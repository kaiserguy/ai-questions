/**
 * Offline Mode Integration Manager
 * Coordinates the download, initialization, and integration of offline components
 */
class OfflineIntegrationManager {
    constructor() {
        this.downloadManager = null;
        this.aiManager = null;
        this.wikiManager = null;
        this.aiModelManager = null; // Alias for tests
        this.wikipediaManager = null; // Alias for tests
        this.packageType = null; // Start with null as tests expect
        this.initialized = false;
        this.isInitialized = false; // Alias for tests
        this.onStatusUpdate = null;
        this.error = null;
    }
    
    /**
     * Set event handlers for status updates
     */
    setEventHandlers(handlers) {
        this.onStatusUpdate = handlers.onStatusUpdate || null;
    }
    
    /**
     * Set the package type
     */
    setPackageType(packageType) {
        // Validate input
        if (packageType === null || packageType === undefined || packageType === '') {
            throw new Error('Package type cannot be null, undefined, or empty');
        }
        
        if (!['minimal', 'standard', 'full'].includes(packageType)) {
            throw new Error(`Invalid package type: ${packageType}`);
        }
        
        this.packageType = packageType;
    }
    
    /**
     * Start the download process
     */
    startDownload() {
        this.updateStatus(`Starting download of ${this.packageType} package`);
        
        // Create download manager
        this.downloadManager = new DownloadManager(this.packageType);
        
        // Set up event handlers
        this.downloadManager.setEventHandlers({
            onProgressUpdate: (message, progress) => {
                if (message) {
                    this.updateStatus(message);
                }
                this.updateDownloadProgress(progress);
            },
            onResourceUpdate: (resource, status, progress) => {
                this.updateResourceStatus(resource, status, progress);
            },
            onComplete: () => {
                this.initializeComponents();
            },
            onError: (error) => {
                this.updateStatus(`Download error: ${error}`, 'error');
            }
        });
        
        // Start download
        this.downloadManager.startDownload();
    }
    
    /**
     * Initialize AI and Wikipedia components
     */
    async initializeComponents() {
        if (!this.packageType) {
            throw new Error('Package type must be set before initializing components');
        }
        
        this.updateStatus('Initializing offline components...');
        
        try {
            // Create managers if they don't exist (for production use)
            // Tests will inject mock managers before calling this method
            if (!this.aiModelManager && typeof AIModelManager !== 'undefined') {
                this.aiModelManager = new AIModelManager(this.packageType);
            }
            
            if (!this.wikipediaManager && typeof WikipediaManager !== 'undefined') {
                this.wikipediaManager = new WikipediaManager(this.packageType);
            }
            
            // Initialize AI Model Manager if it exists
            if (this.aiModelManager) {
                await this.aiModelManager.initialize();
                this.aiManager = this.aiModelManager; // Keep both references
            }
            
            // Initialize Wikipedia Manager if it exists
            if (this.wikipediaManager) {
                await this.wikipediaManager.initialize();
                this.wikiManager = this.wikipediaManager; // Keep both references
            }
            
            this.initialized = true;
            this.isInitialized = true;
            this.checkInitializationComplete();
            
        } catch (error) {
            this.error = error.message;
            this.updateStatus(`Initialization error: ${error.message}`, 'error');
            
            // Call error handler if it exists
            if (this.onError) {
                this.onError(error);
            }
            
            // Call cleanup if it exists
            if (this.cleanup) {
                await this.cleanup();
            }
            
            throw error;
        }
    }
    
    /**
     * Check if all components are initialized
     * @returns {boolean} True if all components are ready
     */
    checkInitializationComplete() {
        // Check if both managers exist and are ready
        const aiReady = this.aiModelManager && this.aiModelManager.isReady();
        const wikiReady = this.wikipediaManager && this.wikipediaManager.isReady();
        
        if (aiReady && wikiReady) {
            this.initialized = true;
            this.isInitialized = true;
            this.updateStatus('All components initialized successfully');
            
            // Show the chat and wiki sections (only if DOM elements exist)
            const progressSection = document.getElementById('progressSection');
            const chatSection = document.getElementById('chatSection');
            const wikiSection = document.getElementById('wikiSection');
            
            if (progressSection) progressSection.style.display = 'none';
            if (chatSection) chatSection.style.display = 'block';
            if (wikiSection) wikiSection.style.display = 'block';
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Show the offline interface (UI sections)
     */
    showOfflineInterface() {
        const progressSection = document.getElementById('progressSection');
        const chatSection = document.getElementById('chatSection');
        const wikiSection = document.getElementById('wikiSection');
        
        if (progressSection) progressSection.style.display = 'none';
        if (chatSection) chatSection.style.display = 'block';
        if (wikiSection) wikiSection.style.display = 'block';
    }
    
    /**
     * Update progress display
     */
    updateProgress(message, progress) {
        const progressElement = document.getElementById('progressText');
        if (progressElement) {
            progressElement.textContent = `${message} ${progress}%`;
        }
    }
    
    /**
     * Handle errors
     */
    handleError(error) {
        this.error = error.message || error;
        console.error('[OfflineIntegrationManager] Error:', error);
        
        if (this.onError) {
            this.onError(error);
        }
    }
    
    /**
     * Display error message to user
     */
    displayError(message) {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }
    
    /**
     * Generate a chat response
     */
    async generateChatResponse(prompt) {
        if (!this.initialized || !this.aiManager || !this.aiManager.initialized) {
            throw new Error('AI components not initialized');
        }
        
        return await this.aiManager.generateResponse(prompt);
    }
    
    /**
     * Stream a chat response
     */
    async streamChatResponse(prompt, onToken) {
        if (!this.initialized || !this.aiManager || !this.aiManager.initialized) {
            throw new Error('AI components not initialized');
        }
        
        return await this.aiManager.streamResponse(prompt, onToken);
    }
    
    /**
     * Search Wikipedia
     */
    async searchWikipedia(query) {
        if (!this.initialized || !this.wikiManager || !this.wikiManager.initialized) {
            throw new Error('Wikipedia components not initialized');
        }
        
        return await this.wikiManager.search(query);
    }
    
    /**
     * Get Wikipedia article
     */
    async getWikipediaArticle(idOrTitle) {
        if (!this.initialized || !this.wikiManager || !this.wikiManager.initialized) {
            throw new Error('Wikipedia components not initialized');
        }
        
        return await this.wikiManager.getArticle(idOrTitle);
    }
    
    /**
     * Update status and notify listeners
     */
    updateStatus(message, status = 'info') {
        console.log(`[OfflineIntegrationManager] ${message}`);
        
        if (this.onStatusUpdate) {
            this.onStatusUpdate(message, status);
        }
    }
    
    /**
     * Update download progress in UI
     */
    updateDownloadProgress(progress) {
        document.getElementById('progressText').textContent = `Downloading... ${progress}%`;
        document.getElementById('progressFill').style.width = `${progress}%`;
    }
    
    /**
     * Update resource status in UI
     */
    updateResourceStatus(resource, status, progress) {
        const container = document.getElementById('resourceStatus');
        
        // Find existing resource item or create new one
        let item = container.querySelector(`[data-resource="${resource}"]`);
        
        if (!item) {
            item = document.createElement('div');
            item.className = 'resource-item';
            item.setAttribute('data-resource', resource);
            container.appendChild(item);
        }
        
        // Update item content
        const statusClass = status === 'loaded' ? 'loaded' : 
                           status === 'error' ? 'error' : 'pending';
        
        const resourceName = this.downloadManager ? 
                            this.downloadManager.getResourceName(resource) : 
                            resource;
        
        const statusText = status === 'loaded' ? 'Loaded' : 
                          status === 'downloading' ? `${progress}%` : 
                          status === 'error' ? 'Error' : 'Pending';
        
        item.innerHTML = `
            <div class="status-indicator ${statusClass}"></div>
            <span>${resourceName}</span>
            <span>${statusText}</span>
        `;
    }
    
    /**
     * Check if browser supports all required features
     */
    static checkBrowserCompatibility() {
        const requirements = {
            indexedDB: 'indexedDB' in window,
            webAssembly: typeof WebAssembly === 'object',
            serviceWorker: 'serviceWorker' in navigator,
            cacheAPI: 'caches' in window
        };
        
        const allMet = Object.values(requirements).every(req => req);
        
        return {
            compatible: allMet,
            requirements: requirements,
            missingFeatures: Object.entries(requirements)
                .filter(([_, supported]) => !supported)
                .map(([feature, _]) => feature)
        };
    }
    
    /**
     * Check for existing installation in IndexedDB
     */
    static async checkExistingInstallation() {
        // For now, return false to avoid initialization issues
        // TODO: Check IndexedDB for existing data
        return {
            installed: false,
            packageType: 'standard' // Default package type
        };
    }
}

// Make available globally for browser
if (typeof window !== 'undefined') {
    window.OfflineIntegrationManager = OfflineIntegrationManager;
}
// Make available for Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineIntegrationManager;
}
