/**
 * Download Manager for AI Questions Offline Mode
 * Handles downloading and tracking of offline resources
 */
class DownloadManager {
    constructor(packageType) {
        this.packageType = packageType;
        this.progress = 0;
        this.resources = {
            aiModel: { status: 'pending', progress: 0 },
            wikipedia: { status: 'pending', progress: 0 },
            libraries: { status: 'pending', progress: 0 }
        };
        this.aborted = false;
        this.onProgressUpdate = null;
        this.onResourceUpdate = null;
        this.onComplete = null;
        this.onError = null;
        this.onLogUpdate = null; // New callback for log updates
        this.logs = []; // Array to store detailed logs
        
        // Package configurations
        this.packages = {
            minimal: {
                name: 'Minimal Package',
                aiModel: {
                    name: 'TinyBERT Model',
                    size: '~150MB'
                },
                wikipedia: {
                    name: 'Wikipedia Subset',
                    size: '~20MB'
                },
                totalSize: '~200MB'
            },
            standard: {
                name: 'Standard Package',
                aiModel: {
                    name: 'Phi-3 Mini Model',
                    size: '~500MB'
                },
                wikipedia: {
                    name: 'Simple Wikipedia',
                    size: '~50MB'
                },
                totalSize: '~800MB'
            },
            full: {
                name: 'Full Package',
                aiModel: {
                    name: 'Multiple AI Models',
                    size: '~1.5GB'
                },
                wikipedia: {
                    name: 'Extended Wikipedia',
                    size: '~200MB'
                },
                totalSize: '~2GB'
            }
        };
    }
    
    /**
     * Set event handlers for download progress
     */
    setEventHandlers(handlers) {
        this.onProgressUpdate = handlers.onProgressUpdate || null;
        this.onResourceUpdate = handlers.onResourceUpdate || null;
        this.onComplete = handlers.onComplete || null;
        this.onError = handlers.onError || null;
        this.onLogUpdate = handlers.onLogUpdate || null;
    }
    
    /**
     * Start the download process
     */
    async startDownload() {
        console.log(`Starting download of ${this.packageType} package`);
        this.logStep('Starting download process...', 'info');
        
        try {
            // Check package availability first
            this.logStep('Checking package availability...', 'info');
            await this.checkPackageAvailability();
            this.logStep('Package availability confirmed', 'success');
            
            // Start with libraries
            this.logStep('Beginning library downloads...', 'info');
            await this.downloadLibraries();
            this.logStep('Libraries downloaded successfully', 'success');
            
            // Then download AI model
            this.logStep('Beginning AI model download...', 'info');
            await this.downloadAIModel();
            this.logStep('AI model downloaded successfully', 'success');
            
            // Finally download Wikipedia
            this.logStep('Beginning Wikipedia database download...', 'info');
            await this.downloadWikipedia();
            this.logStep('Wikipedia database downloaded successfully', 'success');
            
            // Complete the process
            this.logStep('Finalizing download and initializing components...', 'info');
            await this.finishDownload();
            this.logStep('Download completed successfully!', 'success');
            
            if (this.onComplete) {
                this.onComplete();
            }
        } catch (error) {
            console.error('Download error:', error);
            this.logStep(`Download failed: ${error.message}`, 'error');
            if (this.onError) {
                this.onError(error.message);
            }
        }
    }
    
    /**
     * Check if the requested package is available
     */
    async checkPackageAvailability() {
        if (this.aborted) return;
        
        this.updateProgress('Checking package availability...');
        this.logStep('Contacting server to check package availability...', 'info');
        
        try {
            this.logStep('Sending request to /api/offline/packages/availability', 'info');
            const response = await fetch('/api/offline/packages/availability');
            this.logStep(`Server responded with status: ${response.status}`, 'info');
            
            const data = await response.json();
            this.logStep('Parsing server response...', 'info');
            
            if (!data.success) {
                this.logStep('Server reported package availability check failed', 'error');
                throw new Error('Failed to check package availability');
            }
            
            this.logStep('Package availability data received successfully', 'success');
            console.log('Package availability:', data);
            
            // For minimal package, we might use server-side cached resources
            if (this.packageType === 'minimal' && data.packages.minimal && data.packages.minimal.cached) {
                this.logStep('Server-side cached minimal package detected', 'info');
                console.log('Using server-side cached minimal package');
            }
            
            return data;
        } catch (error) {
            console.error('Error checking package availability:', error);
            this.logStep(`Package availability check failed: ${error.message}`, 'error');
            throw new Error('Failed to check package availability: ' + error.message);
        }
    }
    
    /**
     * Download required libraries
     */
    async downloadLibraries() {
        if (this.aborted) return;
        
        this.updateProgress('Downloading required libraries...');
        this.updateResource('libraries', 'downloading', 0);
        this.logStep('Starting library downloads...', 'info');
        
        // Libraries to download
        const libraries = [
            { name: 'transformers.js', size: 2.5 * 1024 * 1024 }, // 2.5MB
            { name: 'sql-wasm.js', size: 1.2 * 1024 * 1024 },     // 1.2MB
            { name: 'tokenizers.js', size: 0.8 * 1024 * 1024 }    // 0.8MB
        ];
        
        const totalSize = libraries.reduce((sum, lib) => sum + lib.size, 0);
        let downloadedSize = 0;
        
        this.logStep(`Downloading ${libraries.length} libraries (total: ${this.formatBytes(totalSize)})`, 'info');
        
        for (const library of libraries) {
            if (this.aborted) return;
            
            try {
                this.logStep(`Downloading ${library.name} (${this.formatBytes(library.size)})...`, 'info');
                // TODO: Actually download the library
                await this.downloadResource(library.name, library.size);
                
                downloadedSize += library.size;
                const progress = Math.round((downloadedSize / totalSize) * 100);
                
                this.logStep(`${library.name} downloaded successfully`, 'success');
                this.updateResource('libraries', 'downloading', progress);
            } catch (error) {
                this.logStep(`Failed to download ${library.name}: ${error.message}`, 'error');
                this.updateResource('libraries', 'error', 0);
                throw new Error(`Failed to download ${library.name}: ${error.message}`);
            }
        }
        
        this.logStep('All libraries downloaded successfully', 'success');
        this.updateResource('libraries', 'loaded', 100);
    }
    
    /**
     * Download AI model based on package type
     */
    async downloadAIModel() {
        if (this.aborted) return;
        
        const modelInfo = this.packages[this.packageType].aiModel;
        this.updateProgress(`Downloading AI model (${modelInfo.name})...`);
        this.updateResource('aiModel', 'downloading', 0);
        this.logStep(`Starting AI model download: ${modelInfo.name}`, 'info');
        
        try {
            // For minimal package, we might use server-side cached model
            if (this.packageType === 'minimal') {
                this.logStep('Checking for cached AI model on server...', 'info');
                const response = await fetch('/api/offline/packages/minimal/manifest');
                this.logStep(`Manifest request responded with status: ${response.status}`, 'info');
                const data = await response.json();
                
                if (data.success && data.manifest) {
                    this.logStep('Manifest received successfully', 'success');
                    const modelResource = data.manifest.resources.find(r => r.type === 'ai-model');
                    
                    if (modelResource && modelResource.cached) {
                        this.logStep(`Found cached AI model: ${modelResource.filename}`, 'success');
                        // Download the cached model
                        await this.downloadCachedResource(modelResource.filename, modelResource.size);
                        this.logStep('Cached AI model downloaded successfully', 'success');
                        this.updateResource('aiModel', 'loaded', 100);
                        return;
                    } else {
                        this.logStep('No cached AI model found, proceeding with standard download', 'info');
                    }
                } else {
                    this.logStep('Failed to get manifest or manifest invalid', 'warning');
                }
            }
            
            // TODO: Actually download the model
            const modelSize = this.getModelSize();
            this.logStep(`Downloading AI model (${this.formatBytes(modelSize)})...`, 'info');
            await this.downloadResource(modelInfo.name, modelSize, (progress) => {
                this.updateResource('aiModel', 'downloading', progress);
            });
            
            this.logStep('AI model downloaded successfully', 'success');
            this.updateResource('aiModel', 'loaded', 100);
        } catch (error) {
            this.logStep(`AI model download failed: ${error.message}`, 'error');
            this.updateResource('aiModel', 'error', 0);
            throw new Error(`Failed to download AI model: ${error.message}`);
        }
    }
    
    /**
     * Download Wikipedia database based on package type
     */
    async downloadWikipedia() {
        if (this.aborted) return;
        
        const wikiInfo = this.packages[this.packageType].wikipedia;
        this.updateProgress(`Downloading Wikipedia database (${wikiInfo.name})...`);
        this.updateResource('wikipedia', 'downloading', 0);
        
        try {
            // For minimal package, we might use server-side cached Wikipedia
            if (this.packageType === 'minimal') {
                const response = await fetch('/api/offline/packages/minimal/manifest');
                const data = await response.json();
                
                if (data.success && data.manifest) {
                    const wikiResource = data.manifest.resources.find(r => r.type === 'wikipedia');
                    
                    if (wikiResource && wikiResource.cached) {
                        // Download the cached Wikipedia
                        await this.downloadCachedResource(wikiResource.filename, wikiResource.size);
                        this.updateResource('wikipedia', 'loaded', 100);
                        return;
                    }
                }
            }
            
            // TODO: Actually download the Wikipedia database
            const wikiSize = this.getWikiSize();
            await this.downloadResource(wikiInfo.name, wikiSize, (progress) => {
                this.updateResource('wikipedia', 'downloading', progress);
            });
            
            this.updateResource('wikipedia', 'loaded', 100);
        } catch (error) {
            this.updateResource('wikipedia', 'error', 0);
            throw new Error(`Failed to download Wikipedia database: ${error.message}`);
        }
    }
    
    /**
     * Finish the download process and initialize components
     */
    async finishDownload() {
        if (this.aborted) return;
        
        this.updateProgress('Download complete! Initializing offline mode...');
        this.logStep('Starting component initialization...', 'info');
        
        // Initialize IndexedDB storage
        this.logStep('Initializing IndexedDB storage...', 'info');
        await this.initializeStorage();
        this.logStep('IndexedDB storage initialized successfully', 'success');
        
        // Initialize AI models
        this.logStep('Initializing AI models...', 'info');
        await this.initializeAIModels();
        this.logStep('AI models initialized successfully', 'success');
        
        // Initialize Wikipedia database
        this.logStep('Initializing Wikipedia database...', 'info');
        await this.initializeWikipedia();
        this.logStep('Wikipedia database initialized successfully', 'success');
        
        this.updateProgress('Offline mode ready!');
        this.logStep('All components initialized - offline mode ready!', 'success');
    }
    
    /**
     * Initialize IndexedDB storage for offline data
     */
    async initializeStorage() {
        return new Promise((resolve) => {
            // Simulate storage initialization
            setTimeout(() => {
                console.log('Storage initialized');
                resolve();
            }, 500);
        });
    }
    
    /**
     * Initialize AI models
     */
    async initializeAIModels() {
        return new Promise((resolve) => {
            // Simulate AI model initialization
            setTimeout(() => {
                console.log('AI models initialized');
                resolve();
            }, 1000);
        });
    }
    
    /**
     * Initialize Wikipedia database
     */
    async initializeWikipedia() {
        return new Promise((resolve) => {
            // Simulate Wikipedia initialization
            setTimeout(() => {
                console.log('Wikipedia database initialized');
                resolve();
            }, 800);
        });
    }
    
    /**
     * Download a resource with progress tracking
     */
    async downloadResource(name, size, progressCallback = null) {
        return new Promise((resolve, reject) => {
            if (this.aborted) {
                reject(new Error('Download aborted'));
                return;
            }
            
            console.log(`Downloading ${name} (${this.formatBytes(size)})...`);
            
            // TODO: Implement actual download from server
            
            let progress = 0;
            const interval = setInterval(() => {
                if (this.aborted) {
                    clearInterval(interval);
                    reject(new Error('Download aborted'));
                    return;
                }
                
                // TODO: Replace with actual download progress
                progress += Math.random() * 5;
                
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    console.log(`Downloaded ${name}`);
                    resolve();
                }
                
                if (progressCallback) {
                    progressCallback(Math.round(progress));
                }
            }, 200);
        });
    }
    
    /**
     * Download a cached resource from the server
     */
    async downloadCachedResource(filename, size) {
        return new Promise((resolve, reject) => {
            if (this.aborted) {
                reject(new Error('Download aborted'));
                return;
            }
            
            console.log(`Downloading cached resource ${filename} (${this.formatBytes(size)})...`);
            
            // TODO: Download from server cache
            
            let progress = 0;
            const interval = setInterval(() => {
                if (this.aborted) {
                    clearInterval(interval);
                    reject(new Error('Download aborted'));
                    return;
                }
                
                // TODO: Replace with actual download progress (faster for cached resources)
                progress += Math.random() * 10;
                
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    console.log(`Downloaded ${filename}`);
                    resolve();
                }
            }, 100);
        });
    }
    
    /**
     * Update overall progress
     */
    updateProgress(message) {
        console.log(message);
        
        if (this.onProgressUpdate) {
            this.onProgressUpdate(message, this.calculateTotalProgress());
        }
    }
    
    /**
     * Update resource status
     */
    updateResource(resource, status, progress) {
        this.resources[resource].status = status;
        this.resources[resource].progress = progress;
        
        if (this.onResourceUpdate) {
            this.onResourceUpdate(resource, status, progress);
        }
        
        // Also update total progress
        if (this.onProgressUpdate) {
            this.onProgressUpdate(null, this.calculateTotalProgress());
        }
    }
    
    /**
     * Calculate total progress based on weighted resource progress
     */
    calculateTotalProgress() {
        // Calculate weighted progress
        const weights = {
            libraries: 0.1,
            aiModel: 0.5,
            wikipedia: 0.4
        };
        
        let totalProgress = 0;
        for (const [resource, data] of Object.entries(this.resources)) {
            totalProgress += data.progress * weights[resource];
        }
        
        this.progress = Math.round(totalProgress);
        return this.progress;
    }
    
    /**
     * Get model size based on package type
     */
    getModelSize() {
        switch (this.packageType) {
            case 'minimal':
                return 150 * 1024 * 1024; // 150MB
            case 'standard':
                return 500 * 1024 * 1024; // 500MB
            case 'full':
                return 1500 * 1024 * 1024; // 1.5GB
            default:
                return 500 * 1024 * 1024; // 500MB
        }
    }
    
    /**
     * Get Wikipedia size based on package type
     */
    getWikiSize() {
        switch (this.packageType) {
            case 'minimal':
                return 20 * 1024 * 1024; // 20MB
            case 'standard':
                return 50 * 1024 * 1024; // 50MB
            case 'full':
                return 200 * 1024 * 1024; // 200MB
            default:
                return 50 * 1024 * 1024; // 50MB
        }
    }
    
    /**
     * Format bytes to human-readable size
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Get resource name for display
     */
    getResourceName(resource) {
        switch (resource) {
            case 'aiModel':
                return this.packages[this.packageType].aiModel.name;
            case 'wikipedia':
                return 'Wikipedia Database';
            case 'libraries':
                return 'Core Libraries';
            default:
                return resource;
        }
    }
    
    /**
     * Abort the download process
     */
    abort() {
        this.aborted = true;
        this.logStep('Download process aborted by user', 'warning');
        console.log('Download aborted');
    }
    
    /**
     * Log a step in the download process
     */
    logStep(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            message,
            type, // 'info', 'success', 'warning', 'error'
            step: this.logs.length + 1
        };
        
        this.logs.push(logEntry);
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        if (this.onLogUpdate) {
            this.onLogUpdate(logEntry, this.logs);
        }
    }
    
    /**
     * Get all logs
     */
    getLogs() {
        return this.logs;
    }
    
    /**
     * Clear all logs
     */
    clearLogs() {
        this.logs = [];
        if (this.onLogUpdate) {
            this.onLogUpdate(null, this.logs);
        }
    }
}

// Make available globally
window.DownloadManager = DownloadManager;
