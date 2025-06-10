class DownloadManagerEnhanced {
    constructor() {
        this.packages = {};
        this.currentDownload = null;
        this.init();
    }

    async init() {
        console.log('Initializing Enhanced Download Manager...');
        await this.checkPackageAvailability();
        this.setupEventListeners();
        this.updateUI();
    }

    async checkPackageAvailability() {
        try {
            console.log('Checking package availability from server...');
            const response = await fetch('/api/offline/packages/availability');
            const data = await response.json();
            
            this.packages = data;
            console.log('Package availability:', data);
            
        } catch (error) {
            console.error('Failed to check package availability:', error);
            // Fallback to client-side packages only
            this.packages = {
                minimal: { available: false, info: { reason: 'Server-side caching not available' } },
                standard: { available: true, info: { reason: 'Client-side download available' } },
                full: { available: true, info: { reason: 'Client-side download available' } }
            };
        }
    }

    setupEventListeners() {
        // Package selection
        document.querySelectorAll('.package-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectPackage(e));
            option.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.selectPackage(e);
            });
        });

        // Download button
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => this.startDownload(e));
            downloadBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.startDownload(e);
            });
        }

        // Build cache button (admin)
        const buildBtn = document.getElementById('buildCacheBtn');
        if (buildBtn) {
            buildBtn.addEventListener('click', (e) => this.buildCache(e));
        }
    }

    updateUI() {
        // Update package availability display
        Object.keys(this.packages).forEach(packageType => {
            const packageElement = document.querySelector(`[data-package="${packageType}"]`);
            if (packageElement) {
                const available = this.packages[packageType].available;
                const info = this.packages[packageType].info;
                
                // Update availability indicator
                const indicator = packageElement.querySelector('.availability-indicator');
                if (indicator) {
                    indicator.textContent = available ? '✅ Ready' : '⏳ Not Ready';
                    indicator.className = `availability-indicator ${available ? 'available' : 'unavailable'}`;
                }
                
                // Update package info
                const infoElement = packageElement.querySelector('.package-info');
                if (infoElement && info) {
                    if (available && info.totalSize) {
                        infoElement.textContent = `Size: ${info.totalSize} | Resources: ${info.cachedResources}/${info.totalResources}`;
                    } else {
                        infoElement.textContent = info.reason || 'Status unknown';
                    }
                }
                
                // Disable unavailable packages
                if (!available) {
                    packageElement.classList.add('disabled');
                    packageElement.style.opacity = '0.6';
                    packageElement.style.pointerEvents = 'none';
                }
            }
        });

        // Show admin controls if minimal package is not ready
        if (!this.packages.minimal?.available) {
            this.showAdminControls();
        }
    }

    showAdminControls() {
        const adminSection = document.getElementById('adminControls');
        if (adminSection) {
            adminSection.style.display = 'block';
        } else {
            // Create admin controls dynamically
            const container = document.querySelector('.download-container');
            if (container) {
                const adminDiv = document.createElement('div');
                adminDiv.id = 'adminControls';
                adminDiv.className = 'admin-controls';
                adminDiv.innerHTML = `
                    <div class="admin-section">
                        <h3>🔧 Administrator Controls</h3>
                        <p>The minimal package is not ready. Build the server-side cache to enable it:</p>
                        <button id="buildCacheBtn" class="build-cache-btn">
                            🏗️ Build Minimal Package Cache
                        </button>
                        <div id="buildStatus" class="build-status"></div>
                    </div>
                `;
                container.appendChild(adminDiv);
                
                // Add event listener for the new button
                document.getElementById('buildCacheBtn').addEventListener('click', (e) => this.buildCache(e));
            }
        }
    }

    selectPackage(event) {
        const packageElement = event.currentTarget;
        const packageType = packageElement.dataset.package;
        
        // Check if package is available
        if (!this.packages[packageType]?.available) {
            this.showMessage(`${packageType} package is not available: ${this.packages[packageType]?.info?.reason}`, 'warning');
            return;
        }
        
        // Remove previous selection
        document.querySelectorAll('.package-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Select current package
        packageElement.classList.add('selected');
        
        // Update download button
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.textContent = `Download ${packageType.charAt(0).toUpperCase() + packageType.slice(1)} Package`;
            downloadBtn.disabled = false;
            downloadBtn.dataset.package = packageType;
        }
        
        // Visual feedback
        packageElement.style.transform = 'scale(0.98)';
        setTimeout(() => {
            packageElement.style.transform = 'scale(1)';
        }, 150);
    }

    async startDownload(event) {
        const packageType = event.target.dataset.package;
        if (!packageType) {
            this.showMessage('Please select a package first', 'error');
            return;
        }

        if (!this.packages[packageType]?.available) {
            this.showMessage(`${packageType} package is not available`, 'error');
            return;
        }

        try {
            this.currentDownload = packageType;
            this.showProgress(0, 'Initializing download...');
            
            if (packageType === 'minimal') {
                await this.downloadServerPackage(packageType);
            } else {
                await this.downloadClientPackage(packageType);
            }
            
        } catch (error) {
            console.error('Download failed:', error);
            this.showMessage(`Download failed: ${error.message}`, 'error');
            this.hideProgress();
        }
    }

    async downloadServerPackage(packageType) {
        try {
            console.log(`Starting server-side download for ${packageType} package...`);
            
            const response = await fetch(`/offline/packages/${packageType}.zip`);
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const contentLength = response.headers.get('content-length');
            const total = parseInt(contentLength, 10);
            let loaded = 0;

            const reader = response.body.getReader();
            const chunks = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                loaded += value.length;

                if (total) {
                    const progress = (loaded / total) * 100;
                    this.showProgress(progress, `Downloading... ${this.formatBytes(loaded)}/${this.formatBytes(total)}`);
                }
            }

            // Create blob and download
            const blob = new Blob(chunks);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-questions-${packageType}-offline.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showMessage(`${packageType} package downloaded successfully!`, 'success');
            this.hideProgress();

        } catch (error) {
            console.error('Server package download failed:', error);
            throw error;
        }
    }

    async downloadClientPackage(packageType) {
        // Fallback to client-side download for standard/full packages
        this.showMessage(`${packageType} package requires client-side download (not yet implemented)`, 'info');
        this.hideProgress();
    }

    async buildCache(event) {
        try {
            const buildBtn = event.target;
            const statusDiv = document.getElementById('buildStatus');
            
            buildBtn.disabled = true;
            buildBtn.textContent = '🔄 Building...';
            
            if (statusDiv) {
                statusDiv.innerHTML = '<div class="building">Building minimal package cache... This may take several minutes.</div>';
            }

            const response = await fetch('/api/offline/packages/build', {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (response.ok) {
                if (statusDiv) {
                    statusDiv.innerHTML = '<div class="success">✅ Cache build started! Check back in a few minutes.</div>';
                }
                
                // Poll for completion
                this.pollBuildStatus();
                
            } else {
                throw new Error(result.error || 'Build failed');
            }
            
        } catch (error) {
            console.error('Cache build failed:', error);
            const statusDiv = document.getElementById('buildStatus');
            if (statusDiv) {
                statusDiv.innerHTML = `<div class="error">❌ Build failed: ${error.message}</div>`;
            }
        } finally {
            const buildBtn = document.getElementById('buildCacheBtn');
            if (buildBtn) {
                buildBtn.disabled = false;
                buildBtn.textContent = '🏗️ Build Minimal Package Cache';
            }
        }
    }

    async pollBuildStatus() {
        const maxAttempts = 30; // 5 minutes with 10-second intervals
        let attempts = 0;
        
        const poll = async () => {
            try {
                const response = await fetch('/api/offline/packages/status');
                const status = await response.json();
                
                const statusDiv = document.getElementById('buildStatus');
                if (statusDiv && status.available) {
                    statusDiv.innerHTML = '<div class="success">✅ Minimal package cache ready! Refresh the page to download.</div>';
                    
                    // Refresh package availability
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                    return;
                }
                
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(poll, 10000); // Check every 10 seconds
                } else {
                    if (statusDiv) {
                        statusDiv.innerHTML = '<div class="warning">⏳ Build is taking longer than expected. Please check back later.</div>';
                    }
                }
                
            } catch (error) {
                console.error('Status poll failed:', error);
            }
        };
        
        setTimeout(poll, 10000); // Start polling after 10 seconds
    }

    showProgress(percentage, message) {
        let progressContainer = document.getElementById('downloadProgress');
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.id = 'downloadProgress';
            progressContainer.className = 'download-progress';
            document.querySelector('.download-container').appendChild(progressContainer);
        }

        progressContainer.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="progress-text">${message}</div>
            <div class="progress-percentage">${percentage.toFixed(1)}%</div>
        `;
        progressContainer.style.display = 'block';
    }

    hideProgress() {
        const progressContainer = document.getElementById('downloadProgress');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }

    showMessage(message, type = 'info') {
        let messageContainer = document.getElementById('downloadMessage');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'downloadMessage';
            messageContainer.className = 'download-message';
            document.querySelector('.download-container').appendChild(messageContainer);
        }

        messageContainer.className = `download-message ${type}`;
        messageContainer.textContent = message;
        messageContainer.style.display = 'block';

        // Auto-hide after 5 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                messageContainer.style.display = 'none';
            }, 5000);
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.downloadManager = new DownloadManagerEnhanced();
});

