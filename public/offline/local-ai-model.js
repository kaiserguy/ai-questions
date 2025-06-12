/**
 * Local AI Model Integration for Offline HTML5 Version
 * Provides browser-based inference using ONNX Runtime Web
 */

class LocalAIModel {
    constructor() {
        this.session = null;
        this.tokenizer = null;
        this.modelName = null;
        this.modelConfig = null;
        this.isLoaded = false;
        this.isLoading = false;
        this.loadingProgress = 0;
        this.supportedModels = {
            'tinyml-qa': {
                name: 'TinyML QA Model',
                description: 'Lightweight question-answering model (15MB)',
                files: {
                    model: '/offline/models/tinyml-qa.onnx',
                    vocab: '/offline/models/tinyml-qa-vocab.json',
                    config: '/offline/models/tinyml-qa-config.json'
                },
                maxLength: 512,
                type: 'qa'
            },
            'minillm-chat': {
                name: 'MiniLLM Chat',
                description: 'Compact chat model optimized for browsers (40MB)',
                files: {
                    model: '/offline/models/minillm-chat.onnx',
                    vocab: '/offline/models/minillm-chat-vocab.json',
                    config: '/offline/models/minillm-chat-config.json'
                },
                maxLength: 1024,
                type: 'chat'
            }
        };
        this.eventListeners = {};
    }

    /**
     * Initialize the ONNX Runtime and check for hardware acceleration
     */
    async initialize() {
        try {
            // Check if ONNX Runtime is available
            if (typeof ort === 'undefined') {
                await this.loadONNXRuntime();
            }

            // Check for WebGL/WebGPU support
            const backends = await this.checkAvailableBackends();
            
            // Emit initialization event
            this.emit('initialized', { backends });
            
            return backends;
        } catch (error) {
            console.error('Failed to initialize LocalAIModel:', error);
            this.emit('error', { message: 'Failed to initialize AI model system', error });
            throw error;
        }
    }

    /**
     * Load ONNX Runtime Web dynamically
     */
    async loadONNXRuntime() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/offline/libs/onnxruntime-web.min.js';
            script.onload = () => {
                console.log('ONNX Runtime loaded successfully');
                resolve();
            };
            script.onerror = () => {
                const error = new Error('Failed to load ONNX Runtime');
                console.error(error);
                reject(error);
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Check available hardware acceleration backends
     */
    async checkAvailableBackends() {
        const backends = {
            webgl: false,
            webgpu: false,
            wasm: true, // WASM is always available as fallback
            cpu: true
        };

        // Check WebGL support
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2');
            backends.webgl = !!gl;
        } catch (e) {
            console.warn('WebGL check failed:', e);
        }

        // Check WebGPU support
        try {
            backends.webgpu = 'gpu' in navigator;
        } catch (e) {
            console.warn('WebGPU check failed:', e);
        }

        return backends;
    }

    /**
     * Get list of available models
     */
    getAvailableModels() {
        return Object.entries(this.supportedModels).map(([id, config]) => ({
            id,
            name: config.name,
            description: config.description,
            type: config.type
        }));
    }

    /**
     * Load a specific model
     */
    async loadModel(modelId, progressCallback = null) {
        if (this.isLoading) {
            throw new Error('Another model is currently loading');
        }

        if (this.isLoaded && this.modelName === modelId) {
            return { success: true, model: this.modelName, alreadyLoaded: true };
        }

        const modelConfig = this.supportedModels[modelId];
        if (!modelConfig) {
            throw new Error(`Model ${modelId} is not supported`);
        }

        try {
            this.isLoading = true;
            this.loadingProgress = 0;
            this.emit('loading', { model: modelId, progress: 0 });

            // Step 1: Load model configuration
            const configResponse = await fetch(modelConfig.files.config);
            if (!configResponse.ok) {
                throw new Error(`Failed to load model config: ${configResponse.statusText}`);
            }
            this.modelConfig = await configResponse.json();
            this.loadingProgress = 0.1;
            if (progressCallback) progressCallback(0.1);
            this.emit('loading', { model: modelId, progress: 0.1 });

            // Step 2: Load tokenizer vocabulary
            const vocabResponse = await fetch(modelConfig.files.vocab);
            if (!vocabResponse.ok) {
                throw new Error(`Failed to load model vocabulary: ${vocabResponse.statusText}`);
            }
            const vocabData = await vocabResponse.json();
            this.tokenizer = new SimpleTokenizer(vocabData);
            this.loadingProgress = 0.2;
            if (progressCallback) progressCallback(0.2);
            this.emit('loading', { model: modelId, progress: 0.2 });

            // Step 3: Determine best execution provider
            const backends = await this.checkAvailableBackends();
            let executionProvider = 'wasm';
            if (backends.webgpu) {
                executionProvider = 'webgpu';
            } else if (backends.webgl) {
                executionProvider = 'webgl';
            }

            // Step 4: Set up ONNX Runtime session options
            const sessionOptions = {
                executionProviders: [executionProvider],
                graphOptimizationLevel: 'all',
                enableCpuMemArena: true,
                enableMemPattern: true,
                executionMode: 'sequential'
            };

            // Step 5: Load the model
            this.loadingProgress = 0.3;
            if (progressCallback) progressCallback(0.3);
            this.emit('loading', { model: modelId, progress: 0.3 });

            // Create array buffer from model file
            const modelResponse = await fetch(modelConfig.files.model);
            if (!modelResponse.ok) {
                throw new Error(`Failed to load model file: ${modelResponse.statusText}`);
            }
            
            // Track download progress
            const reader = modelResponse.body.getReader();
            const contentLength = +modelResponse.headers.get('Content-Length');
            let receivedLength = 0;
            let chunks = [];
            
            while(true) {
                const {done, value} = await reader.read();
                if (done) break;
                
                chunks.push(value);
                receivedLength += value.length;
                
                // Calculate progress (30% to 90%)
                const downloadProgress = receivedLength / contentLength;
                const overallProgress = 0.3 + (downloadProgress * 0.6);
                this.loadingProgress = overallProgress;
                if (progressCallback) progressCallback(overallProgress);
                this.emit('loading', { model: modelId, progress: overallProgress });
            }
            
            // Concatenate chunks into array buffer
            let modelArrayBuffer = new Uint8Array(receivedLength);
            let position = 0;
            for(let chunk of chunks) {
                modelArrayBuffer.set(chunk, position);
                position += chunk.length;
            }

            // Step 6: Create ONNX session
            this.loadingProgress = 0.9;
            if (progressCallback) progressCallback(0.9);
            this.emit('loading', { model: modelId, progress: 0.9 });
            
            this.session = await ort.InferenceSession.create(
                modelArrayBuffer, 
                sessionOptions
            );

            // Step 7: Finalize loading
            this.modelName = modelId;
            this.isLoaded = true;
            this.isLoading = false;
            this.loadingProgress = 1.0;
            if (progressCallback) progressCallback(1.0);
            
            this.emit('loaded', { 
                model: modelId, 
                executionProvider,
                modelConfig: this.modelConfig
            });
            
            return { 
                success: true, 
                model: modelId,
                executionProvider
            };
            
        } catch (error) {
            this.isLoading = false;
            console.error('Failed to load model:', error);
            this.emit('error', { message: `Failed to load model ${modelId}`, error });
            throw error;
        }
    }

    /**
     * Generate a response to user input
     */
    async generateResponse(input, context = '', options = {}) {
        if (!this.isLoaded || !this.session) {
            throw new Error('Model not loaded. Please load a model first.');
        }

        try {
            this.emit('inferenceStart', { input });
            
            // Prepare input with context if available
            let fullInput = input;
            if (context && context.trim().length > 0) {
                fullInput = `${context}\n\nQuestion: ${input}`;
            }
            
            // Tokenize input
            const encodedInput = this.tokenizer.encode(fullInput);
            const inputIds = new Int32Array(encodedInput);
            const inputShape = [1, inputIds.length];
            
            // Create ONNX tensor
            const feeds = {
                'input_ids': new ort.Tensor('int32', inputIds, inputShape)
            };
            
            // Add attention mask if model requires it
            if (this.modelConfig.requires_attention_mask) {
                const attentionMask = new Int32Array(inputIds.length).fill(1);
                feeds['attention_mask'] = new ort.Tensor('int32', attentionMask, inputShape);
            }
            
            // Run inference
            const startTime = performance.now();
            const results = await this.session.run(feeds);
            const endTime = performance.now();
            
            // Process results
            let outputText = '';
            if (results.output_text) {
                // Text output format
                outputText = this.tokenizer.decode(results.output_text.data);
            } else if (results.logits) {
                // Logits format (needs decoding)
                outputText = this.decodeLogits(results.logits);
            }
            
            // Clean up the response
            outputText = this.postProcessResponse(outputText, input);
            
            const inferenceTime = endTime - startTime;
            
            this.emit('inferenceComplete', { 
                input, 
                output: outputText,
                inferenceTime
            });
            
            return {
                response: outputText,
                inferenceTime,
                model: this.modelName
            };
            
        } catch (error) {
            console.error('Inference failed:', error);
            this.emit('error', { message: 'Failed to generate response', error });
            throw error;
        }
    }

    /**
     * Decode logits to text (simplified implementation)
     */
    decodeLogits(logits) {
        // This is a simplified implementation
        // In a real system, this would implement proper token selection
        const outputIds = [];
        const logitsData = logits.data;
        const seqLength = logits.dims[1];
        const vocabSize = logits.dims[2];
        
        for (let i = 0; i < seqLength; i++) {
            let maxIdx = 0;
            let maxVal = logitsData[i * vocabSize];
            
            for (let j = 1; j < vocabSize; j++) {
                const val = logitsData[i * vocabSize + j];
                if (val > maxVal) {
                    maxVal = val;
                    maxIdx = j;
                }
            }
            
            outputIds.push(maxIdx);
        }
        
        return this.tokenizer.decode(outputIds);
    }

    /**
     * Clean up model response
     */
    postProcessResponse(text, originalInput) {
        // Remove any repetition of the input
        if (text.includes(originalInput)) {
            text = text.substring(text.indexOf(originalInput) + originalInput.length);
        }
        
        // Remove common prefixes
        const prefixesToRemove = ['Answer:', 'Response:', 'AI:', 'Assistant:'];
        for (const prefix of prefixesToRemove) {
            if (text.trim().startsWith(prefix)) {
                text = text.trim().substring(prefix.length).trim();
            }
        }
        
        return text.trim();
    }

    /**
     * Unload the current model to free memory
     */
    async unloadModel() {
        if (this.session) {
            try {
                // ONNX Runtime doesn't have a direct unload method
                // Set to null to allow garbage collection
                this.session = null;
                this.isLoaded = false;
                this.modelName = null;
                
                // Force garbage collection if available
                if (window.gc) {
                    window.gc();
                }
                
                this.emit('unloaded', {});
                return true;
            } catch (error) {
                console.error('Failed to unload model:', error);
                return false;
            }
        }
        return true;
    }

    /**
     * Event handling
     */
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    off(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event] = this.eventListeners[event]
                .filter(cb => cb !== callback);
        }
    }

    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} event handler:`, error);
                }
            });
        }
    }
}

/**
 * Simple tokenizer implementation
 */
class SimpleTokenizer {
    constructor(vocabData) {
        this.vocab = vocabData.vocab || {};
        this.ids_to_tokens = vocabData.ids_to_tokens || {};
        this.unk_token_id = vocabData.unk_token_id || 100;
    }

    encode(text) {
        // This is a simplified tokenization implementation
        // In a real system, this would implement proper subword tokenization
        const tokens = text.split(/\s+/);
        return tokens.map(token => this.vocab[token] || this.unk_token_id);
    }

    decode(ids) {
        // Simple decoding
        return ids.map(id => this.ids_to_tokens[id] || '').join(' ');
    }
}

// Export for use in offline app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocalAIModel;
} else {
    window.LocalAIModel = LocalAIModel;
}
