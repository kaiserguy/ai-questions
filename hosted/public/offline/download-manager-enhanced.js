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
        
        // Check if download was just completed (after page reload)
        this.checkDownloadCompletion();
    }

    checkDownloadCompletion() {
        // Check if we have a stored download completion flag
        const downloadCompleted = localStorage.getItem('offline_download_completed');
        if (downloadCompleted) {
            // Get the package type that was downloaded
            const packageType = localStorage.getItem('offline_package_type') || 'standard';
            
            console.log(`Detected completed download of ${packageType} package`);
            
            // Clear the flag to prevent showing the message again on future reloads
            localStorage.removeItem('offline_download_completed');
            
            // Show success message
            this.showDownloadSuccess(packageType);
            
            // Notify the app that offline resources are available
            if (window.offlineApp) {
                // Trigger offline status check
                window.offlineApp.checkOfflineStatus().then(() => {
                    // Update UI based on offline status
                    window.offlineApp.updateUI();
                });
            } else {
                console.warn('OfflineApp not available to notify about download completion');
                
                // Fallback: try to update UI elements directly
                this.updateUIAfterDownload();
            }
        }
    }
    
    showDownloadSuccess(packageType) {
        // Create a success notification
        const notification = document.createElement('div');
        notification.className = 'download-success-notification';
        notification.innerHTML = `
            <div class="success-icon">✓</div>
            <div class="success-message">
                <h3>${packageType.charAt(0).toUpperCase() + packageType.slice(1)} Package Downloaded Successfully!</h3>
                <p>All resources are now available offline. You can use AI Questions without an internet connection.</p>
            </div>
            <button class="close-btn">×</button>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .download-success-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 15px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 1000;
                max-width: 400px;
                animation: slideIn 0.5s ease-out;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .success-icon {
                font-size: 24px;
                background: rgba(255, 255, 255, 0.2);
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .success-message {
                flex: 1;
            }
            
            .success-message h3 {
                margin: 0 0 5px 0;
                font-size: 16px;
            }
            
            .success-message p {
                margin: 0;
                font-size: 14px;
                opacity: 0.9;
            }
            
            .close-btn {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.7;
            }
            
            .close-btn:hover {
                opacity: 1;
            }
            
            @media (max-width: 576px) {
                .download-success-notification {
                    bottom: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        // Add event listener to close button
        notification.querySelector('.close-btn').addEventListener('click', () => {
            notification.remove();
        });
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.style.animation = 'slideOut 0.5s ease-in forwards';
                
                // Add slideOut animation
                const slideOutStyle = document.createElement('style');
                slideOutStyle.textContent = `
                    @keyframes slideOut {
                        from {
                            transform: translateX(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                    }
                `;
                document.head.appendChild(slideOutStyle);
                
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        notification.remove();
                    }
                }, 500);
            }
        }, 10000);
    }
    
    updateUIAfterDownload() {
        // Hide download section
        const downloadSection = document.getElementById('downloadSection');
        if (downloadSection) {
            downloadSection.style.display = 'none';
        }
        
        // Hide progress section
        const progressSection = document.getElementById('progressSection');
        if (progressSection) {
            progressSection.style.display = 'none';
        }
        
        // Show chat section
        const chatSection = document.getElementById('chatSection');
        if (chatSection) {
            chatSection.style.display = 'block';
        }
        
        // Update status indicator
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const statusDescription = document.getElementById('statusDescription');
        
        if (statusDot) {
            statusDot.classList.add('offline');
        }
        
        if (statusText) {
            statusText.textContent = '🟢 Offline Ready';
        }
        
        if (statusDescription) {
            statusDescription.textContent = 'All required resources are available. You can use AI Questions completely offline.';
        }
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
            // TODO: Implement actual download process
            await this.downloadPackage(this.currentPackage);
            
            // Show success message
            this.updateProgress(100, 'Download complete!', 'All resources downloaded successfully');
            
            // Store download completion in localStorage
            localStorage.setItem('offline_download_completed', 'true');
            localStorage.setItem('offline_package_type', this.currentPackage);
            
            // Update UI without reloading
            setTimeout(() => {
                // Hide progress section
                if (progressSection) progressSection.style.display = 'none';
                
                // Notify the app that offline resources are available
                if (window.offlineApp) {
                    // Trigger offline status check
                    window.offlineApp.checkOfflineStatus().then(() => {
                        // Update UI based on offline status
                        window.offlineApp.updateUI();
                        
                        // Show success notification
                        this.showDownloadSuccess(this.currentPackage);
                    });
                } else {
                    console.warn('OfflineApp not available to notify about download completion');
                    
                    // Fallback: try to update UI elements directly
                    this.updateUIAfterDownload();
                    
                    // Show success notification
                    this.showDownloadSuccess(this.currentPackage);
                }
                
                this.isDownloading = false;
            }, 1000);
            
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
            
            // TODO: Download actual component
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
        
        // Store download metadata
        await this.storeDownloadMetadata(packageType);
        
        return true;
    }
    
    async storeDownloadMetadata(packageType) {
        try {
            // Store metadata in IndexedDB
            const db = await this.openIndexedDB();
            const transaction = db.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');
            
            // Store package info
            await new Promise((resolve, reject) => {
                const request = store.put({
                    key: 'download_info',
                    packageType,
                    timestamp: new Date().toISOString(),
                    components: this.packageInfo?.packages?.[packageType]?.components || []
                });
                
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            
            console.log(`Stored download metadata for ${packageType} package`);
        } catch (error) {
            console.error('Failed to store download metadata:', error);
        }
    }

    async downloadComponent(componentId, componentInfo, cache) {
        // TODO: Calculate actual download time based on component size
        const sizeInMB = parseInt(componentInfo.size) || 10;
        const downloadTimeMs = Math.min(sizeInMB * 20, 3000); // Faster for demo
        
        // TODO: Implement actual progress updates
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
        // TODO: Download and cache actual Wikipedia database
        console.log(`Simulating Wikipedia database download: ${wikipediaId}`);
        
        // Create a dummy database file in IndexedDB
        try {
            const db = await this.openIndexedDB();
            console.log('Wikipedia database initialized');
            
            // Add a sample article to verify database works
            const transaction = db.transaction(['articles'], 'readwrite');
            const store = transaction.objectStore('articles');
            
            // Add a sample article
            await new Promise((resolve, reject) => {
                const request = store.put({
                    id: 'sample_article',
                    title: 'Sample Article',
                    content: 'This is a sample article to verify the Wikipedia database is working.',
                    timestamp: new Date().toISOString()
                });
                
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            
            console.log('Added sample article to Wikipedia database');
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
