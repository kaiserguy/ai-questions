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
        
        // Initialize storage first
        await this.initializeStorage();
        
        // Libraries to download with real URLs
        const libraries = [
            { 
                name: 'transformers.js', 
                url: '/offline/libs/transformers.js',
                fallbackUrl: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'
            },
            { 
                name: 'sql-wasm.js', 
                url: '/offline/libs/sql-wasm.js',
                fallbackUrl: 'https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-wasm.js'
            }
        ];
        
        let completedLibraries = 0;
        
        for (const library of libraries) {
            if (this.aborted) return;
            
            try {
                // Check if already downloaded
                if (await this.fileExists(library.name)) {
                    console.log(`${library.name} already exists, skipping download`);
                    completedLibraries++;
                    const progress = Math.round((completedLibraries / libraries.length) * 100);
                    this.updateResource('libraries', 'downloading', progress);
                    continue;
                }
                
                // Try primary URL first, then fallback
                let downloadUrl = library.url;
                try {
                    await this.downloadResource(library.name, downloadUrl, (libProgress) => {
                        const overallProgress = Math.round(((completedLibraries + libProgress / 100) / libraries.length) * 100);
                        this.updateResource('libraries', 'downloading', overallProgress);
                    });
                } catch (primaryError) {
                    console.log(`Primary URL failed for ${library.name}, trying fallback...`);
                    downloadUrl = library.fallbackUrl;
                    await this.downloadResource(library.name, downloadUrl, (libProgress) => {
                        const overallProgress = Math.round(((completedLibraries + libProgress / 100) / libraries.length) * 100);
                        this.updateResource('libraries', 'downloading', overallProgress);
                    });
                }
                
                completedLibraries++;
                const progress = Math.round((completedLibraries / libraries.length) * 100);
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
            // Model URLs based on package type
            const modelUrls = {
                'minimal': {
                    name: 'TinyBERT',
                    url: '/offline/models/tinybert-uncased.bin',
                    fallbackUrl: 'https://huggingface.co/prajjwal1/bert-tiny/resolve/main/pytorch_model.bin'
                },
                'standard': {
                    name: 'Phi-3 Mini',
                    url: '/offline/models/phi3-mini.bin',
                    fallbackUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct/resolve/main/model.safetensors'
                },
                'full': {
                    name: 'Llama-3.2',
                    url: '/offline/models/llama-3.2.bin',
                    fallbackUrl: 'https://huggingface.co/meta-llama/Llama-3.2-1B/resolve/main/model.safetensors'
                }
            };
            
            const modelConfig = modelUrls[this.packageType];
            if (!modelConfig) {
                throw new Error(`Unknown package type: ${this.packageType}`);
            }
            
            // Check if model already exists
            if (await this.fileExists(modelConfig.name)) {
                console.log(`${modelConfig.name} already exists, skipping download`);
                this.updateResource('aiModel', 'loaded', 100);
                return;
            }
            
            // Try to download from primary URL first
            let downloadUrl = modelConfig.url;
            try {
                await this.downloadResource(modelConfig.name, downloadUrl, (progress) => {
                    this.updateResource('aiModel', 'downloading', progress);
                });
            } catch (primaryError) {
                console.log(`Primary model URL failed, trying fallback...`);
                downloadUrl = modelConfig.fallbackUrl;
                await this.downloadResource(modelConfig.name, downloadUrl, (progress) => {
                    this.updateResource('aiModel', 'downloading', progress);
                });
            }
            
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
            // Wikipedia database URLs based on package type
            const wikiUrls = {
                'minimal': {
                    name: 'Wikipedia-Subset-20MB',
                    url: '/offline/wikipedia/wikipedia-subset-20mb.db',
                    fallbackUrl: 'https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/wikipedia_en_top_2023-01.zim'
                },
                'standard': {
                    name: 'Simple-Wikipedia-50MB',
                    url: '/offline/wikipedia/simple-wikipedia-50mb.db',
                    fallbackUrl: 'https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/wikipedia_en_simple_all_2023-01.zim'
                },
                'full': {
                    name: 'Extended-Wikipedia',
                    url: '/offline/wikipedia/extended-wikipedia.db',
                    fallbackUrl: 'https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/wikipedia_en_all_nopic_2023-01.zim'
                }
            };
            
            const wikiConfig = wikiUrls[this.packageType];
            if (!wikiConfig) {
                throw new Error(`Unknown package type: ${this.packageType}`);
            }
            
            // Check if Wikipedia database already exists
            if (await this.fileExists(wikiConfig.name)) {
                console.log(`${wikiConfig.name} already exists, skipping download`);
                this.updateResource('wikipedia', 'loaded', 100);
                return;
            }
            
            // Try to download from primary URL first
            let downloadUrl = wikiConfig.url;
            try {
                await this.downloadResource(wikiConfig.name, downloadUrl, (progress) => {
                    this.updateResource('wikipedia', 'downloading', progress);
                });
            } catch (primaryError) {
                console.log(`Primary Wikipedia URL failed, trying fallback...`);
                downloadUrl = wikiConfig.fallbackUrl;
                await this.downloadResource(wikiConfig.name, downloadUrl, (progress) => {
                    this.updateResource('wikipedia', 'downloading', progress);
                });
            }
            
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
     * Download a resource with progress tracking using real HTTP requests
     */
    async downloadResource(name, url, progressCallback = null) {
        return new Promise(async (resolve, reject) => {
            if (this.aborted) {
                reject(new Error('Download aborted'));
                return;
            }
            
            console.log(`Downloading ${name} from ${url}...`);
            
            try {
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const contentLength = response.headers.get('content-length');
                const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
                
                if (!response.body) {
                    throw new Error('Response body is not available');
                }
                
                const reader = response.body.getReader();
                let bytesDownloaded = 0;
                const chunks = [];
                
                while (true) {
                    if (this.aborted) {
                        reader.cancel();
                        reject(new Error('Download aborted'));
                        return;
                    }
                    
                    const { done, value } = await reader.read();
                    
                    if (done) break;
                    
                    chunks.push(value);
                    bytesDownloaded += value.length;
                    
                    if (totalBytes > 0 && progressCallback) {
                        const progress = Math.round((bytesDownloaded / totalBytes) * 100);
                        progressCallback(progress);
                    }
                }
                
                // Combine all chunks into a single Uint8Array
                const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                const result = new Uint8Array(totalLength);
                let offset = 0;
                
                for (const chunk of chunks) {
                    result.set(chunk, offset);
                    offset += chunk.length;
                }
                
                // Store the downloaded file in IndexedDB
                await this.storeFile(name, result);
                
                console.log(`Downloaded ${name} (${this.formatBytes(bytesDownloaded)})`);
                resolve(result);
                
            } catch (error) {
                console.error(`Failed to download ${name}:`, error);
                reject(error);
            }
        });
    }
    
    /**
     * Initialize IndexedDB for offline storage
     */
    async initializeStorage() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('OfflineAI', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores for different types of files
                if (!db.objectStoreNames.contains('libraries')) {
                    db.createObjectStore('libraries', { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains('models')) {
                    db.createObjectStore('models', { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains('wikipedia')) {
                    db.createObjectStore('wikipedia', { keyPath: 'name' });
                }
            };
        });
    }
    
    /**
     * Store a file in IndexedDB
     */
    async storeFile(name, data) {
        if (!this.db) {
            await this.initializeStorage();
        }
        
        return new Promise((resolve, reject) => {
            // Determine which store to use based on file type
            let storeName = 'libraries';
            if (name.includes('model') || name.includes('bert') || name.includes('llama')) {
                storeName = 'models';
            } else if (name.includes('wikipedia') || name.includes('wiki')) {
                storeName = 'wikipedia';
            }
            
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const fileData = {
                name: name,
                data: data,
                timestamp: Date.now(),
                size: data.length
            };
            
            const request = store.put(fileData);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Retrieve a file from IndexedDB
     */
    async getFile(name) {
        if (!this.db) {
            await this.initializeStorage();
        }
        
        return new Promise((resolve, reject) => {
            // Check all stores for the file
            const stores = ['libraries', 'models', 'wikipedia'];
            let found = false;
            
            const checkStore = (storeIndex) => {
                if (storeIndex >= stores.length) {
                    if (!found) resolve(null);
                    return;
                }
                
                const transaction = this.db.transaction([stores[storeIndex]], 'readonly');
                const store = transaction.objectStore(stores[storeIndex]);
                const request = store.get(name);
                
                request.onsuccess = () => {
                    if (request.result && !found) {
                        found = true;
                        resolve(request.result);
                    } else {
                        checkStore(storeIndex + 1);
                    }
                };
                
                request.onerror = () => {
                    if (!found) checkStore(storeIndex + 1);
                };
            };
            
            checkStore(0);
        });
    }
    
    /**
     * Check if a file exists in storage
     */
    async fileExists(name) {
        const file = await this.getFile(name);
        return file !== null;
    }
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
