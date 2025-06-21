// Progressive Download and Caching Manager for Offline Mode
class DownloadManager {
    constructor() {
        this.downloads = new Map();
        this.cache = null;
        this.isInitialized = false;
        this.downloadQueue = [];
        this.maxConcurrentDownloads = 3;
        this.activeDownloads = 0;
        
        // Download configurations
        this.downloadConfigs = {
            'minimal': {
                name: 'Minimal Package',
                totalSize: 200 * 1024 * 1024, // 200MB
                components: [
                    {
                        id: 'core-app',
                        name: 'Core Application',
                        size: 10 * 1024 * 1024,
                        url: '/offline/packages/core-app.zip',
                        priority: 1
                    },
                    {
                        id: 'tinybert-model',
                        name: 'TinyBERT AI Model',
                        size: 60 * 1024 * 1024,
                        url: 'https://huggingface.co/distilbert-base-uncased/resolve/main/pytorch_model.bin',
                        priority: 2
                    },
                    {
                        id: 'wikipedia-minimal',
                        name: 'Essential Wikipedia Articles',
                        size: 20 * 1024 * 1024,
                        url: '/offline/packages/wikipedia-minimal.db',
                        priority: 3
                    },
                    {
                        id: 'assets-minimal',
                        name: 'Application Assets',
                        size: 110 * 1024 * 1024,
                        url: '/offline/packages/assets-minimal.zip',
                        priority: 4
                    }
                ]
            },
            'standard': {
                name: 'Standard Package',
                totalSize: 800 * 1024 * 1024, // 800MB
                components: [
                    {
                        id: 'core-app',
                        name: 'Core Application',
                        size: 10 * 1024 * 1024,
                        url: '/offline/packages/core-app.zip',
                        priority: 1
                    },
                    {
                        id: 'phi3-mini-model',
                        name: 'Phi-3 Mini AI Model',
                        size: 600 * 1024 * 1024,
                        url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-onnx/resolve/main/cpu_and_mobile/cpu-int4-rtn-block-32-acc-level-4/phi3-mini-4k-instruct-cpu-int4-rtn-block-32-acc-level-4.onnx',
                        priority: 2
                    },
                    {
                        id: 'wikipedia-standard',
                        name: 'Simple Wikipedia Database',
                        size: 50 * 1024 * 1024,
                        url: '/offline/packages/wikipedia-standard.db',
                        priority: 3
                    },
                    {
                        id: 'assets-standard',
                        name: 'Extended Assets',
                        size: 140 * 1024 * 1024,
                        url: '/offline/packages/assets-standard.zip',
                        priority: 4
                    }
                ]
            },
            'full': {
                name: 'Full Package',
                totalSize: 2 * 1024 * 1024 * 1024, // 2GB
                components: [
                    {
                        id: 'core-app',
                        name: 'Core Application',
                        size: 10 * 1024 * 1024,
                        url: '/offline/packages/core-app.zip',
                        priority: 1
                    },
                    {
                        id: 'phi3-mini-model',
                        name: 'Phi-3 Mini AI Model',
                        size: 600 * 1024 * 1024,
                        url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-onnx/resolve/main/cpu_and_mobile/cpu-int4-rtn-block-32-acc-level-4/phi3-mini-4k-instruct-cpu-int4-rtn-block-32-acc-level-4.onnx',
                        priority: 2
                    },
                    {
                        id: 't5-small-model',
                        name: 'T5 Small Model',
                        size: 900 * 1024 * 1024,
                        url: 'https://huggingface.co/t5-small/resolve/main/pytorch_model.bin',
                        priority: 3
                    },
                    {
                        id: 'wikipedia-full',
                        name: 'Extended Wikipedia Database',
                        size: 200 * 1024 * 1024,
                        url: '/offline/packages/wikipedia-full.db',
                        priority: 4
                    },
                    {
                        id: 'assets-full',
                        name: 'Complete Assets Package',
                        size: 290 * 1024 * 1024,
                        url: '/offline/packages/assets-full.zip',
                        priority: 5
                    }
                ]
            }
        };
    }

    async initialize() {
        console.log('📦 Initializing Download Manager');
        
        try {
            // Open cache for storing downloaded components
            this.cache = await caches.open('ai-questions-offline-downloads-v1');
            
            // Check for existing downloads
            await this.loadDownloadState();
            
            this.isInitialized = true;
            console.log('✅ Download Manager initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Download Manager:', error);
            return false;
        }
    }

    async startPackageDownload(packageType, progressCallback) {
        console.log(`🚀 Starting download of ${packageType} package`);
        
        const config = this.downloadConfigs[packageType];
        if (!config) {
            throw new Error(`Unknown package type: ${packageType}`);
        }

        const downloadId = `package-${packageType}-${Date.now()}`;
        
        // Create download session
        const downloadSession = {
            id: downloadId,
            packageType,
            config,
            startTime: new Date(),
            totalSize: config.totalSize,
            downloadedSize: 0,
            components: new Map(),
            status: 'downloading',
            progressCallback
        };

        this.downloads.set(downloadId, downloadSession);

        try {
            // Download components in priority order
            const sortedComponents = config.components.sort((a, b) => a.priority - b.priority);
            
            for (const component of sortedComponents) {
                await this.downloadComponent(downloadSession, component);
                
                // Check if download was cancelled
                if (downloadSession.status === 'cancelled') {
                    throw new Error('Download cancelled by user');
                }
            }

            downloadSession.status = 'completed';
            downloadSession.endTime = new Date();
            
            // Save download state
            await this.saveDownloadState(downloadSession);
            
            console.log(`✅ Package ${packageType} downloaded successfully`);
            progressCallback?.(100, 'Download completed', 'All components downloaded successfully');
            
            return downloadSession;
            
        } catch (error) {
            downloadSession.status = 'failed';
            downloadSession.error = error.message;
            console.error(`❌ Package download failed:`, error);
            throw error;
        }
    }

    async downloadComponent(downloadSession, component) {
        console.log(`📥 Downloading component: ${component.name}`);
        
        const componentDownload = {
            id: component.id,
            name: component.name,
            size: component.size,
            downloadedSize: 0,
            status: 'downloading',
            startTime: new Date()
        };

        downloadSession.components.set(component.id, componentDownload);

        try {
            // Check if component is already cached
            const cachedResponse = await this.cache.match(component.url);
            if (cachedResponse) {
                console.log(`✅ Component ${component.name} found in cache`);
                componentDownload.status = 'completed';
                componentDownload.downloadedSize = component.size;
                downloadSession.downloadedSize += component.size;
                this.updateProgress(downloadSession);
                return;
            }

            // Download with progress tracking
            const response = await this.downloadWithProgress(
                component.url,
                component.size,
                (progress, loaded, total) => {
                    componentDownload.downloadedSize = loaded;
                    
                    // Update session progress
                    const sessionProgress = this.calculateSessionProgress(downloadSession);
                    downloadSession.progressCallback?.(
                        sessionProgress.percent,
                        `Downloading ${component.name}...`,
                        `${this.formatBytes(loaded)} / ${this.formatBytes(total)} (${progress}%)`
                    );
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Cache the downloaded component
            await this.cache.put(component.url, response.clone());
            
            componentDownload.status = 'completed';
            componentDownload.endTime = new Date();
            downloadSession.downloadedSize += component.size;
            
            console.log(`✅ Component ${component.name} downloaded successfully`);
            
        } catch (error) {
            componentDownload.status = 'failed';
            componentDownload.error = error.message;
            console.error(`❌ Component download failed:`, error);
            throw error;
        }
    }

    async downloadWithProgress(url, expectedSize, progressCallback) {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const contentLength = expectedSize || parseInt(response.headers.get('content-length') || '0');
        
        let receivedLength = 0;
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            chunks.push(value);
            receivedLength += value.length;
            
            // Update progress
            const progress = contentLength > 0 ? Math.round((receivedLength / contentLength) * 100) : 0;
            progressCallback?.(progress, receivedLength, contentLength);
            
            // Yield control to prevent blocking
            if (chunks.length % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }

        // Reconstruct the response
        const allChunks = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
            allChunks.set(chunk, position);
            position += chunk.length;
        }

        return new Response(allChunks, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    }

    calculateSessionProgress(downloadSession) {
        const totalSize = downloadSession.totalSize;
        let downloadedSize = 0;
        
        for (const component of downloadSession.components.values()) {
            downloadedSize += component.downloadedSize;
        }
        
        const percent = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
        
        return {
            percent,
            downloadedSize,
            totalSize,
            remainingSize: totalSize - downloadedSize
        };
    }

    updateProgress(downloadSession) {
        const progress = this.calculateSessionProgress(downloadSession);
        downloadSession.progressCallback?.(
            progress.percent,
            'Downloading package...',
            `${this.formatBytes(progress.downloadedSize)} / ${this.formatBytes(progress.totalSize)}`
        );
    }

    async pauseDownload(downloadId) {
        const download = this.downloads.get(downloadId);
        if (download && download.status === 'downloading') {
            download.status = 'paused';
            console.log(`⏸️ Download ${downloadId} paused`);
            return true;
        }
        return false;
    }

    async resumeDownload(downloadId) {
        const download = this.downloads.get(downloadId);
        if (download && download.status === 'paused') {
            download.status = 'downloading';
            console.log(`▶️ Download ${downloadId} resumed`);
            // Resume download logic would go here
            return true;
        }
        return false;
    }

    async cancelDownload(downloadId) {
        const download = this.downloads.get(downloadId);
        if (download) {
            download.status = 'cancelled';
            console.log(`❌ Download ${downloadId} cancelled`);
            return true;
        }
        return false;
    }

    async getDownloadStatus(downloadId) {
        const download = this.downloads.get(downloadId);
        if (!download) return null;
        
        const progress = this.calculateSessionProgress(download);
        
        return {
            id: download.id,
            packageType: download.packageType,
            status: download.status,
            progress: progress.percent,
            downloadedSize: progress.downloadedSize,
            totalSize: progress.totalSize,
            startTime: download.startTime,
            endTime: download.endTime,
            error: download.error,
            components: Array.from(download.components.values())
        };
    }

    async getCachedComponents() {
        const cachedUrls = [];
        const cache = await caches.open('ai-questions-offline-downloads-v1');
        const requests = await cache.keys();
        
        for (const request of requests) {
            cachedUrls.push(request.url);
        }
        
        return cachedUrls;
    }

    async clearCache() {
        console.log('🗑️ Clearing download cache');
        await caches.delete('ai-questions-offline-downloads-v1');
        this.cache = await caches.open('ai-questions-offline-downloads-v1');
        console.log('✅ Cache cleared');
    }

    async getCacheSize() {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                return {
                    used: estimate.usage || 0,
                    available: estimate.quota || 0,
                    usedFormatted: this.formatBytes(estimate.usage || 0),
                    availableFormatted: this.formatBytes(estimate.quota || 0)
                };
            }
        } catch (error) {
            console.error('Failed to get cache size:', error);
        }
        
        return {
            used: 0,
            available: 0,
            usedFormatted: '0 B',
            availableFormatted: 'Unknown'
        };
    }

    async saveDownloadState(downloadSession) {
        try {
            const db = await this.openIndexedDB();
            const transaction = db.transaction(['downloads'], 'readwrite');
            const store = transaction.objectStore('downloads');
            
            const downloadData = {
                id: downloadSession.id,
                packageType: downloadSession.packageType,
                status: downloadSession.status,
                startTime: downloadSession.startTime,
                endTime: downloadSession.endTime,
                totalSize: downloadSession.totalSize,
                downloadedSize: downloadSession.downloadedSize,
                components: Array.from(downloadSession.components.entries()),
                error: downloadSession.error
            };
            
            await this.promisifyRequest(store.put(downloadData));
            console.log(`💾 Download state saved for ${downloadSession.id}`);
        } catch (error) {
            console.error('Failed to save download state:', error);
        }
    }

    async loadDownloadState() {
        try {
            const db = await this.openIndexedDB();
            const transaction = db.transaction(['downloads'], 'readonly');
            const store = transaction.objectStore('downloads');
            const downloads = await this.promisifyRequest(store.getAll());
            
            for (const downloadData of downloads) {
                const downloadSession = {
                    id: downloadData.id,
                    packageType: downloadData.packageType,
                    status: downloadData.status,
                    startTime: new Date(downloadData.startTime),
                    endTime: downloadData.endTime ? new Date(downloadData.endTime) : null,
                    totalSize: downloadData.totalSize,
                    downloadedSize: downloadData.downloadedSize,
                    components: new Map(downloadData.components),
                    error: downloadData.error
                };
                
                this.downloads.set(downloadData.id, downloadSession);
            }
            
            console.log(`📚 Loaded ${downloads.length} download sessions`);
        } catch (error) {
            console.error('Failed to load download state:', error);
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AIQuestionsOffline', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('downloads')) {
                    db.createObjectStore('downloads', { keyPath: 'id' });
                }
            };
        });
    }

    promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    getPackageInfo(packageType) {
        return this.downloadConfigs[packageType] || null;
    }

    getAllPackages() {
        return Object.keys(this.downloadConfigs).map(type => ({
            type,
            ...this.downloadConfigs[type]
        }));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DownloadManager;
} else {
    window.DownloadManager = DownloadManager;
}

