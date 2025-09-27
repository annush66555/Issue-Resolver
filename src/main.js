const { app, BrowserWindow, ipcMain, desktopCapturer, screen, ipcMain: { handle } } = require('electron');
const path = require('path');

// Disable hardware acceleration to prevent GPU delays
app.disableHardwareAcceleration();

// Allow multiple instances by default
// Each instance will automatically find an available port
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const os = require('os');

// Keep a global reference of the window object
let mainWindow;
let server;
let io;
let users = new Map();

function createWindow() {
  // Create the browser window with optimized settings
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      backgroundThrottling: false, // Prevent background throttling
      webSecurity: false // Disable web security for faster loading
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: true, // Show immediately instead of waiting
    skipTaskbar: false,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    alwaysOnTop: false,
    fullscreenable: true,
    paintWhenInitiallyHidden: false // Don't paint when hidden for faster startup
  });

  // Load the app immediately
  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanupAndExit();
  });

  // Handle app termination
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      cleanupAndExit();
    }
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      try {
        createWindow();
      } catch (error) {
        console.error('Failed to start application:', error);
        cleanupAndExit(1);
      }
    }
  });

  // Handle process termination signals
  process.on('SIGTERM', cleanupAndExit);
  process.on('SIGINT', cleanupAndExit);
}

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const net = require('net');
    let currentPort = startPort;
    
    const tryPort = (port) => {
      const server = net.createServer();
      
      server.on('listening', () => {
        const actualPort = server.address().port;
        server.close(() => {
          resolve(actualPort);
        });
      });
      
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Try next port
          currentPort++;
          if (currentPort > startPort + 100) {
            reject(new Error('No available ports found'));
            return;
          }
          tryPort(currentPort);
        } else {
          reject(err);
        }
      });
      
      server.listen(port, '127.0.0.1');
    };
    
    tryPort(currentPort);
  });
}

async function startServer() {
  try {
    console.log('Starting server...');
    const expressApp = express();
    server = http.createServer(expressApp);
    
    io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      maxHttpBufferSize: 50e6, // 50MB buffer size for file transfers
      pingTimeout: 60000,
      pingInterval: 25000
    });
    
    // Try to start server on available port
    return new Promise((resolve, reject) => {
      let currentPort = 3000;
      
      const tryStartServer = (port) => {
        server.removeAllListeners('error');
        server.removeAllListeners('listening');
        
        server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is in use, trying port ${port + 1}...`);
            currentPort++;
            if (currentPort > 3100) {
              reject(new Error('No available ports found'));
              return;
            }
            tryStartServer(currentPort);
          } else {
            reject(err);
          }
        });
        
        server.on('listening', () => {
          const actualPort = server.address().port;
          console.log(`Server running on port ${actualPort}`);
          // Setup socket handlers after server is successfully listening
          setupSocketHandlers(actualPort);
          resolve(actualPort);
        });
        
        server.listen(port, '0.0.0.0'); // Listen on all interfaces for network access
      };
      
      tryStartServer(currentPort);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
}

/**
 * Sets up all socket.io event handlers
 * @param {number} port - The port number the server is running on
 */
function setupSocketHandlers(port) {
  console.log(`Setting up socket handlers for port ${port}`);
  
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // User join handler
    socket.on('user-join', (userData) => {
      // Check if user already exists (prevent duplicates)
      const existingUser = Array.from(users.values()).find(user => user.username === userData.username);
      if (existingUser && existingUser.id !== socket.id) {
        console.log('Duplicate username detected:', userData.username);
        socket.emit('error', { message: 'Username already taken' });
        return;
      }
      
      users.set(socket.id, {
        id: socket.id,
        username: userData.username,
        status: 'online'
      });
      
      console.log('User joined:', userData.username, 'Socket ID:', socket.id, 'Total users:', users.size);
      
      // Send current user list to the new user
      socket.emit('users-update', Array.from(users.values()));
      
      // Notify ALL users (including the new one) about the updated user list
      io.emit('users-update', Array.from(users.values()));
      
      // Also notify other users about the new user joining
      socket.broadcast.emit('user-joined', {
        id: socket.id,
        username: userData.username,
        status: 'online'
      });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      const user = users.get(socket.id);
      if (user) {
        console.log('User disconnected:', user.username);
        users.delete(socket.id);
        
        // Notify other users about the disconnection
        socket.broadcast.emit('user-left', {
          id: socket.id,
          username: user.username
        });
        
        // Send updated user list to all remaining users
        io.emit('users-update', Array.from(users.values()));
      }
    });
    
    // Chat request handler
    socket.on('chat-request', (data) => {
      console.log('Server received chat request:', data);
      console.log('Looking for target socket:', data.targetUserId);
      
      const targetSocket = io.sockets.sockets.get(data.targetUserId);
      console.log('Target socket found:', !!targetSocket);
      
      if (targetSocket) {
        const requestData = {
          fromUserId: socket.id,
          fromUsername: users.get(socket.id)?.username,
          requestId: data.requestId
        };
        console.log('Sending chat request to target:', requestData);
        targetSocket.emit('chat-request', requestData);
      } else {
        console.log('Target socket not found for user:', data.targetUserId);
        console.log('Available sockets:', Array.from(io.sockets.sockets.keys()));
      }
    });

    // Chat request response handler
    socket.on('chat-request-response', (data) => {
      const targetSocket = io.sockets.sockets.get(data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('chat-request-response', data);
      }
    });

    socket.on('message', (data) => {
      try {
        const targetSocket = io.sockets.sockets.get(data.targetUserId);
        if (targetSocket) {
          // Log file transfers for debugging
          if (data.type === 'file') {
            console.log(`File transfer: ${data.fileName} (${data.fileSize} bytes) from ${data.sender}`);
          }
          
          targetSocket.emit('message', {
            ...data,
            timestamp: new Date().toISOString()
          });
        } else {
          console.log('Target user not found for message:', data.targetUserId);
        }
      } catch (error) {
        console.error('Error handling message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('screen-share-request', (data) => {
      const targetSocket = io.sockets.sockets.get(data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('screen-share-request', {
          fromUserId: socket.id,
          fromUsername: users.get(socket.id)?.username,
          requestId: data.requestId
        });
      }
    });

    socket.on('screen-share-response', (data) => {
      const targetSocket = io.sockets.sockets.get(data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('screen-share-response', data);
      }
    });

    socket.on('screen-data', (data) => {
      const targetSocket = io.sockets.sockets.get(data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('screen-data', data);
      }
    });

    socket.on('viewing-stopped', (data) => {
      const targetSocket = io.sockets.sockets.get(data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('viewing-stopped', {
          fromUser: data.fromUser
        });
      }
    });

    socket.on('remote-control-request', (data) => {
      const targetSocket = io.sockets.sockets.get(data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('remote-control-request', {
          fromUserId: socket.id,
          fromUsername: users.get(socket.id)?.username,
          requestId: data.requestId
        });
      }
    });

    socket.on('remote-control-response', (data) => {
      const targetSocket = io.sockets.sockets.get(data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('remote-control-response', data);
      }
    });

    socket.on('remote-control-action', (data) => {
      const targetSocket = io.sockets.sockets.get(data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('remote-control-action', data);
      }
    });

    // Handle session end
    socket.on('end-session', (data) => {
      console.log('Session end request received:', data);
      const targetSocket = io.sockets.sockets.get(data.targetUserId);
      if (targetSocket) {
        targetSocket.emit('end-session', {
          fromUser: data.fromUser,
          timestamp: data.timestamp
        });
      }
    });

  });
}

// Function to ensure chat history directory exists
function ensureChatHistoryDir() {
  const desktopPath = path.join(os.homedir(), 'Desktop');
  const chatHistoryDir = path.join(desktopPath, 'TwinDesk_ChatHistory');
  if (!fs.existsSync(chatHistoryDir)) {
    fs.mkdirSync(chatHistoryDir, { recursive: true });
  }
  console.log('Chat history directory:', chatHistoryDir);
  return chatHistoryDir;
}

// Function to clean up resources
function cleanupAndExit(exitCode = 0) {
  return new Promise((resolve) => {
    try {
      console.log('Cleaning up resources...');
      
      // Close all WebSocket connections
      if (io) {
        io.sockets.emit('server-shutdown');
        io.close(() => {
          console.log('WebSocket server closed');
        });
      }
      
      // Close the HTTP server
      if (server) {
        server.close(() => {
          console.log('HTTP server closed');
          if (process.platform !== 'darwin') {
            app.quit();
          }
          resolve();
        });
      } else {
        if (process.platform !== 'darwin') {
          app.quit();
        }
        resolve();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
      if (process.platform !== 'darwin') {
        app.quit();
      }
      resolve();
    }
  });
}

// IPC handlers
ipcMain.handle('save-chat-history', async (event, { chatData, username, partner }) => {
  try {
    console.log('Saving chat history for:', username, 'and', partner);
    const chatHistoryDir = ensureChatHistoryDir();
    const sanitizedUsername = username.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const sanitizedPartner = partner.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `chat_${sanitizedUsername}_${sanitizedPartner}_${timestamp}.json`;
    const filePath = path.join(chatHistoryDir, fileName);
    
    console.log('Writing chat history to:', filePath);
    fs.writeFileSync(filePath, JSON.stringify(chatData, null, 2));
    console.log('Chat history saved successfully');
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving chat history:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-desktop-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 150 }
    });
    return sources;
  } catch (error) {
    console.error('Error getting desktop sources:', error);
    return [];
  }
});

ipcMain.handle('simulate-mouse-click', async (event, x, y) => {
  try {
    // This would require robotjs or similar library for actual mouse control
    // For now, we'll just log the action
    console.log(`Simulating mouse click at ${x}, ${y}`);
    return { success: true };
  } catch (error) {
    console.error('Error simulating mouse click:', error);
    return { success: false, error: error.message };
  }
});

// Allow multiple instances for LAN connections
// Remove single instance lock to enable multi-desktop connections
console.log('Allowing multiple instances for LAN connectivity');

// Always start as independent instance
app.whenReady().then(async () => {
  try {
    console.log('Starting independent instance...');
    
    // Create window first
    createWindow();
    
    // Start server and wait for it to be ready
    console.log('Starting server...');
    const serverPort = await startServer();
    console.log(`Server started successfully on port ${serverPort}`);
    
    // Set up IPC handler with the actual port
    ipcMain.handle('get-server-port', () => {
      console.log('IPC: get-server-port called, returning:', serverPort);
      return serverPort;
    });
    
    console.log('Application fully ready!');
  } catch (error) {
    console.error('Failed to start application:', error);
    cleanupAndExit(1);
  }
});

// Handle process termination signals
process.on('SIGTERM', () => cleanupAndExit(0));
process.on('SIGINT', () => cleanupAndExit(0));
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  cleanupAndExit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  cleanupAndExit(1);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanupAndExit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});
