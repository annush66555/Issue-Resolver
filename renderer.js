const { ipcRenderer } = require('electron');
const io = require('socket.io-client');

class TwinDeskApp {
    constructor() {
        this.socket = null;
        this.onlineUsers = [];
        this.currentChatPartner = null;
        this.pendingRequests = new Map();
        this.isScreenSharing = false;
        this.isRemoteControlling = false;
        this.remoteCanvas = null;
        this.serverPort = null; // Cache server port to avoid multiple IPC calls
        this.currentPage = 'welcome';
        
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }
    
    initialize() {
        console.log('Initializing TwinDeskApp...');
        this.initializeElements();
        this.bindEvents();
        this.showPage('welcome');
    }

    testConnection() {
        console.log('Test connection called');
        this.showNotification('Button is working! Testing connection...', 'info');
        
        // Simple test - just navigate to dashboard
        const username = this.usernameInput ? this.usernameInput.value.trim() : 'TestUser';
        if (!username) {
            this.showNotification('Please enter a username', 'error');
            return;
        }
        
        this.showNotification('Navigating to dashboard...', 'success');
        this.showPage('dashboard');
    }

    initializeElements() {
        console.log('Initializing elements...');
        
        // Page elements
        this.welcomePage = document.getElementById('welcome-page');
        this.usernamePage = document.getElementById('username-page');
        this.dashboardPage = document.getElementById('dashboard-page');
        this.chatPage = document.getElementById('chat-page');

        // Welcome page elements
        this.startBtn = document.getElementById('start-btn');
        console.log('Start button:', this.startBtn);
        
        // Username page elements
        this.usernameInput = document.getElementById('username-input');
        this.connectBtn = document.getElementById('connect-btn');
        console.log('Username input:', this.usernameInput);
        console.log('Connect button:', this.connectBtn);

        // Dashboard elements
        this.currentUserSpan = document.getElementById('current-user');
        this.usersList = document.getElementById('users-list');
        this.userFilter = document.getElementById('user-filter');
        this.featureBoxes = document.querySelectorAll('.feature-box');

        // Chat elements
        this.backBtn = document.getElementById('back-to-dashboard');
        this.chatPartnerName = document.getElementById('chat-partner-name');
        this.chatStatus = document.getElementById('chat-status');
        this.messagesContainer = document.getElementById('messages-container');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.endChatBtn = document.getElementById('end-chat-btn');

        // Screen sharing elements
        this.screenShareBtn = document.getElementById('screen-share-btn');
        this.remoteControlBtn = document.getElementById('remote-control-btn');
        this.screenShareContainer = document.getElementById('screen-share-container');
        this.stopScreenShareBtn = document.getElementById('stop-screen-share');
        this.stopViewingBtn = document.getElementById('stop-viewing');
        this.screenShareStatus = document.getElementById('screen-share-status');
        this.screenCanvas = document.getElementById('screen-canvas');

        // Modal elements
        this.modalOverlay = document.getElementById('modal-overlay');
        this.chatRequestModal = document.getElementById('chat-request-modal');
        this.screenShareRequestModal = document.getElementById('screen-share-request-modal');
        this.remoteControlRequestModal = document.getElementById('remote-control-request-modal');
        
        // Debug modal elements
        console.log('Modal elements initialized:');
        console.log('modalOverlay:', !!this.modalOverlay);
        console.log('chatRequestModal:', !!this.chatRequestModal);
        console.log('screenShareRequestModal:', !!this.screenShareRequestModal);
        console.log('remoteControlRequestModal:', !!this.remoteControlRequestModal);
        
        // Notification container
        this.notificationContainer = document.getElementById('notification-container');
    }

    bindEvents() {
        // Welcome page events
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.showPage('username'));
        }
        
        // Username page events
        if (this.connectBtn) {
            console.log('Connect button found, adding event listener');
            this.connectBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Connect button clicked!');
                this.connectToServer();
            });
        } else {
            console.error('Connect button not found!');
        }
        if (this.usernameInput) {
            this.usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.connectToServer();
            });
        }

        // Dashboard navigation events
        if (this.userFilter) {
            this.userFilter.addEventListener('input', (e) => this.filterUsers(e.target.value));
        }

        // Chat page events
        if (this.backBtn) {
            this.backBtn.addEventListener('click', () => this.showPage('dashboard'));
        }
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
        }
        if (this.messageInput) {
            this.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMessage();
            });
        }
        if (this.endChatBtn) {
            this.endChatBtn.addEventListener('click', () => this.endChat());
        }

        // File attachment and emoji events
        const fileAttachBtn = document.getElementById('file-attach-btn');
        const emojiBtn = document.getElementById('emoji-btn');
        
        if (fileAttachBtn) {
            fileAttachBtn.addEventListener('click', () => this.openFileDialog());
        }
        if (emojiBtn) {
            emojiBtn.addEventListener('click', () => this.toggleEmojiPicker());
        }

        // Screen sharing events
        if (this.screenShareBtn) {
            this.screenShareBtn.addEventListener('click', () => this.requestScreenShare());
        }
        if (this.remoteControlBtn) {
            this.remoteControlBtn.addEventListener('click', () => this.requestRemoteControl());
        }
        if (this.stopScreenShareBtn) {
            this.stopScreenShareBtn.addEventListener('click', () => this.stopScreenShare());
        }
        if (this.stopViewingBtn) {
            this.stopViewingBtn.addEventListener('click', () => this.stopViewing());
        }

        // Modal events
        const acceptChatBtn = document.getElementById('accept-chat-btn');
        const declineChatBtn = document.getElementById('decline-chat-btn');
        const acceptScreenShareBtn = document.getElementById('accept-screen-share-btn');
        const declineScreenShareBtn = document.getElementById('decline-screen-share-btn');
        const acceptRemoteControlBtn = document.getElementById('accept-remote-control-btn');
        const declineRemoteControlBtn = document.getElementById('decline-remote-control-btn');

        if (acceptChatBtn) acceptChatBtn.addEventListener('click', () => this.respondToChatRequest(true));
        if (declineChatBtn) declineChatBtn.addEventListener('click', () => this.respondToChatRequest(false));
        if (acceptScreenShareBtn) acceptScreenShareBtn.addEventListener('click', () => this.respondToScreenShareRequest(true));
        if (declineScreenShareBtn) declineScreenShareBtn.addEventListener('click', () => this.respondToScreenShareRequest(false));
        if (acceptRemoteControlBtn) acceptRemoteControlBtn.addEventListener('click', () => this.respondToRemoteControlRequest(true));
        if (declineRemoteControlBtn) declineRemoteControlBtn.addEventListener('click', () => this.respondToRemoteControlRequest(false));

        // Screen canvas events for remote control
        if (this.screenCanvas) {
            this.screenCanvas.addEventListener('click', (e) => this.handleRemoteClick(e));
            this.screenCanvas.addEventListener('mousemove', (e) => this.handleRemoteMouseMove(e));
        }
    }

    showPage(pageId) {
        // Hide all pages
        if (this.welcomePage) this.welcomePage.style.display = 'none';
        if (this.usernamePage) this.usernamePage.style.display = 'none';
        if (this.dashboardPage) this.dashboardPage.style.display = 'none';
        if (this.chatPage) this.chatPage.style.display = 'none';

        // Show the requested page
        this.currentPage = pageId;
        switch (pageId) {
            case 'welcome':
                if (this.welcomePage) this.welcomePage.style.display = 'flex';
                break;
            case 'username':
                if (this.usernamePage) this.usernamePage.style.display = 'flex';
                break;
            case 'dashboard':
                if (this.dashboardPage) this.dashboardPage.style.display = 'flex';
                break;
            case 'chat':
                if (this.chatPage) this.chatPage.style.display = 'flex';
                break;
        }
    }

    filterUsers(searchTerm) {
        const userItems = this.usersList.querySelectorAll('.user-item');
        userItems.forEach(item => {
            const username = item.querySelector('.user-name').textContent.toLowerCase();
            const isVisible = username.includes(searchTerm.toLowerCase());
            item.style.display = isVisible ? 'flex' : 'none';
        });
    }

    async connectToServer() {
        const username = this.usernameInput.value.trim();
        console.log('Username:', username);
        
        if (!username) {
            this.showNotification('Please enter a username', 'error');
            return;
        }

        // Prevent multiple connections
        if (this.socket && this.socket.connected) {
            console.log('Already connected to server');
            this.showNotification('Already connected', 'warning');
            return;
        }

        // Disconnect existing socket if any
        if (this.socket) {
            console.log('Disconnecting existing socket...');
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }

        try {
            console.log('Starting connection process...');
            this.showNotification('Connecting...', 'info');
            
            // Wait a moment for server to be ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get the dynamic port from the main process via IPC (only once)
            if (!this.serverPort) {
                console.log('Requesting server port via IPC...');
                this.serverPort = await ipcRenderer.invoke('get-server-port');
                console.log(`Received port from IPC: ${this.serverPort}`);
            }
            
            if (!this.serverPort) {
                console.error('No port received from server');
                throw new Error('Server not ready. Please try again in a moment.');
            }
            
            // Connect to the server with better configuration
            console.log(`Attempting to connect to http://localhost:${this.serverPort}`);
            this.socket = io(`http://localhost:${this.serverPort}`, {
                timeout: 10000,
                forceNew: true,
                transports: ['polling', 'websocket'],
                upgrade: true,
                rememberUpgrade: false
            });
            this.currentUser = { username, id: null };
            console.log('Socket created, waiting for connection...');

            this.socket.on('connect', () => {
                console.log('=== CONNECTED TO SERVER ===');
                console.log('Socket ID:', this.socket.id);
                console.log('Username:', username);
                this.currentUser.id = this.socket.id;
                this.socket.emit('user-join', { username });
                this.updateDashboardUsername(username);
                this.showPage('dashboard');
                this.updateDashboardUI();
                this.showNotification('Connected successfully!', 'success');
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                // Only show connection errors if we're not already connected
                if (!this.socket.connected) {
                    this.showNotification(`Failed to connect to server`, 'error');
                }
            });

            this.socket.on('disconnect', (reason) => {
                console.log('Disconnected from server. Reason:', reason);
                // Don't show error notification for normal disconnects
                if (reason !== 'io client disconnect' && reason !== 'transport close') {
                    this.showNotification('Connection lost', 'warning');
                }
            });

            this.socket.on('users-update', (users) => {
                console.log('=== USERS UPDATE EVENT ===');
                console.log('Received users-update event:', users);
                console.log('Current user ID for filtering:', this.currentUser?.id);
                console.log('Current user object:', this.currentUser);
                
                // Filter out current user and store
                this.onlineUsers = users.filter(user => user.id !== this.currentUser?.id);
                console.log('Filtered online users:', this.onlineUsers);
                console.log('Number of online users after filtering:', this.onlineUsers.length);
                
                // Update the users list display
                this.updateUsersList(this.onlineUsers);
                
                // Force UI update
                this.updateDashboardUI();
            });

            this.socket.on('user-joined', (data) => {
                console.log('=== USER JOINED EVENT ===');
                console.log('User joined data:', data);
                this.showNotification(`${data.username} joined`, 'info');
                // Don't manually update users list - let users-update handle it
            });

            this.socket.on('user-left', (data) => {
                console.log('User left:', data);
                this.showNotification(`${data.username} left`, 'info');
                // Don't manually update users list - let users-update handle it
            });

            this.socket.on('chat-request', (data) => {
                console.log('Client received chat-request event:', data);
                this.handleChatRequest(data);
            });

            this.socket.on('chat-request-response', (data) => {
                this.handleChatRequestResponse(data);
            });

            this.socket.on('message', (data) => {
                this.handleMessage(data);
            });

            this.socket.on('screen-share-request', (data) => {
                this.handleScreenShareRequest(data);
            });

            this.socket.on('screen-share-response', (data) => {
                this.handleScreenShareResponse(data);
            });

            this.socket.on('remote-control-request', (data) => {
                this.handleRemoteControlRequest(data);
            });

            this.socket.on('remote-control-response', (data) => {
                this.handleRemoteControlResponse(data);
            });

            this.socket.on('screen-sharing-started', () => {
                // Enable remote control button when screen sharing starts
                if (this.remoteControlBtn) {
                    this.remoteControlBtn.style.display = 'inline-flex';
                    this.remoteControlBtn.textContent = '🖱️ Request Control';
                    this.remoteControlBtn.disabled = false;
                }
            });

            this.socket.on('screen-sharing-stopped', () => {
                this.handleScreenSharingStopped();
            });

            this.socket.on('viewing-stopped', () => {
                this.handleViewingStopped();
            });

            this.socket.on('screen-data', (data) => {
                this.handleScreenData(data);
            });

            this.socket.on('end-session', (data) => {
                this.handleEndSession(data);
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                this.showNotification('Disconnected from server', 'error');
            });

            this.socket.on('error', (error) => {
                console.error('Socket error:', error);
                this.showNotification('Connection error occurred', 'error');
            });
        } catch (error) {
            console.error('Error joining chat:', error);
            this.showNotification(error.message || 'Failed to connect to server', 'error');
        }
    }

    updateDashboardUI() {
        console.log('=== updateDashboardUI called ===');
        console.log('Current page:', this.currentPage);
        console.log('usersList element:', this.usersList);
        console.log('Online users:', this.onlineUsers);
        
        if (this.currentUserSpan && this.currentUser) {
            this.currentUserSpan.textContent = this.currentUser.username;
        }
        if (this.statusIndicator) {
            this.statusIndicator.className = 'status-indicator online';
        }
        
        // Update users list on dashboard
        this.updateUsersList(this.onlineUsers);
    }

    updateDashboardUsername(username) {
        const welcomeUsername = document.getElementById('welcome-username');
        const currentUserDisplay = document.getElementById('current-user-display');
        
        if (welcomeUsername) {
            welcomeUsername.textContent = username;
        }
        if (currentUserDisplay) {
            currentUserDisplay.textContent = username;
        }
    }

    updateUsersList(users) {
        console.log('=== updateUsersList called ===');
        console.log('this.usersList element:', this.usersList);
        
        if (!this.usersList) {
            console.error('usersList element not found! Re-initializing...');
            this.usersList = document.getElementById('users-list');
            console.log('Re-initialized usersList:', this.usersList);
            if (!this.usersList) {
                console.error('Still cannot find users-list element!');
                return;
            }
        }
        
        this.usersList.innerHTML = '';
        const noUsersPlaceholder = document.getElementById('no-users-placeholder');
        
        // Debug logging
        console.log('All users:', users);
        console.log('Current user:', this.currentUser);
        
        // Deduplicate users by username and filter out current user
        const uniqueUsers = new Map();
        users.forEach(user => {
            if (user.id !== this.currentUser?.id && !uniqueUsers.has(user.username)) {
                uniqueUsers.set(user.username, user);
            }
        });
        
        const otherUsers = Array.from(uniqueUsers.values());
        console.log('Other users after filtering and deduplication:', otherUsers);
        
        console.log('Number of other users to display:', otherUsers.length);
        
        if (otherUsers.length === 0) {
            if (noUsersPlaceholder) {
                noUsersPlaceholder.style.display = 'block';
                console.log('Showing no users placeholder');
            }
        } else {
            if (noUsersPlaceholder) {
                noUsersPlaceholder.style.display = 'none';
                console.log('Hiding no users placeholder');
            }
            
            console.log('Creating user elements...');
            otherUsers.forEach(user => {
                console.log('Creating element for user:', user);
                const userElement = this.createUserElement(user);
                this.usersList.appendChild(userElement);
                console.log('Added user element for:', user.username);
            });
            
            console.log('Final usersList innerHTML:', this.usersList.innerHTML);
        }
    }

    createUserElement(user) {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.innerHTML = `
            <div class="user-avatar">
                ${user.username.charAt(0).toUpperCase()}
            </div>
            <div class="user-details">
                <h4>${user.username}</h4>
                <p class="user-status-text">
                    <span class="status-dot online"></span>
                    Online
                </p>
            </div>
            <button class="btn btn-follow">
                Follow
            </button>
        `;
        
        // Add event listener properly to avoid multiple bindings
        const followBtn = userDiv.querySelector('.btn-follow');
        followBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Follow button clicked for:', user.username);
            this.followUser(user.id, user.username);
        });
        
        return userDiv;
    }

    followUser(targetUserId, targetUsername) {
        // Send chat request when following a user
        this.sendChatRequest(targetUserId, targetUsername);
    }

    sendChatRequest(targetUserId, targetUsername) {
        // Check if there's already a pending request to this user
        const existingRequest = Array.from(this.pendingRequests.values())
            .find(req => req.type === 'chat' && req.targetUserId === targetUserId);
        
        if (existingRequest) {
            console.log('Chat request already pending for:', targetUsername);
            this.showNotification(`Chat request already sent to ${targetUsername}`, 'warning');
            return;
        }
        
        // Check if already in chat with this user
        if (this.currentChatPartner && this.currentChatPartner.id === targetUserId) {
            console.log('Already in chat with:', targetUsername);
            this.showNotification(`Already chatting with ${targetUsername}`, 'info');
            return;
        }
        
        const requestId = this.generateId();
        const requestData = {
            requestId: requestId,
            targetUserId: targetUserId,
            targetUsername: targetUsername,
            type: 'chat'
        };
        
        // Store pending request with timestamp to prevent spam
        this.pendingRequests.set(requestId, {
            ...requestData,
            timestamp: Date.now()
        });
        
        // Clean up old pending requests (older than 30 seconds)
        this.cleanupOldRequests();
        
        console.log('=== SENDING CHAT REQUEST ===');
        console.log('Sending chat request:', requestData);
        console.log('Socket connected:', this.socket.connected);
        this.socket.emit('chat-request', requestData);
        this.showNotification(`Chat request sent to ${targetUsername}`, 'success');
    }

    cleanupOldRequests() {
        const now = Date.now();
        const maxAge = 30000; // 30 seconds
        
        for (const [requestId, request] of this.pendingRequests.entries()) {
            if (request.timestamp && (now - request.timestamp) > maxAge) {
                console.log('Cleaning up old request:', requestId);
                this.pendingRequests.delete(requestId);
            }
        }
    }

    handleChatRequest(data) {
        console.log('=== CHAT REQUEST RECEIVED ===');
        console.log('Chat request data:', data);
        
        this.pendingRequests.set(data.requestId, { 
            type: 'chat', 
            fromUserId: data.fromUserId, 
            fromUsername: data.fromUsername,
            requestId: data.requestId
        });
        
        console.log('Stored pending request:', this.pendingRequests.get(data.requestId));
        
        const messageElement = document.getElementById('chat-request-message');
        console.log('chat-request-message element found:', !!messageElement);
        
        if (messageElement) {
            messageElement.textContent = `${data.fromUsername} wants to start a chat with you`;
            console.log('Updated message element text');
        }
        
        console.log('Showing chat request modal...');
        this.showModal('chat-request-modal');
    }

    respondToChatRequest(accepted) {
        console.log('=== RESPONDING TO CHAT REQUEST ===');
        console.log('Accepted:', accepted);
        console.log('All pending requests:', Array.from(this.pendingRequests.entries()));
        
        const activeRequest = Array.from(this.pendingRequests.values())
            .find(req => req.type === 'chat' && req.fromUserId);
        
        console.log('Found active request:', activeRequest);
        
        if (!activeRequest) {
            console.log('No active chat request found!');
            return;
        }

        const requestId = Array.from(this.pendingRequests.entries())
            .find(([id, req]) => req === activeRequest)?.[0];

        console.log('Request ID:', requestId);

        const responseData = {
            targetUserId: activeRequest.fromUserId,
            accepted,
            requestId
        };
        
        console.log('Sending chat request response:', responseData);
        this.socket.emit('chat-request-response', responseData);

        if (accepted) {
            console.log('Starting chat with:', activeRequest.fromUsername);
            this.startChat(activeRequest.fromUserId, activeRequest.fromUsername);
        }

        this.pendingRequests.delete(requestId);
        this.hideModal();
        console.log('Chat request response completed');
    }

    handleChatRequestResponse(data) {
        const request = this.pendingRequests.get(data.requestId);
        if (!request) return;

        if (data.accepted) {
            this.startChat(request.targetUserId, request.targetUsername);
            this.showNotification('Chat request accepted!', 'success');
        } else {
            this.showNotification('Chat request declined', 'warning');
        }

        this.pendingRequests.delete(data.requestId);
    }

    startChat(partnerId, partnerName) {
        this.currentChatPartner = { id: partnerId, username: partnerName };
        this.chatHistory = [];
        
        this.showPage('chat');
        
        // Show current user's username at top of chat section
        if (this.chatPartnerName) this.chatPartnerName.textContent = this.currentUser.username;
        if (this.chatStatus) this.chatStatus.textContent = 'Online';
        
        // Update chat user avatar with current user's initial
        const chatUserAvatar = document.getElementById('chat-user-avatar');
        if (chatUserAvatar && this.currentUser.username) {
            chatUserAvatar.textContent = this.currentUser.username.charAt(0).toUpperCase();
        }
        
        // Populate sidebar with online users
        this.populateChatSidebar();
        
        if (this.messageInput) this.messageInput.focus();
    }

    populateChatSidebar() {
        const sidebarUsersList = document.getElementById('sidebar-users-list');
        if (!sidebarUsersList) return;

        sidebarUsersList.innerHTML = '';

        if (this.onlineUsers.length === 0) {
            sidebarUsersList.innerHTML = '<div class="no-users-message">No online users</div>';
            return;
        }

        this.onlineUsers.forEach(user => {
            const userElement = this.createSidebarUserElement(user);
            sidebarUsersList.appendChild(userElement);
        });
    }

    createSidebarUserElement(user) {
        const userDiv = document.createElement('div');
        userDiv.className = 'sidebar-user-item';
        userDiv.innerHTML = `
            <div class="sidebar-user-avatar">
                ${user.username.charAt(0).toUpperCase()}
            </div>
            <div class="sidebar-user-details">
                <h4>${user.username}</h4>
                <p class="sidebar-user-status">
                    <span class="status-dot online"></span>
                    Online
                </p>
            </div>
        `;
        
        // Add click handler to switch chat partner
        userDiv.addEventListener('click', () => {
            this.switchChatPartner(user.id, user.username);
        });
        
        return userDiv;
    }

    switchChatPartner(userId, username) {
        // Update chat header with new partner
        document.getElementById('chat-partner-name').textContent = username;
        const chatUserAvatar = document.getElementById('chat-user-avatar');
        if (chatUserAvatar) {
            chatUserAvatar.textContent = username.charAt(0).toUpperCase();
        }
        
        // Clear messages for new chat
        const messagesContainer = document.getElementById('messages-container');
        messagesContainer.innerHTML = '';
        
        // Update current chat partner
        this.currentChatPartner = { id: userId, username: username };
        
        // Show notification
        this.showNotification(`Switched to chat with ${username}`, 'info');
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.currentChatPartner) return;

        const messageData = {
            id: this.generateId(),
            text: message,
            sender: this.currentUser.username,
            senderId: this.currentUser.id,
            targetUserId: this.currentChatPartner.id,
            timestamp: new Date().toISOString()
        };

        this.socket.emit('message', messageData);
        this.addMessageToChat(messageData, true);
        this.chatHistory.push(messageData);
        
        this.messageInput.value = '';
    }

    handleMessage(data) {
        this.addMessageToChat(data, false);
        this.chatHistory.push(data);
    }

    addMessageToChat(messageData, isSent) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
        
        const timestamp = new Date(messageData.timestamp).toLocaleTimeString();
        
        if (messageData.type === 'file') {
            // Handle file messages
            const fileSize = this.formatFileSize(messageData.fileSize);
            messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="file-message">
                        <div class="file-icon">📎</div>
                        <div class="file-details">
                            <div class="file-name">${messageData.fileName}</div>
                            <div class="file-size">${fileSize}</div>
                        </div>
                        ${messageData.fileData ? `<button class="download-btn" onclick="app.downloadFile('${messageData.fileData}', '${messageData.fileName}')">Download</button>` : ''}
                    </div>
                    <div class="message-info">${timestamp}</div>
                </div>
            `;
        } else {
            // Handle text messages
            messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="message-text">${messageData.text}</div>
                    <div class="message-info">${timestamp}</div>
                </div>
            `;
        }
        
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    downloadFile(fileData, fileName) {
        const link = document.createElement('a');
        link.href = fileData;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.showNotification(`Downloaded: ${fileName}`, 'success');
    }

    async requestScreenShare() {
        if (!this.currentChatPartner) {
            this.showNotification('No active chat session', 'error');
            return;
        }

        try {
            const sources = await ipcRenderer.invoke('get-desktop-sources');
            if (sources.length === 0) {
                this.showNotification('No screen sources available', 'error');
                return;
            }

            // Use the first screen source (primary display)
            const source = sources.find(s => s.name === 'Entire Screen') || sources[0];
            
            const requestId = this.generateId();
            this.pendingRequests.set(requestId, { 
                type: 'screen-share', 
                targetUserId: this.currentChatPartner.id,
                source 
            });

            this.socket.emit('screen-share-request', {
                targetUserId: this.currentChatPartner.id,
                requestId
            });

            this.showNotification('Screen share request sent', 'success');
        } catch (error) {
            console.error('Error requesting screen share:', error);
            this.showNotification('Failed to request screen share', 'error');
        }
    }

    handleScreenShareRequest(data) {
        this.pendingRequests.set(data.requestId, {
            type: 'screen-share',
            fromUserId: data.fromUserId,
            fromUsername: data.fromUsername
        });

        document.getElementById('screen-share-request-message').textContent = 
            `${data.fromUsername} wants to share their screen with you`;
        this.showModal('screen-share-request-modal');
    }

    respondToScreenShareRequest(accepted) {
        const activeRequest = Array.from(this.pendingRequests.values())
            .find(req => req.type === 'screen-share' && req.fromUserId);
        
        if (!activeRequest) return;

        const requestId = Array.from(this.pendingRequests.entries())
            .find(([id, req]) => req === activeRequest)?.[0];

        this.socket.emit('screen-share-response', {
            targetUserId: activeRequest.fromUserId,
            accepted,
            requestId
        });

        if (accepted) {
            this.prepareForScreenViewing();
        }

        this.pendingRequests.delete(requestId);
        this.hideModal();
    }

    handleScreenShareResponse(data) {
        const request = this.pendingRequests.get(data.requestId);
        if (!request) return;

        if (data.accepted) {
            this.startScreenSharing(request.source);
            this.showNotification('Screen sharing started!', 'success');
        } else {
            this.showNotification('Screen share request declined', 'warning');
        }

        this.pendingRequests.delete(data.requestId);
    }

    async startScreenSharing(source) {
        try {
            this.screenStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: source.id,
                        minWidth: 1280,
                        maxWidth: 1920,
                        minHeight: 720,
                        maxHeight: 1080
                    }
                }
            });

            this.isScreenSharing = true;
            this.screenShareContainer.style.display = 'flex';
            this.messagesContainer.style.display = 'none';
            this.screenShareBtn.textContent = '🖥️ Sharing Screen';
            this.screenShareBtn.disabled = true;
            
            // Update status and show appropriate buttons for sharer
            if (this.screenShareStatus) {
                this.screenShareStatus.textContent = 'Sharing Your Screen';
            }
            
            // Show stop sharing button for the sharer
            if (this.stopScreenShareBtn) {
                this.stopScreenShareBtn.style.display = 'inline-block';
            }
            
            // Hide stop viewing button (sharer doesn't view)
            if (this.stopViewingBtn) {
                this.stopViewingBtn.style.display = 'none';
            }
            
            // Hide remote control button for the sharer
            this.remoteControlBtn.style.display = 'none';
            
            // Notify the other user that screen sharing has started
            if (this.currentChatPartner) {
                this.socket.emit('screen-sharing-started', {
                    targetUserId: this.currentChatPartner.id
                });
            }

            // Start capturing and sending screen data
            this.captureScreenData();
        } catch (error) {
            console.error('Error starting screen share:', error);
            this.showNotification('Failed to start screen sharing', 'error');
        }
    }

    prepareForScreenViewing() {
        this.screenShareContainer.style.display = 'flex';
        this.messagesContainer.style.display = 'none';
        
        // Update status and show appropriate buttons for viewer
        if (this.screenShareStatus) {
            this.screenShareStatus.textContent = 'Viewing Shared Screen';
        }
        
        // Show stop viewing button for the viewer
        if (this.stopViewingBtn) {
            this.stopViewingBtn.style.display = 'inline-block';
        }
        
        // Hide stop sharing button (viewer doesn't share)
        if (this.stopScreenShareBtn) {
            this.stopScreenShareBtn.style.display = 'none';
        }
        
        // Only show remote control button if not already in a remote control session
        if (!this.isRemoteControlling) {
            this.remoteControlBtn.style.display = 'inline-flex';
            this.remoteControlBtn.textContent = '🖱️ Request Control';
            this.remoteControlBtn.disabled = false;
        }
    }

    captureScreenData() {
        if (!this.isScreenSharing || !this.screenStream) return;

        const video = document.createElement('video');
        video.srcObject = this.screenStream;
        video.play();

        video.onloadedmetadata = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const captureFrame = () => {
                if (!this.isScreenSharing) return;

                ctx.drawImage(video, 0, 0);
                const imageData = canvas.toDataURL('image/jpeg', 0.7);

                this.socket.emit('screen-data', {
                    targetUserId: this.currentChatPartner.id,
                    imageData,
                    width: canvas.width,
                    height: canvas.height
                });

                setTimeout(captureFrame, 100); // 10 FPS
            };

            captureFrame();
        };
    }

    handleScreenData(data) {
        const img = new Image();
        img.onload = () => {
            const ctx = this.screenCanvas.getContext('2d');
            this.screenCanvas.width = data.width;
            this.screenCanvas.height = data.height;
            ctx.drawImage(img, 0, 0);
        };
        img.src = data.imageData;
    }

    stopScreenShare() {
        // Notify the other user that screen sharing has stopped
        if (this.currentChatPartner) {
            this.socket.emit('screen-sharing-stopped', {
                targetUserId: this.currentChatPartner.id
            });
        }

        // Stop the screen stream if it exists
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }

        // Reset screen sharing state
        this.isScreenSharing = false;
        
        // Update UI - ensure proper chat alignment is restored
        this.screenShareContainer.style.display = 'none';
        this.messagesContainer.style.display = 'flex';
        this.messagesContainer.style.flexDirection = 'column';
        
        // Reset screen share button
        if (this.screenShareBtn) {
            this.screenShareBtn.textContent = '🖥️ Share Screen';
            this.screenShareBtn.disabled = false;
        }
        
        // Hide both stop buttons
        if (this.stopScreenShareBtn) {
            this.stopScreenShareBtn.style.display = 'none';
        }
        if (this.stopViewingBtn) {
            this.stopViewingBtn.style.display = 'none';
        }
        
        // If we were being remotely controlled, end that too
        if (this.isRemoteControlling) {
            this.endRemoteControl();
        }
        
        // Force reflow to ensure proper layout
        this.messagesContainer.offsetHeight;
        
        this.showNotification('Screen sharing stopped', 'info');
    }

    requestRemoteControl() {
        if (!this.currentChatPartner) return;

        const requestId = this.generateId();
        this.pendingRequests.set(requestId, {
            type: 'remote-control',
            targetUserId: this.currentChatPartner.id
        });

        this.socket.emit('remote-control-request', {
            targetUserId: this.currentChatPartner.id,
            requestId
        });

        this.showNotification('Remote control request sent', 'success');
    }

    handleRemoteControlRequest(data) {
        this.pendingRequests.set(data.requestId, {
            type: 'remote-control',
            fromUserId: data.fromUserId,
            fromUsername: data.fromUsername
        });

        document.getElementById('remote-control-request-message').textContent = 
            `${data.fromUsername} wants to control your screen`;
        this.showModal('remote-control-request-modal');
    }

    respondToRemoteControlRequest(accepted) {
        const activeRequest = Array.from(this.pendingRequests.values())
            .find(req => req.type === 'remote-control' && req.fromUserId);
        
        if (!activeRequest) return;

        const requestId = Array.from(this.pendingRequests.entries())
            .find(([id, req]) => req === activeRequest)?.[0];

        this.socket.emit('remote-control-response', {
            targetUserId: activeRequest.fromUserId,
            accepted,
            requestId
        });

        if (accepted) {
            this.isRemoteControlling = false; // We're being controlled
            this.showNotification('Remote control access granted', 'success');
        }

        this.pendingRequests.delete(requestId);
        this.hideModal();
    }

    handleRemoteControlResponse(data) {
        const request = this.pendingRequests.get(data.requestId);
        if (!request) return;

        if (data.accepted) {
            this.isRemoteControlling = true;
            this.remoteControlBtn.textContent = '🖱️ Controlling';
            this.remoteControlBtn.disabled = true;
            this.showNotification('Remote control granted!', 'success');
        } else {
            this.showNotification('Remote control request declined', 'warning');
        }

        this.pendingRequests.delete(data.requestId);
    }

    handleRemoteClick(event) {
        if (!this.isRemoteControlling) return;

        const rect = this.screenCanvas.getBoundingClientRect();
        const scaleX = this.screenCanvas.width / rect.width;
        const scaleY = this.screenCanvas.height / rect.height;
        
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        this.socket.emit('remote-control-action', {
            targetUserId: this.currentChatPartner.id,
            action: 'click',
            x: Math.round(x),
            y: Math.round(y)
        });
    }

    handleRemoteMouseMove(event) {
        if (!this.isRemoteControlling) return;
        // Mouse move events can be implemented similarly to clicks
    }

    async handleRemoteControlAction(data) {
        if (data.action === 'click') {
            try {
                await ipcRenderer.invoke('simulate-mouse-click', data.x, data.y);
            } catch (error) {
                console.error('Error simulating mouse click:', error);
            }
        }
    }

    async endChat() {
        console.log('=== END CHAT CALLED ===');
        console.log('Current chat partner:', this.currentChatPartner);
        console.log('Chat history length:', this.chatHistory.length);
        
        let chatSaved = false;
        const partnerName = this.currentChatPartner?.username || 'the other user';
        
        // Save chat history if there are messages
        if (this.chatHistory.length > 0 && this.currentChatPartner) {
            try {
                console.log('Attempting to save chat history...');
                const chatData = {
                    chatData: {
                        messages: this.chatHistory,
                        timestamp: new Date().toISOString()
                    },
                    username: this.currentUser.username,
                    partner: this.currentChatPartner.username
                };
                
                console.log('Chat data to save:', chatData);
                const result = await ipcRenderer.invoke('save-chat-history', chatData);
                console.log('Save result:', result);
                
                if (result && result.success) {
                    console.log('Chat history saved successfully:', result.filePath);
                    chatSaved = true;
                } else {
                    const error = result ? result.error : 'Unknown error';
                    console.error('Failed to save chat history:', error);
                }
            } catch (error) {
                console.error('Error saving chat history:', error);
            }
        } else {
            console.log('No chat history to save');
        }

        // Notify the other user that the session is ending
        if (this.currentChatPartner && this.socket && this.socket.connected) {
            console.log('Notifying other user about session end...');
            this.socket.emit('end-session', {
                targetUserId: this.currentChatPartner.id,
                fromUser: this.currentUser?.username || 'User',
                timestamp: new Date().toISOString(),
                endedByUser: true
            });
        }

        // Stop screen sharing and remote control
        if (this.isScreenSharing) {
            this.stopScreenShare();
        }
        
        if (this.isRemoteControlling) {
            this.endRemoteControl();
        }

        // Reset all session states
        this.resetSessionState();

        // Navigate back to dashboard
        this.showPage('dashboard');

        // Show appropriate notification
        if (chatSaved) {
            this.showNotification('Chat history saved - Session ended', 'success');
        } else {
            this.showNotification(`Session with ${partnerName} ended`, 'info');
        }
        
        console.log('End chat completed');
    }

    async endSession() {
        // Save chat history before ending the session
        if (this.currentChatPartner && this.chatHistory.length > 0) {
            try {
                const chatData = {
                    chatData: {
                        messages: this.chatHistory,
                        timestamp: new Date().toISOString()
                    },
                    username: this.currentUser.username,
                    partner: this.currentChatPartner.username
                };
                
                const result = await ipcRenderer.invoke('save-chat-history', chatData);
                
                if (result && result.success) {
                    console.log('Chat history saved successfully:', result.filePath);
                } else {
                    console.error('Failed to save chat history:', result ? result.error : 'Unknown error');
                }
            } catch (error) {
                console.error('Error saving chat history:', error);
            }
        }

        // Notify the other user that the session is ending
        if (this.currentChatPartner) {
            this.socket.emit('end-session', {
                targetUserId: this.currentChatPartner.id,
                fromUser: this.currentUser?.username || 'User',
                timestamp: new Date().toISOString()
            });
        }

        // Stop any ongoing screen sharing or remote control
        if (this.isScreenSharing) {
            this.stopScreenShare();
        }
        
        if (this.isRemoteControlling) {
            this.endRemoteControl();
        }

        // Get partner name before resetting the state
        const partnerName = this.currentChatPartner?.username || 'the other user';
        
        // Reset all chat-related states
        this.currentChatPartner = null;
        this.chatHistory = [];
        this.pendingRequests.clear();
        
        // Clear the messages container
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '';
        }
        
        // Reset UI elements
        if (this.chatPartnerName) {
            this.chatPartnerName.textContent = 'Select a user to chat';
        }
        
        if (this.chatStatus) {
            this.chatStatus.textContent = 'Not in a chat';
            this.chatStatus.className = 'chat-status offline';
        }
        
        // Hide remote control button if visible
        if (this.remoteControlBtn) {
            this.remoteControlBtn.style.display = 'none';
        }
        
        // Show dashboard page
        this.showPage('dashboard');
        
        // Show appropriate notification based on whether chat history was saved
        if (this.chatHistory.length > 0) {
            this.showNotification('Chat history saved successfully', 'success');
        } else {
            this.showNotification(`Session with ${partnerName} has ended`, 'info');
        }
    }

    openFileDialog() {
        // Create file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '*/*';
        fileInput.multiple = true;
        
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                this.handleFileAttachment(files);
            }
        });
        
        fileInput.click();
    }

    handleFileAttachment(files) {
        if (!this.currentChatPartner) {
            this.showNotification('No active chat session', 'error');
            return;
        }

        files.forEach(file => {
            // Check file size limit (10MB)
            const maxFileSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxFileSize) {
                this.showNotification(`File too large: ${file.name}. Maximum size is 10MB.`, 'error');
                return;
            }

            // Check if it's an image and compress if needed
            if (file.type.startsWith('image/')) {
                this.compressAndSendImage(file);
            } else {
                // Read non-image files as base64 for transmission
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.handleFileData(e.target.result, file);
                };
                reader.onerror = () => {
                    this.showNotification(`Failed to read file: ${file.name}`, 'error');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    compressAndSendImage(file) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Calculate new dimensions (max 1920x1080)
            let { width, height } = img;
            const maxWidth = 1920;
            const maxHeight = 1080;
            
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to base64 with compression
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% quality
            
            console.log(`Image compressed: ${file.name}`);
            console.log(`Original: ${this.formatFileSize(file.size)}`);
            console.log(`Compressed: ${this.formatFileSize(compressedDataUrl.length)}`);
            
            this.handleFileData(compressedDataUrl, file);
        };
        
        img.onerror = () => {
            this.showNotification(`Failed to process image: ${file.name}`, 'error');
        };
        
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    handleFileData(fileData, file) {
        try {
            const base64Size = fileData.length;
            const originalSize = file.size;
            
            console.log(`File: ${file.name}`);
            console.log(`Original size: ${this.formatFileSize(originalSize)}`);
            console.log(`Base64 size: ${this.formatFileSize(base64Size)}`);
            console.log(`Size increase: ${((base64Size - originalSize) / originalSize * 100).toFixed(1)}%`);
            
            // Check if base64 encoded size is too large (Socket.IO has ~1MB default message limit)
            const maxBase64Size = 5 * 1024 * 1024; // 5MB base64 limit
            if (base64Size > maxBase64Size) {
                this.showNotification(`File too large after encoding: ${file.name}. Try a smaller file.`, 'error');
                return;
            }
            
            const fileMessage = {
                id: this.generateId(),
                type: 'file',
                fileName: file.name,
                fileSize: file.size,
                fileData: fileData,
                sender: this.currentUser.username,
                senderId: this.currentUser.id,
                targetUserId: this.currentChatPartner.id,
                timestamp: new Date().toISOString()
            };
            
            console.log(`Sending file: ${file.name}, Original: ${this.formatFileSize(file.size)}, Encoded: ${this.formatFileSize(base64Size)}`);
            
            // Send file message to other user
            this.socket.emit('message', fileMessage);
            
            // Display in own chat
            this.addMessageToChat(fileMessage, true);
            this.chatHistory.push(fileMessage);
            
            this.showNotification(`File sent: ${file.name}`, 'success');
        } catch (error) {
            console.error('Error sending file:', error);
            this.showNotification(`Failed to send file: ${file.name}`, 'error');
        }
    }

    toggleEmojiPicker() {
        // Simple emoji picker implementation
        const emojis = ['😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🎉', '🔥', '💯', '😎', '🙄', '😢', '😡', '🤝', '👋', '🎯', '⚡', '🌟', '💪'];
        
        // Create or toggle emoji picker
        let emojiPicker = document.getElementById('emoji-picker');
        
        if (emojiPicker) {
            emojiPicker.remove();
            return;
        }
        
        emojiPicker = document.createElement('div');
        emojiPicker.id = 'emoji-picker';
        emojiPicker.className = 'emoji-picker';
        
        emojis.forEach(emoji => {
            const emojiBtn = document.createElement('button');
            emojiBtn.textContent = emoji;
            emojiBtn.className = 'emoji-btn-item';
            emojiBtn.addEventListener('click', () => {
                this.insertEmoji(emoji);
                emojiPicker.remove();
            });
            emojiPicker.appendChild(emojiBtn);
        });
        
        // Position picker above input
        const messageInputArea = document.querySelector('.message-input-area');
        messageInputArea.appendChild(emojiPicker);
    }

    insertEmoji(emoji) {
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            const cursorPos = messageInput.selectionStart;
            const textBefore = messageInput.value.substring(0, cursorPos);
            const textAfter = messageInput.value.substring(cursorPos);
            messageInput.value = textBefore + emoji + textAfter;
            messageInput.focus();
            messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
        }
    }

    stopViewing() {
        // Notify the other user that viewing has stopped
        if (this.currentChatPartner) {
            this.socket.emit('viewing-stopped', {
                targetUserId: this.currentChatPartner.id,
                fromUser: this.currentUser?.username || 'User'
            });
        }

        // Reset viewing state and restore chat alignment
        this.handleViewingStopped();
        this.showNotification('Stopped viewing screen', 'info');
    }

    handleScreenSharingStopped() {
        // Reset the UI when screen sharing stops
        this.screenShareContainer.style.display = 'none';
        this.messagesContainer.style.display = 'flex';
        
        // Hide remote control button
        if (this.remoteControlBtn) {
            this.remoteControlBtn.style.display = 'none';
        }
        
        // Reset screen share button if it exists
        if (this.screenShareBtn) {
            this.screenShareBtn.textContent = '🖥️ Share Screen';
            this.screenShareBtn.disabled = false;
        }
        
        // Hide both stop buttons
        if (this.stopScreenShareBtn) {
            this.stopScreenShareBtn.style.display = 'none';
        }
        if (this.stopViewingBtn) {
            this.stopViewingBtn.style.display = 'none';
        }
        
        this.showNotification('Screen sharing stopped', 'info');
    }

    handleViewingStopped() {
        // Reset the UI when viewing stops and restore proper chat alignment
        this.screenShareContainer.style.display = 'none';
        this.messagesContainer.style.display = 'flex';
        this.messagesContainer.style.flexDirection = 'column';
        
        // Hide remote control button
        if (this.remoteControlBtn) {
            this.remoteControlBtn.style.display = 'none';
        }
        
        // Hide both stop buttons
        if (this.stopScreenShareBtn) {
            this.stopScreenShareBtn.style.display = 'none';
        }
        if (this.stopViewingBtn) {
            this.stopViewingBtn.style.display = 'none';
        }
        
        // Force reflow to ensure proper layout
        this.messagesContainer.offsetHeight;
        
        // Scroll to bottom to maintain chat position
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        
        this.showNotification('Viewing has ended', 'info');
    }

    endRemoteControl() {
        this.isRemoteControlling = false;
        if (this.remoteControlBtn) {
            this.remoteControlBtn.textContent = '🖱️ Request Control';
            this.remoteControlBtn.disabled = false;
        }
    }

    resetSessionState() {
        // Reset all chat-related states
        this.currentChatPartner = null;
        this.chatHistory = [];
        this.isRemoteControlling = false;
        this.isScreenSharing = false;
        this.pendingRequests.clear();
        
        // Clear UI
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '';
        }
        
        if (this.chatPartnerName) {
            this.chatPartnerName.textContent = 'Select a user to chat';
        }
        
        if (this.chatStatus) {
            this.chatStatus.textContent = 'Not in a chat';
            this.chatStatus.className = 'chat-status offline';
        }
        
        if (this.remoteControlBtn) {
            this.remoteControlBtn.textContent = '🖱️ Request Control';
            this.remoteControlBtn.disabled = false;
            this.remoteControlBtn.style.display = 'none';
        }

        // Reset screen sharing UI
        if (this.screenShareContainer) {
            this.screenShareContainer.style.display = 'none';
        }
        
        if (this.messagesContainer) {
            this.messagesContainer.style.display = 'flex';
        }
        
        if (this.stopScreenShareBtn) {
            this.stopScreenShareBtn.style.display = 'none';
        }
        
        if (this.stopViewingBtn) {
            this.stopViewingBtn.style.display = 'none';
        }
        
        if (this.screenShareBtn) {
            this.screenShareBtn.textContent = '🖥️ Share Screen';
            this.screenShareBtn.disabled = false;
        }

        // Hide remote control indicator
        const remoteControlIndicator = document.getElementById('remote-control-indicator');
        if (remoteControlIndicator) {
            remoteControlIndicator.classList.remove('active');
        }
    }

    async handleEndSession(data) {
        // Save chat history before resetting if there are messages
        let chatSaved = false;
        if (this.chatHistory.length > 0 && this.currentChatPartner) {
            try {
                const chatData = {
                    chatData: {
                        messages: this.chatHistory,
                        timestamp: new Date().toISOString()
                    },
                    username: this.currentUser.username,
                    partner: this.currentChatPartner.username
                };
                
                const result = await ipcRenderer.invoke('save-chat-history', chatData);
                
                if (result && result.success) {
                    console.log('Chat history saved successfully:', result.filePath);
                    chatSaved = true;
                } else {
                    console.error('Failed to save chat history:', result ? result.error : 'Unknown error');
                }
            } catch (error) {
                console.error('Error saving chat history:', error);
            }
        }
        
        // Stop any ongoing screen sharing or remote control
        if (this.isScreenSharing) {
            this.stopScreenShare();
        }
        
        if (this.isRemoteControlling) {
            this.endRemoteControl();
        }

        // Reset all session states
        this.resetSessionState();
        
        // Show appropriate notification
        if (chatSaved) {
            this.showNotification('Chat history saved - Session ended by other user', 'info');
        } else {
            this.showNotification(`${data.fromUser} has ended the session`, 'info');
        }
        
        // Navigate back to dashboard
        this.showPage('dashboard');
    }

    showModal(modalId) {
        console.log('showModal called with:', modalId);
        console.log('modalOverlay element:', this.modalOverlay);
        
        if (!this.modalOverlay) {
            console.error('Modal overlay not found!');
            return;
        }
        
        this.modalOverlay.style.display = 'flex';
        
        const targetModal = document.getElementById(modalId);
        console.log('Target modal found:', !!targetModal);
        
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = modal.id === modalId ? 'block' : 'none';
            console.log(`Modal ${modal.id} display:`, modal.style.display);
        });
    }

    hideModal() {
        this.modalOverlay.style.display = 'none';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        this.notificationContainer.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    // Test function to manually trigger modal
    testModal() {
        console.log('Testing modal display...');
        this.showModal('chat-request-modal');
    }
}

// Initialize the app
const app = new TwinDeskApp();

// Make app globally available for onclick handlers
window.app = app;
