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
        
        const validPackages = ['minimal', 'standard', 'full'];
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
        this.modelConfigs = {
            'minimal': {
                modelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',  // Smallest model (~0.5GB)
                description: 'Lightweight model for basic Q&A'
            },
            'standard': {
                modelId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',  // Medium model (~1.5GB)
                description: 'Balanced model for general Q&A'
            },
            'full': {
                modelId: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',  // Full model (~4.5GB)
                description: 'Full-featured model for comprehensive Q&A'
            }
        };
    }

    /**
     * Set the package type for model selection
     * @param {string} packageType - Type of package ('minimal', 'standard', 'full')
     */
    setPackageType(packageType) {
        // Allow null/undefined/empty for testing
        if (packageType === null || packageType === undefined || packageType === '') {
            this.packageType = null;
            return;
        }
        
        const validPackages = ['minimal', 'standard', 'full'];
        if (!validPackages.includes(packageType)) {
            throw new Error(`Invalid package type: ${packageType}. Must be one of: ${validPackages.join(', ')}`);
        }
        this.packageType = packageType;
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
            // Load model based on package type
            console.log(`[AIModelManager] Loading model for package: ${this.packageType}`);
            
            // Load the actual model using WebLLM
            await this._loadModel(progressCallback);
            
            this.ready = true;
            this.initialized = true;
            this.loading = false;
            console.log('[AIModelManager] Model loaded successfully');
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
        const validPackages = ['minimal', 'standard', 'full'];
        
        if (!validPackages.includes(this.packageType)) {
            throw new Error(`Invalid package type: ${this.packageType}`);
        }

        const config = this.modelConfigs[this.packageType];
        
        // Check if we're in a browser environment with WebLLM support
        if (typeof window === 'undefined' || !window.webllm) {
            throw new Error(
                'WebLLM is not available. AI chat requires WebLLM to be loaded. ' +
                'Please ensure the WebLLM library is included in your page.'
            );
        }

        // Real WebLLM implementation
        const initProgressCallback = (progress) => {
            console.log(`[AIModelManager] Loading progress: ${JSON.stringify(progress)}`);
            if (progressCallback) {
                progressCallback(progress);
            }
        };

        try {
            this.engine = await window.webllm.CreateMLCEngine(
                config.modelId,
                { initProgressCallback }
            );
            
            this.model = {
                type: this.packageType,
                modelId: config.modelId,
                loaded: true,
                timestamp: new Date().toISOString(),
                engine: 'WebLLM'
            };
        } catch (error) {
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
     * @returns {Promise<string>} Generated response
     */
    async generateResponse(prompt) {
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
            // Real WebLLM inference
            const response = await this.engine.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 512
            });
            
            return response.choices[0].message.content;
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

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIModelManager;
}
