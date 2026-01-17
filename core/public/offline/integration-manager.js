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
     * Initialize the offline mode (for existing installations)
     * This shows the UI and initializes components in the background
     */
    async initialize() {
        this.updateStatus('Initializing offline mode...');
        
        // Set a default package type if not set
        if (!this.packageType) {
            this.packageType = 'minimal';
        }
        
        // Try to initialize components if they exist
        try {
            await this.initializeComponents();
        } catch (error) {
            // If initialization fails, still show the UI with error messages
            console.error('Component initialization failed:', error);
            this.checkInitializationComplete();
        }
    }
    
    /**
     * Set the package type
     */
    setPackageType(packageType) {
        // Validate input
        if (packageType === null || packageType === undefined || packageType === '') {
            throw new Error('Package type cannot be null, undefined, or empty');
        }
        
        if (!['mobile', 'minimal', 'standard', 'full'].includes(packageType)) {
            throw new Error(`Invalid package type: ${packageType}`);
        }
        
        this.packageType = packageType;
    }
    
    /**
     * Start the download process
     */
    startDownload() {
        this.updateStatus(`Starting download of ${this.packageType} package`);
        
        // Create download manager if it doesn't exist
        if (!this.downloadManager) {
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
            
            // Set up log entry handler
            this.downloadManager.onLogEntry = (type, message) => {
                if (window.uiManager && window.uiManager.addLogEntry) {
                    window.uiManager.addLogEntry(type, message);
                }
            };
        }
        
        // Start download
        this.downloadManager.startDownload();
    }

    /**
     * Pause the download process
     */
    pauseDownload() {
        if (this.downloadManager) {
            this.downloadManager.pause();
            this.updateStatus('Download paused');
        }
    }

    /**
     * Resume the download process
     */
    resumeDownload() {
        if (this.downloadManager) {
            this.downloadManager.resume();
            this.updateStatus('Download resumed');
        }
    }

    /**
     * Cancel the download process
     */
    cancelDownload() {
        if (this.downloadManager) {
            this.downloadManager.abort();
            this.updateStatus('Download cancelled');
        }
    }
    
    /**
     * Initialize AI and Wikipedia components
     */
    async initializeComponents() {
        // Prevent duplicate initialization
        if (this.initialized) {
            console.log('[OfflineIntegrationManager] Components already initialized, skipping');
            return;
        }
        
        if (!this.packageType) {
            throw new Error('Package type must be set before initializing components');
        }
        
        this.updateStatus('Initializing offline components...');
        
        try {
            // Use the AI manager that was initialized during download if available
            if (this.downloadManager && this.downloadManager.initializedAIManager) {
                this.aiModelManager = this.downloadManager.initializedAIManager;
                this.aiManager = this.aiModelManager;
                console.log('[IntegrationManager] Using AI manager from download process');
            }
            // Otherwise create managers if they don't exist (for production use)
            // Tests will inject test managers before calling this method
            else if (!this.aiModelManager && typeof AIModelManager !== 'undefined') {
                this.aiModelManager = new AIModelManager(this.packageType);
                this.aiManager = this.aiModelManager; // Keep both references
            }
            
            if (!this.wikipediaManager && typeof AIWikipediaSearch !== 'undefined') {
                this.wikipediaManager = new AIWikipediaSearch();
            }
            
            // Initialize AI model manager if injected (for tests) or if it has an initialize method
            if (this.aiModelManager && typeof this.aiModelManager.initialize === 'function') {
                try {
                    await this.aiModelManager.initialize();
                } catch (aiError) {
                    console.error('AI model initialization failed:', aiError);
                    throw aiError; // Propagate error for tests to catch
                }
            }
            
            // Initialize AIWikipediaSearch if it exists
            if (this.wikipediaManager) {
                try {
                    if (typeof this.wikipediaManager.initialize === 'function') {
                        await this.wikipediaManager.initialize();
                    }
                    this.wikiManager = this.wikipediaManager; // Keep both references
                } catch (wikiError) {
                    console.warn('AIWikipediaSearch initialization failed:', wikiError);
                    this.wikipediaManager = null; // Clear failed manager
                    // Don't throw - allow initialization to continue without Wikipedia
                }
            }
            
            this.initialized = true;
            this.isInitialized = true;
            this.checkInitializationComplete();
            
            // Only show "Downloaded" if Wikipedia database is actually available
            // Check if the database was successfully loaded
            const hasWikipediaDb = this.wikipediaManager && this.wikipediaManager.db;
            if (hasWikipediaDb) {
                this.updateDownloadButton('ready');
            } else {
                console.log('[IntegrationManager] Wikipedia database not loaded, keeping download button enabled');
            }
            if (typeof updateModelStatus === 'function') {
                setTimeout(() => updateModelStatus(), 200);
            }
            
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
     * Helper method to check if a manager is ready
     * @param {Object} manager - The manager to check
     * @returns {boolean} True if manager exists and is ready
     */
    isManagerReady(manager) {
        return manager && typeof manager.isReady === 'function' && manager.isReady();
    }
    
    /**
     * Check if all components are initialized
     * @returns {boolean} True if all components are ready
     */
    checkInitializationComplete() {
        // Check if both managers exist and are ready
        const aiReady = this.isManagerReady(this.aiModelManager);
        const wikiReady = this.isManagerReady(this.wikipediaManager);
        
        // Show UI even if managers aren't ready
        // This allows users to see the interface and get helpful error messages
        const progressSection = document.getElementById('progressSection');
        const chatSection = document.getElementById('chatSection');
        const wikiSection = document.getElementById('wikiSection');
        
        if (progressSection) progressSection.style.display = 'none';
        if (chatSection) chatSection.style.display = 'block';
        if (wikiSection) wikiSection.style.display = 'block';
        
        if (aiReady && wikiReady) {
            this.initialized = true;
            this.isInitialized = true;
            this.updateStatus('All components initialized successfully');
            
            // Update download button to show completion
            this.updateDownloadButton('ready');
            
            // Update model status in the UI
            if (typeof updateModelStatus === 'function') {
                setTimeout(() => updateModelStatus(), 100);
            }
            
            return true;
        } else {
            // Show UI but mark as not fully initialized
            this.initialized = false;
            this.isInitialized = false;
            this.updateStatus('Initializing offline components...');
            return false;
        }
    }
    
    /**
     * Update download button state
     */
    updateDownloadButton(state) {
        const downloadBtn = document.getElementById('downloadBtn');
        if (!downloadBtn) return;
        
        if (state === 'ready') {
            downloadBtn.textContent = '✓ Downloaded';
            downloadBtn.disabled = true;
            downloadBtn.classList.add('downloaded');
        }
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
     * Send a chat message and get a response (used by offline.ejs)
     * @param {string} message - The user's message
     * @returns {Promise<Object>} Response object with response property
     */
    async sendChatMessage(message) {
        if (!this.initialized || !this.aiManager) {
            throw new Error('AI components not initialized');
        }
        
        const response = await this.aiManager.generateResponse(message);
        return { response };
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
        const logMethod = status === 'error' ? console.error : status === 'warning' ? console.warn : console.log;
        logMethod(`[OfflineIntegrationManager] ${message}`);
        
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
        console.log('[CheckInstallation] Checking for existing installation...');
        return new Promise((resolve) => {
            if (typeof indexedDB === 'undefined') {
                console.log('[CheckInstallation] IndexedDB not available');
                resolve({ installed: false, packageType: 'standard' });
                return;
            }
            
            const request = indexedDB.open('OfflineAI', 2);
            
            request.onerror = () => {
                console.log('[CheckInstallation] Failed to open database');
                resolve({ installed: false, packageType: 'standard' });
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                console.log('[CheckInstallation] Database opened successfully');
                console.log('[CheckInstallation] Object stores:', Array.from(db.objectStoreNames));
                
                // Check if metadata store exists and has installation info
                if (!db.objectStoreNames.contains('metadata')) {
                    console.log('[CheckInstallation] No metadata store found');
                    db.close();
                    resolve({ installed: false, packageType: 'standard' });
                    return;
                }
                
                const transaction = db.transaction(['metadata'], 'readonly');
                const store = transaction.objectStore('metadata');
                const getRequest = store.get('installation');
                
                getRequest.onsuccess = () => {
                    const data = getRequest.result;
                    console.log('[CheckInstallation] Installation metadata:', data);
                    db.close();
                    
                    if (data && data.installed) {
                        console.log(`[CheckInstallation] ✅ Found installation: ${data.packageType} from ${data.installedAt}`);
                        resolve({
                            installed: true,
                            packageType: data.packageType || 'standard',
                            installedAt: data.installedAt,
                            version: data.version
                        });
                    } else {
                        console.log('[CheckInstallation] No installation marker found');
                        resolve({ installed: false, packageType: 'standard' });
                    }
                };
                
                getRequest.onerror = () => {
                    console.log('[CheckInstallation] Failed to get installation metadata');
                    db.close();
                    resolve({ installed: false, packageType: 'standard' });
                };
            };
            
            request.onupgradeneeded = (event) => {
                // Database doesn't exist yet, so not installed
                console.log('[CheckInstallation] Database upgrade needed - no installation');
                event.target.transaction.abort();
            };
        });
    }
}

// Make available globally for browser
if (typeof window !== 'undefined') {
    window.OfflineIntegrationManager = OfflineIntegrationManager;
    window.IntegrationManager = OfflineIntegrationManager; // Alias for backward compatibility
}
// Make available for Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineIntegrationManager;
}
