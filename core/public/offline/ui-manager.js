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
            chatMessages: document.getElementById('chatMessages') || document.getElementById('chatContainer'),
            chatSection: document.getElementById('chatSection'),
            wikiSearchInput: document.getElementById('wikiSearchInput'),
            wikiSearchBtn: document.getElementById('wikiSearchBtn'),
            wikiResults: document.getElementById('wikiResults'),
            wikiSection: document.getElementById('wikiSection'),
            clearCacheBtn: document.getElementById('clearCacheBtn'),
            optionCards: document.querySelectorAll('.option-card'),
            pauseBtn: document.getElementById('pauseBtn'),
            resumeBtn: document.getElementById('resumeBtn'),
            cancelBtn: document.getElementById('cancelBtn'),
            storageMonitor: document.getElementById('storageMonitor'),
            storageSummary: document.getElementById('storageSummary'),
            storageFill: document.getElementById('storageFill'),
            storageUsed: document.querySelector('.storage-used'),
            storageAvailable: document.querySelector('.storage-available'),
            storageQuota: document.querySelector('.storage-quota'),
            storageWarning: document.getElementById('storageWarning'),
            toggleLogBtn: document.getElementById('toggleLogBtn'),
            downloadLog: document.getElementById('downloadLog')
        };
        
        // Log state
        this.logVisible = false;
        this.logEntries = [];
    }
    
    /**
     * Initialize the UI manager
     */
    async initialize(integrationManager) {
        try {
            // Validate integration manager
            if (!integrationManager) {
                throw new Error('Integration manager is required');
            }
            
            this.integrationManager = integrationManager;
            
            // Set up event handlers
            this.setupPackageSelection();
            this.setupDownloadButton();
            this.setupChatHandlers();
            this.setupWikiSearchHandlers();
            this.setupClearCacheHandler();
            this.setupDownloadControlHandlers();
            this.setupLogToggleHandler();
            
            // Start storage monitoring
            this.startStorageMonitoring();
            
            // Check browser compatibility
            await this.checkBrowserCompatibility();
            
            // Check for existing data
            await this.checkExistingData();
            
            // Set up keyboard shortcuts
            this.setupKeyboardShortcuts();
            
        } catch (error) {
            console.error('Failed to initialize UI manager:', error);
            this.displayToast('Failed to initialize UI. Please refresh the page.', 'error');
            throw error;
        }
    }
    
    /**
     * Set up global keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K to focus chat input
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.elements.chatInput?.focus();
            }
            
            // Ctrl/Cmd + / to focus wiki search
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                this.elements.wikiSearchInput?.focus();
            }
            
            // Escape to clear focus
            if (e.key === 'Escape') {
                document.activeElement?.blur();
            }
        });
    }
    
    /**
     * Check browser compatibility for offline features
     */
    async checkBrowserCompatibility() {
        try {
            const features = {
                indexedDB: 'indexedDB' in window,
                serviceWorker: 'serviceWorker' in navigator,
                webWorkers: 'Worker' in window,
                localStorage: (() => {
                    try {
                        const test = '__storage_test__';
                        localStorage.setItem(test, test);
                        localStorage.removeItem(test);
                        return true;
                    } catch (e) {
                        return false;
                    }
                })(),
                fetch: 'fetch' in window,
                webAssembly: 'WebAssembly' in window
            };
            
            const allSupported = Object.values(features).every(v => v);
            const missingFeatures = Object.entries(features)
                .filter(([, supported]) => !supported)
                .map(([name]) => name);
            
            if (allSupported) {
                this.updateStatus(
                    'compatible', 
                    'Your browser supports all offline features', 
                    'Ready to download and use offline mode.'
                );
                this.announceToScreenReader('Browser is compatible with offline features');
            } else {
                const featureList = missingFeatures.join(', ');
                this.updateStatus(
                    'incompatible', 
                    'Browser compatibility issues detected', 
                    `Missing features: ${featureList}. Some offline features may not work correctly.`
                );
                this.announceToScreenReader('Browser compatibility issues detected');
                
                // Show detailed warning
                console.warn('Missing browser features:', missingFeatures);
            }
        } catch (error) {
            console.error('Compatibility check failed:', error);
            this.updateStatus(
                'error',
                'Could not check browser compatibility',
                'Please ensure you are using a modern browser.'
            );
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
                    this.announceToScreenReader('Offline data is available');
                    
                    // Show chat and wiki sections
                    if (this.elements.chatSection) {
                        this.elements.chatSection.style.display = 'block';
                    }
                    if (this.elements.wikiSection) {
                        this.elements.wikiSection.style.display = 'block';
                    }
                }
            }
        } catch (error) {
            // Not an error - just no existing data
            console.log('No existing offline data found:', error.message);
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
            // Make cards keyboard accessible
            card.setAttribute('role', 'radio');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-checked', 'false');
            
            const handleSelect = () => {
                // Prevent selection during download
                if (this.isDownloading) {
                    this.displayToast('Cannot change package during download', 'warning');
                    return;
                }
                
                // Remove selected class from all cards
                this.elements.optionCards.forEach(c => {
                    c.classList.remove('selected');
                    c.setAttribute('aria-checked', 'false');
                });
                
                // Add selected class to clicked card
                card.classList.add('selected');
                card.setAttribute('aria-checked', 'true');
                
                // Store selected package
                this.selectedPackage = card.dataset.package;
                
                // Announce selection to screen readers
                const packageName = this.getPackageName(this.selectedPackage);
                this.announceToScreenReader(`${packageName} package selected`);
                
                // Enable download button
                if (this.elements.downloadBtn) {
                    this.elements.downloadBtn.disabled = false;
                    this.elements.downloadBtn.textContent = `Download ${packageName} Package`;
                    this.elements.downloadBtn.setAttribute('aria-label', `Download ${packageName} Package`);
                }
                
                // Update integration manager
                if (this.integrationManager) {
                    try {
                        this.integrationManager.setPackageType(this.selectedPackage);
                    } catch (error) {
                        console.error('Failed to set package type:', error);
                        this.displayToast('Failed to select package. Please try again.', 'error');
                    }
                }
            };
            
            // Click handler
            card.addEventListener('click', handleSelect);
            
            // Keyboard navigation
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect();
                }
                
                // Arrow key navigation
                const cards = Array.from(this.elements.optionCards);
                const currentIndex = cards.indexOf(card);
                
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextCard = cards[(currentIndex + 1) % cards.length];
                    nextCard.focus();
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prevCard = cards[(currentIndex - 1 + cards.length) % cards.length];
                    prevCard.focus();
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
                    this.displayToast('Please select a package first', 'warning');
                    return;
                }
                
                if (this.isDownloading) {
                    this.displayToast('Download already in progress', 'info');
                    return;
                }
                
                this.startDownload();
            });
        }
    }

    /**
     * Set up handlers for pause, resume, and cancel buttons
     */
    setupDownloadControlHandlers() {
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.addEventListener('click', () => {
                if (this.integrationManager) {
                    this.integrationManager.pauseDownload();
                    this.elements.pauseBtn.style.display = 'none';
                    if (this.elements.resumeBtn) this.elements.resumeBtn.style.display = 'inline-block';
                    this.updateProgress(null, 'Download paused');
                }
            });
        }

        if (this.elements.resumeBtn) {
            this.elements.resumeBtn.addEventListener('click', () => {
                if (this.integrationManager) {
                    this.integrationManager.resumeDownload();
                    this.elements.resumeBtn.style.display = 'none';
                    if (this.elements.pauseBtn) this.elements.pauseBtn.style.display = 'inline-block';
                    this.updateProgress(null, 'Resuming download...');
                }
            });
        }

        if (this.elements.cancelBtn) {
            this.elements.cancelBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to cancel the download?')) {
                    if (this.integrationManager) {
                        this.integrationManager.cancelDownload();
                        this.handleDownloadFailure();
                        this.displayToast('Download cancelled', 'info');
                    }
                }
            });
        }
    }

    /**
     * Start periodic storage monitoring
     */
    startStorageMonitoring() {
        this.updateStorageInfo();
        // Update every 30 seconds
        setInterval(() => this.updateStorageInfo(), 30000);
    }

    /**
     * Update storage usage information
     */
    async updateStorageInfo() {
        if (!navigator.storage || !navigator.storage.estimate) {
            if (this.elements.storageSummary) this.elements.storageSummary.textContent = 'Not supported';
            return;
        }

        try {
            const estimate = await navigator.storage.estimate();
            const used = estimate.usage || 0;
            const quota = estimate.quota || 0;
            const percent = quota > 0 ? (used / quota) * 100 : 0;

            if (this.elements.storageSummary) {
                this.elements.storageSummary.textContent = `${Math.round(percent)}% used`;
            }

            if (this.elements.storageFill) {
                this.elements.storageFill.style.width = `${percent}%`;
                if (percent > 80) {
                    this.elements.storageFill.style.backgroundColor = '#ef4444';
                } else if (percent > 50) {
                    this.elements.storageFill.style.backgroundColor = '#f59e0b';
                }
            }

            if (this.elements.storageUsed) this.elements.storageUsed.textContent = `Used: ${this.formatBytes(used)}`;
            if (this.elements.storageAvailable) this.elements.storageAvailable.textContent = `Available: ${this.formatBytes(quota - used)}`;
            if (this.elements.storageQuota) this.elements.storageQuota.textContent = `Quota: ${this.formatBytes(quota)}`;

            if (this.elements.storageWarning) {
                this.elements.storageWarning.style.display = percent > 80 ? 'block' : 'none';
            }
        } catch (error) {
            console.error('Failed to get storage estimate:', error);
        }
    }

    /**
     * Format bytes to human-readable string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Start the download process
     */
    startDownload() {
        // Validate state
        if (this.isDownloading) {
            this.displayToast('Download already in progress', 'info');
            return;
        }
        
        if (!this.selectedPackage) {
            this.displayToast('Please select a package first', 'warning');
            return;
        }
        
        this.isDownloading = true;
        
        // Update UI
        if (this.elements.downloadBtn) {
            this.elements.downloadBtn.disabled = true;
            this.elements.downloadBtn.textContent = 'Downloading...';
            this.elements.downloadBtn.setAttribute('aria-busy', 'true');
        }
        
        // Disable package selection during download
        this.elements.optionCards.forEach(card => {
            card.style.pointerEvents = 'none';
            card.style.opacity = '0.6';
        });
        
        if (this.elements.progressSection) {
            this.elements.progressSection.style.display = 'block';
            this.elements.progressSection.setAttribute('aria-hidden', 'false');
        }
        
        this.updateProgress(0, 'Starting download...');
        this.announceToScreenReader('Download started');
        
        // Start download via integration manager
        if (this.integrationManager && typeof this.integrationManager.startDownload === 'function') {
            try {
                this.integrationManager.startDownload();
            } catch (error) {
                console.error('Download error:', error);
                this.displayToast(`Download failed: ${error.message || 'Unknown error'}`, 'error');
                this.handleDownloadFailure();
            }
        } else {
            this.displayToast('Download manager not available. Please refresh the page.', 'error');
            this.handleDownloadFailure();
        }
    }
    
    /**
     * Handle download failure and reset state
     */
    handleDownloadFailure() {
        this.isDownloading = false;
        this.resetDownloadButton();
        
        // Re-enable package selection
        this.elements.optionCards.forEach(card => {
            card.style.pointerEvents = '';
            card.style.opacity = '';
        });
        
        if (this.elements.progressSection) {
            this.elements.progressSection.style.display = 'none';
            this.elements.progressSection.setAttribute('aria-hidden', 'true');
        }
    }
    
    /**
     * Update download progress
     */
    updateProgress(percent, details) {
        // Validate percent value
        const validPercent = Math.max(0, Math.min(100, percent || 0));
        
        if (this.elements.progressText) {
            this.elements.progressText.textContent = `Downloading... ${Math.round(validPercent)}%`;
        }
        
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = `${validPercent}%`;
            this.elements.progressFill.setAttribute('aria-valuenow', validPercent);
        }
        
        if (this.elements.progressDetails && details) {
            const sanitizedDetails = this.sanitizeHTML(details);
            this.elements.progressDetails.textContent = sanitizedDetails;
        }
        
        // Announce progress milestones to screen readers
        if (validPercent === 25 || validPercent === 50 || validPercent === 75 || validPercent === 100) {
            this.announceToScreenReader(`Download ${validPercent}% complete`);
        }
        
        // Handle completion
        if (validPercent >= 100) {
            this.handleDownloadComplete();
        }
    }
    
    /**
     * Handle download completion
     */
    handleDownloadComplete() {
        this.isDownloading = false;
        
        // Update button
        if (this.elements.downloadBtn) {
            this.elements.downloadBtn.textContent = 'Download Complete';
            this.elements.downloadBtn.removeAttribute('aria-busy');
        }
        
        // Re-enable package selection
        this.elements.optionCards.forEach(card => {
            card.style.pointerEvents = '';
            card.style.opacity = '';
        });
        
        // Show success message
        this.displayToast('Offline package downloaded successfully!', 'success');
        this.announceToScreenReader('Download completed successfully');
        
        // Enable chat
        this.enableChat();
        
        // Show chat and wiki sections
        if (this.elements.chatSection) {
            this.elements.chatSection.style.display = 'block';
        }
        if (this.elements.wikiSection) {
            this.elements.wikiSection.style.display = 'block';
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
            // Support Enter to send, Shift+Enter for new line
            this.elements.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); // Prevent default to avoid form submission
                    this.sendMessage();
                }
            });
            
            // Add input validation feedback
            this.elements.chatInput.addEventListener('input', (e) => {
                const length = e.target.value.length;
                if (length > 5000) {
                    e.target.setAttribute('aria-invalid', 'true');
                    this.displayToast('Message is too long (max 5000 characters)', 'warning');
                } else {
                    e.target.removeAttribute('aria-invalid');
                }
            });
        }
    }
    
    /**
     * Send a chat message
     */
    async sendMessage() {
        // Prevent sending if already processing
        if (this.elements.sendBtn?.disabled) {
            return;
        }
        
        const message = this.elements.chatInput?.value?.trim();
        
        if (!message) {
            this.displayToast('Please enter a message', 'warning');
            this.elements.chatInput?.focus();
            return;
        }
        
        // Check message length
        if (message.length > 5000) {
            this.displayToast('Message is too long. Please keep it under 5000 characters.', 'warning');
            return;
        }
        
        // Check if AI is ready
        if (!this.integrationManager || !this.integrationManager.isInitialized) {
            this.displayToast('Please download the offline package first', 'warning');
            return;
        }
        
        // Disable send button during processing
        if (this.elements.sendBtn) {
            this.elements.sendBtn.disabled = true;
            this.elements.sendBtn.setAttribute('aria-busy', 'true');
        }
        
        // Add user message to chat
        this.addChatMessage(message, 'user');
        
        // Clear input
        this.elements.chatInput.value = '';
        
        // Show loading indicator
        const loadingId = this.addChatMessage('Thinking...', 'assistant', true);
        
        try {
            // Get AI response with timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout - AI is taking too long to respond')), 60000)
            );
            
            const response = await Promise.race([
                this.integrationManager.chat(message),
                timeoutPromise
            ]);
            
            // Validate response
            if (!response || typeof response !== 'string') {
                throw new Error('Invalid response from AI');
            }
            
            // Remove loading message
            this.removeChatMessage(loadingId);
            
            // Add AI response
            this.addChatMessage(response, 'assistant');
        } catch (error) {
            console.error('Chat error:', error);
            
            // Remove loading message
            this.removeChatMessage(loadingId);
            
            // Show appropriate error message
            let errorMessage = 'An unexpected error occurred';
            if (error.message.includes('timeout')) {
                errorMessage = 'Request timeout - AI is taking too long to respond';
            } else if (error.message.includes('network')) {
                errorMessage = 'Network error - Please check your connection';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            // Show error in chat
            this.addChatMessage(`Error: ${errorMessage}`, 'assistant', false, true);
            this.displayToast('Failed to get AI response', 'error');
        } finally {
            // Re-enable send button
            if (this.elements.sendBtn) {
                this.elements.sendBtn.disabled = false;
                this.elements.sendBtn.removeAttribute('aria-busy');
            }
            
            // Refocus input for accessibility
            this.elements.chatInput?.focus();
        }
    }
    
    /**
     * Add a message to the chat
     */
    addChatMessage(text, sender, isLoading = false, isError = false) {
        if (!this.elements.chatMessages) return null;
        
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = `chat-message ${sender}-message`;
        messageDiv.setAttribute('role', 'article');
        messageDiv.setAttribute('aria-label', `${sender === 'user' ? 'User' : 'AI Assistant'} message`);
        
        if (isLoading) {
            messageDiv.classList.add('loading');
            messageDiv.setAttribute('aria-busy', 'true');
        }
        
        if (isError) {
            messageDiv.classList.add('error');
            messageDiv.setAttribute('aria-live', 'assertive');
        }
        
        const label = sender === 'user' ? 'You' : 'AI Assistant';
        // Sanitize text to prevent XSS
        const sanitizedText = this.sanitizeHTML(text);
        messageDiv.innerHTML = `<strong>${label}:</strong> ${sanitizedText}`;
        
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
     * NOTE: Disabled - AIWikipediaSearch handles this directly
     */
    setupWikiSearchHandlers() {
        // Search handlers are now managed by AIWikipediaSearch class
        // This prevents duplicate event handlers and search calls
        /*
        if (this.elements.wikiSearchBtn) {
            this.elements.wikiSearchBtn.addEventListener('click', () => this.searchWikipedia());
        }
        
        if (this.elements.wikiSearchInput) {
            this.elements.wikiSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent form submission
                    this.searchWikipedia();
                }
            });
        */
            
        if (this.elements.wikiSearchInput) {
            
            // Add input validation
            this.elements.wikiSearchInput.addEventListener('input', (e) => {
                const length = e.target.value.length;
                if (length > 200) {
                    e.target.setAttribute('aria-invalid', 'true');
                } else {
                    e.target.removeAttribute('aria-invalid');
                }
            });
        }
    }
    
    /**
     * Search Wikipedia
     */
    async searchWikipedia() {
        // Prevent multiple simultaneous searches
        if (this.elements.wikiSearchBtn?.disabled) {
            return;
        }
        
        const query = this.elements.wikiSearchInput?.value?.trim();
        
        if (!query) {
            this.displayToast('Please enter a search term', 'warning');
            this.elements.wikiSearchInput?.focus();
            return;
        }
        
        // Validate query length
        if (query.length < 2) {
            this.displayToast('Search term must be at least 2 characters', 'warning');
            return;
        }
        
        if (query.length > 200) {
            this.displayToast('Search term is too long (max 200 characters)', 'warning');
            return;
        }
        
        // Check if Wikipedia is ready
        if (!this.integrationManager || !this.integrationManager.isInitialized) {
            this.displayToast('Please download the offline package first', 'warning');
            return;
        }
        
        // Disable search button
        if (this.elements.wikiSearchBtn) {
            this.elements.wikiSearchBtn.disabled = true;
            this.elements.wikiSearchBtn.setAttribute('aria-busy', 'true');
        }
        
        // Show loading
        if (this.elements.wikiResults) {
            this.elements.wikiResults.innerHTML = '<div class="loading" role="status" aria-live="polite">Searching...</div>';
        }
        
        try {
            // Search with timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Search timeout')), 30000)
            );
            
            const results = await Promise.race([
                this.integrationManager.searchWikipedia(query),
                timeoutPromise
            ]);
            
            this.displayWikiResults(results);
        } catch (error) {
            console.error('Wikipedia search error:', error);
            
            let errorMessage = 'Search failed';
            if (error.message.includes('timeout')) {
                errorMessage = 'Search timeout - Please try again';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            if (this.elements.wikiResults) {
                this.elements.wikiResults.innerHTML = `<div class="error" role="alert">${this.sanitizeHTML(errorMessage)}</div>`;
            }
            this.displayToast('Wikipedia search failed', 'error');
        } finally {
            // Re-enable search button
            if (this.elements.wikiSearchBtn) {
                this.elements.wikiSearchBtn.disabled = false;
                this.elements.wikiSearchBtn.removeAttribute('aria-busy');
            }
        }
    }
    
    /**
     * Display Wikipedia search results
     */
    displayWikiResults(results) {
        if (!this.elements.wikiResults) return;
        
        // Set aria-live for screen readers
        this.elements.wikiResults.setAttribute('aria-live', 'polite');
        
        if (!results || results.length === 0) {
            this.elements.wikiResults.innerHTML = '<div class="no-results" role="status">No results found</div>';
            return;
        }
        
        const html = results.map((result, index) => {
            // Sanitize result data
            const title = this.sanitizeHTML(result.title || 'Untitled');
            const snippet = this.sanitizeHTML(
                result.snippet || 
                result.content?.substring(0, 200) + '...' || 
                'No description available'
            );
            
            return `
                <article class="wiki-result" role="article" aria-label="Wikipedia result ${index + 1}">
                    <h4>${title}</h4>
                    <p>${snippet}</p>
                </article>
            `;
        }).join('');
        
        this.elements.wikiResults.innerHTML = html;
        
        // Announce results count to screen readers
        const resultCount = results.length;
        const announcement = `Found ${resultCount} result${resultCount !== 1 ? 's' : ''}`;
        this.announceToScreenReader(announcement);
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
        // Prevent multiple simultaneous clear operations
        if (this.elements.clearCacheBtn?.disabled) {
            return;
        }
        
        // Confirm with user - use custom dialog for better UX
        const confirmed = confirm(
            'Are you sure you want to clear all offline data?\n\n' +
            'This will remove:\n' +
            '- Downloaded AI models\n' +
            '- Wikipedia data\n' +
            '- All cached files\n\n' +
            'You will need to download the package again to use offline features.'
        );
        
        if (!confirmed) {
            return;
        }
        
        // Disable clear button during operation
        if (this.elements.clearCacheBtn) {
            this.elements.clearCacheBtn.disabled = true;
            this.elements.clearCacheBtn.setAttribute('aria-busy', 'true');
        }
        
        this.displayToast('Clearing cache...', 'info');
        
        try {
            // Clear IndexedDB databases
            if ('databases' in indexedDB) {
                const databases = await indexedDB.databases();
                for (const db of databases) {
                    if (db.name) {
                        await new Promise((resolve, reject) => {
                            const request = indexedDB.deleteDatabase(db.name);
                            request.onsuccess = resolve;
                            request.onerror = () => reject(new Error(`Failed to delete database: ${db.name}`));
                            request.onblocked = () => {
                                console.warn(`Database ${db.name} is blocked - close all tabs using it`);
                                reject(new Error(`Database ${db.name} is blocked. Please close all other tabs.`));
                            };
                        });
                    }
                }
            }
            
            // Clear localStorage with error handling
            try {
                localStorage.clear();
            } catch (e) {
                console.warn('Failed to clear localStorage:', e);
            }
            
            // Clear sessionStorage with error handling
            try {
                sessionStorage.clear();
            } catch (e) {
                console.warn('Failed to clear sessionStorage:', e);
            }
            
            // Clear Service Worker caches if available
            if ('caches' in window) {
                try {
                    const cacheNames = await caches.keys();
                    await Promise.all(
                        cacheNames.map(cacheName => caches.delete(cacheName))
                    );
                } catch (e) {
                    console.warn('Failed to clear Service Worker caches:', e);
                }
            }
            
            this.displayToast('All offline data cleared successfully', 'success');
            
            // Reset UI state
            this.selectedPackage = null;
            this.isDownloading = false;
            this.elements.optionCards.forEach(c => c.classList.remove('selected'));
            this.resetDownloadButton();
            this.updateStatus('compatible', 'Cache cleared', 'Select a package to download offline data.');
            
            // Clear chat messages
            if (this.elements.chatMessages) {
                this.elements.chatMessages.innerHTML = '';
            }
            
            // Reset integrationManager
            if (this.integrationManager) {
                this.integrationManager.isInitialized = false;
                this.integrationManager.initialized = false;
            }
            
        } catch (error) {
            console.error('Failed to clear cache:', error);
            this.displayToast(
                `Failed to clear cache: ${error.message || 'Unknown error'}`, 
                'error'
            );
        } finally {
            // Re-enable clear button
            if (this.elements.clearCacheBtn) {
                this.elements.clearCacheBtn.disabled = false;
                this.elements.clearCacheBtn.removeAttribute('aria-busy');
            }
        }
    }
    
    /**
     * Display a toast notification
     * Uses available toast system (toast.js, Toast global, or fallback)
     */
    displayToast(message, type = 'info') {
        // Use the toast.js if available
        if (typeof toast !== 'undefined' && typeof toast.show === 'function') {
            toast.show(message, type);
        } else if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast(message, type);
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
    
    /**
     * Sanitize HTML to prevent XSS attacks
     */
    sanitizeHTML(text) {
        if (!text) return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Set up the download log toggle handler
     */
    setupLogToggleHandler() {
        const toggleBtn = this.elements.toggleLogBtn;
        const downloadLog = this.elements.downloadLog;
        
        if (toggleBtn && downloadLog) {
            // Initially hide the log
            downloadLog.style.display = 'none';
            
            toggleBtn.addEventListener('click', () => {
                this.logVisible = !this.logVisible;
                
                if (this.logVisible) {
                    downloadLog.style.display = 'block';
                    toggleBtn.textContent = 'Hide Details';
                } else {
                    downloadLog.style.display = 'none';
                    toggleBtn.textContent = 'Show Details';
                }
            });
        }
    }
    
    /**
     * Add a log entry to the download log
     */
    addLogEntry(type, message) {
        const downloadLog = this.elements.downloadLog;
        if (!downloadLog) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const entry = {
            type,
            message,
            timestamp
        };
        
        this.logEntries.push(entry);
        
        // Create log entry element
        const entryDiv = document.createElement('div');
        entryDiv.className = `log-entry log-${type}`;
        
        const typeIcon = this.getLogTypeIcon(type);
        entryDiv.innerHTML = `
            <span class="log-time">[${timestamp}]</span>
            <span class="log-icon">${typeIcon}</span>
            <span class="log-message">${this.sanitizeHTML(message)}</span>
        `;
        
        // Clear placeholder comment if it's the first entry
        if (this.logEntries.length === 1) {
            downloadLog.innerHTML = '';
        }
        
        downloadLog.appendChild(entryDiv);
        
        // Auto-scroll to bottom
        downloadLog.scrollTop = downloadLog.scrollHeight;
    }
    
    /**
     * Get icon for log type
     */
    getLogTypeIcon(type) {
        const icons = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'download': '⬇️',
            'progress': '📊',
            'complete': '🎉'
        };
        return icons[type] || 'ℹ️';
    }
    
    /**
     * Clear all log entries
     */
    clearLogEntries() {
        const downloadLog = this.elements.downloadLog;
        if (downloadLog) {
            downloadLog.innerHTML = '';
            this.logEntries = [];
        }
    }
    
    /**
     * Announce message to screen readers
     */
    announceToScreenReader(message) {
        // Create or get aria-live region
        let liveRegion = document.getElementById('sr-live-region');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'sr-live-region';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.setAttribute('class', 'sr-only');
            liveRegion.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;';
            document.body.appendChild(liveRegion);
        }
        
        // Clear and set new message
        liveRegion.textContent = '';
        setTimeout(() => {
            liveRegion.textContent = message;
        }, 100);
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
