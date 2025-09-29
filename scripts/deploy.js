#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const platform = args[0] || 'all';

console.log('🚀 TwinDesk Desktop Deployment Script');
console.log('=====================================');

// Check if required dependencies are installed
try {
    require('electron-builder');
    console.log('✅ electron-builder found');
} catch (error) {
    console.log('❌ electron-builder not found. Installing...');
    execSync('npm install electron-builder --save-dev', { stdio: 'inherit' });
}

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
    console.log('📁 Created dist directory');
}

// Build commands for different platforms
const buildCommands = {
    'win': 'npm run build:win-all',
    'mac': 'npm run build:mac-all',
    'linux': 'npm run build:linux-all',
    'all': 'npm run build:all'
};

const platformNames = {
    'win': 'Windows',
    'mac': 'macOS',
    'linux': 'Linux',
    'all': 'All Platforms'
};

if (!buildCommands[platform]) {
    console.log('❌ Invalid platform. Available options:');
    console.log('   win    - Build for Windows (x64, x86)');
    console.log('   mac    - Build for macOS (Intel, Apple Silicon)');
    console.log('   linux  - Build for Linux (x64, ARM64)');
    console.log('   all    - Build for all platforms');
    process.exit(1);
}

console.log(`🏗️  Building for: ${platformNames[platform]}`);
console.log('⏳ This may take several minutes...');

try {
    // Clean previous builds
    console.log('🧹 Cleaning previous builds...');
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
        fs.mkdirSync(distDir);
    }

    // Run the build
    console.log(`🔨 Running: ${buildCommands[platform]}`);
    execSync(buildCommands[platform], { stdio: 'inherit' });

    // Generate release notes
    console.log('📝 Generating release notes...');
    execSync('npm run create-release-notes', { stdio: 'inherit' });

    // List generated files
    console.log('\n✅ Build completed successfully!');
    console.log('📦 Generated files:');
    
    const files = fs.readdirSync(distDir);
    files.forEach(file => {
        const filePath = path.join(distDir, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`   📄 ${file} (${size} MB)`);
    });

    console.log('\n🎉 Deployment ready!');
    console.log('📁 Files are located in the ./dist directory');
    console.log('📋 Release notes: ./RELEASE_NOTES.md');

} catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}
