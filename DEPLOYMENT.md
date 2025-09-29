# TwinDesk Desktop Deployment Guide

This guide explains how to build and deploy TwinDesk for multiple desktop platforms.

## 🚀 Quick Start

### Build for All Platforms
```bash
npm run deploy:all
```

### Build for Specific Platform
```bash
# Windows only
npm run deploy:win

# macOS only  
npm run deploy:mac

# Linux only
npm run deploy:linux
```

### Using the Deployment Script
```bash
# Build all platforms
node scripts/deploy.js all

# Build specific platform
node scripts/deploy.js win
node scripts/deploy.js mac
node scripts/deploy.js linux
```

## 📦 Available Build Targets

### Windows
- **NSIS Installer** (`.exe`) - Recommended for end users
- **Portable Executable** (`.exe`) - No installation required
- **ZIP Archive** (`.zip`) - Compressed portable version
- **Architectures**: x64, x86 (32-bit)

### macOS
- **DMG Installer** (`.dmg`) - Standard macOS installer
- **ZIP Archive** (`.zip`) - Compressed application bundle
- **Architectures**: x64 (Intel), arm64 (Apple Silicon)

### Linux
- **AppImage** (`.AppImage`) - Universal Linux executable
- **Debian Package** (`.deb`) - For Ubuntu/Debian systems
- **RPM Package** (`.rpm`) - For Red Hat/Fedora systems
- **TAR.GZ Archive** (`.tar.gz`) - Compressed archive
- **Architectures**: x64, arm64

## 🛠️ Build Requirements

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Git

### Platform-Specific Requirements

#### Windows Builds
- Windows 10+ (for building)
- No additional requirements

#### macOS Builds
- macOS 10.14+ (for building)
- Xcode Command Line Tools
- Apple Developer Account (for code signing)

#### Linux Builds
- Linux distribution with glibc 2.17+
- `fpm` gem for RPM/DEB packages (optional)

## 🔧 Build Configuration

The build configuration is defined in `package.json` under the `build` section:

### Key Features
- **Multi-architecture support**: x64, x86, arm64
- **Multiple output formats** per platform
- **Optimized compression** for smaller file sizes
- **Platform-specific metadata** and icons
- **Code signing preparation** (certificates required)

### File Naming Convention
```
${productName}-${version}-${arch}.${ext}
```

Examples:
- `TwinDesk-1.0.0-x64.exe`
- `TwinDesk-1.0.0-arm64.dmg`
- `TwinDesk-1.0.0-x64.AppImage`

## 📁 Output Structure

After building, files are organized in the `dist/` directory:

```
dist/
├── TwinDesk-Setup-1.0.0.exe          # Windows installer
├── TwinDesk-1.0.0-x64.exe             # Windows portable (64-bit)
├── TwinDesk-1.0.0-ia32.exe            # Windows portable (32-bit)
├── TwinDesk-1.0.0-x64.dmg             # macOS installer (Intel)
├── TwinDesk-1.0.0-arm64.dmg           # macOS installer (Apple Silicon)
├── TwinDesk-1.0.0-x64.AppImage        # Linux AppImage (64-bit)
├── TwinDesk-1.0.0-arm64.AppImage      # Linux AppImage (ARM64)
├── TwinDesk-1.0.0-x64.deb             # Debian package (64-bit)
├── TwinDesk-1.0.0-arm64.deb           # Debian package (ARM64)
├── TwinDesk-1.0.0-x64.rpm             # RPM package (64-bit)
├── TwinDesk-1.0.0-arm64.rpm           # RPM package (ARM64)
└── ... (additional zip/tar.gz files)
```

## 🎯 Deployment Strategies

### 1. GitHub Releases
1. Build all platforms: `npm run deploy:all`
2. Create a new GitHub release
3. Upload all files from `dist/` directory
4. Include `RELEASE_NOTES.md` in the release description

### 2. Direct Distribution
1. Build for target platform
2. Host files on your web server
3. Provide download links with platform detection

### 3. Package Managers

#### Windows
- **Chocolatey**: Create a chocolatey package
- **Winget**: Submit to Microsoft's package manager

#### macOS
- **Homebrew**: Create a homebrew cask
- **Mac App Store**: Requires additional setup

#### Linux
- **Snap Store**: Create a snap package
- **Flatpak**: Create a flatpak package
- **AUR**: Submit to Arch User Repository

## 🔐 Code Signing

### Windows
1. Obtain a code signing certificate
2. Set environment variables:
   ```bash
   set CSC_LINK=path/to/certificate.p12
   set CSC_KEY_PASSWORD=your_password
   ```

### macOS
1. Join Apple Developer Program
2. Create certificates in Keychain Access
3. Set environment variables:
   ```bash
   export CSC_LINK=path/to/certificate.p12
   export CSC_KEY_PASSWORD=your_password
   export APPLE_ID=your_apple_id
   export APPLE_ID_PASSWORD=app_specific_password
   ```

### Linux
- Code signing is optional for Linux
- GPG signing can be used for package verification

## 🧪 Testing Builds

### Automated Testing
```bash
# Test on current platform
npm test

# Build and test
npm run build:dir
npm run test:built
```

### Manual Testing
1. Install/run the built application
2. Test core functionality:
   - Application startup
   - Network connectivity
   - Screen sharing
   - Chat functionality
   - Settings persistence

## 📊 Build Optimization

### Size Optimization
- Use `compression: "maximum"` in build config
- Exclude unnecessary files with `files` array
- Use `asar` packaging (enabled by default)

### Performance
- Enable native dependencies compilation
- Use appropriate architecture targets
- Optimize renderer process

## 🐛 Troubleshooting

### Common Issues

#### Build Fails on macOS
- Install Xcode Command Line Tools: `xcode-select --install`
- Check certificate validity
- Verify entitlements file

#### Windows Build Issues
- Run as Administrator if needed
- Check Windows Defender exclusions
- Verify certificate installation

#### Linux Build Issues
- Install required system dependencies
- Check glibc version compatibility
- Verify file permissions

### Debug Mode
```bash
# Enable debug output
DEBUG=electron-builder npm run build:all
```

## 📈 CI/CD Integration

### GitHub Actions Example
```yaml
name: Build and Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - run: npm ci
    - run: npm run deploy:all
    
    - uses: actions/upload-artifact@v3
      with:
        name: builds-${{ matrix.os }}
        path: dist/
```

## 📞 Support

For deployment issues:
1. Check this documentation
2. Review electron-builder documentation
3. Check platform-specific requirements
4. Create an issue with build logs

---

**Last Updated**: ${new Date().toISOString().split('T')[0]}
**Electron Builder Version**: Latest
**Supported Platforms**: Windows, macOS, Linux
