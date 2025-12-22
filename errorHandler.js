// Error handling and logging utility
class ErrorHandler {
    static init() {
        // Global error handler for uncaught exceptions
        window.onerror = (message, source, lineno, colno, error) => {
            this.logError({
                message,
                source,
                lineno,
                colno,
                error: error?.stack || error,
                type: 'unhandled_error'
            });
            return true; // Prevent default browser error handling
        };

        // Global promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                message: 'Unhandled Promise Rejection',
                error: event.reason?.stack || event.reason || event,
                type: 'unhandled_rejection'
            });
        });

        // Log page errors to the server
        this.setupErrorReporting();
    }

    static setupErrorReporting() {
        // Override console methods to capture logs
        const originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug
        };

        // Enhanced console logging with error tracking
        console.log = (...args) => {
            this.logToServer('log', args);
            originalConsole.log(...args);
        };

        console.error = (...args) => {
            this.logToServer('error', args);
            originalConsole.error(...args);
        };

        console.warn = (...args) => {
            this.logToServer('warn', args);
            originalConsole.warn(...args);
        };

        console.info = (...args) => {
            this.logToServer('info', args);
            originalConsole.info(...args);
        };

        console.debug = (...args) => {
            this.logToServer('debug', args);
            originalConsole.debug(...args);
        };
    }

    static logError(errorData) {
        const error = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            ...errorData
        };

        // Log to console
        console.error('Error occurred:', error);

        // Send to error tracking service (e.g., Sentry, LogRocket, or your own API)
        this.reportError(error);

        return error;
    }

    static async reportError(error) {
        try {
            // Replace with your error reporting endpoint
            const response = await fetch('/api/logs/error', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(error)
            });

            if (!response.ok) {
                console.warn('Failed to send error report to server');
            }
        } catch (e) {
            console.warn('Error reporting failed:', e);
        }
    }

    static logToServer(level, args) {
        const logEntry = {
            level,
            timestamp: new Date().toISOString(),
            messages: args.map(arg => {
                if (arg instanceof Error) {
                    return {
                        message: arg.message,
                        stack: arg.stack,
                        name: arg.name
                    };
                }
                return arg;
            }),
            context: {
                url: window.location.href,
                userAgent: navigator.userAgent
            }
        };

        // In development, log to console
        if (process.env.NODE_ENV === 'development') {
            console[level](...args);
        }

        // In production, send logs to server
        if (process.env.NODE_ENV === 'production') {
            this.sendLogToServer(logEntry);
        }
    }

    static async sendLogToServer(logEntry) {
        try {
            await fetch('/api/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(logEntry)
            });
        } catch (error) {
            console.warn('Failed to send log to server:', error);
        }
    }

    static withErrorHandling(fn, errorMessage = 'An error occurred') {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.logError({
                    message: errorMessage,
                    error: error?.stack || error,
                    type: 'function_error',
                    functionName: fn.name || 'anonymous'
                });
                
                // Show user-friendly error message
                if (window.showNotification) {
                    window.showNotification(errorMessage, 'error');
                } else {
                    console.error(errorMessage, error);
                }
                
                // Re-throw to allow further error handling
                throw error;
            }
        };
    }
}

// Initialize error handling when the script loads
ErrorHandler.init();

// Export for use in other modules
export default ErrorHandler;
