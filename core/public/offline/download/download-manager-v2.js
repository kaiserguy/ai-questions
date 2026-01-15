/**
 * Enhanced Download Manager
 * Handles file downloads with progress tracking, validation, and retry logic
 */
class DownloadManagerV2 {
    constructor() {
        this.downloads = new Map();
        this.retryAttempts = 3;
        this.retryDelay = 1000; // ms
        // Event handlers for compatibility with IntegrationManager
        this.onProgressUpdate = null;
        this.onResourceUpdate = null;
        this.onComplete = null;
        this.onError = null;
    }

    /**
     * Set event handlers for download progress and status updates
     * @param {Object} handlers - Event handler callbacks
     * @param {Function} handlers.onProgressUpdate - Progress update callback
     * @param {Function} handlers.onResourceUpdate - Resource status update callback
     * @param {Function} handlers.onComplete - Download complete callback
     * @param {Function} handlers.onError - Error callback
     */
    setEventHandlers(handlers) {
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
     * Download file with progress tracking
     * @param {string} url - File URL
     * @param {string} fileName - File name
     * @param {Object} options - Download options
     * @param {Function} options.onProgress - Progress callback
     * @param {string} options.expectedChecksum - Expected SHA-256 checksum
     * @param {number} options.retryAttempts - Number of retry attempts
     * @returns {Promise<Blob>}
     */
    async downloadFile(url, fileName, options = {}) {
        const {
            onProgress = null,
            expectedChecksum = null,
            retryAttempts = this.retryAttempts
        } = options;

        let lastError = null;

        for (let attempt = 0; attempt < retryAttempts; attempt++) {
            try {
                const blob = await this._downloadWithProgress(url, fileName, onProgress);
                
                // Validate checksum if provided
                if (expectedChecksum) {
                    const isValid = await this.validateChecksum(blob, expectedChecksum);
                    if (!isValid) {
                        throw new Error('Checksum validation failed');
                    }
                }

                return blob;
            } catch (error) {
                lastError = error;
                console.error(`Download attempt ${attempt + 1} failed:`, error);
                
                if (attempt < retryAttempts - 1) {
                    await this.delay(this.retryDelay * Math.pow(2, attempt));
                }
            }
        }

        throw new Error(`Failed to download ${fileName} after ${retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Internal download with progress tracking
     * @private
     * @param {string} url - File URL
     * @param {string} fileName - File name
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Blob>}
     */
    async _downloadWithProgress(url, fileName, onProgress) {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }

        const contentLength = +response.headers.get('Content-Length');
        if (!contentLength) {
            throw new Error('Content-Length header missing');
        }

        const reader = response.body.getReader();
        let receivedLength = 0;
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            chunks.push(value);
            receivedLength += value.length;
            
            if (onProgress) {
                onProgress({
                    fileName,
                    loaded: receivedLength,
                    total: contentLength,
                    percentage: (receivedLength / contentLength) * 100
                });
            }
        }

        return new Blob(chunks);
    }

    /**
     * Download multiple files with overall progress
     * @param {Array<Object>} files - Array of {url, name, checksum}
     * @param {Function} onProgress - Overall progress callback
     * @returns {Promise<Map<string, Blob>>}
     */
    async downloadMultiple(files, onProgress) {
        const results = new Map();
        const fileProgress = new Map();
        
        // Initialize progress tracking
        files.forEach(file => {
            fileProgress.set(file.name, { loaded: 0, total: 0 });
        });

        const updateOverallProgress = () => {
            let totalLoaded = 0;
            let totalSize = 0;
            
            fileProgress.forEach(progress => {
                totalLoaded += progress.loaded;
                totalSize += progress.total;
            });

            if (onProgress && totalSize > 0) {
                onProgress({
                    loaded: totalLoaded,
                    total: totalSize,
                    percentage: (totalLoaded / totalSize) * 100,
                    filesCompleted: results.size,
                    filesTotal: files.length
                });
            }
        };

        // Download files sequentially
        for (const file of files) {
            const blob = await this.downloadFile(file.url, file.name, {
                expectedChecksum: file.checksum,
                onProgress: (progress) => {
                    fileProgress.set(file.name, {
                        loaded: progress.loaded,
                        total: progress.total
                    });
                    updateOverallProgress();
                }
            });
            
            results.set(file.name, blob);
        }

        return results;
    }

    /**
     * Validate file checksum
     * @param {Blob} blob - File blob
     * @param {string} expectedChecksum - Expected SHA-256 hex string
     * @returns {Promise<boolean>}
     */
    async validateChecksum(blob, expectedChecksum) {
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex === expectedChecksum.toLowerCase();
    }

    /**
     * Calculate checksum for a blob
     * @param {Blob} blob - File blob
     * @returns {Promise<string>} SHA-256 hex string
     */
    async calculateChecksum(blob) {
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Delay helper for retry logic
     * @private
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cancel download
     * @param {string} fileName - File name to cancel
     */
    cancelDownload(fileName) {
        // Implementation would need AbortController integration
        this.downloads.delete(fileName);
    }
}

// Export for use in browser and Node.js
if (typeof window !== 'undefined') {
    window.DownloadManagerV2 = DownloadManagerV2;
    window.DownloadManager = DownloadManagerV2; // Alias for backward compatibility
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DownloadManagerV2 };
}
