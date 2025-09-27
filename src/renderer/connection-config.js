// Connection configuration for TwinDesk
class ConnectionConfig {
    constructor() {
        this.defaultPort = 3000;
        this.serverHost = null;
        this.isServerMode = false;
    }

    // Get server configuration based on mode
    async getServerConfig() {
        // Check if we should run in server mode or client mode
        const urlParams = new URLSearchParams(window.location.search);
        const serverIP = urlParams.get('server') || localStorage.getItem('twindesk-server-ip');
        
        if (serverIP) {
            // Client mode - connect to specified server
            this.serverHost = serverIP;
            this.isServerMode = false;
            return {
                host: serverIP,
                port: this.defaultPort,
                mode: 'client'
            };
        } else {
            // Server mode - get local server port
            try {
                const port = await window.electronAPI?.getServerPort() || this.defaultPort;
                this.isServerMode = true;
                return {
                    host: 'localhost',
                    port: port,
                    mode: 'server'
                };
            } catch (error) {
                console.error('Failed to get server port:', error);
                return {
                    host: 'localhost',
                    port: this.defaultPort,
                    mode: 'server'
                };
            }
        }
    }

    // Set server IP for client connections
    setServerIP(ip) {
        this.serverHost = ip;
        localStorage.setItem('twindesk-server-ip', ip);
    }

    // Clear server IP (return to server mode)
    clearServerIP() {
        this.serverHost = null;
        localStorage.removeItem('twindesk-server-ip');
    }

    // Get local IP address for sharing
    async getLocalIP() {
        try {
            // This is a simple method to get local IP
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('Failed to get public IP:', error);
            return 'localhost';
        }
    }
}

// Export for use in renderer
window.ConnectionConfig = ConnectionConfig;
