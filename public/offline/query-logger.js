/**
 * Query Logging System for Offline Mode
 * Provides client-side logging with collapsible UI
 */

class OfflineQueryLogger {
    constructor() {
        this.logs = [];
        this.isVisible = false;
        this.container = null;
        this.logContainer = null;
        this.toggleButton = null;
        this.clearButton = null;
        this.init();
    }

    init() {
        this.createUI();
        this.setupEventListeners();
    }

    createUI() {
        // Create the main container
        this.container = document.createElement('div');
        this.container.className = 'query-logger';
        this.container.innerHTML = `
            <div class="query-logger-header">
                <button id="queryLogToggle" class="query-log-toggle">
                    🔍 Show Query Logs (<span id="logCount">0</span>)
                </button>
                <button id="queryLogClear" class="query-log-clear" style="display: none;">
                    🧹 Clear
                </button>
            </div>
            <div id="queryLogContainer" class="query-log-container" style="display: none;">
                <div class="query-log-content">
                    <div id="queryLogEntries" class="query-log-entries">
                        <p class="query-log-empty">No queries logged yet. Start a search to see the process!</p>
                    </div>
                </div>
            </div>
        `;

        // Add CSS styles
        this.addStyles();

        // Find the chat container and insert the logger
        const chatContainer = document.querySelector('.chat-container') || 
                            document.querySelector('.container') || 
                            document.body;
        
        if (chatContainer) {
            chatContainer.appendChild(this.container);
        }

        // Get references to elements
        this.toggleButton = document.getElementById('queryLogToggle');
        this.clearButton = document.getElementById('queryLogClear');
        this.logContainer = document.getElementById('queryLogContainer');
        this.logEntries = document.getElementById('queryLogEntries');
        this.logCount = document.getElementById('logCount');
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .query-logger {
                margin: 20px 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .query-logger-header {
                display: flex;
                gap: 10px;
                align-items: center;
                margin-bottom: 10px;
            }

            .query-log-toggle {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s ease;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .query-log-toggle:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }

            .query-log-toggle.active {
                background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
            }

            .query-log-clear {
                background: #dc3545;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.3s ease;
            }

            .query-log-clear:hover {
                background: #c82333;
                transform: translateY(-1px);
            }

            .query-log-container {
                background: white;
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                overflow: hidden;
                transition: all 0.3s ease;
            }

            .query-log-content {
                max-height: 400px;
                overflow-y: auto;
            }

            .query-log-entries {
                padding: 15px;
            }

            .query-log-empty {
                text-align: center;
                color: #6c757d;
                font-style: italic;
                margin: 20px 0;
            }

            .query-log-entry {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 8px 0;
                border-bottom: 1px solid #f1f3f4;
                font-size: 13px;
                line-height: 1.4;
            }

            .query-log-entry:last-child {
                border-bottom: none;
            }

            .query-log-timestamp {
                color: #6c757d;
                font-size: 11px;
                min-width: 60px;
                font-family: monospace;
            }

            .query-log-type {
                min-width: 60px;
                font-weight: 600;
                text-transform: uppercase;
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 3px;
                text-align: center;
            }

            .query-log-type.search {
                background: #e3f2fd;
                color: #1976d2;
            }

            .query-log-type.sql {
                background: #f3e5f5;
                color: #7b1fa2;
            }

            .query-log-type.review {
                background: #fff3e0;
                color: #f57c00;
            }

            .query-log-type.result {
                background: #e8f5e8;
                color: #388e3c;
            }

            .query-log-type.error {
                background: #ffebee;
                color: #d32f2f;
            }

            .query-log-message {
                flex: 1;
                color: #333;
                word-break: break-word;
            }

            .query-log-message code {
                background: #f8f9fa;
                padding: 2px 4px;
                border-radius: 3px;
                font-family: monospace;
                font-size: 12px;
                color: #e83e8c;
            }

            /* Mobile responsive */
            @media (max-width: 768px) {
                .query-logger-header {
                    flex-direction: column;
                    align-items: stretch;
                }

                .query-log-toggle {
                    margin-bottom: 5px;
                }

                .query-log-entry {
                    flex-direction: column;
                    gap: 5px;
                }

                .query-log-timestamp,
                .query-log-type {
                    min-width: auto;
                }
            }

            /* Animation for showing/hiding */
            .query-log-container.show {
                animation: slideDown 0.3s ease-out;
            }

            .query-log-container.hide {
                animation: slideUp 0.3s ease-out;
            }

            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes slideUp {
                from {
                    opacity: 1;
                    transform: translateY(0);
                }
                to {
                    opacity: 0;
                    transform: translateY(-10px);
                }
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', () => this.toggleVisibility());
        }

        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.clearLogs());
        }
    }

    toggleVisibility() {
        this.isVisible = !this.isVisible;
        
        if (this.isVisible) {
            this.logContainer.style.display = 'block';
            this.logContainer.classList.add('show');
            this.toggleButton.textContent = `🔍 Hide Query Logs (${this.logs.length})`;
            this.toggleButton.classList.add('active');
            this.clearButton.style.display = this.logs.length > 0 ? 'block' : 'none';
        } else {
            this.logContainer.classList.add('hide');
            setTimeout(() => {
                this.logContainer.style.display = 'none';
                this.logContainer.classList.remove('show', 'hide');
            }, 300);
            this.toggleButton.textContent = `🔍 Show Query Logs (${this.logs.length})`;
            this.toggleButton.classList.remove('active');
            this.clearButton.style.display = 'none';
        }
    }

    addLog(type, message, timestamp = null) {
        const logEntry = {
            type,
            message,
            timestamp: timestamp || new Date().toLocaleTimeString()
        };

        this.logs.push(logEntry);
        this.updateUI();
        this.scrollToBottom();
    }

    addLogs(logs) {
        for (const log of logs) {
            this.addLog(log.type, log.message, new Date(log.timestamp).toLocaleTimeString());
        }
    }

    updateUI() {
        // Update log count
        if (this.logCount) {
            this.logCount.textContent = this.logs.length;
        }

        // Update toggle button text
        if (this.toggleButton) {
            const action = this.isVisible ? 'Hide' : 'Show';
            this.toggleButton.textContent = `🔍 ${action} Query Logs (${this.logs.length})`;
        }

        // Show/hide clear button
        if (this.clearButton) {
            this.clearButton.style.display = this.logs.length > 0 && this.isVisible ? 'block' : 'none';
        }

        // Update log entries
        if (this.logEntries) {
            if (this.logs.length === 0) {
                this.logEntries.innerHTML = '<p class="query-log-empty">No queries logged yet. Start a search to see the process!</p>';
            } else {
                this.logEntries.innerHTML = this.logs.map(log => `
                    <div class="query-log-entry">
                        <div class="query-log-timestamp">${log.timestamp}</div>
                        <div class="query-log-type ${log.type}">${log.type}</div>
                        <div class="query-log-message">${this.formatMessage(log.message)}</div>
                    </div>
                `).join('');
            }
        }
    }

    formatMessage(message) {
        // Format SQL queries with code styling
        if (message.startsWith('SQL:')) {
            const sqlPart = message.substring(4).trim();
            return `SQL: <code>${sqlPart}</code>`;
        }
        
        // Format other messages
        return message.replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    scrollToBottom() {
        if (this.logEntries && this.isVisible) {
            setTimeout(() => {
                this.logEntries.scrollTop = this.logEntries.scrollHeight;
            }, 100);
        }
    }

    clearLogs() {
        this.logs = [];
        this.updateUI();
    }

    // Method to be called when starting a new search
    logSearchStart(query) {
        this.addLog('search', `🔍 Starting search for: "${query}"`);
    }

    // Method to be called when search completes
    logSearchComplete(resultCount) {
        this.addLog('result', `✅ Search completed. Found ${resultCount} relevant articles.`);
    }

    // Method to be called when search fails
    logSearchError(error) {
        this.addLog('error', `❌ Search failed: ${error}`);
    }
}

// Export for use in offline app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineQueryLogger;
} else {
    window.OfflineQueryLogger = OfflineQueryLogger;
}

