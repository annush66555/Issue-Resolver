#!/usr/bin/env node

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const chalk = require('chalk');
const figlet = require('figlet');
const os = require('os');

class TwinDeskServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            },
            maxHttpBufferSize: 50e6,
            pingTimeout: 60000,
            pingInterval: 25000
        });
        this.users = new Map();
        this.port = 3000;
    }

    showBanner() {
        console.clear();
        console.log(chalk.cyan(figlet.textSync('TwinDesk Server', {
            font: 'Standard',
            horizontalLayout: 'default',
            verticalLayout: 'default'
        })));
        console.log(chalk.yellow('🖥️  Dedicated Server Mode'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log();
    }

    async start() {
        this.showBanner();
        
        // Setup static file serving for web clients
        this.app.use(express.static(path.join(__dirname, 'renderer')));
        
        // Serve the main HTML file
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'renderer', 'index.html'));
        });

        // Find available port
        await this.findAvailablePort();
        
        // Setup socket handlers
        this.setupSocketHandlers();
        
        // Start server
        this.server.listen(this.port, '0.0.0.0', () => {
            this.showServerInfo();
        });

        // Handle graceful shutdown
        this.setupGracefulShutdown();
    }

    async findAvailablePort() {
        return new Promise((resolve) => {
            const net = require('net');
            let currentPort = this.port;
            
            const tryPort = (port) => {
                const testServer = net.createServer();
                
                testServer.on('listening', () => {
                    testServer.close(() => {
                        this.port = port;
                        resolve(port);
                    });
                });
                
                testServer.on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        currentPort++;
                        if (currentPort > this.port + 100) {
                            console.log(chalk.red('❌ No available ports found'));
                            process.exit(1);
                        }
                        tryPort(currentPort);
                    }
                });
                
                testServer.listen(port, '0.0.0.0');
            };
            
            tryPort(currentPort);
        });
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(chalk.green(`👤 User connected: ${socket.id}`));
            
            socket.on('user-join', (userData) => {
                // Check for duplicate usernames
                const existingUser = Array.from(this.users.values()).find(user => user.username === userData.username);
                if (existingUser && existingUser.id !== socket.id) {
                    socket.emit('error', { message: 'Username already taken' });
                    return;
                }
                
                this.users.set(socket.id, {
                    id: socket.id,
                    username: userData.username,
                    status: 'online',
                    joinedAt: new Date()
                });
                
                console.log(chalk.blue(`📝 User joined: ${userData.username} (Total: ${this.users.size})`));
                
                // Send user list updates
                this.io.emit('users-update', Array.from(this.users.values()));
                
                socket.broadcast.emit('user-joined', {
                    id: socket.id,
                    username: userData.username,
                    status: 'online'
                });
            });
            
            socket.on('disconnect', () => {
                const user = this.users.get(socket.id);
                if (user) {
                    console.log(chalk.yellow(`👋 User disconnected: ${user.username}`));
                    this.users.delete(socket.id);
                    
                    socket.broadcast.emit('user-left', {
                        id: socket.id,
                        username: user.username
                    });
                    
                    this.io.emit('users-update', Array.from(this.users.values()));
                }
            });
            
            // Chat functionality
            socket.on('chat-request', (data) => {
                const targetSocket = this.io.sockets.sockets.get(data.targetUserId);
                if (targetSocket) {
                    targetSocket.emit('chat-request', {
                        fromUserId: socket.id,
                        fromUsername: this.users.get(socket.id)?.username,
                        requestId: data.requestId
                    });
                    console.log(chalk.magenta(`💬 Chat request: ${this.users.get(socket.id)?.username} → ${this.users.get(data.targetUserId)?.username}`));
                }
            });

            socket.on('chat-request-response', (data) => {
                const targetSocket = this.io.sockets.sockets.get(data.targetUserId);
                if (targetSocket) {
                    targetSocket.emit('chat-request-response', data);
                }
            });

            socket.on('message', (data) => {
                const targetSocket = this.io.sockets.sockets.get(data.targetUserId);
                if (targetSocket) {
                    targetSocket.emit('message', {
                        ...data,
                        timestamp: new Date().toISOString()
                    });
                    
                    if (data.type === 'file') {
                        console.log(chalk.cyan(`📎 File transfer: ${data.fileName} (${data.fileSize} bytes)`));
                    } else {
                        console.log(chalk.cyan(`💬 Message: ${data.sender} → ${this.users.get(data.targetUserId)?.username}`));
                    }
                }
            });

            // Screen sharing functionality
            socket.on('screen-share-request', (data) => {
                const targetSocket = this.io.sockets.sockets.get(data.targetUserId);
                if (targetSocket) {
                    targetSocket.emit('screen-share-request', {
                        fromUserId: socket.id,
                        fromUsername: this.users.get(socket.id)?.username,
                        requestId: data.requestId
                    });
                    console.log(chalk.blue(`🖥️  Screen share request: ${this.users.get(socket.id)?.username} → ${this.users.get(data.targetUserId)?.username}`));
                }
            });

            socket.on('screen-share-response', (data) => {
                const targetSocket = this.io.sockets.sockets.get(data.targetUserId);
                if (targetSocket) {
                    targetSocket.emit('screen-share-response', data);
                }
            });

            socket.on('screen-data', (data) => {
                const targetSocket = this.io.sockets.sockets.get(data.targetUserId);
                if (targetSocket) {
                    targetSocket.emit('screen-data', data);
                }
            });

            // Remote control functionality
            socket.on('remote-control-request', (data) => {
                const targetSocket = this.io.sockets.sockets.get(data.targetUserId);
                if (targetSocket) {
                    targetSocket.emit('remote-control-request', {
                        fromUserId: socket.id,
                        fromUsername: this.users.get(socket.id)?.username,
                        requestId: data.requestId
                    });
                    console.log(chalk.red(`🖱️  Remote control request: ${this.users.get(socket.id)?.username} → ${this.users.get(data.targetUserId)?.username}`));
                }
            });

            socket.on('remote-control-response', (data) => {
                const targetSocket = this.io.sockets.sockets.get(data.targetUserId);
                if (targetSocket) {
                    targetSocket.emit('remote-control-response', data);
                }
            });

            socket.on('remote-control-action', (data) => {
                const targetSocket = this.io.sockets.sockets.get(data.targetUserId);
                if (targetSocket) {
                    targetSocket.emit('remote-control-action', data);
                }
            });

            socket.on('end-session', (data) => {
                const targetSocket = this.io.sockets.sockets.get(data.targetUserId);
                if (targetSocket) {
                    targetSocket.emit('end-session', {
                        fromUser: data.fromUser,
                        timestamp: data.timestamp
                    });
                }
            });
        });
    }

    showServerInfo() {
        console.log(chalk.green('✅ TwinDesk Server Started Successfully!'));
        console.log();
        console.log(chalk.blue('📊 Server Information:'));
        console.log(chalk.white(`   Port: ${this.port}`));
        console.log(chalk.white(`   Host: 0.0.0.0 (All interfaces)`));
        console.log();
        
        console.log(chalk.blue('🌐 Access URLs:'));
        console.log(chalk.white(`   Local:    http://localhost:${this.port}`));
        console.log(chalk.white(`   Local:    http://127.0.0.1:${this.port}`));
        
        // Show network interfaces
        const interfaces = os.networkInterfaces();
        Object.keys(interfaces).forEach(name => {
            interfaces[name].forEach(iface => {
                if (iface.family === 'IPv4' && !iface.internal) {
                    console.log(chalk.white(`   Network:  http://${iface.address}:${this.port}`));
                }
            });
        });
        
        console.log();
        console.log(chalk.blue('🎯 Connection Modes:'));
        console.log(chalk.white('   • Desktop GUI: Launch TwinDesk application'));
        console.log(chalk.white('   • Web Browser: Open the URLs above'));
        console.log(chalk.white('   • Terminal CLI: Use twindesk-cli command'));
        console.log();
        console.log(chalk.yellow('📝 Server Status: Running'));
        console.log(chalk.gray('Press Ctrl+C to stop the server'));
        console.log(chalk.gray('─'.repeat(60)));
        
        // Show real-time stats
        this.showRealTimeStats();
    }

    showRealTimeStats() {
        setInterval(() => {
            const userCount = this.users.size;
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            
            process.stdout.write(`\r${chalk.green('👥 Users:')} ${userCount} | ${chalk.blue('⏱️  Uptime:')} ${hours}h ${minutes}m ${seconds}s`);
        }, 1000);
    }

    setupGracefulShutdown() {
        const shutdown = () => {
            console.log(chalk.yellow('\n🔄 Shutting down server...'));
            
            // Notify all clients
            this.io.emit('server-shutdown', { message: 'Server is shutting down' });
            
            // Close server
            this.server.close(() => {
                console.log(chalk.green('✅ Server stopped gracefully'));
                process.exit(0);
            });
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }
}

// Start server if run directly
if (require.main === module) {
    const server = new TwinDeskServer();
    server.start().catch(console.error);
}

module.exports = TwinDeskServer;
