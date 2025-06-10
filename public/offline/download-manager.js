// Enhanced Download Manager with server-side caching support
class DownloadManager {
    constructor() {
        this.downloads = new Map();
        this.cache = new Map();
        this.isInitialized = false;
        this.downloadQueue = [];
        this.maxConcurrentDownloads = 3;
        this.activeDownloads = 0;
        this.serverPackages = {};
    }

    async init() {
        console.log('📦 Initializing Download Manager');
        
        try {
            // Check server-side package availability
            await this.checkServerPackageAvailability();
            
            this.isInitialized = true;
            console.log('✅ Download Manager initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize Download Manager:', error);
            return false;
        }
    }

    async checkServerPackageAvailability() {
        try {
            const response = await fetch('/api/offline/packages/availability');
            const data = await response.json();
            
            if (data.success) {
                this.serverPackages = data.packages;
                console.log('📦 Server packages available:', Object.keys(this.serverPackages));
            } else {
                console.warn('⚠️ Failed to get server package availability');
                this.serverPackages = {};
            }
            
        } catch (error) {
            console.error('❌ Error checking server package availability:', error);
            this.serverPackages = {};
        }
    }

    getAvailablePackages() {
        const packages = {};
        
        // Add server-cached packages (minimal only)
        for (const [id, pkg] of Object.entries(this.serverPackages)) {
            if (pkg.cached && pkg.available) {
                packages[id] = {
                    ...pkg,
                    downloadType: 'cached'
                };
            }
        }
        
        // Add direct download packages (standard and full)
        for (const [id, pkg] of Object.entries(this.serverPackages)) {
            if (pkg.directDownload && pkg.available) {
                packages[id] = {
                    ...pkg,
                    downloadType: 'direct'
                };
            }
        }
        
        return packages;
    }

    async buildMinimalPackage() {
        try {
            console.log('🔨 Requesting minimal package build...');
            
            const response = await fetch('/api/offline/packages/build', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Minimal package built successfully');
                
                // Refresh package availability
                await this.checkServerPackageAvailability();
                
                return true;
            } else {
                console.error('❌ Failed to build minimal package:', data.error);
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error building minimal package:', error);
            return false;
        }
    }

    async downloadPackage(packageId, progressCallback) {
        const packageInfo = this.serverPackages[packageId];
        
        if (!packageInfo) {
            throw new Error(`Package ${packageId} not found`);
        }
        
        if (packageInfo.cached) {
            // Download from server cache
            return await this.downloadCachedPackage(packageId, progressCallback);
        } else if (packageInfo.directDownload) {
            // Direct client-side download
            return await this.downloadDirectPackage(packageId, progressCallback);
        } else {
            throw new Error(`Package ${packageId} is not available for download`);
        }
    }

    async downloadCachedPackage(packageId, progressCallback) {
        try {
            console.log(`📥 Downloading cached package: ${packageId}`);
            
            // Get package manifest
            const manifestResponse = await fetch(`/api/offline/packages/${packageId}/manifest`);
            const manifestData = await manifestResponse.json();
            
            if (!manifestData.success) {
                throw new Error('Failed to get package manifest');
            }
            
            const manifest = manifestData.manifest;
            const files = [];
            let completedFiles = 0;
            
            // Download each file
            for (const fileInfo of manifest.files) {
                if (progressCallback) {
                    progressCallback({
                        progress: (completedFiles / manifest.files.length) * 100,
                        currentFile: fileInfo.name,
                        completedFiles: completedFiles,
                        totalFiles: manifest.files.length
                    });
                }
                
                const fileResponse = await fetch(`/offline/packages/${packageId}/${fileInfo.name}`);
                
                if (!fileResponse.ok) {
                    throw new Error(`Failed to download ${fileInfo.name}: ${fileResponse.statusText}`);
                }
                
                const blob = await fileResponse.blob();
                
                files.push({
                    name: fileInfo.name,
                    blob: blob,
                    size: blob.size,
                    description: fileInfo.description
                });
                
                completedFiles++;
            }
            
            if (progressCallback) {
                progressCallback({
                    progress: 100,
                    currentFile: 'Complete',
                    completedFiles: completedFiles,
                    totalFiles: manifest.files.length
                });
            }
            
            console.log(`✅ Downloaded ${files.length} files for ${packageId}`);
            return files;
            
        } catch (error) {
            console.error(`❌ Failed to download cached package ${packageId}:`, error);
            throw error;
        }
    }

    async downloadDirectPackage(packageId, progressCallback) {
        // For direct downloads, we simulate the download process
        // In a real implementation, this would download from CDNs or external sources
        
        console.log(`📥 Starting direct download for package: ${packageId}`);
        
        const packageInfo = this.serverPackages[packageId];
        const simulatedFiles = [];
        
        // Simulate download progress
        const totalSteps = 10;
        for (let i = 0; i <= totalSteps; i++) {
            if (progressCallback) {
                progressCallback({
                    progress: (i / totalSteps) * 100,
                    currentFile: i === totalSteps ? 'Complete' : `Downloading ${packageInfo.name} components...`,
                    completedFiles: i,
                    totalFiles: totalSteps
                });
            }
            
            // Simulate download time
            await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
        }
        
        // For demo purposes, create placeholder files
        if (packageId === 'standard') {
            simulatedFiles.push(
                { name: 'phi3-mini.onnx', blob: new Blob(['Standard AI model data']), size: 800 * 1024 * 1024 },
                { name: 'wikipedia-simple.db', blob: new Blob(['Wikipedia data']), size: 50 * 1024 * 1024 },
                { name: 'app-standard.js', blob: new Blob(['Application code']), size: 1024 * 1024 }
            );
        } else if (packageId === 'full') {
            simulatedFiles.push(
                { name: 'multiple-models.tar.gz', blob: new Blob(['Multiple AI models']), size: 1.5 * 1024 * 1024 * 1024 },
                { name: 'wikipedia-extended.db', blob: new Blob(['Extended Wikipedia']), size: 500 * 1024 * 1024 },
                { name: 'app-full.js', blob: new Blob(['Full application']), size: 5 * 1024 * 1024 }
            );
        }
        
        console.log(`✅ Direct download completed for ${packageId}`);
        return simulatedFiles;
    }

    // Check if browser supports required features
    checkBrowserCapabilities() {
        const capabilities = {
            serviceWorker: 'serviceWorker' in navigator,
            indexedDB: 'indexedDB' in window,
            webAssembly: 'WebAssembly' in window,
            cacheAPI: 'caches' in window
        };
        
        console.log('Browser capabilities:', capabilities);
        return capabilities;
    }

    // Get download progress for a specific package
    getDownloadProgress(packageId) {
        return this.downloads.get(packageId) || null;
    }

    // Cancel a download
    cancelDownload(packageId) {
        const download = this.downloads.get(packageId);
        if (download && download.controller) {
            download.controller.abort();
            this.downloads.delete(packageId);
            console.log(`❌ Download cancelled for ${packageId}`);
            return true;
        }
        return false;
    }

    // Clear all downloads
    clearDownloads() {
        for (const [packageId, download] of this.downloads) {
            if (download.controller) {
                download.controller.abort();
            }
        }
        this.downloads.clear();
        console.log('🗑️ All downloads cleared');
    }
}

// Make DownloadManager available globally
window.DownloadManager = DownloadManager;

