#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');
const chalk = require('chalk');
const figlet = require('figlet');
const path = require('path');
const fs = require('fs');

class TwinDeskLauncher {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async start() {
        console.clear();
        this.showBanner();
        await this.showLaunchMenu();
    }

    showBanner() {
        console.log(chalk.cyan(figlet.textSync('TwinDesk', {
            font: 'Big',
            horizontalLayout: 'default',
            verticalLayout: 'default'
        })));
        console.log(chalk.yellow('🚀 Dual-Mode Real-time Communication Platform'));
        console.log(chalk.gray('─'.repeat(70)));
        console.log();
    }

    async showLaunchMenu() {
        console.log(chalk.blue('🎯 Choose Your Interface:'));
        console.log();
        console.log(chalk.green('1. 🖥️  Desktop GUI Mode'));
        console.log(chalk.cyan('   • Full graphical interface'));
        console.log(chalk.cyan('   • Screen sharing & remote control'));
        console.log(chalk.cyan('   • File transfers & emoji support'));
        console.log();
        console.log(chalk.green('2. 💻 Terminal CLI Mode'));
        console.log(chalk.cyan('   • Command-line interface'));
        console.log(chalk.cyan('   • Lightweight & fast'));
        console.log(chalk.cyan('   • Perfect for servers & SSH'));
        console.log();
        console.log(chalk.green('3. 🔗 Hybrid Mode'));
        console.log(chalk.cyan('   • Both GUI and CLI simultaneously'));
        console.log(chalk.cyan('   • Maximum flexibility'));
        console.log();
        console.log(chalk.green('4. ⚙️  Server Only Mode'));
        console.log(chalk.cyan('   • Run server without client'));
        console.log(chalk.cyan('   • For dedicated hosting'));
        console.log();
        console.log(chalk.green('5. ❌ Exit'));
        console.log();

        this.rl.question(chalk.yellow('Select mode (1-5): '), async (answer) => {
            switch (answer.trim()) {
                case '1':
                    await this.launchDesktopMode();
                    break;
                case '2':
                    await this.launchTerminalMode();
                    break;
                case '3':
                    await this.launchHybridMode();
                    break;
                case '4':
                    await this.launchServerMode();
                    break;
                case '5':
                    this.exit();
                    break;
                default:
                    console.log(chalk.red('❌ Invalid option. Please try again.'));
                    await this.showLaunchMenu();
            }
        });
    }

    async launchDesktopMode() {
        console.log(chalk.green('🖥️  Launching Desktop GUI Mode...'));
        console.log(chalk.yellow('📝 Starting Electron application...'));
        
        try {
            const desktopProcess = spawn('npm', ['start'], {
                cwd: process.cwd(),
                stdio: 'inherit',
                shell: true
            });

            desktopProcess.on('error', (error) => {
                console.log(chalk.red('❌ Failed to start desktop application:'), error.message);
                this.showLaunchMenu();
            });

            desktopProcess.on('close', (code) => {
                console.log(chalk.yellow(`Desktop application exited with code ${code}`));
                this.showLaunchMenu();
            });

        } catch (error) {
            console.log(chalk.red('❌ Error launching desktop mode:'), error.message);
            this.showLaunchMenu();
        }
    }

    async launchTerminalMode() {
        console.log(chalk.green('💻 Launching Terminal CLI Mode...'));
        
        try {
            const terminalClient = require('./src/terminal-client.js');
            const client = new terminalClient();
            await client.initialize();
        } catch (error) {
            console.log(chalk.red('❌ Error launching terminal mode:'), error.message);
            this.showLaunchMenu();
        }
    }

    async launchHybridMode() {
        console.log(chalk.green('🔗 Launching Hybrid Mode...'));
        console.log(chalk.yellow('📝 Starting both Desktop GUI and Terminal CLI...'));
        
        try {
            // Start desktop mode
            const desktopProcess = spawn('npm', ['start'], {
                cwd: process.cwd(),
                stdio: 'pipe',
                shell: true
            });

            console.log(chalk.green('✅ Desktop GUI started'));

            // Wait a moment for desktop to initialize
            setTimeout(async () => {
                console.log(chalk.green('✅ Starting Terminal CLI...'));
                
                // Start terminal mode
                const terminalClient = require('./src/terminal-client.js');
                const client = new terminalClient();
                await client.initialize();
            }, 3000);

        } catch (error) {
            console.log(chalk.red('❌ Error launching hybrid mode:'), error.message);
            this.showLaunchMenu();
        }
    }

    async launchServerMode() {
        console.log(chalk.green('⚙️  Launching Server Only Mode...'));
        console.log(chalk.yellow('📝 Starting server without client interface...'));
        
        try {
            const serverProcess = spawn('node', ['src/server-only.js'], {
                cwd: process.cwd(),
                stdio: 'inherit',
                shell: true
            });

            serverProcess.on('error', (error) => {
                console.log(chalk.red('❌ Failed to start server:'), error.message);
                this.showLaunchMenu();
            });

        } catch (error) {
            console.log(chalk.red('❌ Error launching server mode:'), error.message);
            this.showLaunchMenu();
        }
    }

    exit() {
        console.log(chalk.yellow('👋 Thank you for using TwinDesk!'));
        this.rl.close();
        process.exit(0);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Goodbye!'));
    process.exit(0);
});

// Run launcher
if (require.main === module) {
    const launcher = new TwinDeskLauncher();
    launcher.start().catch(console.error);
}

module.exports = TwinDeskLauncher;
