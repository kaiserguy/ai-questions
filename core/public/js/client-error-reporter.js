/**
 * Client-Side Error Reporter
 * Captures browser console errors and sends them to the server for logging
 */

(function() {
    'use strict';

    // Configuration
    const REPORT_ENDPOINT = '/api/client-logs';
    const BATCH_INTERVAL = 1000; // Send logs every second
    let logQueue = [];

    // Send logs to server
    function sendLogs() {
        if (logQueue.length === 0) return;

        const logsToSend = [...logQueue];
        logQueue = [];

        fetch(REPORT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ logs: logsToSend })
        }).catch(err => {
            // Silently fail - don't want to create infinite loop
            console.warn('Failed to send client logs to server:', err);
        });
    }

    // Add log to queue
    function queueLog(type, args) {
        const timestamp = new Date().toISOString();
        const message = Array.from(args).map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        logQueue.push({
            type,
            message,
            timestamp,
            url: window.location.href,
            userAgent: navigator.userAgent
        });
    }

    // Intercept console methods
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info
    };

    console.log = function() {
        queueLog('log', arguments);
        originalConsole.log.apply(console, arguments);
    };

    console.warn = function() {
        queueLog('warn', arguments);
        originalConsole.warn.apply(console, arguments);
    };

    console.error = function() {
        queueLog('error', arguments);
        originalConsole.error.apply(console, arguments);
    };

    console.info = function() {
        queueLog('info', arguments);
        originalConsole.info.apply(console, arguments);
    };

    // Capture unhandled errors
    window.addEventListener('error', function(event) {
        queueLog('error', [
            'Unhandled Error:',
            event.message,
            'at',
            event.filename + ':' + event.lineno + ':' + event.colno
        ]);
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        queueLog('error', [
            'Unhandled Promise Rejection:',
            event.reason
        ]);
    });

    // Send logs periodically
    setInterval(sendLogs, BATCH_INTERVAL);

    // Send logs before page unload
    window.addEventListener('beforeunload', sendLogs);

    // Initial log to confirm reporter is active
    console.info('[Client Error Reporter] Active and monitoring browser console');
})();
