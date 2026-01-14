/**
 * Offline Mode UI Manager
 * Handles all UI interactions for the offline mode page
 */
class OfflineUIManager {
    constructor() {
        this.selectedPackage = null;
        this.isDownloading = false;
        this.integrationManager = null;
        
        // DOM elements
        this.elements = {
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            statusDescription: document.getElementById('statusDescription'),
            downloadBtn: document.getElementById('downloadBtn'),
            progressSection: document.getElementById('progressSection'),
            progressText: document.getElementById('progressText'),
            progressFill: document.getElementById('progressFill'),
            progressDetails: document.getElementById('progressDetails'),
            chatInput: document.getElementById('chatInput'),
            sendBtn: document.getElementById('sendBtn'),
            chatMessages: document.getElementById('chatMessages'),
            wikiSearchInput: document.getElementById('wikiSearchInput'),
            wikiSearchBtn: document.getElementById('wikiSearchBtn'),
            wikiResults: document.getElementById('wikiResults'),
            clearCacheBtn: document.getElementById('clearCacheBtn'),
            optionCards: document.querySelectorAll('.option-card')
        };
    }
    
    /**
     * Initialize the UI manager
     */
    async initialize(integrationManager) {
        this.integrationManager = integrationManager;
        
        // Set up event handlers
        this.setupPackageSelection();
        this.setupDownloadButton();
        this.setupChatHandlers();
        this.setupWikiSearchHandlers();
        this.setupClearCacheHandler();
        
        // Check browser compatibility
        await this.checkBrowserCompatibility();
        
        // Check for existing data
        await this.checkExistingData();
    }
    
    /**
     * Check browser compatibility for offline features
     */
    async checkBrowserCompatibility() {
        const features = {
            indexedDB: 'indexedDB' in window,
            serviceWorker: 'serviceWorker' in navigator,
            webWorkers: 'Worker' in window,
            localStorage: 'localStorage' in window,
            fetch: 'fetch' in window
        };
        
        const allSupported = Object.values(features).every(v => v);
        const missingFeatures = Object.entries(features)
            .filter(([, supported]) => !supported)
            .map(([name]) => name);
        
        if (allSupported) {
            this.updateStatus('compatible', 'Your browser supports all offline features', 'Ready to download and use offline mode.');
        } else {
            this.updateStatus('incompatible', 'Browser compatibility issues detected', `Missing features: ${missingFeatures.join(', ')}`);
        }
    }
    
    /**
     * Check for existing downloaded data
     */
    async checkExistingData() {
        try {
            // Check if IndexedDB has data
            if (typeof ModelStorage !== 'undefined') {
                const modelStorage = new ModelStorage();
                await modelStorage.initialize();
                const hasModel = await modelStorage.hasModel();
                if (hasModel) {
                    this.updateStatus('ready', 'Offline mode ready', 'AI model and data are available for offline use.');
                    this.enableChat();
                }
            }
        } catch (error) {
            console.log('No existing offline data found');
        }
    }
    
    /**
     * Update the status indicator
     */
    updateStatus(status, text, description) {
        if (this.elements.statusDot) {
            this.elements.statusDot.className = 'status-dot';
            if (status === 'compatible' || status === 'ready') {
                this.elements.statusDot.classList.add('status-success');
            } else if (status === 'incompatible' || status === 'error') {
                this.elements.statusDot.classList.add('status-error');
            } else if (status === 'loading') {
                this.elements.statusDot.classList.add('status-loading');
            }
        }
        
        if (this.elements.statusText && text) {
            this.elements.statusText.textContent = text;
        }
        
        if (this.elements.statusDescription && description) {
            this.elements.statusDescription.textContent = description;
        }
    }
    
    /**
     * Set up package selection handlers
     */
    setupPackageSelection() {
        this.elements.optionCards.forEach(card => {
            card.addEventListener('click', () => {
                // Remove selected class from all cards
                this.elements.optionCards.forEach(c => c.classList.remove('selected'));
                
                // Add selected class to clicked card
                card.classList.add('selected');
                
                // Store selected package
                this.selectedPackage = card.dataset.package;
                
                // Enable download button
                if (this.elements.downloadBtn) {
                    this.elements.downloadBtn.disabled = false;
                    this.elements.downloadBtn.textContent = `Download ${this.getPackageName(this.selectedPackage)} Package`;
                }
                
                // Update integration manager
                if (this.integrationManager) {
                    try {
                        this.integrationManager.setPackageType(this.selectedPackage);
                    } catch (error) {
                        console.error('Failed to set package type:', error);
                    }
                }
            });
        });
    }
    
    /**
     * Get human-readable package name
     */
    getPackageName(packageType) {
        const names = {
            minimal: 'Minimal',
            standard: 'Standard',
            full: 'Premium'
        };
        return names[packageType] || packageType;
    }
    
    /**
     * Set up download button handler
     */
    setupDownloadButton() {
        if (this.elements.downloadBtn) {
            this.elements.downloadBtn.addEventListener('click', () => {
                if (!this.selectedPackage) {
                    this.showToast('Please select a package first', 'warning');
                    return;
                }
                
                if (this.isDownloading) {
                    this.showToast('Download already in progress', 'info');
                    return;
                }
                
                this.startDownload();
            });
        }
    }
    
    /**
     * Start the download process
     */
    startDownload() {
        this.isDownloading = true;
        
        // Update UI
        if (this.elements.downloadBtn) {
            this.elements.downloadBtn.disabled = true;
            this.elements.downloadBtn.textContent = 'Downloading...';
        }
        
        if (this.elements.progressSection) {
            this.elements.progressSection.style.display = 'block';
        }
        
        this.updateProgress(0, 'Starting download...');
        
        // Start download via integration manager
        if (this.integrationManager && typeof this.integrationManager.startDownload === 'function') {
            try {
                this.integrationManager.startDownload();
            } catch (error) {
                this.showToast(`Download failed: ${error.message}`, 'error');
                this.isDownloading = false;
                this.resetDownloadButton();
            }
        } else {
            this.showToast('Download manager not available. Please refresh the page.', 'error');
            this.isDownloading = false;
            this.resetDownloadButton();
        }
    }
    
    /**
     * Update download progress
     */
    updateProgress(percent, details) {
        if (this.elements.progressText) {
            this.elements.progressText.textContent = `Downloading... ${Math.round(percent)}%`;
        }
        
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = `${percent}%`;
        }
        
        if (this.elements.progressDetails && details) {
            this.elements.progressDetails.textContent = details;
        }
    }
    
    /**
     * Reset download button to initial state
     */
    resetDownloadButton() {
        if (this.elements.downloadBtn) {
            this.elements.downloadBtn.disabled = !this.selectedPackage;
            this.elements.downloadBtn.textContent = this.selectedPackage 
                ? `Download ${this.getPackageName(this.selectedPackage)} Package`
                : 'Select a package to continue';
        }
    }
    
    /**
     * Set up chat handlers
     */
    setupChatHandlers() {
        if (this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (this.elements.chatInput) {
            this.elements.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }
    
    /**
     * Send a chat message
     */
    async sendMessage() {
        const message = this.elements.chatInput?.value?.trim();
        
        if (!message) {
            this.showToast('Please enter a message', 'warning');
            return;
        }
        
        // Check if AI is ready
        if (!this.integrationManager || !this.integrationManager.isInitialized) {
            this.showToast('Please download the offline package first', 'warning');
            return;
        }
        
        // Add user message to chat
        this.addChatMessage(message, 'user');
        
        // Clear input
        this.elements.chatInput.value = '';
        
        // Show loading indicator
        const loadingId = this.addChatMessage('Thinking...', 'assistant', true);
        
        try {
            // Get AI response
            const response = await this.integrationManager.chat(message);
            
            // Remove loading message
            this.removeChatMessage(loadingId);
            
            // Add AI response
            this.addChatMessage(response, 'assistant');
        } catch (error) {
            // Remove loading message
            this.removeChatMessage(loadingId);
            
            // Show error
            this.addChatMessage(`Error: ${error.message}`, 'assistant', false, true);
            this.showToast('Failed to get AI response', 'error');
        }
    }
    
    /**
     * Add a message to the chat
     */
    addChatMessage(text, sender, isLoading = false, isError = false) {
        if (!this.elements.chatMessages) return null;
        
        const messageId = `msg-${Date.now()}`;
        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = `chat-message ${sender}-message`;
        
        if (isLoading) {
            messageDiv.classList.add('loading');
        }
        
        if (isError) {
            messageDiv.classList.add('error');
        }
        
        const label = sender === 'user' ? 'You' : 'AI Assistant';
        messageDiv.innerHTML = `<strong>${label}:</strong> ${text}`;
        
        this.elements.chatMessages.appendChild(messageDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        
        return messageId;
    }
    
    /**
     * Remove a chat message by ID
     */
    removeChatMessage(messageId) {
        const message = document.getElementById(messageId);
        if (message) {
            message.remove();
        }
    }
    
    /**
     * Enable chat functionality
     */
    enableChat() {
        if (this.elements.chatInput) {
            this.elements.chatInput.disabled = false;
        }
        if (this.elements.sendBtn) {
            this.elements.sendBtn.disabled = false;
        }
    }
    
    /**
     * Set up Wikipedia search handlers
     */
    setupWikiSearchHandlers() {
        if (this.elements.wikiSearchBtn) {
            this.elements.wikiSearchBtn.addEventListener('click', () => this.searchWikipedia());
        }
        
        if (this.elements.wikiSearchInput) {
            this.elements.wikiSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.searchWikipedia();
                }
            });
        }
    }
    
    /**
     * Search Wikipedia
     */
    async searchWikipedia() {
        const query = this.elements.wikiSearchInput?.value?.trim();
        
        if (!query) {
            this.showToast('Please enter a search term', 'warning');
            return;
        }
        
        // Check if Wikipedia is ready
        if (!this.integrationManager || !this.integrationManager.isInitialized) {
            this.showToast('Please download the offline package first', 'warning');
            return;
        }
        
        // Show loading
        if (this.elements.wikiResults) {
            this.elements.wikiResults.innerHTML = '<div class="loading">Searching...</div>';
        }
        
        try {
            const results = await this.integrationManager.searchWikipedia(query);
            this.displayWikiResults(results);
        } catch (error) {
            if (this.elements.wikiResults) {
                this.elements.wikiResults.innerHTML = `<div class="error">Search failed: ${error.message}</div>`;
            }
            this.showToast('Wikipedia search failed', 'error');
        }
    }
    
    /**
     * Display Wikipedia search results
     */
    displayWikiResults(results) {
        if (!this.elements.wikiResults) return;
        
        if (!results || results.length === 0) {
            this.elements.wikiResults.innerHTML = '<div class="no-results">No results found</div>';
            return;
        }
        
        const html = results.map(result => `
            <div class="wiki-result">
                <h4>${result.title}</h4>
                <p>${result.snippet || result.content?.substring(0, 200) + '...'}</p>
            </div>
        `).join('');
        
        this.elements.wikiResults.innerHTML = html;
    }
    
    /**
     * Set up clear cache handler
     */
    setupClearCacheHandler() {
        if (this.elements.clearCacheBtn) {
            this.elements.clearCacheBtn.addEventListener('click', () => this.clearCache());
        }
    }
    
    /**
     * Clear all cached data
     */
    async clearCache() {
        // Confirm with user
        if (!confirm('Are you sure you want to clear all offline data? This will remove downloaded AI models and Wikipedia data.')) {
            return;
        }
        
        this.showToast('Clearing cache...', 'info');
        
        try {
            // Clear IndexedDB databases
            const databases = await indexedDB.databases();
            for (const db of databases) {
                if (db.name) {
                    await new Promise((resolve, reject) => {
                        const request = indexedDB.deleteDatabase(db.name);
                        request.onsuccess = resolve;
                        request.onerror = reject;
                    });
                }
            }
            
            // Clear localStorage
            localStorage.clear();
            
            // Clear sessionStorage
            sessionStorage.clear();
            
            this.showToast('All offline data cleared successfully', 'success');
            
            // Reset UI
            this.selectedPackage = null;
            this.elements.optionCards.forEach(c => c.classList.remove('selected'));
            this.resetDownloadButton();
            this.updateStatus('compatible', 'Cache cleared', 'Select a package to download offline data.');
            
        } catch (error) {
            console.error('Failed to clear cache:', error);
            this.showToast(`Failed to clear cache: ${error.message}`, 'error');
        }
    }
    
    /**
     * Show a toast notification
     */
    showToast(message, type = 'info') {
        // Use the toast.js if available
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else if (typeof Toast !== 'undefined' && typeof Toast.show === 'function') {
            Toast.show(message, type);
        } else {
            // Fallback to console and alert for errors
            console.log(`[${type.toUpperCase()}] ${message}`);
            if (type === 'error') {
                alert(message);
            }
        }
    }
}

// Create alias for IntegrationManager if it doesn't exist
if (typeof window !== 'undefined') {
    // Export OfflineUIManager
    window.OfflineUIManager = OfflineUIManager;
    
    // Also export as UIManager for convenience
    window.UIManager = OfflineUIManager;
}

// Node.js exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineUIManager;
}
