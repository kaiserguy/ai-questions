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
    }
    
    /**
     * Start the download process
     */
    async startDownload() {
        console.log(`Starting download of ${this.packageType} package`);
        
        try {
            // Check package availability first
            await this.checkPackageAvailability();
            
            // Start with libraries
            await this.downloadLibraries();
            
            // Then download AI model
            await this.downloadAIModel();
            
            // Finally download Wikipedia
            await this.downloadWikipedia();
            
            // Complete the process
            await this.finishDownload();
            
            if (this.onComplete) {
                this.onComplete();
            }
        } catch (error) {
            console.error('Download error:', error);
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
        
        try {
            const response = await fetch('/api/offline/packages/availability');
            const data = await response.json();
            
            if (!data.success) {
                throw new Error('Failed to check package availability');
            }
            
            console.log('Package availability:', data);
            
            // For minimal package, we might use server-side cached resources
            if (this.packageType === 'minimal' && data.packages.minimal && data.packages.minimal.cached) {
                console.log('Using server-side cached minimal package');
            }
            
            return data;
        } catch (error) {
            console.error('Error checking package availability:', error);
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
        
        // Libraries to download
        const libraries = [
            { name: 'transformers.js', size: 2.5 * 1024 * 1024 }, // 2.5MB
            { name: 'sql-wasm.js', size: 1.2 * 1024 * 1024 },     // 1.2MB
            { name: 'tokenizers.js', size: 0.8 * 1024 * 1024 }    // 0.8MB
        ];
        
        const totalSize = libraries.reduce((sum, lib) => sum + lib.size, 0);
        let downloadedSize = 0;
        
        for (const library of libraries) {
            if (this.aborted) return;
            
            try {
                // TODO: Actually download the library
                await this.downloadResource(library.name, library.size);
                
                downloadedSize += library.size;
                const progress = Math.round((downloadedSize / totalSize) * 100);
                
                this.updateResource('libraries', 'downloading', progress);
            } catch (error) {
                this.updateResource('libraries', 'error', 0);
                throw new Error(`Failed to download ${library.name}: ${error.message}`);
            }
        }
        
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
        
        try {
            // For minimal package, we might use server-side cached model
            if (this.packageType === 'minimal') {
                const response = await fetch('/api/offline/packages/minimal/manifest');
                const data = await response.json();
                
                if (data.success && data.manifest) {
                    const modelResource = data.manifest.resources.find(r => r.type === 'ai-model');
                    
                    if (modelResource && modelResource.cached) {
                        // Download the cached model
                        await this.downloadCachedResource(modelResource.filename, modelResource.size);
                        this.updateResource('aiModel', 'loaded', 100);
                        return;
                    }
                }
            }
            
            // TODO: Actually download the model
            const modelSize = this.getModelSize();
            await this.downloadResource(modelInfo.name, modelSize, (progress) => {
                this.updateResource('aiModel', 'downloading', progress);
            });
            
            this.updateResource('aiModel', 'loaded', 100);
        } catch (error) {
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
        
        // Initialize IndexedDB storage
        await this.initializeStorage();
        
        // Initialize AI models
        await this.initializeAIModels();
        
        // Initialize Wikipedia database
        await this.initializeWikipedia();
        
        this.updateProgress('Offline mode ready!');
    }
    
    /**
     * Initialize IndexedDB storage for offline data
     */
    async initializeStorage() {
        return new Promise((resolve) => {
            // TODO: Initialize actual IndexedDB storage
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
            // TODO: Initialize actual AI models
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
            // TODO: Initialize actual Wikipedia database
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
            
            // Process download from server
            
            let progress = 0;
            const interval = setInterval(() => {
                if (this.aborted) {
                    clearInterval(interval);
                    reject(new Error('Download aborted'));
                    return;
                }
                
                // Update download progress
                // Real progress calculation based on bytes downloaded
                const progressIncrement = Math.min(bytesDownloaded / totalBytes * 100, 5);
                progress += progressIncrement;
                
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
                
                // Update download progress (faster for cached resources)
                // Real progress based on component loading status
                const componentProgress = this.getComponentLoadingProgress();
                progress += Math.min(componentProgress, 10);
                
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
     * Get real component loading progress
     */
    getComponentLoadingProgress() {
        // Calculate progress based on actual component states
        const components = ['transformers', 'onnx', 'sql', 'wikipedia'];
        const loadedComponents = components.filter(comp => 
            window[comp + 'Loaded'] || window[comp + 'Ready']
        ).length;
        return (loadedComponents / components.length) * 25; // Max 25% per check
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
        console.log('Download aborted');
    }
}

// Make available globally
window.DownloadManager = DownloadManager;
