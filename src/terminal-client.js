#!/usr/bin/env node

const io = require('socket.io-client');
const readline = require('readline');
const chalk = require('chalk');
const figlet = require('figlet');
const { program } = require('commander');

class TwinDeskTerminalClient {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.onlineUsers = [];
        this.currentChatPartner = null;
        this.isConnected = false;
        this.rl = null;
        this.serverPort = 3000;
        this.serverHost = 'localhost';
    }

    async initialize() {
        console.clear();
        this.showBanner();
        this.setupReadline();
        await this.showMainMenu();
    }

    showBanner() {
        console.log(chalk.cyan(figlet.textSync('TwinDesk CLI', {
            font: 'Standard',
            horizontalLayout: 'default',
            verticalLayout: 'default'
        })));
        console.log(chalk.yellow('🚀 Terminal-based Real-time Chat & Screen Sharing'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log();
    }

    setupReadline() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.green('TwinDesk> ')
        });
    }

    async showMainMenu() {
        console.log(chalk.blue('📋 Connection Options:'));
        console.log('1. 🖥️  Host Session (Desktop GUI)');
        console.log('2. 💻 Join Session (Terminal CLI)');
        console.log('3. 🔗 Connect to Remote Host');
        console.log('4. ⚙️  Settings');
        console.log('5. ❌ Exit');
        console.log();

        this.rl.question(chalk.yellow('Select option (1-5): '), async (answer) => {
            switch (answer.trim()) {
                case '1':
                    await this.startDesktopMode();
                    break;
                case '2':
                    await this.startTerminalMode();
                    break;
                case '3':
                    await this.connectToRemoteHost();
                    break;
                case '4':
                    await this.showSettings();
                    break;
                case '5':
                    this.exit();
                    break;
                default:
                    console.log(chalk.red('❌ Invalid option. Please try again.'));
                    await this.showMainMenu();
            }
        });
    }

    async startDesktopMode() {
        console.log(chalk.green('🖥️  Starting Desktop GUI Mode...'));
        console.log(chalk.yellow('📝 This will launch the Electron desktop application'));
        
        const { spawn } = require('child_process');
        const desktopApp = spawn('npm', ['start'], {
            cwd: process.cwd(),
            stdio: 'inherit',
            shell: true
        });

        desktopApp.on('error', (error) => {
            console.log(chalk.red('❌ Failed to start desktop application:'), error.message);
            this.showMainMenu();
        });

        console.log(chalk.green('✅ Desktop application started!'));
        console.log(chalk.gray('Press Ctrl+C to return to terminal menu'));
    }

    async startTerminalMode() {
        console.log(chalk.green('💻 Starting Terminal CLI Mode...'));
        
        this.rl.question(chalk.yellow('Enter your username: '), async (username) => {
            if (!username.trim()) {
                console.log(chalk.red('❌ Username cannot be empty'));
                return this.startTerminalMode();
            }

            this.currentUser = { username: username.trim(), id: null };
            await this.connectToServer();
        });
    }

    async connectToRemoteHost() {
        console.log(chalk.blue('🔗 Connect to Remote Host'));
        
        this.rl.question(chalk.yellow('Enter server IP address: '), (ip) => {
            this.rl.question(chalk.yellow('Enter server port (default 3000): '), async (port) => {
                this.serverHost = ip.trim() || 'localhost';
                this.serverPort = parseInt(port.trim()) || 3000;
                
                console.log(chalk.gray(`Connecting to ${this.serverHost}:${this.serverPort}...`));
                await this.startTerminalMode();
            });
        });
    }

    async connectToServer() {
        try {
            console.log(chalk.yellow('🔄 Connecting to server...'));
            
            this.socket = io(`http://${this.serverHost}:${this.serverPort}`, {
                timeout: 10000,
                forceNew: true,
                transports: ['polling', 'websocket']
            });

            this.socket.on('connect', () => {
                console.log(chalk.green('✅ Connected to server successfully!'));
                this.isConnected = true;
                this.currentUser.id = this.socket.id;
                this.socket.emit('user-join', { username: this.currentUser.username });
                this.showTerminalDashboard();
            });

            this.socket.on('connect_error', (error) => {
                console.log(chalk.red('❌ Connection failed:'), error.message);
                console.log(chalk.yellow('🔄 Working in offline mode...'));
                this.showOfflineMode();
            });

            this.socket.on('users-update', (users) => {
                this.onlineUsers = users.filter(user => user.id !== this.currentUser?.id);
                this.updateUsersList();
            });

            this.socket.on('message', (data) => {
                this.handleIncomingMessage(data);
            });

            this.socket.on('chat-request', (data) => {
                this.handleChatRequest(data);
            });

            this.socket.on('disconnect', () => {
                console.log(chalk.yellow('⚠️  Disconnected from server'));
                this.isConnected = false;
            });

        } catch (error) {
            console.log(chalk.red('❌ Failed to connect:'), error.message);
            this.showOfflineMode();
        }
    }

    showTerminalDashboard() {
        console.clear();
        console.log(chalk.green(`👋 Welcome ${this.currentUser.username}!`));
        console.log(chalk.blue('🌐 Status: ') + (this.isConnected ? chalk.green('Online') : chalk.red('Offline')));
        console.log(chalk.gray('─'.repeat(50)));
        
        this.showCommands();
        this.startCommandLoop();
    }

    showCommands() {
        console.log(chalk.blue('📋 Available Commands:'));
        console.log('  /users     - List online users');
        console.log('  /chat <id> - Start chat with user');
        console.log('  /msg <msg> - Send message in current chat');
        console.log('  /quit      - Exit current chat');
        console.log('  /help      - Show this help');
        console.log('  /exit      - Exit application');
        console.log(chalk.gray('─'.repeat(50)));
    }

    startCommandLoop() {
        this.rl.prompt();
        
        this.rl.on('line', (input) => {
            this.handleCommand(input.trim());
            this.rl.prompt();
        });
    }

    handleCommand(input) {
        if (!input) return;

        const [command, ...args] = input.split(' ');

        switch (command.toLowerCase()) {
            case '/users':
                this.showOnlineUsers();
                break;
            case '/chat':
                this.startChat(args[0]);
                break;
            case '/msg':
                this.sendMessage(args.join(' '));
                break;
            case '/quit':
                this.quitChat();
                break;
            case '/help':
                this.showCommands();
                break;
            case '/exit':
                this.exit();
                break;
            default:
                if (this.currentChatPartner) {
                    this.sendMessage(input);
                } else {
                    console.log(chalk.red('❌ Unknown command. Type /help for available commands.'));
                }
        }
    }

    showOnlineUsers() {
        console.log(chalk.blue('👥 Online Users:'));
        if (this.onlineUsers.length === 0) {
            console.log(chalk.gray('  No other users online'));
        } else {
            this.onlineUsers.forEach((user, index) => {
                console.log(chalk.green(`  ${index + 1}. ${user.username} (${user.id})`));
            });
        }
    }

    startChat(userId) {
        if (!userId) {
            console.log(chalk.red('❌ Please specify user ID. Use /users to see available users.'));
            return;
        }

        const user = this.onlineUsers.find(u => u.id === userId || u.username === userId);
        if (!user) {
            console.log(chalk.red('❌ User not found'));
            return;
        }

        this.currentChatPartner = user;
        console.log(chalk.green(`💬 Started chat with ${user.username}`));
        console.log(chalk.gray('Type messages directly or use /quit to end chat'));
    }

    sendMessage(message) {
        if (!message) {
            console.log(chalk.red('❌ Message cannot be empty'));
            return;
        }

        if (!this.currentChatPartner) {
            console.log(chalk.red('❌ No active chat. Use /chat <user> to start a chat.'));
            return;
        }

        if (!this.isConnected) {
            console.log(chalk.red('❌ Not connected to server'));
            return;
        }

        const messageData = {
            targetUserId: this.currentChatPartner.id,
            sender: this.currentUser.username,
            message: message,
            timestamp: new Date().toISOString(),
            type: 'text'
        };

        this.socket.emit('message', messageData);
        console.log(chalk.cyan(`You: ${message}`));
    }

    handleIncomingMessage(data) {
        if (data.type === 'text') {
            console.log(chalk.magenta(`${data.sender}: ${data.message}`));
        }
    }

    handleChatRequest(data) {
        console.log(chalk.yellow(`📞 Chat request from ${data.fromUsername}`));
        this.rl.question(chalk.yellow('Accept? (y/n): '), (answer) => {
            const accepted = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
            
            this.socket.emit('chat-request-response', {
                targetUserId: data.fromUserId,
                accepted: accepted,
                requestId: data.requestId
            });

            if (accepted) {
                this.currentChatPartner = {
                    id: data.fromUserId,
                    username: data.fromUsername
                };
                console.log(chalk.green(`✅ Chat accepted with ${data.fromUsername}`));
            } else {
                console.log(chalk.red('❌ Chat request declined'));
            }
        });
    }

    quitChat() {
        if (this.currentChatPartner) {
            console.log(chalk.yellow(`👋 Ended chat with ${this.currentChatPartner.username}`));
            this.currentChatPartner = null;
        } else {
            console.log(chalk.gray('No active chat to quit'));
        }
    }

    updateUsersList() {
        // This could trigger a refresh of the users list display
        // For now, we'll just update the internal list
    }

    showOfflineMode() {
        console.log(chalk.yellow('📴 Working in offline mode'));
        console.log(chalk.gray('Limited functionality available'));
        this.showMainMenu();
    }

    async showSettings() {
        console.log(chalk.blue('⚙️  Settings'));
        console.log(`Current server: ${this.serverHost}:${this.serverPort}`);
        console.log('Press Enter to return to main menu...');
        
        this.rl.question('', () => {
            this.showMainMenu();
        });
    }

    exit() {
        console.log(chalk.yellow('👋 Goodbye!'));
        if (this.socket) {
            this.socket.disconnect();
        }
        if (this.rl) {
            this.rl.close();
        }
        process.exit(0);
    }
}

// CLI Program setup
program
    .name('twindesk-cli')
    .description('TwinDesk Terminal Client')
    .version('1.0.0')
    .option('-h, --host <host>', 'Server host', 'localhost')
    .option('-p, --port <port>', 'Server port', '3000')
    .option('-u, --username <username>', 'Username')
    .action(async (options) => {
        const client = new TwinDeskTerminalClient();
        
        if (options.host) client.serverHost = options.host;
        if (options.port) client.serverPort = parseInt(options.port);
        if (options.username) {
            client.currentUser = { username: options.username, id: null };
            await client.connectToServer();
        } else {
            await client.initialize();
        }
    });

// Handle process termination
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Goodbye!'));
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n👋 Goodbye!'));
    process.exit(0);
});

// Export for use as module
module.exports = TwinDeskTerminalClient;

// Run if called directly
if (require.main === module) {
    program.parse();
}
