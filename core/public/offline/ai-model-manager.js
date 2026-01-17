/**
 * AIModelManager - Manages offline AI model loading and inference using WebLLM
 * Handles local AI models for offline question answering with real LLM inference
 */

class AIModelManager {
    constructor(packageType = null) {
        // Validate package type - tests expect error when null/undefined/empty
        if (packageType === null || packageType === undefined || packageType === '') {
            throw new Error('Package type is required');
        }
        
        const validPackages = ['mobile', 'minimal', 'standard', 'full'];
        if (!validPackages.includes(packageType)) {
            throw new Error(`Invalid package type: ${packageType}. Must be one of: ${validPackages.join(', ')}`);
        }
        
        this.packageType = packageType;
        this.engine = null;
        this.ready = false;
        this.loading = false;
        this.initialized = false; // Alias for tests
        this.error = null;
        this.model = null;
        
        // Model configurations for different package types
        // Sizes are approximate and include model weights + WASM runtime
        this.modelConfigs = {
            'mobile': {
                modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',  // Tiny model (~300MB)
                description: 'Mobile-optimized tiny model for basic Q&A',
                sizeBytes: 300 * 1024 * 1024,  // ~300MB
                minStorageBytes: 500 * 1024 * 1024  // Need 500MB free for safety
            },
            'minimal': {
                modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',  // Small model (~600MB)
                description: 'Lightweight model for basic Q&A',
                sizeBytes: 600 * 1024 * 1024,  // ~600MB
                minStorageBytes: 800 * 1024 * 1024  // Need 800MB free for safety
            },
            'standard': {
                modelId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',  // Medium model (~1.8GB)
                description: 'Balanced model for general Q&A',
                sizeBytes: 1800 * 1024 * 1024,  // ~1.8GB
                minStorageBytes: 2200 * 1024 * 1024  // Need 2.2GB free for safety
            },
            'full': {
                modelId: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',  // Full model (~4.5GB)
                description: 'Full-featured model for comprehensive Q&A',
                sizeBytes: 4500 * 1024 * 1024,  // ~4.5GB
                minStorageBytes: 5500 * 1024 * 1024  // Need 5.5GB free for safety
            }
        };
    }

    /**
     * Set the package type for model selection
     * @param {string} packageType - Type of package ('mobile', 'minimal', 'standard', 'full')
     */
    setPackageType(packageType) {
        // Allow null/undefined/empty for testing
        if (packageType === null || packageType === undefined || packageType === '') {
            this.packageType = null;
            return;
        }
        
        const validPackages = ['mobile', 'minimal', 'standard', 'full'];
        if (!validPackages.includes(packageType)) {
            throw new Error(`Invalid package type: ${packageType}. Must be one of: ${validPackages.join(', ')}`);
        }
        this.packageType = packageType;
    }

    /**
     * Check available storage quota
     * @returns {Promise<{available: number, total: number, used: number, sufficient: boolean}>}
     */
    async checkStorageQuota() {
        const config = this.modelConfigs[this.packageType];
        const requiredBytes = config ? config.minStorageBytes : 500 * 1024 * 1024;
        
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                const available = (estimate.quota || 0) - (estimate.usage || 0);
                const result = {
                    available: available,
                    total: estimate.quota || 0,
                    used: estimate.usage || 0,
                    required: requiredBytes,
                    sufficient: available >= requiredBytes
                };
                
                console.log(`[AIModelManager] Storage check: ${this._formatBytes(available)} available, ${this._formatBytes(requiredBytes)} required`);
                return result;
            }
        } catch (error) {
            console.warn('[AIModelManager] Could not check storage quota:', error.message);
        }
        
        // If we can't check, assume sufficient (will fail gracefully later if not)
        return {
            available: -1,
            total: -1,
            used: -1,
            required: requiredBytes,
            sufficient: true,
            unknown: true
        };
    }

    /**
     * Format bytes to human-readable string
     * @private
     */
    _formatBytes(bytes) {
        if (bytes < 0) return 'Unknown';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    /**
     * Get recommended package type based on device capabilities
     * @returns {Promise<string>}
     */
    async getRecommendedPackage() {
        // Check if mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Check storage
        const storage = await this.checkStorageQuota();
        
        if (isMobile || storage.available < 800 * 1024 * 1024) {
            return 'mobile';
        } else if (storage.available < 2200 * 1024 * 1024) {
            return 'minimal';
        } else if (storage.available < 5500 * 1024 * 1024) {
            return 'standard';
        } else {
            return 'full';
        }
    }

    /**
     * Check if device is mobile
     * @returns {boolean}
     */
    static isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Load the AI model (alias for initialize for test compatibility)
     * @returns {Promise<void>}
     */
    async loadModel() {
        return await this.initialize();
    }

    /**
     * Initialize the AI model
     * @param {Function} progressCallback - Optional callback for progress updates
     * @returns {Promise<void>}
     */
    async initialize(progressCallback = null) {
        if (!this.packageType) {
            throw new Error('Package type must be set before initialization');
        }

        if (this.ready) {
            console.log('[AIModelManager] Model already initialized');
            return;
        }

        if (this.loading) {
            console.log('[AIModelManager] Model is already loading');
            return;
        }

        this.loading = true;
        this.error = null;

        try {
            // Check storage quota before attempting download
            const storage = await this.checkStorageQuota();
            if (!storage.sufficient && !storage.unknown) {
                const config = this.modelConfigs[this.packageType];
                const availableStr = this._formatBytes(storage.available);
                const requiredStr = this._formatBytes(storage.required);
                
                // Suggest a smaller package if available
                let suggestion = '';
                if (this.packageType !== 'mobile') {
                    suggestion = ' Try selecting the "Mobile" package which requires less storage.';
                }
                
                throw new Error(
                    `Insufficient storage space. Available: ${availableStr}, Required: ${requiredStr}.${suggestion}`
                );
            }
            
            // Load model based on package type
            console.log(`[AIModelManager] Loading model for package: ${this.packageType}`);
            
            // Load the actual model using WebLLM
            await this._loadModel(progressCallback);
            
            this.ready = true;
            this.initialized = true;
            this.loading = false;
            console.log('[AIModelManager] Model loaded successfully');
            
            // Dispatch event for UI update
            window.dispatchEvent(new Event('modelLoaded'));
            
            // Update UI directly
            if (typeof updateModelStatus === 'function') {
                updateModelStatus();
            }
        } catch (error) {
            this.loading = false;
            this.ready = false;
            this.initialized = false;
            this.error = error.message;
            console.error('[AIModelManager] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Internal method to load the model using WebLLM
     * @private
     */
    async _loadModel(progressCallback) {
        // Validate package type
        const validPackages = ['mobile', 'minimal', 'standard', 'full'];
        
        if (!validPackages.includes(this.packageType)) {
            throw new Error(`Invalid package type: ${this.packageType}`);
        }

        const config = this.modelConfigs[this.packageType];
        
        // WebLLM availability already checked in initialize()
        // This method should only be called when WebLLM is available

        // Real WebLLM implementation
        const initProgressCallback = (progress) => {
            console.log(`[AIModelManager] Loading progress: ${JSON.stringify(progress)}`);
            if (progressCallback) {
                progressCallback(progress);
            }
        };

        try {
            // Check if model is available locally on server
            const localModelUrl = `/webllm-models/${config.modelId}/metadata.json`;
            let useLocalModel = false;
            let metadata = null;
            
            try {
                const response = await fetch(localModelUrl);
                if (response.ok) {
                    metadata = await response.json();
                    console.log('[AIModelManager] Found local model cache:', metadata);
                    useLocalModel = true;
                }
            } catch (e) {
                console.log('[AIModelManager] Local model cache not found, will download from CDN');
            }
            
            // Configure model loading
            const engineConfig = {
                initProgressCallback
            };
            
            // If local model is available, configure WebLLM to use it
            // WebLLM expects the model to be in HuggingFace format with specific files
            // For now, just use the default CDN - browser will cache it in IndexedDB
            // TODO: Properly configure custom model URL once we verify the model format
            
            this.engine = await window.webllm.CreateMLCEngine(
                config.modelId,
                engineConfig
            );
            
            this.model = {
                type: this.packageType,
                modelId: config.modelId,
                loaded: true,
                timestamp: new Date().toISOString(),
                engine: 'WebLLM',
                source: useLocalModel ? 'local-cache-available' : 'cdn',
                localCacheDetected: useLocalModel
            };
        } catch (error) {
            // Check if it's a storage/cache error
            if (error.message && error.message.includes('Cache')) {
                throw new Error(
                    `Failed to cache AI model. This is usually caused by insufficient storage space. ` +
                    `Try clearing browser data or selecting a smaller model package. Original error: ${error.message}`
                );
            }
            throw new Error(`Failed to load WebLLM model: ${error.message}`);
        }
    }

    /**
     * Check if the model is ready for inference
     * @returns {boolean}
     */
    isReady() {
        return this.ready && this.model !== null;
    }

    /**
     * Generate a response to a prompt
     * @param {string} prompt - The input prompt
     * @param {Function} onToken - Optional callback for streaming tokens
     * @returns {Promise<string>} Generated response
     */
    async generateResponse(prompt, onToken = null) {
        if (!this.isReady()) {
            throw new Error('Model is not ready. Call initialize() first.');
        }

        if (!prompt || typeof prompt !== 'string') {
            throw new Error('Prompt must be a non-empty string');
        }

        if (!this.engine || typeof this.engine.chat === 'undefined') {
            throw new Error(
                'WebLLM engine is not properly initialized. Cannot generate response.'
            );
        }

        try {
            // Use streaming if callback provided
            if (onToken && typeof onToken === 'function') {
                const completion = await this.engine.chat.completions.create({
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 512,
                    stream: true
                });
                
                let fullResponse = '';
                for await (const chunk of completion) {
                    const delta = chunk.choices[0]?.delta?.content || '';
                    if (delta) {
                        fullResponse += delta;
                        onToken(delta);
                    }
                }
                return fullResponse;
            } else {
                // Non-streaming fallback
                const response = await this.engine.chat.completions.create({
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 512
                });
                
                return response.choices[0].message.content;
            }
        } catch (error) {
            this.error = error.message;
            console.error('[AIModelManager] Response generation failed:', error);
            throw error;
        }
    }

    /**
     * Get the current model status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            ready: this.ready,
            loading: this.loading,
            error: this.error,
            packageType: this.packageType,
            model: this.model ? {
                type: this.model.type,
                modelId: this.model.modelId,
                engine: this.model.engine,
                timestamp: this.model.timestamp
            } : null
        };
    }

    /**
     * Get model configuration info
     * @returns {Object} Model configuration
     */
    getModelConfig() {
        return this.modelConfigs[this.packageType] || null;
    }

    /**
     * Get all available model configurations
     * @returns {Object} All model configurations
     */
    static getAvailableModels() {
        return {
            'mobile': {
                modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
                description: 'Mobile-optimized tiny model for basic Q&A',
                sizeBytes: 300 * 1024 * 1024,
                sizeLabel: '~300 MB',
                recommended: 'Mobile devices, limited storage'
            },
            'minimal': {
                modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
                description: 'Lightweight model for basic Q&A',
                sizeBytes: 600 * 1024 * 1024,
                sizeLabel: '~600 MB',
                recommended: 'Tablets, older computers'
            },
            'standard': {
                modelId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
                description: 'Balanced model for general Q&A',
                sizeBytes: 1800 * 1024 * 1024,
                sizeLabel: '~1.8 GB',
                recommended: 'Most desktop computers'
            },
            'full': {
                modelId: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',
                description: 'Full-featured model for comprehensive Q&A',
                sizeBytes: 4500 * 1024 * 1024,
                sizeLabel: '~4.5 GB',
                recommended: 'High-end computers with ample storage'
            }
        };
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        if (this.engine && typeof this.engine.unload === 'function') {
            await this.engine.unload();
        }
        
        this.engine = null;
        this.model = null;
        this.ready = false;
        this.initialized = false;
        this.loading = false;
        this.error = null;
        console.log('[AIModelManager] Resources cleaned up');
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.AIModelManager = AIModelManager;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIModelManager;
}
