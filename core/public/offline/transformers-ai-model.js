/**
 * Transformers.js AI Model Integration for Offline Mode
 * Provides real ONNX models from Hugging Face that run directly in the browser
 * 
 * Uses the Transformers.js library for question answering and text generation
 */

class TransformersAIModel {
    constructor(options = {}) {
        this.options = {
            useWebGPU: true,
            quantization: 'q4', // q4, q8, fp16, fp32
            ...options
        };
        
        this.pipeline = null;
        this.currentTask = null;
        this.currentModel = null;
        this.isLoading = false;
        this.events = {};
        this.initialized = false;
        
        // Model registry with Transformers.js compatible models
        this.modelRegistry = {
            'distilbert-qa': {
                name: 'DistilBERT QA',
                task: 'question-answering',
                modelId: 'Xenova/distilbert-base-cased-distilled-squad',
                type: 'question-answering',
                description: 'Fast and lightweight question answering model',
                size: '250MB'
            },
            'qwen-chat': {
                name: 'Qwen 1.5 Chat',
                task: 'text-generation',
                modelId: 'Xenova/Qwen1.5-0.5B-Chat',
                type: 'text-generation',
                description: 'Lightweight chat model for conversational AI',
                size: '500MB'
            },
            'gpt2': {
                name: 'GPT-2',
                task: 'text-generation',
                modelId: 'Xenova/gpt2',
                type: 'text-generation',
                description: 'General purpose text generation',
                size: '500MB'
            }
        };
    }

    /**
     * Initialize Transformers.js
     */
    async initialize() {
        if (this.initialized) {
            console.log('TransformersAI already initialized');
            return true;
        }

        console.log('Initializing TransformersAI with Transformers.js...');
        
        try {
            // Wait for Transformers.js to be loaded
            if (typeof window.transformers === 'undefined') {
                console.log('Waiting for Transformers.js to load...');
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Transformers.js loading timeout'));
                    }, 30000);
                    
                    window.addEventListener('transformers-loaded', () => {
                        clearTimeout(timeout);
                        resolve();
                    }, { once: true });
                    
                    if (typeof window.transformers !== 'undefined') {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            }

            this.initialized = true;
            console.log('TransformersAI initialization complete');
            this.emit('initialized', {});
            return true;
        } catch (error) {
            console.error('Failed to initialize TransformersAI:', error);
            return false;
        }
    }

    /**
     * Load a model by ID
     */
    async loadModel(modelId, options = {}) {
        const { onProgress = null } = options;

        if (this.currentModel === modelId && this.pipeline) {
            console.log(`Model ${modelId} already loaded`);
            return this.pipeline;
        }

        const modelInfo = this.modelRegistry[modelId];
        if (!modelInfo) {
            throw new Error(`Unknown model: ${modelId}`);
        }

        this.isLoading = true;
        this.emit('loadStart', { modelId, modelInfo });

        try {
            console.log(`Loading model: ${modelInfo.name} (${modelInfo.modelId})`);

            // Import pipeline function from Transformers.js
            const { pipeline } = await import('@huggingface/transformers');

            // Load the pipeline with quantization
            this.pipeline = await pipeline(modelInfo.task, modelInfo.modelId, {
                dtype: this.options.quantization,
                device: this.options.useWebGPU ? 'webgpu' : 'wasm',
                progress_callback: (progress) => {
                    if (onProgress) {
                        onProgress({
                            percent: Math.round((progress.progress || 0) * 100),
                            loaded: progress.progress || 0,
                            total: 1,
                            status: progress.status
                        });
                    }
                    this.emit('loadProgress', { 
                        modelId, 
                        progress: Math.round((progress.progress || 0) * 100),
                        status: progress.status
                    });
                }
            });

            this.currentModel = modelId;
            this.currentTask = modelInfo.task;
            this.isLoading = false;
            this.emit('loadSuccess', { modelId, modelInfo });
            
            console.log(`Model ${modelId} loaded successfully`);
            return this.pipeline;
            
        } catch (error) {
            this.isLoading = false;
            console.error(`Failed to load model ${modelId}:`, error);
            this.emit('loadError', { modelId, error });
            throw error;
        }
    }

    /**
     * Generate a response using the loaded model
     */
    async generateResponse(input, options = {}) {
        if (!this.pipeline) {
            throw new Error('No model loaded. Call loadModel() first.');
        }

        try {
            let result;

            if (this.currentTask === 'question-answering') {
                // For QA, we need both question and context
                const { question, context } = options;
                if (!question || !context) {
                    throw new Error('Question answering requires both question and context options');
                }
                result = await this.pipeline({
                    question: question || input,
                    context: context
                });
            } else if (this.currentTask === 'text-generation') {
                // For text generation
                result = await this.pipeline(input, {
                    max_new_tokens: options.maxTokens || 100,
                    temperature: options.temperature || 0.7,
                    top_p: options.topP || 0.9
                });
            } else {
                throw new Error(`Unsupported task: ${this.currentTask}`);
            }

            return result;
        } catch (error) {
            console.error('Error generating response:', error);
            throw error;
        }
    }

    /**
     * Answer a question using the QA model
     */
    async answerQuestion(question, context) {
        if (this.currentTask !== 'question-answering') {
            throw new Error('Current model does not support question answering');
        }

        try {
            const result = await this.pipeline({
                question,
                context
            });
            return result;
        } catch (error) {
            console.error('Error answering question:', error);
            throw error;
        }
    }

    /**
     * Generate text using the text generation model
     */
    async generateText(prompt, options = {}) {
        if (this.currentTask !== 'text-generation') {
            throw new Error('Current model does not support text generation');
        }

        try {
            const result = await this.pipeline(prompt, {
                max_new_tokens: options.maxTokens || 100,
                temperature: options.temperature || 0.7,
                top_p: options.topP || 0.9
            });
            return result;
        } catch (error) {
            console.error('Error generating text:', error);
            throw error;
        }
    }

    /**
     * Get available models
     */
    getAvailableModels() {
        return Object.entries(this.modelRegistry).map(([id, info]) => ({
            id,
            ...info
        }));
    }

    /**
     * Get current model info
     */
    getCurrentModel() {
        if (!this.currentModel) return null;
        return {
            id: this.currentModel,
            ...this.modelRegistry[this.currentModel]
        };
    }

    /**
     * Unload the current model to free memory
     */
    unloadModel() {
        this.pipeline = null;
        this.currentModel = null;
        this.currentTask = null;
        this.emit('modelUnloaded', {});
    }

    /**
     * Event emitter methods
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    off(event, callback) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        }
    }

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
}

// Make the class available globally
if (typeof window !== 'undefined') {
    window.TransformersAIModel = TransformersAIModel;
}
