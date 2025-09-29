#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

const version = packageJson.version;
const productName = packageJson.build.productName;

const releaseNotes = `
# ${productName} v${version} - Desktop Release

## 🚀 Multi-Platform Desktop Application

TwinDesk is now available for multiple desktop platforms with optimized builds for different architectures.

### 📦 Available Downloads

#### Windows
- **Installer (Recommended)**: \`${productName}-Setup-${version}.exe\`
- **Portable (64-bit)**: \`${productName}-${version}-x64.exe\`
- **Portable (32-bit)**: \`${productName}-${version}-ia32.exe\`
- **Archive (64-bit)**: \`${productName}-${version}-x64.zip\`
- **Archive (32-bit)**: \`${productName}-${version}-ia32.zip\`

#### macOS
- **DMG Installer (Intel)**: \`${productName}-${version}-x64.dmg\`
- **DMG Installer (Apple Silicon)**: \`${productName}-${version}-arm64.dmg\`
- **Archive (Intel)**: \`${productName}-${version}-x64.zip\`
- **Archive (Apple Silicon)**: \`${productName}-${version}-arm64.zip\`

#### Linux
- **AppImage (64-bit)**: \`${productName}-${version}-x64.AppImage\`
- **AppImage (ARM64)**: \`${productName}-${version}-arm64.AppImage\`
- **Debian Package (64-bit)**: \`${productName}-${version}-x64.deb\`
- **Debian Package (ARM64)**: \`${productName}-${version}-arm64.deb\`
- **RPM Package (64-bit)**: \`${productName}-${version}-x64.rpm\`
- **RPM Package (ARM64)**: \`${productName}-${version}-arm64.rpm\`
- **Archive (64-bit)**: \`${productName}-${version}-x64.tar.gz\`
- **Archive (ARM64)**: \`${productName}-${version}-arm64.tar.gz\`

### ✨ Features

- **Real-time Chat**: Instant messaging with secure delivery
- **Screen Sharing**: High-quality screen streaming
- **Remote Control**: Mouse and keyboard access to shared screens
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Network Connectivity**: Host or join sessions across different networks
- **Secure Communication**: End-to-end encrypted connections

### 🔧 Installation Instructions

#### Windows
1. Download the installer (\`${productName}-Setup-${version}.exe\`)
2. Run the installer and follow the setup wizard
3. Launch TwinDesk from the Start Menu or Desktop shortcut

#### macOS
1. Download the DMG file for your architecture
2. Open the DMG and drag TwinDesk to Applications
3. Launch from Applications folder

#### Linux
- **AppImage**: Download, make executable (\`chmod +x\`), and run
- **Debian/Ubuntu**: Install with \`sudo dpkg -i ${productName}-${version}-x64.deb\`
- **Red Hat/Fedora**: Install with \`sudo rpm -i ${productName}-${version}-x64.rpm\`

### 🌐 Network Requirements

- **Host Mode**: Requires open port 3000 (configurable)
- **Client Mode**: Outbound connections only
- **Firewall**: May need to allow TwinDesk through firewall

### 📋 System Requirements

#### Minimum Requirements
- **Windows**: Windows 10 or later
- **macOS**: macOS 10.14 or later
- **Linux**: Ubuntu 18.04, Debian 10, or equivalent
- **RAM**: 4GB minimum, 8GB recommended
- **Network**: Broadband internet connection

#### Recommended Requirements
- **RAM**: 8GB or more
- **CPU**: Multi-core processor
- **Network**: Stable broadband connection (10+ Mbps)

### 🐛 Known Issues

- First launch may require firewall permission
- Some antivirus software may flag the application (false positive)
- Screen sharing performance depends on network speed

### 📞 Support

For support, issues, or feature requests:
- Create an issue on the project repository
- Check the README.md for troubleshooting
- Review the documentation for setup instructions

---

**Build Date**: ${new Date().toISOString().split('T')[0]}
**Version**: ${version}
**Platforms**: Windows (x64, x86), macOS (Intel, Apple Silicon), Linux (x64, ARM64)
`;

const outputPath = path.join(__dirname, '..', 'RELEASE_NOTES.md');
fs.writeFileSync(outputPath, releaseNotes.trim());

console.log(`✅ Release notes created: ${outputPath}`);
console.log(`📦 Version: ${version}`);
console.log(`🏗️  Build configuration updated for multi-platform deployment`);
