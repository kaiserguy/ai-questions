/**
 * ONNX Session Manager
 * Handles ONNX Runtime Web session creation, model loading, and inference execution
 * 
 * Supports WebGPU acceleration with automatic fallback to WebAssembly
 */

class ONNXSessionManager {
    constructor() {
        this.session = null;
        this.executionProvider = null;
        this.modelMetadata = null;
        this.isLoaded = false;
        this.inputNames = [];
        this.outputNames = [];
        
        // Performance tracking
        this.stats = {
            loadTimeMs: 0,
            lastInferenceTimeMs: 0,
            totalInferences: 0,
            averageInferenceTimeMs: 0
        };
    }

    /**
     * Check if WebGPU is available
     * @returns {Promise<boolean>} True if WebGPU is supported
     */
    async checkWebGPUSupport() {
        if (typeof navigator === 'undefined') return false;
        
        if (!navigator.gpu) {
            console.log('[ONNXSessionManager] WebGPU not available in this browser');
            return false;
        }

        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                console.log('[ONNXSessionManager] No WebGPU adapter found');
                return false;
            }
            
            const device = await adapter.requestDevice();
            if (!device) {
                console.log('[ONNXSessionManager] Could not get WebGPU device');
                return false;
            }
            
            console.log('[ONNXSessionManager] WebGPU is available');
            return true;
        } catch (error) {
            console.log('[ONNXSessionManager] WebGPU check failed:', error.message);
            return false;
        }
    }

    /**
     * Get the best available execution provider
     * @returns {Promise<string>} 'webgpu' or 'wasm'
     */
    async getBestExecutionProvider() {
        const hasWebGPU = await this.checkWebGPUSupport();
        return hasWebGPU ? 'webgpu' : 'wasm';
    }

    /**
     * Load an ONNX model from various sources
     * @param {string|ArrayBuffer|Uint8Array} modelSource - Model path, URL, or binary data
     * @param {Object} options - Loading options
     * @returns {Promise<void>}
     */
    async loadModel(modelSource, options = {}) {
        const {
            executionProvider = 'auto',
            enableProfiling = false,
            graphOptimizationLevel = 'all',
            logSeverityLevel = 2, // Warning level
            onProgress = null
        } = options;

        const startTime = performance.now();

        try {
            // Check if ONNX Runtime is available
            if (typeof ort === 'undefined') {
                throw new Error('ONNX Runtime Web (ort) is not loaded. Include onnxruntime-web in your page.');
            }

            // Determine execution provider
            if (executionProvider === 'auto') {
                this.executionProvider = await this.getBestExecutionProvider();
            } else {
                this.executionProvider = executionProvider;
            }

            console.log(`[ONNXSessionManager] Using execution provider: ${this.executionProvider}`);

            // Configure session options
            const sessionOptions = {
                executionProviders: [this.executionProvider],
                graphOptimizationLevel: graphOptimizationLevel,
                enableProfiling: enableProfiling,
                logSeverityLevel: logSeverityLevel
            };

            // Add WebGPU-specific options
            if (this.executionProvider === 'webgpu') {
                sessionOptions.preferredOutputLocation = 'gpu-buffer';
            }

            // Load model based on source type
            if (typeof modelSource === 'string') {
                // URL or path
                if (onProgress) {
                    // Fetch with progress tracking
                    const modelData = await this._fetchWithProgress(modelSource, onProgress);
                    this.session = await ort.InferenceSession.create(modelData, sessionOptions);
                } else {
                    this.session = await ort.InferenceSession.create(modelSource, sessionOptions);
                }
            } else if (modelSource instanceof ArrayBuffer || modelSource instanceof Uint8Array) {
                // Binary data
                this.session = await ort.InferenceSession.create(modelSource, sessionOptions);
            } else {
                throw new Error('Invalid model source type. Expected string (URL/path), ArrayBuffer, or Uint8Array.');
            }

            // Extract model metadata
            this.inputNames = this.session.inputNames;
            this.outputNames = this.session.outputNames;
            
            this.modelMetadata = {
                inputNames: this.inputNames,
                outputNames: this.outputNames,
                executionProvider: this.executionProvider
            };

            this.isLoaded = true;
            this.stats.loadTimeMs = performance.now() - startTime;

            console.log(`[ONNXSessionManager] Model loaded in ${this.stats.loadTimeMs.toFixed(2)}ms`);
            console.log(`[ONNXSessionManager] Inputs: ${this.inputNames.join(', ')}`);
            console.log(`[ONNXSessionManager] Outputs: ${this.outputNames.join(', ')}`);

        } catch (error) {
            console.error('[ONNXSessionManager] Failed to load model:', error);
            
            // Try fallback to WASM if WebGPU failed
            if (this.executionProvider === 'webgpu' && executionProvider === 'auto') {
                console.log('[ONNXSessionManager] Falling back to WebAssembly...');
                return this.loadModel(modelSource, {
                    ...options,
                    executionProvider: 'wasm'
                });
            }
            
            throw error;
        }
    }

    /**
     * Run inference on the model
     * @param {Object} inputs - Input tensors as {name: tensor} object
     * @returns {Promise<Object>} Output tensors
     */
    async runInference(inputs) {
        if (!this.isLoaded) {
            throw new Error('Model not loaded. Call loadModel() first.');
        }

        const startTime = performance.now();

        try {
            // Create ONNX tensors from inputs
            const feeds = {};
            for (const [name, data] of Object.entries(inputs)) {
                if (data instanceof ort.Tensor) {
                    feeds[name] = data;
                } else {
                    // Assume it's a tensor-like object with data and dims
                    feeds[name] = new ort.Tensor(
                        data.type || 'int64',
                        data.data,
                        data.dims
                    );
                }
            }

            // Run inference
            const results = await this.session.run(feeds);

            // Update stats
            const inferenceTime = performance.now() - startTime;
            this.stats.lastInferenceTimeMs = inferenceTime;
            this.stats.totalInferences++;
            this.stats.averageInferenceTimeMs = 
                (this.stats.averageInferenceTimeMs * (this.stats.totalInferences - 1) + inferenceTime) 
                / this.stats.totalInferences;

            return results;

        } catch (error) {
            console.error('[ONNXSessionManager] Inference failed:', error);
            throw error;
        }
    }

    /**
     * Create an input tensor
     * @param {string} type - Data type ('float32', 'int64', etc.)
     * @param {Array|TypedArray} data - Tensor data
     * @param {number[]} dims - Tensor dimensions
     * @returns {ort.Tensor} ONNX tensor
     */
    createTensor(type, data, dims) {
        if (typeof ort === 'undefined') {
            throw new Error('ONNX Runtime Web (ort) is not loaded.');
        }
        return new ort.Tensor(type, data, dims);
    }

    /**
     * Get model input/output information
     * @returns {Object} Model metadata
     */
    getModelInfo() {
        if (!this.isLoaded) {
            return null;
        }

        return {
            ...this.modelMetadata,
            stats: { ...this.stats }
        };
    }

    /**
     * Get performance statistics
     * @returns {Object} Performance stats
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Release model resources
     */
    async release() {
        if (this.session) {
            try {
                await this.session.release();
            } catch (error) {
                console.warn('[ONNXSessionManager] Error releasing session:', error);
            }
            this.session = null;
        }
        
        this.isLoaded = false;
        this.inputNames = [];
        this.outputNames = [];
        this.modelMetadata = null;
    }

    /**
     * Check if model is loaded and ready
     * @returns {boolean} True if ready for inference
     */
    isReady() {
        return this.isLoaded && this.session !== null;
    }

    /**
     * Fetch model with progress tracking
     * @private
     */
    async _fetchWithProgress(url, onProgress) {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
        }

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        
        const reader = response.body.getReader();
        const chunks = [];
        let loaded = 0;

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            chunks.push(value);
            loaded += value.length;
            
            if (onProgress && total > 0) {
                onProgress({
                    loaded,
                    total,
                    percent: (loaded / total) * 100
                });
            }
        }

        // Combine chunks into single ArrayBuffer
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result.buffer;
    }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ONNXSessionManager };
}
if (typeof window !== 'undefined') {
    window.ONNXSessionManager = ONNXSessionManager;
}
