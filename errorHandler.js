// Browser-safe error handling and logging utility for the Mini App
// - No direct usage of process.env in browser runtime
// - Safe console wrapping without recursion
// - Graceful network logging with try/catch

class ErrorHandler {
  static init() {
    if (window.__errorHandlerInitialized) return;
    window.__errorHandlerInitialized = true;

    // Global error handler
    window.onerror = (message, source, lineno, colno, error) => {
      this.logError({
        message,
        source,
        lineno,
        colno,
        error: error?.stack || String(error),
        type: 'unhandled_error'
      });
      return true; // prevent default browser popup
    };

    // Global unhandled rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        message: 'Unhandled Promise Rejection',
        error: event?.reason?.stack || String(event?.reason),
        type: 'unhandled_rejection'
      });
    });

    // Setup console hooks
    this.setupErrorReporting();
  }

  static setupErrorReporting() {
    // Keep original console refs (bound) to avoid recursion
    if (!window.__originalConsoleRef) {
      window.__originalConsoleRef = {
        log: console.log.bind(console),
        error: console.error.bind(console),
        warn: console.warn.bind(console),
        info: console.info.bind(console),
        debug: console.debug.bind(console)
      };
    }
    const original = window.__originalConsoleRef;

    // Wrap console methods
    console.log = (...args) => {
      try { ErrorHandler.logToServer('log', args); } catch (_) {}
      original.log(...args);
    };
    console.error = (...args) => {
      try { ErrorHandler.logToServer('error', args); } catch (_) {}
      original.error(...args);
    };
    console.warn = (...args) => {
      try { ErrorHandler.logToServer('warn', args); } catch (_) {}
      original.warn(...args);
    };
    console.info = (...args) => {
      try { ErrorHandler.logToServer('info', args); } catch (_) {}
      original.info(...args);
    };
    console.debug = (...args) => {
      try { ErrorHandler.logToServer('debug', args); } catch (_) {}
      original.debug(...args);
    };
  }

  static logError(errorData) {
    const error = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...errorData
    };

    // Log to console (will be wrapped safely)
    try { (window.__originalConsoleRef?.error || console.error)('Error occurred:', error); } catch (_) {}

    // Send to error tracking endpoint (best-effort)
    this.reportError(error);
    return error;
  }

  static async reportError(error) {
    try {
      const resp = await fetch('/api/logs/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error)
      });
      if (!resp.ok) {
        (window.__originalConsoleRef?.warn || console.warn)('Failed to send error report');
      }
    } catch (e) {
      (window.__originalConsoleRef?.warn || console.warn)('Error reporting failed:', e);
    }
  }

  static logToServer(level, args) {
    const original = window.__originalConsoleRef || console;
    const env = (typeof process !== 'undefined' && process?.env?.NODE_ENV) || 'production';

    const logEntry = {
      level,
      timestamp: new Date().toISOString(),
      messages: args.map(arg => {
        if (arg instanceof Error) {
          return { message: arg.message, stack: arg.stack, name: arg.name };
        }
        return arg;
      }),
      context: { url: window.location.href, userAgent: navigator.userAgent }
    };

    // Dev: print to original console, not recursively
    if (env === 'development' && typeof original[level] === 'function') {
      try { original[level](...args); } catch (_) {}
    }

    // Prod: send logs to server (best-effort)
    if (env === 'production') {
      this.sendLogToServer(logEntry);
    }
  }

  static async sendLogToServer(logEntry) {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      });
    } catch (e) {
      (window.__originalConsoleRef?.warn || console.warn)('Failed to send log to server:', e);
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

        // user-friendly notification fallback
        try {
          if (window.showNotification) window.showNotification(errorMessage, 'error');
        } catch (_) {}

        throw error;
      }
    };
  }
}

// Initialize when loaded
ErrorHandler.init();

export default ErrorHandler;
