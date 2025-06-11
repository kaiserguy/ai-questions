class OfflineAppEnhanced {
    constructor() {
        this.isOffline = false;
        this.serviceWorker = null;
        this.aiModel = null;
        this.wikipediaDB = null;
        this.conversationHistory = [];
        this.queryLogger = null;
        this.enhancedWikipediaSearch = null;
        this.init();
    }

    async init() {
        console.log('Initializing Enhanced Offline App...');
        
        // Check browser compatibility
        if (!this.checkCompatibility()) {
            this.showError('Your browser does not support the required features for offline mode.');
            return;
        }

        // Check if offline resources are available
        await this.checkOfflineStatus();
        
        // Initialize UI
        this.setupEventListeners();
        this.updateUI();
        
        // Initialize query logger
        this.initializeQueryLogger();
        
        // Register service worker
        await this.registerServiceWorker();
        
        console.log('Enhanced Offline App initialized');
    }

    checkCompatibility() {
        const required = [
            'serviceWorker' in navigator,
            'indexedDB' in window,
            'WebAssembly' in window,
            'fetch' in window
        ];
        
        return required.every(feature => feature);
    }

    async checkOfflineStatus() {
        try {
            // Check if we have cached resources
            const cache = await caches.open('ai-questions-offline-v1');
            const cachedRequests = await cache.keys();
            
            // Check for essential resources
            const essentialResources = [
                '/offline/ai-models.js',
                '/offline/wikipedia.js',
                '/offline/app.js'
            ];
            
            const hasEssentials = essentialResources.every(resource => 
                cachedRequests.some(request => request.url.includes(resource))
            );
            
            this.isOffline = hasEssentials;
            console.log('Offline status:', this.isOffline ? 'Ready' : 'Not ready');
            
        } catch (error) {
            console.error('Failed to check offline status:', error);
            this.isOffline = false;
        }
    }

    setupEventListeners() {
        // Chat form
        const chatForm = document.getElementById('chatForm');
        if (chatForm) {
            chatForm.addEventListener('submit', (e) => this.handleChatSubmit(e));
        }

        // Chat input
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleChatSubmit(e);
                }
            });
        }

        // Model selector
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => this.switchModel(e.target.value));
        }

        // Clear chat button
        const clearBtn = document.getElementById('clearChat');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearChat());
        }

        // Download resources button
        const downloadBtn = document.getElementById('downloadResources');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadResources());
        }
    }

    updateUI() {
        // Update offline status indicator
        const statusIndicator = document.getElementById('offlineStatus');
        if (statusIndicator) {
            statusIndicator.textContent = this.isOffline ? '🟢 Offline Ready' : '🔴 Online Only';
            statusIndicator.className = this.isOffline ? 'status-online' : 'status-offline';
        }

        // Show/hide download button
        const downloadBtn = document.getElementById('downloadResources');
        if (downloadBtn) {
            downloadBtn.style.display = this.isOffline ? 'none' : 'block';
        }

        // Enable/disable chat based on offline status
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) {
            if (!this.isOffline) {
                chatContainer.innerHTML = `
                    <div class="offline-notice">
                        <h3>📥 Download Required</h3>
                        <p>To use the offline AI chat, you need to download the required resources first.</p>
                        <button id="downloadResources" class="download-btn">
                            📥 Download Offline Resources
                        </button>
                    </div>
                `;
                
                // Re-attach event listener
                document.getElementById('downloadResources').addEventListener('click', () => this.downloadResources());
            }
        }
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/offline/sw.js');
                console.log('Service Worker registered:', registration);
                this.serviceWorker = registration;
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    console.log('Service Worker update found');
                });
                
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    async handleChatSubmit(event) {
        event.preventDefault();
        
        if (!this.isOffline) {
            this.showMessage('Please download offline resources first', 'error');
            return;
        }

        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message) return;

        // Clear input
        chatInput.value = '';
        
        // Add user message to chat
        this.addMessageToChat('user', message);
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Get AI response
            const response = await this.getAIResponse(message);
            
            // Remove typing indicator
            this.hideTypingIndicator();
            
            // Add AI response to chat
            this.addMessageToChat('assistant', response);
            
        } catch (error) {
            console.error('Chat error:', error);
            this.hideTypingIndicator();
            this.addMessageToChat('system', `Error: ${error.message}`);
        }
    }

    async getAIResponse(message) {
        if (!this.aiModel) {
            // Load AI model if not already loaded
            await this.loadAIModel();
        }

        // Simple response for now - in real implementation this would use the AI model
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(`This is a simulated AI response to: "${message}". In the full implementation, this would use the loaded AI model to generate a proper response.`);
            }, 1000 + Math.random() * 2000);
        });
    }

    async loadAIModel() {
        try {
            this.showMessage('Loading AI model...', 'info');
            
            // Simulate model loading
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.aiModel = { loaded: true, name: 'TinyBERT' };
            this.showMessage('AI model loaded successfully', 'success');
            
        } catch (error) {
            console.error('Failed to load AI model:', error);
            throw new Error('Failed to load AI model');
        }
    }

    addMessageToChat(role, content) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const timestamp = new Date().toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="role">${role === 'user' ? '👤 You' : role === 'assistant' ? '🤖 AI' : '⚠️ System'}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${content}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Store in conversation history
        this.conversationHistory.push({ role, content, timestamp });
    }

    showTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.className = 'message assistant typing';
        typingDiv.innerHTML = `
            <div class="message-header">
                <span class="role">🤖 AI</span>
                <span class="timestamp">typing...</span>
            </div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
        this.conversationHistory = [];
        this.showMessage('Chat cleared', 'info');
    }

    async switchModel(modelName) {
        try {
            this.showMessage(`Switching to ${modelName}...`, 'info');
            
            // Simulate model switching
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.aiModel = { loaded: true, name: modelName };
            this.showMessage(`Switched to ${modelName}`, 'success');
            
        } catch (error) {
            console.error('Failed to switch model:', error);
            this.showMessage(`Failed to switch to ${modelName}`, 'error');
        }
    }

    downloadResources() {
        // Redirect to download page
        window.location.href = '/offline';
    }

    showMessage(message, type = 'info') {
        let messageContainer = document.getElementById('appMessage');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'appMessage';
            messageContainer.className = 'app-message';
            document.body.appendChild(messageContainer);
        }

        messageContainer.className = `app-message ${type}`;
        messageContainer.textContent = message;
        messageContainer.style.display = 'block';

        // Auto-hide after 3 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                messageContainer.style.display = 'none';
            }, 3000);
        }
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    initializeQueryLogger() {
        // Initialize the query logger
        if (typeof OfflineQueryLogger !== 'undefined') {
            this.queryLogger = new OfflineQueryLogger();
            console.log('✅ Query logger initialized');
        } else {
            console.warn('⚠️ OfflineQueryLogger not available');
        }
    }

    async searchWikipedia(query) {
        if (!this.wikipediaDB) {
            console.warn('Wikipedia database not available');
            return [];
        }

        // Log search start
        if (this.queryLogger) {
            this.queryLogger.logSearchStart(query);
        }

        try {
            // Initialize enhanced search if not already done
            if (!this.enhancedWikipediaSearch && typeof EnhancedWikipediaSearch !== 'undefined') {
                this.enhancedWikipediaSearch = new EnhancedWikipediaSearch(this.wikipediaDB);
            }

            let searchResults;
            
            if (this.enhancedWikipediaSearch) {
                // Use enhanced search with logging
                const result = await this.enhancedWikipediaSearch.enhancedSearch(query, 5);
                
                // Add logs to query logger
                if (this.queryLogger && result.status_log) {
                    this.queryLogger.addLogs(result.status_log);
                }
                
                searchResults = result.results || [];
            } else {
                // Fallback to basic search
                searchResults = await this.basicWikipediaSearch(query);
            }

            // Log search completion
            if (this.queryLogger) {
                this.queryLogger.logSearchComplete(searchResults.length);
            }

            return searchResults;

        } catch (error) {
            console.error('Wikipedia search failed:', error);
            
            // Log search error
            if (this.queryLogger) {
                this.queryLogger.logSearchError(error.message);
            }
            
            return [];
        }
    }

    async basicWikipediaSearch(query) {
        // Basic search implementation for fallback
        if (!this.wikipediaDB || !this.wikipediaDB.db) {
            return [];
        }

        try {
            const stmt = this.wikipediaDB.db.prepare(`
                SELECT title, content, snippet(wikipedia_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
                FROM wikipedia_fts 
                WHERE wikipedia_fts MATCH ?
                ORDER BY rank 
                LIMIT 5
            `);
            
            const results = [];
            stmt.bind([query.toLowerCase()]);
            
            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push({
                    title: row.title,
                    content: row.content,
                    snippet: row.snippet || row.content?.substring(0, 200) + '...',
                    url: `/offline/wikipedia/article/${encodeURIComponent(row.title)}`
                });
            }
            
            stmt.free();
            return results;
            
        } catch (error) {
            console.error('Basic Wikipedia search failed:', error);
            return [];
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.offlineApp = new OfflineAppEnhanced();
});

