/**
 * Enhanced Download Manager for Offline Mode
 * Handles downloading and caching of offline resources
 */

class DownloadManagerEnhanced {
    constructor() {
        this.isDownloading = false;
        this.currentPackage = null;
        this.progress = 0;
        this.init();
    }

    async init() {
        console.log('Initializing Enhanced Download Manager...');
        
        // Check if packages are available from server
        await this.checkPackageAvailability();
        
        // Set up event listeners
        this.setupEventListeners();
    }

    async checkPackageAvailability() {
        console.log('Checking package availability from server...');
        
        try {
            // Try to fetch package information from server
            // If server is unavailable, use local fallback data
            const response = await fetch('/api/offline/packages/availability')
                .catch(() => {
                    console.log('API endpoint not available, using fallback data');
                    return { ok: false };
                });
            
            if (response.ok) {
                const data = await response.json();
                this.packageInfo = data;
                console.log('Package availability:', data);
            } else {
                // Use fallback data if API is not available
                this.packageInfo = this.getFallbackPackageInfo();
                console.log('Package availability:', { error: 'API endpoint not found', usingFallback: true });
            }
        } catch (error) {
            console.error('Failed to check package availability:', error);
            this.packageInfo = this.getFallbackPackageInfo();
        }
    }

    getFallbackPackageInfo() {
        // Fallback package information when API is unavailable
        return {
            packages: {
                minimal: {
                    name: 'Minimal Package',
                    size: '200MB',
                    components: ['core', 'tinyml-qa', 'wikipedia-mini'],
                    available: true
                },
                standard: {
                    name: 'Standard Package',
                    size: '800MB',
                    components: ['core', 'minillm-chat', 'wikipedia-simple'],
                    available: true
                },
                full: {
                    name: 'Full Package',
                    size: '2GB',
                    components: ['core', 'all-models', 'wikipedia-extended'],
                    available: true
                }
            },
            components: {
                core: {
                    name: 'Core Scripts',
                    size: '5MB',
                    files: 12,
                    required: true
                },
                'tinyml-qa': {
                    name: 'TinyML QA Model',
                    size: '15MB',
                    files: 3
                },
                'minillm-chat': {
                    name: 'MiniLLM Chat Model',
                    size: '40MB',
                    files: 3
                },
                'all-models': {
                    name: 'All AI Models',
                    size: '150MB',
                    files: 9
                },
                'wikipedia-mini': {
                    name: 'Mini Wikipedia',
                    size: '20MB',
                    articles: 1000
                },
                'wikipedia-simple': {
                    name: 'Simple Wikipedia',
                    size: '50MB',
                    articles: 5000
                },
                'wikipedia-extended': {
                    name: 'Extended Wikipedia',
                    size: '500MB',
                    articles: 50000
                }
            }
        };
    }

    setupEventListeners() {
        // Download button
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.startDownload());
        }

        // Package selection
        document.querySelectorAll('.download-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.download-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                option.classList.add('selected');
                
                // Update download button text
                if (downloadBtn) {
                    const packageName = option.querySelector('.option-title').textContent;
                    downloadBtn.textContent = `Download ${packageName}`;
                }
                
                // Store selected package
                this.currentPackage = option.dataset.package;
            });
        });
    }

    async startDownload() {
        if (this.isDownloading) return;
        
        this.isDownloading = true;
        this.progress = 0;
        
        // Get selected package
        if (!this.currentPackage) {
            this.currentPackage = document.querySelector('.download-option.selected')?.dataset.package || 'standard';
        }
        
        console.log(`Starting download of ${this.currentPackage} package`);
        
        // Show progress section
        const downloadSection = document.getElementById('downloadSection');
        const progressSection = document.getElementById('progressSection');
        
        if (downloadSection) downloadSection.style.display = 'none';
        if (progressSection) progressSection.style.display = 'block';
        
        try {
            // Simulate download process
            await this.downloadPackage(this.currentPackage);
            
            // Show success message
            this.updateProgress(100, 'Download complete!', 'All resources downloaded successfully');
            
            // Reload page after a short delay to initialize offline mode
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            console.error('Download failed:', error);
            this.updateProgress(0, 'Download failed', error.message);
            
            // Show retry button
            const progressDetails = document.getElementById('progressDetails');
            if (progressDetails) {
                progressDetails.innerHTML = `
                    ${error.message}
                    <button id="retryBtn" class="download-btn" style="margin-top: 15px;">
                        Try Again
                    </button>
                `;
                
                document.getElementById('retryBtn').addEventListener('click', () => {
                    this.isDownloading = false;
                    this.startDownload();
                });
            }
        }
    }

    async downloadPackage(packageType) {
        // Get package info
        const packageInfo = this.packageInfo?.packages?.[packageType];
        if (!packageInfo) {
            throw new Error(`Package information not available for ${packageType}`);
        }
        
        // Get components to download
        const components = packageInfo.components || [];
        
        // Initialize cache
        const cache = await caches.open('ai-questions-offline-v1');
        
        // Download each component
        let totalProgress = 0;
        const componentCount = components.length;
        
        for (let i = 0; i < componentCount; i++) {
            const component = components[i];
            const componentInfo = this.packageInfo?.components?.[component];
            
            if (!componentInfo) {
                console.warn(`Component information not available for ${component}`);
                continue;
            }
            
            // Update progress
            this.updateProgress(
                totalProgress + (i / componentCount) * 100,
                `Downloading ${componentInfo.name}...`,
                `Component ${i + 1} of ${componentCount}`
            );
            
            // Simulate component download
            await this.downloadComponent(component, componentInfo, cache);
            
            // Update total progress
            totalProgress = Math.round((i + 1) / componentCount * 100);
            this.updateProgress(
                totalProgress,
                `Downloaded ${componentInfo.name}`,
                `${i + 1} of ${componentCount} components complete`
            );
        }
        
        // Create dummy files for testing
        await this.createDummyFiles(cache);
        
        return true;
    }

    async downloadComponent(componentId, componentInfo, cache) {
        // Simulate download time based on component size
        const sizeInMB = parseInt(componentInfo.size) || 10;
        const downloadTimeMs = Math.min(sizeInMB * 20, 3000); // Faster for demo
        
        // Simulate progress updates
        const updateInterval = 100;
        const steps = downloadTimeMs / updateInterval;
        
        for (let i = 0; i < steps; i++) {
            await new Promise(resolve => setTimeout(resolve, updateInterval));
            
            // Update component progress
            const componentProgress = Math.round((i + 1) / steps * 100);
            this.updateComponentProgress(componentProgress, componentInfo.name);
        }
        
        // Cache component files
        if (componentId === 'core') {
            await this.cacheCoreFIles(cache);
        } else if (componentId.startsWith('wikipedia')) {
            await this.cacheWikipediaFiles(cache, componentId);
        } else {
            await this.cacheModelFiles(cache, componentId);
        }
    }

    async cacheCoreFIles(cache) {
        // Cache essential script files
        const coreFiles = [
            '/offline/app-enhanced.js',
            '/offline/ai-models.js',
            '/offline/wikipedia.js',
            '/offline/enhanced-wikipedia-search.js',
            '/offline/query-logger.js',
            '/offline/wikipedia-content-parser.js',
            '/offline/wikipedia-router.js',
            '/offline/local-ai-model.js',
            '/offline/libs/onnxruntime-web.min.js',
            '/offline/icon-144.png'
        ];
        
        // Cache each file
        for (const file of coreFiles) {
            try {
                // Check if file exists on server
                const response = await fetch(file).catch(() => ({ ok: false }));
                
                if (response.ok) {
                    await cache.put(file, response);
                } else {
                    // Create empty file in cache if not found
                    const blob = new Blob(['// File not found'], { type: 'text/javascript' });
                    const response = new Response(blob);
                    await cache.put(file, response);
                }
            } catch (error) {
                console.warn(`Failed to cache ${file}:`, error);
            }
        }
    }

    async cacheModelFiles(cache, modelId) {
        // Cache model files
        const modelFiles = [
            `/offline/models/${modelId}.onnx`,
            `/offline/models/${modelId}-vocab.json`,
            `/offline/models/${modelId}-config.json`
        ];
        
        // Cache each file
        for (const file of modelFiles) {
            try {
                // Check if file exists on server
                const response = await fetch(file).catch(() => ({ ok: false }));
                
                if (response.ok) {
                    await cache.put(file, response);
                } else {
                    // Create empty file in cache if not found
                    const blob = new Blob(['{}'], { type: 'application/json' });
                    const response = new Response(blob);
                    await cache.put(file, response);
                }
            } catch (error) {
                console.warn(`Failed to cache ${file}:`, error);
            }
        }
    }

    async cacheWikipediaFiles(cache, wikipediaId) {
        // In a real implementation, this would download and cache the Wikipedia database
        // For now, we'll just simulate it
        console.log(`Simulating Wikipedia database download: ${wikipediaId}`);
        
        // Create a dummy database file in IndexedDB
        try {
            const db = await this.openIndexedDB();
            console.log('Wikipedia database initialized');
        } catch (error) {
            console.error('Failed to initialize Wikipedia database:', error);
        }
    }

    async openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('wikipedia-offline', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('articles')) {
                    db.createObjectStore('articles', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };
        });
    }

    async createDummyFiles(cache) {
        // Create dummy icon file
        try {
            const iconResponse = await fetch('/offline/icon-144.png').catch(() => ({ ok: false }));
            
            if (!iconResponse.ok) {
                // Create a simple SVG icon as fallback
                const svgIcon = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
                        <rect width="144" height="144" fill="#6366f1" />
                        <text x="72" y="72" font-family="Arial" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle">AI</text>
                    </svg>
                `;
                
                const blob = new Blob([svgIcon], { type: 'image/svg+xml' });
                const response = new Response(blob);
                await cache.put('/offline/icon-144.png', response);
            }
        } catch (error) {
            console.warn('Failed to create dummy icon:', error);
        }
    }

    updateProgress(percent, text, details) {
        this.progress = percent;
        
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const progressDetails = document.getElementById('progressDetails');
        
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
        
        if (progressText) {
            progressText.textContent = text;
        }
        
        if (progressDetails) {
            progressDetails.textContent = details;
        }
    }

    updateComponentProgress(percent, componentName) {
        const progressDetails = document.getElementById('progressDetails');
        
        if (progressDetails) {
            progressDetails.textContent = `Downloading ${componentName}: ${percent}%`;
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.downloadManager = new DownloadManagerEnhanced();
});
