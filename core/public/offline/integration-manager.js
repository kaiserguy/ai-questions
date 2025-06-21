/**
 * Offline Mode Integration Manager
 * Coordinates the download, initialization, and integration of offline components
 */
class OfflineIntegrationManager {
    constructor() {
        this.downloadManager = null;
        this.aiManager = null;
        this.wikiManager = null;
        this.packageType = 'standard'; // Default package type
        this.initialized = false;
        this.onStatusUpdate = null;
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
        this.updateStatus('Initializing offline components...');
        
        try {
            // Create AI manager
            this.aiManager = new AIModelManager(this.packageType);
            
            // Set up AI event handlers
            this.aiManager.setEventHandlers({
                onStatusUpdate: (message, status) => {
                    this.updateStatus(message, status);
                },
                onModelLoaded: () => {
                    this.updateStatus('AI models ready');
                    this.checkInitializationComplete();
                }
            });
            
            // Create Wikipedia manager
            this.wikiManager = new WikipediaManager(this.packageType);
            
            // Set up Wikipedia event handlers
            this.wikiManager.setEventHandlers({
                onStatusUpdate: (message, status) => {
                    this.updateStatus(message, status);
                },
                onDatabaseLoaded: () => {
                    this.updateStatus('Wikipedia database ready');
                    this.checkInitializationComplete();
                }
            });
            
            // Initialize components in parallel
            await Promise.all([
                this.aiManager.initialize(),
                this.wikiManager.initialize()
            ]);
            
        } catch (error) {
            this.updateStatus(`Initialization error: ${error.message}`, 'error');
        }
    }
    
    /**
     * Check if all components are initialized
     */
    checkInitializationComplete() {
        if (this.aiManager && this.aiManager.initialized && 
            this.wikiManager && this.wikiManager.initialized) {
            
            this.initialized = true;
            this.updateStatus('All components initialized successfully');
            
            // Show the chat and wiki sections
            document.getElementById('progressSection').style.display = 'none';
            document.getElementById('chatSection').style.display = 'block';
            document.getElementById('wikiSection').style.display = 'block';
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
        // In a real implementation, this would check IndexedDB for existing data
        // For now, we'll simulate this check
        return {
            installed: false,
            packageType: null
        };
    }
}

// Make available globally
window.OfflineIntegrationManager = OfflineIntegrationManager;
