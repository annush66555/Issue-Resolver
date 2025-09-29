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
            // Try to get local network IP using WebRTC
            const localIP = await this.getLocalNetworkIP();
            if (localIP && localIP !== 'localhost') {
                return localIP;
            }
            
            // Fallback to public IP if local IP detection fails
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('Failed to get IP address:', error);
            return 'localhost';
        }
    }
    
    // Get local network IP using WebRTC
    async getLocalNetworkIP() {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve('localhost');
            }, 3000); // 3 second timeout
            
            try {
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });
                
                pc.createDataChannel('');
                
                pc.onicecandidate = (ice) => {
                    if (!ice || !ice.candidate || !ice.candidate.candidate) return;
                    
                    const candidate = ice.candidate.candidate;
                    const ipMatch = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/);
                    
                    if (ipMatch) {
                        const ip = ipMatch[1];
                        // Filter out localhost and invalid IPs
                        if (ip !== '127.0.0.1' && !ip.startsWith('169.254') && this.isValidLocalIP(ip)) {
                            clearTimeout(timeout);
                            pc.close();
                            resolve(ip);
                        }
                    }
                };
                
                pc.createOffer().then(offer => pc.setLocalDescription(offer));
                
            } catch (error) {
                console.error('WebRTC IP detection failed:', error);
                clearTimeout(timeout);
                resolve('localhost');
            }
        });
    }
    
    // Check if IP is a valid local network IP
    isValidLocalIP(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        
        const first = parseInt(parts[0]);
        const second = parseInt(parts[1]);
        
        // Check for private IP ranges
        return (
            (first === 10) || // 10.0.0.0/8
            (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0/12
            (first === 192 && second === 168) // 192.168.0.0/16
        );
    }
}

// Export for use in renderer
if (typeof window !== 'undefined') {
    window.ConnectionConfig = ConnectionConfig;
}
