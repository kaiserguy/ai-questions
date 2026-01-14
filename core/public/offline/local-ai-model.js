/**
 * Local AI Model Integration for Offline Mode
 * Provides ONNX Runtime Web-based AI models that run directly in the browser
 * 
 * Implements Issue #119: ONNX Runtime Web model loading
 * Updated for Phase 3: Real Phi-3 inference integration
 */

class LocalAIModel {
    constructor(options = {}) {
        this.options = {
            modelPath: '/offline-resources/models/',
            tokenizerPath: '/offline-resources/tokenizers/',
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
        
        // Phi-3 inference engine
        this.phi3Inference = null;
        
        // Available backends in priority order
        this.backends = {
            webgpu: false,
            webgl: false,
            wasm: false,
            cpu: true
        };
        
        // Model registry with metadata - updated for Phi-3
        this.modelRegistry = {
            'phi3-mini': {
                name: 'Phi-3 Mini',
                file: 'phi3-mini-4k-instruct.onnx',
                tokenizerFile: 'tokenizer.json',
                size: '2.3GB',
                type: 'text-generation',
                description: 'Microsoft Phi-3 Mini 4K Instruct - Compact but powerful language model',
                inputNames: ['input_ids', 'attention_mask'],
                outputNames: ['logits'],
                contextLength: 4096,
                isPhi3: true
            },
            'phi3-mini-q4': {
                name: 'Phi-3 Mini (Quantized)',
                file: 'phi3-mini-4k-instruct-q4.onnx',
                tokenizerFile: 'tokenizer.json',
                size: '1.2GB',
                type: 'text-generation',
                description: 'Quantized Phi-3 Mini - Smaller size, faster inference',
                inputNames: ['input_ids', 'attention_mask'],
                outputNames: ['logits'],
                contextLength: 4096,
                isPhi3: true
            },
            'tinyml-qa': {
                name: 'TinyML QA',
                file: 'tinyml-qa.onnx',
                size: '15MB',
                type: 'question-answering',
                description: 'Lightweight model for question answering',
                inputNames: ['input_ids', 'attention_mask'],
                outputNames: ['start_logits', 'end_logits'],
                isPhi3: false
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
                this.backends.webgpu = !!adapter;
                console.log(`WebGPU: ${this.backends.webgpu ? 'Available' : 'Not available'}`);
            } catch {
                this.backends.webgpu = false;
            }
        }

        // Check WebGL
        if (this.options.useWebGL) {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
                this.backends.webgl = !!gl;
                console.log(`WebGL: ${this.backends.webgl ? 'Available' : 'Not available'}`);
            } catch {
                this.backends.webgl = false;
            }
        }

        // WASM is always available in modern browsers
        this.backends.wasm = typeof WebAssembly !== 'undefined';
        console.log(`WASM: ${this.backends.wasm ? 'Available' : 'Not available'}`);
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
     * Load a model by ID
     */
    async loadModel(modelId, options = {}) {
        const { onProgress = null } = options;

        if (this.models.has(modelId)) {
            console.log(`Model ${modelId} already loaded`);
            return this.models.get(modelId);
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
                throw new Error(`Model file not found: ${modelPath}. Please download the model first.`);
            }

            // Use Phi3Inference for Phi-3 models
            if (modelInfo.isPhi3) {
                await this.loadPhi3Model(modelId, modelInfo, onProgress);
            } else {
                // Load with standard ONNX Runtime
                await this.loadStandardModel(modelId, modelInfo, onProgress);
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
     * Load Phi-3 model with specialized inference engine
     */
    async loadPhi3Model(modelId, modelInfo, onProgress) {
        // Check if Phi3Inference is available
        if (typeof Phi3Inference === 'undefined') {
            throw new Error('Phi3Inference not loaded. Include phi3-inference.js first.');
        }

        // Initialize Phi-3 inference engine
        this.phi3Inference = new Phi3Inference();
        
        const modelPath = `${this.options.modelPath}${modelInfo.file}`;
        const tokenizerPath = `${this.options.tokenizerPath}${modelInfo.tokenizerFile}`;

        await this.phi3Inference.initialize({
            modelPath,
            tokenizerPath,
            executionProvider: this.getBestExecutionProvider(),
            onProgress: onProgress ? (progress) => {
                this.emit('loadProgress', { 
                    modelId, 
                    progress: progress.percent,
                    loaded: progress.loaded,
                    total: progress.total
                });
                onProgress(progress);
            } : null
        });

        this.models.set(modelId, {
            ...modelInfo,
            isPhi3: true,
            inference: this.phi3Inference,
            loadedAt: new Date(),
            executionProvider: this.getBestExecutionProvider()
        });

        console.log(`Phi-3 model ${modelId} loaded successfully`);
    }

    /**
     * Load standard ONNX model
     */
    async loadStandardModel(modelId, modelInfo, onProgress) {
        if (typeof ort === 'undefined') {
            throw new Error('ONNX Runtime not loaded');
        }

        const modelPath = `${this.options.modelPath}${modelInfo.file}`;
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
     * Generate a chat response using the loaded model
     * @param {Array} messages - Array of {role, content} messages
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Generated response
     */
    async generateResponse(messages, options = {}) {
        const modelId = this.currentModel;
        
        if (!modelId) {
            throw new Error('No model loaded. Call loadModel() first.');
        }

        const model = this.models.get(modelId);
        
        if (!model) {
            throw new Error(`Model ${modelId} not found`);
        }

        this.emit('inferenceStart', { modelId, messages });

        try {
            let response;

            if (model.isPhi3 && this.phi3Inference) {
                // Use Phi-3 inference engine
                response = await this.phi3Inference.chat(messages, {
                    maxNewTokens: options.maxTokens || 512,
                    temperature: options.temperature || 0.7,
                    topK: options.topK || 50,
                    topP: options.topP || 0.9,
                    onToken: options.onToken
                });
            } else {
                // Standard inference (for non-Phi3 models)
                const prompt = this.formatPrompt(messages);
                response = await this.runInference(modelId, prompt, options);
            }

            this.emit('inferenceComplete', { modelId, messages, response });
            return response;

        } catch (error) {
            console.error('Generation error:', error);
            this.emit('inferenceError', { modelId, error });
            throw error;
        }
    }

    /**
     * Stream chat response with token callbacks
     * @param {Array} messages - Chat messages
     * @param {Function} onToken - Callback for each generated token
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Complete response
     */
    async streamResponse(messages, onToken, options = {}) {
        return this.generateResponse(messages, {
            ...options,
            onToken
        });
    }

    /**
     * Stop ongoing generation
     */
    stopGeneration() {
        if (this.phi3Inference) {
            this.phi3Inference.stop();
        }
    }

    /**
     * Format messages into a prompt string (for non-Phi3 models)
     */
    formatPrompt(messages) {
        return messages.map(m => {
            if (m.role === 'system') return `System: ${m.content}`;
            if (m.role === 'user') return `User: ${m.content}`;
            if (m.role === 'assistant') return `Assistant: ${m.content}`;
            return m.content;
        }).join('\n') + '\nAssistant:';
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
            
            if (model.isPhi3 && this.phi3Inference) {
                // Use Phi-3 inference
                result = await this.phi3Inference.generate(input, options);
            } else if (this.sessions.has(modelId)) {
                // Real ONNX inference
                const session = this.sessions.get(modelId);
                const feeds = this.prepareTensors(input);
                const startTime = performance.now();
                const outputs = await session.run(feeds);
                const inferenceTime = performance.now() - startTime;
                result = { outputs, inferenceTime };
            } else {
                throw new Error(`No inference session available for model ${modelId}`);
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
     * Simple tokenizer (fallback for non-Phi3 models)
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
            const model = this.models.get(modelId);
            
            // Release Phi-3 inference engine if applicable
            if (model.isPhi3 && this.phi3Inference) {
                await this.phi3Inference.release();
                this.phi3Inference = null;
            }
            
            // Release standard ONNX session
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

    /**
     * Get inference statistics
     */
    getStats() {
        if (this.phi3Inference) {
            return this.phi3Inference.getStats();
        }
        return null;
    }

    /**
     * Check if model is ready for inference
     */
    isReady() {
        if (this.phi3Inference) {
            return this.phi3Inference.isReady();
        }
        return this.currentModel !== null && this.models.has(this.currentModel);
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
        console.log('Available backends:', backends);
    });
    
    window.localAI.on('loadProgress', (data) => {
        console.log(`Loading ${data.modelId}: ${data.progress}%`);
    });
    
    window.localAI.on('loadSuccess', (data) => {
        console.log(`Model ${data.modelId} loaded successfully`);
    });
    
    window.localAI.on('loadError', (data) => {
        console.error(`Failed to load model ${data.modelId}:`, data.error);
    });
});

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LocalAIModel };
}
if (typeof window !== 'undefined') {
    window.LocalAIModel = LocalAIModel;
}
