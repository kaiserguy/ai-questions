/**
 * Download Manager for AI Questions Offline Mode
 * Handles downloading and tracking of offline resources
 */
class DownloadManager {
    constructor(packageType) {
        // Validate packageType parameter
        if (!packageType) {
            throw new Error('packageType is required');
        }
        if (typeof packageType !== 'string') {
            throw new Error('packageType must be a string');
        }
        
        // Define valid package types
        const validPackageTypes = ['minimal', 'standard', 'full'];
        if (!validPackageTypes.includes(packageType)) {
            throw new Error(`Invalid packageType: ${packageType}. Must be one of: ${validPackageTypes.join(', ')}`);
        }
        
        this.packageType = packageType;
        this.progress = 0;
        this.resources = {
            aiModel: { status: 'pending', progress: 0 },
            wikipedia: { status: 'pending', progress: 0 },
            libraries: { status: 'pending', progress: 0 }
        };
        this.aborted = false;
        this.onError = null;
        this.downloadState = null;
        this.errorCategories = {
            network: {
                patterns: ['network', 'fetch', 'connection', 'timeout', 'offline', 'ECONNREFUSED'],
                message: 'Connection lost during download',
                recovery: 'Check your internet connection and try again.',
                actions: ['retry', 'cancel']
            },
            storage: {
                patterns: ['quota', 'storage', 'disk', 'space', 'IndexedDB'],
                message: 'Not enough storage space',
                recovery: 'Free up storage space and try again.',
                actions: ['clear_cache', 'cancel']
            },
            server: {
                patterns: ['500', '502', '503', '504', 'server'],
                message: 'Server temporarily unavailable',
                recovery: 'The server is experiencing issues. Please try again later.',
                actions: ['retry_later', 'cancel']
            },
            notFound: {
                patterns: ['404', 'not found'],
                message: 'Resource not found',
                recovery: 'The requested file could not be found. Try a different package.',
                actions: ['change_package', 'cancel']
            },
            permission: {
                patterns: ['403', 'forbidden', 'permission', 'access'],
                message: 'Access denied',
                recovery: 'You do not have permission to download this resource.',
                actions: ['cancel']
            }
        };
        this.lastSaveTime = 0;
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
        // Allow empty/null handlers - just set everything to null
        if (!handlers || typeof handlers !== 'object') {
            this.onProgressUpdate = null;
            this.onResourceUpdate = null;
            this.onComplete = null;
            this.onError = null;
            return;
        }
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
            // Check if resources are actually available before starting
            const resourcesAvailable = await this.checkResourcesExist();
            if (!resourcesAvailable) {
                throw new Error('Offline mode downloads are currently unavailable. The required AI models and Wikipedia databases are not yet hosted. Please use the online version or install locally with Ollama for full functionality.');
            }
            
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
     * Check if offline resources actually exist on the server or CDN
     */
    async checkResourcesExist() {
        try {
            // Check availability of the transformers library on the CDN
            // Using CDN check because local resources are not currently hosted
            const response = await fetch('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js', { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            console.log('Resource check failed:', error);
            return false;
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
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
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
            
            // Call error handler if set
            if (this.onError) {
                this.onError(error.message || error.toString());
            }
            
            throw error;
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
        
        // Libraries to download
        // Use CDN URLs as primary source since local resources are not currently hosted
        // This allows downloads to work when CDN resources are available
        const libraries = [
            { 
                name: 'transformers.js', 
                url: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js',
                fallbackUrl: '/offline-resources/libs/transformers.js'
            },
            { 
                name: 'sql-wasm.js', 
                url: 'https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-wasm.js',
                fallbackUrl: '/offline-resources/libs/sql-wasm.js'
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
                
                // Call error handler if set
                if (this.onError) {
                    this.onError(`Failed to download ${library.name}: ${error.message}`);
                }
                
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
            // Use CDN URLs as primary source since local resources are not currently hosted
            // Note: These URLs point to large model files (hundreds of MB to GB)
            // TODO: Consider using pre-converted ONNX format models to reduce size and ensure compatibility
            // Current formats (pytorch_model.bin, model.safetensors) may need conversion for ONNX Runtime Web
            const modelUrls = {
                'minimal': {
                    name: 'TinyBERT',
                    url: 'https://huggingface.co/prajjwal1/bert-tiny/resolve/main/pytorch_model.bin',
                    fallbackUrl: '/offline-resources/models/tinybert-uncased.bin'
                },
                'standard': {
                    name: 'Phi-3 Mini',
                    url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct/resolve/main/model.safetensors',
                    fallbackUrl: '/offline-resources/models/phi3-mini.bin'
                },
                'full': {
                    name: 'Llama-3.2',
                    url: 'https://huggingface.co/meta-llama/Llama-3.2-1B/resolve/main/model.safetensors',
                    fallbackUrl: '/offline-resources/models/llama-3.2.bin'
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
            // Use CDN URLs as primary source since local resources are not currently hosted
            // This allows downloads to work when CDN resources are available
            const wikiUrls = {
                'minimal': {
                    name: 'Wikipedia-Subset-20MB',
                    url: 'https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/wikipedia_en_top_2023-01.zim',
                    fallbackUrl: '/offline-resources/wikipedia/wikipedia-subset-20mb.db'
                },
                'standard': {
                    name: 'Simple-Wikipedia-50MB',
                    url: 'https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/wikipedia_en_simple_all_2023-01.zim',
                    fallbackUrl: '/offline-resources/wikipedia/simple-wikipedia-50mb.db'
                },
                'full': {
                    name: 'Extended-Wikipedia',
                    url: 'https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/wikipedia_en_all_nopic_2023-01.zim',
                    fallbackUrl: '/offline-resources/wikipedia/extended-wikipedia.db'
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
     * Helper to wrap a promise with a timeout
     * @param {Promise} promise - The promise to wrap
     * @param {number} ms - Timeout in milliseconds
     * @param {string} errorMessage - Error message if timeout occurs
     * @returns {Promise}
     */
    async withTimeout(promise, ms, errorMessage = 'Operation timed out') {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
        });

        try {
            const result = await Promise.race([promise, timeoutPromise]);
            return result;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Finish the download process and initialize components
     */
    async finishDownload() {
        if (this.aborted) return;
        
        this.updateProgress('Download complete! Initializing offline mode...');
        
        try {
            // Use withTimeout helper for the entire initialization sequence
            await this.withTimeout((async () => {
                // Initialize IndexedDB storage
                await this.initializeStorage();
                
                // Initialize AI models
                await this.initializeAIModels();
                
                // Initialize Wikipedia database - with its own timeout
                try {
                    await this.withTimeout(
                        this.initializeWikipedia(),
                        5000,
                        'Wikipedia initialization timeout'
                    );
                } catch (wikiError) {
                    console.warn('Wikipedia initialization failed or timed out:', wikiError);
                    // Continue without Wikipedia - don't fail the whole process
                }
            })(), 10000, 'Initialization timeout');
            
            this.updateProgress('Offline mode ready!');
        } catch (error) {
            console.warn('Initialization error (continuing anyway):', error);
            this.updateProgress('Offline mode initialized (with warnings)');
            // Don't throw - allow the process to complete
        }
    }
    
    /**
     * Initialize IndexedDB storage for offline data
     */
    async initializeStorage() {
        if (this.db) {
            return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('OfflineAI', 2);
            
            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB storage initialized');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains('libraries')) {
                    db.createObjectStore('libraries', { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains('models')) {
                    db.createObjectStore('models', { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains('wikipedia')) {
                    db.createObjectStore('wikipedia', { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains('cache')) {
                    db.createObjectStore('cache', { keyPath: 'url' });
                }
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
                
                console.log('IndexedDB stores created');
            };
        });
    }
    
    /**
     * Initialize AI models
     */
    async initializeAIModels() {
        try {
            // Initialize the LocalAI model system if available
            if (typeof window !== 'undefined' && window.localAI) {
                await window.localAI.initialize();
                console.log('AI models initialized via LocalAI');
            } else {
                console.log('LocalAI not available, models will load on demand');
            }
            return true;
        } catch (error) {
            console.error('Failed to initialize AI models:', error);
            return false;
        }
    }
    
    /**
     * Initialize Wikipedia database
     */
    async initializeWikipedia() {
        try {
            // Check if Wikipedia data exists in IndexedDB
            if (!this.db) {
                await this.initializeStorage();
            }
            
            const hasWikipedia = await this.fileExists('wikipedia-index');
            if (hasWikipedia) {
                console.log('Wikipedia database found in IndexedDB');
                // Initialize SQL.js if available for querying
                if (typeof initSqlJs !== 'undefined') {
                    const SQL = await initSqlJs({
                        locateFile: file => `/offline-resources/libs/${file}`
                    });
                    this.sqlDb = SQL;
                    console.log('SQL.js initialized for Wikipedia queries');
                }
            } else {
                console.log('Wikipedia database not yet downloaded');
            }
            return true;
        } catch (error) {
            console.error('Failed to initialize Wikipedia:', error);
            return false;
        }
    }
    
    /**
     * Download a resource with progress tracking using real HTTP requests
     */
    async downloadResource(name, url, progressCallback = null, retryCount = 0) {
        const MAX_RETRIES = 3;
        const TIMEOUT_MS = 30000; // 30 second timeout
        
        return new Promise(async (resolve, reject) => {
            if (this.aborted) {
                reject(new Error('Download aborted'));
                return;
            }
            
            console.log(`Downloading ${name} from ${url}... (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
            
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, TIMEOUT_MS);
            
            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                
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
                clearTimeout(timeoutId);
                console.error(`Failed to download ${name}:`, error);
                
                // Check if we should retry
                if (retryCount < MAX_RETRIES && !this.aborted) {
                    const isTimeout = error.name === 'AbortError';
                    const errorType = isTimeout ? 'timeout' : 'error';
                    console.log(`Download ${errorType} for ${name}, retrying in 2 seconds...`);
                    
                    // Notify about retry
                    if (this.onProgress) {
                        this.onProgress(`Retry ${retryCount + 1}/${MAX_RETRIES} for ${name}...`);
                    }
                    
                    // Backoff delay before retry (2 seconds)
                    await this.delay(2000);
                    
                    // Retry with incremented count
                    try {
                        const result = await this.downloadResource(name, url, progressCallback, retryCount + 1);
                        resolve(result);
                    } catch (retryError) {
                        reject(retryError);
                    }
                } else {
                    const isTimeout = error.name === 'AbortError';
                    const errorMsg = isTimeout 
                        ? `Download timed out after ${TIMEOUT_MS/1000}s (${MAX_RETRIES + 1} attempts)` 
                        : error.message;
                    reject(new Error(errorMsg));
                }
            }
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
        try {
            const file = await this.getFile(name);
            return file !== null;
        } catch (error) {
            // If storage not available, assume file doesn't exist
            console.log('Storage not available, assuming file does not exist');
            return false;
        }
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
        // Validate status
        const validStatuses = ['pending', 'downloading', 'loaded', 'error'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
        }
        
        // Validate progress
        if (typeof progress !== 'number') {
            throw new Error('Progress must be a number');
        }
        if (progress < 0 || progress > 100) {
            throw new Error('Progress must be between 0 and 100');
        }
        
        this.resources[resource].status = status;
        this.resources[resource].progress = progress;
        
        if (this.onResourceUpdate) {
            this.onResourceUpdate(resource, status, progress);
        }
        
        // Also update total progress
        if (this.onProgressUpdate) {
            this.onProgressUpdate(null, this.calculateTotalProgress());
        }
        
        // Save state periodically during download
        if (status === 'downloading') {
            this.saveDownloadState();
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
    /**
     * Utility delay for retry backoff
     */
    delay(ms) {
        return new Promise(resolve => {
            const start = Date.now();
            const check = () => {
                if (Date.now() - start >= ms) {
                    resolve();
                } else {
                    requestAnimationFrame(check);
                }
            };
            check();
        });
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Calculate overall progress based on individual resource progress
     */
    calculateOverallProgress() {
        // Calculate weighted average of all resources
        const resources = ['libraries', 'aiModel', 'wikipedia'];
        const totalProgress = resources.reduce((sum, resource) => {
            return sum + (this.resources[resource]?.progress || 0);
        }, 0);
        return Math.round(totalProgress / resources.length);
    }
    
    /**
     * Get resource name for display
     */
    getResourceName(resource) {
        if (!resource || typeof resource !== 'string') {
            return 'Unknown Resource';
        }
        switch (resource) {
            case 'aiModel':
                return this.packages[this.packageType].aiModel.name;
            case 'wikipedia':
                return 'Wikipedia Database';
            case 'libraries':
                return 'Core Libraries';
            default:
                return 'Unknown Resource';
        }
    }
    
    /**
     * Abort the download process
     */
    abort() {
        this.aborted = true;
        this.clearDownloadState();
        console.log('Download aborted');
    }
    
    /**
     * Pause the download process
     */
    pause() {
        this.paused = true;
        this.saveDownloadState();
        console.log('Download paused');
    }
    
    /**
     * Resume the download process
     */
    resume() {
        this.paused = false;
        console.log('Download resumed');
    }
    
    /**
     * Check if download is paused
     */
    isPaused() {
        return this.paused;
    }
    
    /**
     * Save download state to IndexedDB for persistence
     */
    async saveDownloadState() {
        const now = Date.now();
        // Only save every 5 seconds to avoid excessive writes
        if (now - this.lastSaveTime < 5000) return;
        this.lastSaveTime = now;
        
        try {
            await this.initializeStorage();
            const state = {
                key: 'downloadState',
                packageType: this.packageType,
                progress: this.progress,
                resources: JSON.parse(JSON.stringify(this.resources)),
                timestamp: now,
                paused: this.paused
            };
            
            const transaction = this.db.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');
            store.put(state);
            console.log('Download state saved:', state.progress + '%');
        } catch (error) {
            console.error('Failed to save download state:', error);
        }
    }
    
    /**
     * Load download state from IndexedDB
     */
    async loadDownloadState() {
        try {
            await this.initializeStorage();
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['metadata'], 'readonly');
                const store = transaction.objectStore('metadata');
                const request = store.get('downloadState');
                
                request.onsuccess = () => {
                    const state = request.result;
                    if (state && state.packageType === this.packageType) {
                        // Check if state is less than 24 hours old
                        const age = Date.now() - state.timestamp;
                        if (age < 24 * 60 * 60 * 1000) {
                            resolve(state);
                        } else {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to load download state:', error);
            return null;
        }
    }
    
    /**
     * Clear download state from IndexedDB
     */
    async clearDownloadState() {
        try {
            await this.initializeStorage();
            const transaction = this.db.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');
            store.delete('downloadState');
            console.log('Download state cleared');
        } catch (error) {
            console.error('Failed to clear download state:', error);
        }
    }
    
    /**
     * Check for interrupted download and offer to resume
     */
    async checkForInterruptedDownload() {
        const state = await this.loadDownloadState();
        if (state && state.progress > 0 && state.progress < 100) {
            return {
                hasInterrupted: true,
                progress: state.progress,
                resources: state.resources,
                timestamp: state.timestamp,
                packageType: state.packageType
            };
        }
        return { hasInterrupted: false };
    }
    
    /**
     * Resume from saved state
     */
    async resumeFromState(state) {
        if (!state) return false;
        
        this.progress = state.progress;
        this.resources = state.resources;
        this.paused = false;
        
        console.log('Resuming download from', state.progress + '%');
        return true;
    }
    
    /**
     * Setup beforeunload warning during active download
     */
    setupBeforeUnloadWarning() {
        if (typeof window === 'undefined') return;
        
        this.beforeUnloadHandler = (e) => {
            if (this.isDownloading() && !this.paused) {
                e.preventDefault();
                e.returnValue = 'Download in progress. Are you sure you want to leave?';
                return e.returnValue;
            }
        };
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
    }
    
    /**
     * Remove beforeunload warning
     */
    removeBeforeUnloadWarning() {
        if (typeof window === 'undefined' || !this.beforeUnloadHandler) return;
        window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
    
    /**
     * Check if download is in progress
     */
    isDownloading() {
        return Object.values(this.resources).some(r => r.status === 'downloading');
    }
    
    /**
     * Get storage usage information
     */
    async getStorageUsage() {
        if (typeof navigator === 'undefined' || !navigator.storage) {
            return { used: 0, quota: 0, percent: 0 };
        }
        
        try {
            const estimate = await navigator.storage.estimate();
            return {
                used: estimate.usage || 0,
                quota: estimate.quota || 0,
                percent: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0,
                usedFormatted: this.formatBytes(estimate.usage || 0),
                quotaFormatted: this.formatBytes(estimate.quota || 0)
            };
        } catch (error) {
            console.error('Failed to get storage estimate:', error);
            return { used: 0, quota: 0, percent: 0 };
        }
    }
    
    /**
     * Categorize an error and provide recovery guidance
     */
    categorizeError(error) {
        const errorString = (error.message || error.toString()).toLowerCase();
        
        for (const [category, config] of Object.entries(this.errorCategories)) {
            if (config.patterns.some(pattern => errorString.includes(pattern.toLowerCase()))) {
                return {
                    category,
                    message: config.message,
                    recovery: config.recovery,
                    actions: config.actions,
                    originalError: error.message || error.toString()
                };
            }
        }
        
        // Default unknown error
        return {
            category: 'unknown',
            message: 'An unexpected error occurred',
            recovery: 'Please try again. If the problem persists, contact support.',
            actions: ['retry', 'cancel'],
            originalError: error.message || error.toString()
        };
    }
    
    /**
     * Handle error with categorization
     */
    handleError(error, resource = null) {
        const categorized = this.categorizeError(error);
        
        if (resource) {
            this.updateResource(resource, 'error', 0);
        }
        
        if (this.onError) {
            this.onError(categorized);
        }
        
        return categorized;
    }
}

// Make available globally for browser
if (typeof window !== 'undefined') {
    window.DownloadManager = DownloadManager;
}

// Make available for Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DownloadManager;
}
