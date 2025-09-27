class ErrorHandler {
    static logError(error, context = '') {
        const timestamp = new Date().toISOString();
        const errorMessage = `[${timestamp}] ${context}: ${error.message || error}`;
        console.error(errorMessage);
        
        // In production, you might want to send errors to a logging service
        if (process.env.NODE_ENV === 'production') {
            // Send to logging service
        }
    }

    static handleSocketError(socket, error) {
        this.logError(error, 'Socket Error');
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
            if (socket && socket.disconnected) {
                try {
                    socket.connect();
                } catch (reconnectError) {
                    this.logError(reconnectError, 'Socket Reconnection Failed');
                }
            }
        }, 3000);
    }

    static handleScreenCaptureError(error) {
        this.logError(error, 'Screen Capture Error');
        
        const errorMessages = {
            'NotAllowedError': 'Screen capture permission denied. Please allow screen access.',
            'NotFoundError': 'No screen sources found. Please check your display settings.',
            'NotReadableError': 'Screen capture device is already in use.',
            'OverconstrainedError': 'Screen capture constraints cannot be satisfied.',
            'SecurityError': 'Screen capture blocked due to security restrictions.',
            'AbortError': 'Screen capture was aborted.',
            'NotSupportedError': 'Screen capture is not supported on this device.'
        };

        return errorMessages[error.name] || 'An unknown screen capture error occurred.';
    }

    static handleFileSystemError(error, operation = 'file operation') {
        this.logError(error, `File System Error - ${operation}`);
        
        const errorMessages = {
            'ENOENT': 'File or directory not found.',
            'EACCES': 'Permission denied. Please check file permissions.',
            'EEXIST': 'File already exists.',
            'ENOSPC': 'Not enough space on device.',
            'EMFILE': 'Too many open files.',
            'ENOTDIR': 'Not a directory.',
            'EISDIR': 'Is a directory, expected a file.'
        };

        return errorMessages[error.code] || `File system error during ${operation}.`;
    }

    static handleNetworkError(error) {
        this.logError(error, 'Network Error');
        
        if (error.code === 'ECONNREFUSED') {
            return 'Connection refused. Please check if the server is running.';
        } else if (error.code === 'ENOTFOUND') {
            return 'Server not found. Please check your network connection.';
        } else if (error.code === 'ETIMEDOUT') {
            return 'Connection timed out. Please try again.';
        }
        
        return 'Network error occurred. Please check your connection.';
    }

    static validateInput(input, type, maxLength = null) {
        if (!input || typeof input !== 'string') {
            throw new Error(`Invalid ${type}: must be a non-empty string`);
        }
        
        const trimmed = input.trim();
        if (trimmed.length === 0) {
            throw new Error(`Invalid ${type}: cannot be empty`);
        }
        
        if (maxLength && trimmed.length > maxLength) {
            throw new Error(`Invalid ${type}: exceeds maximum length of ${maxLength} characters`);
        }
        
        // Basic sanitization
        const sanitized = trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        return sanitized;
    }

    static sanitizeMessage(message) {
        if (!message || typeof message !== 'string') {
            return '';
        }
        
        // Remove potentially dangerous HTML/script tags
        return message
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
    }

    static isValidUserId(userId) {
        return userId && typeof userId === 'string' && userId.length > 0;
    }

    static createSafeCallback(callback, context = 'Unknown') {
        return (...args) => {
            try {
                return callback(...args);
            } catch (error) {
                this.logError(error, `Callback Error - ${context}`);
            }
        };
    }
}

module.exports = ErrorHandler;
