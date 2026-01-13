/**
 * Local AI Model Integration for Offline Mode
 * Provides ONNX Runtime Web-based AI models that run directly in the browser
 * 
 * Implements Issue #119: ONNX Runtime Web model loading
 */

class LocalAIModel {
    constructor(options = {}) {
        this.options = {
            modelPath: '/offline-resources/models/',
            wasmPath: '/offline-resources/libs/',
            useWebGPU: true,
            useWebGL: true,
            useSIMD: true,
            numThreads: navigator.hardwareConcurrency || 4,
            ...options
        };
        
        this.models = new Map();
        this.sessions = new Map();
        this.currentModel = null;
        this.isLoading = false;
        this.events = {};
        this.initialized = false;
        
        // Available backends in priority order
        this.backends = {
            webgpu: false,
            webgl: false,
            wasm: false,
            cpu: true
        };
        
        // Model registry with metadata
        this.modelRegistry = {
            'tinyml-qa': {
                name: 'TinyML QA',
                file: 'tinyml-qa.onnx',
                size: '15MB',
                type: 'question-answering',
                description: 'Lightweight model for question answering',
                inputNames: ['input_ids', 'attention_mask'],
                outputNames: ['start_logits', 'end_logits']
            },
            'minillm-chat': {
                name: 'MiniLLM Chat',
                file: 'minillm-chat.onnx',
                size: '40MB',
                type: 'text-generation',
                description: 'Compact chat model for general conversations',
                inputNames: ['input_ids', 'attention_mask'],
                outputNames: ['logits']
            }
        };
    }

    /**
     * Initialize the ONNX Runtime environment
     */
    async initialize() {
        if (this.initialized) {
            console.log('LocalAI already initialized');
            return true;
        }

        console.log('Initializing LocalAI with ONNX Runtime Web...');
        
        try {
            // Configure ONNX Runtime if available
            if (typeof ort !== 'undefined') {
                ort.env.wasm.wasmPaths = this.options.wasmPath;
                ort.env.wasm.numThreads = this.options.numThreads;
                if (this.options.useSIMD) {
                    ort.env.wasm.simd = true;
                }
                console.log('ONNX Runtime configured');
            } else {
                console.warn('ONNX Runtime not loaded');
            }
            
            await this.detectBackends();
            this.initialized = true;
            console.log('LocalAI initialization complete');
            this.emit('backendsDetected', this.backends);
            return true;
        } catch (error) {
            console.error('Failed to initialize LocalAI:', error);
            return false;
        }
    }

    /**
     * Detect available compute backends
     */
    async detectBackends() {
        // Check WebGPU
        if (this.options.useWebGPU && 'gpu' in navigator) {
            try {
                const adapter = await navigator.gpu?.requestAdapter();
                if (adapter) this.backends.webgpu = true;
            } catch (e) {
                console.warn('WebGPU not available');
            }
        }

        // Check WebGL
        if (this.options.useWebGL) {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                if (gl) this.backends.webgl = true;
            } catch (e) {
                console.warn('WebGL not available');
            }
        }

        // Check WASM
        try {
            if (typeof WebAssembly === 'object') this.backends.wasm = true;
        } catch (e) {
            console.warn('WebAssembly not available');
        }

        return this.backends;
    }

    /**
     * Get the best available execution provider
     */
    getBestExecutionProvider() {
        if (this.backends.webgpu) return 'webgpu';
        if (this.backends.webgl) return 'webgl';
        if (this.backends.wasm) return 'wasm';
        return 'cpu';
    }

    /**
     * Load an ONNX model
     */
    async loadModel(modelId, options = {}) {
        if (this.isLoading) {
            throw new Error('Another model is currently loading');
        }

        if (this.sessions.has(modelId)) {
            console.log(`Model ${modelId} already loaded`);
            this.currentModel = modelId;
            return this.sessions.get(modelId);
        }

        const modelInfo = this.modelRegistry[modelId];
        if (!modelInfo) {
            throw new Error(`Unknown model: ${modelId}`);
        }

        this.isLoading = true;
        this.emit('loadStart', { modelId, modelInfo });

        try {
            const modelPath = `${this.options.modelPath}${modelInfo.file}`;
            console.log(`Loading model from: ${modelPath}`);

            // Check if model file exists
            const modelExists = await this.checkModelExists(modelPath);
            
            if (!modelExists) {
                this.isLoading = false;
                const error = new Error(`Model file not found: ${modelPath}. Please download the model first.`);
                this.emit('loadError', { modelId, error });
                throw error;
            }

            // Load with ONNX Runtime
            if (typeof ort !== 'undefined') {
                const executionProviders = [this.getBestExecutionProvider()];
                const session = await this.createSessionWithProgress(modelPath, {
                    executionProviders,
                    graphOptimizationLevel: 'all'
                }, modelId);

                this.sessions.set(modelId, session);
                this.models.set(modelId, {
                    ...modelInfo,
                    session,
                    loadedAt: new Date(),
                    executionProvider: executionProviders[0]
                });
            } else {
                this.isLoading = false;
                const error = new Error('ONNX Runtime is not available. Cannot load AI models.');
                this.emit('loadError', { modelId, error });
                throw error;
            }

            this.currentModel = modelId;
            this.isLoading = false;
            this.emit('loadSuccess', { modelId, modelInfo });
            return this.models.get(modelId);
        } catch (error) {
            this.isLoading = false;
            console.error(`Failed to load model ${modelId}:`, error);
            this.emit('loadError', { modelId, error });
            throw error;
        }
    }

    /**
     * Create ONNX session with progress tracking
     */
    async createSessionWithProgress(modelPath, options, modelId) {
        const response = await fetch(modelPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch model: ${response.status}`);
        }

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;

        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (total > 0) {
                const progress = Math.round((loaded / total) * 100);
                this.emit('loadProgress', { modelId, progress, loaded, total });
            }
        }

        const modelData = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
            modelData.set(chunk, offset);
            offset += chunk.length;
        }

        return await ort.InferenceSession.create(modelData.buffer, options);
    }

    /**
     * Check if model file exists
     */
    async checkModelExists(modelPath) {
        try {
            const response = await fetch(modelPath, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }



    /**
     * Run inference on a loaded model
     */
    async runInference(modelId, input, options = {}) {
        if (!this.models.has(modelId)) {
            await this.loadModel(modelId);
        }

        const model = this.models.get(modelId);
        this.emit('inferenceStart', { modelId, input });

        try {
            let result;
            
            if (model.isFallback) {
                result = await model.infer(input, options);
            } else if (this.sessions.has(modelId)) {
                // Real ONNX inference
                const session = this.sessions.get(modelId);
                const feeds = this.prepareTensors(input);
                const startTime = performance.now();
                const outputs = await session.run(feeds);
                const inferenceTime = performance.now() - startTime;
                result = { outputs, inferenceTime };
            } else {
                result = await model.infer(input, options);
            }

            this.emit('inferenceComplete', { modelId, input, result });
            return result;
        } catch (error) {
            console.error('Inference error:', error);
            this.emit('inferenceError', { modelId, error });
            throw error;
        }
    }

    /**
     * Prepare input tensors for ONNX
     */
    prepareTensors(input) {
        if (typeof input === 'string') {
            const tokens = this.simpleTokenize(input);
            return {
                input_ids: new ort.Tensor('int64', BigInt64Array.from(tokens.map(BigInt)), [1, tokens.length]),
                attention_mask: new ort.Tensor('int64', BigInt64Array.from(tokens.map(() => 1n)), [1, tokens.length])
            };
        }
        return input;
    }

    /**
     * Simple tokenizer
     */
    simpleTokenize(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 0)
            .map(t => {
                let hash = 0;
                for (let i = 0; i < t.length; i++) {
                    hash = ((hash << 5) - hash) + t.charCodeAt(i);
                    hash = hash & hash;
                }
                return Math.abs(hash) % 30000;
            });
    }

    /**
     * Unload a model
     */
    async unloadModel(modelId) {
        if (!this.models.has(modelId)) return false;

        try {
            if (this.sessions.has(modelId)) {
                const session = this.sessions.get(modelId);
                if (session.release) await session.release();
                this.sessions.delete(modelId);
            }
            this.models.delete(modelId);
            if (this.currentModel === modelId) this.currentModel = null;
            this.emit('unload', { modelId });
            return true;
        } catch (error) {
            console.error(`Failed to unload model ${modelId}:`, error);
            return false;
        }
    }

    /**
     * Get available models
     */
    async getAvailableModels() {
        const models = [];
        for (const [id, info] of Object.entries(this.modelRegistry)) {
            const modelPath = `${this.options.modelPath}${info.file}`;
            const isDownloaded = await this.checkModelExists(modelPath);
            models.push({
                id,
                ...info,
                isDownloaded,
                isLoaded: this.models.has(id)
            });
        }
        return models;
    }

    // Event emitter methods
    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
        return this;
    }

    off(event, callback) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        }
        return this;
    }

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(cb => {
                try { cb(data); } catch (e) { console.error(`Event handler error:`, e); }
            });
        }
        return this;
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.localAI = new LocalAIModel();
    
    window.localAI.on('backendsDetected', (backends) => {
        console.log('LocalAI backends:', backends);
    });
    
    window.localAI.on('loadStart', (data) => {
        console.log(`Loading model: ${data.modelId}`);
    });
    
    window.localAI.on('loadProgress', (data) => {
        console.log(`Loading ${data.modelId}: ${data.progress}%`);
    });
    
    window.localAI.on('loadSuccess', (data) => {
        console.log(`Model loaded: ${data.modelId}${data.fallback ? ' (fallback)' : ''}`);
    });
    
    window.localAI.on('loadError', (data) => {
        console.error(`Model load error:`, data.error);
    });
    
    window.localAI.initialize();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocalAIModel;
}
