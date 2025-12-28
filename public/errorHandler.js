// Simplified Error Handler for browser environment
class ErrorHandler {
  static init() {
    if (window.__errorHandlerInitialized) return;
    window.__errorHandlerInitialized = true;

    // Global error handler
    window.addEventListener('error', (event) => {
      this.logError({
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack || String(event.error),
        type: 'unhandled_error'
      });
    });

    // Global unhandled rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        message: 'Unhandled Promise Rejection',
        error: event.reason?.stack || String(event.reason),
        type: 'unhandled_rejection'
      });
    });

    console.log('✅ Error Handler initialized');
  }

  static logError(errorData) {
    const error = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...errorData
    };

    console.error('❌ Error occurred:', error);
    
    // Send to server (optional)
    this.reportError(error).catch(() => {});
    
    return error;
  }

  static async reportError(error) {
    try {
      await fetch('/api/logs/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error)
      });
    } catch (e) {
      // Silently fail if error reporting fails
    }
  }

  static withErrorHandling(fn, errorMessage = 'Произошла ошибка') {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.logError({
          message: errorMessage,
          error: error?.stack || String(error),
          type: 'function_error',
          functionName: fn.name || 'anonymous'
        });

        // Show user-friendly notification
        if (window.showNotification) {
          window.showNotification(errorMessage, 'error');
        }

        throw error;
      }
    };
  }
}

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ErrorHandler.init());
} else {
  ErrorHandler.init();
}

export default ErrorHandler;