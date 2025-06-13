/**
 * AI Model Manager for Offline Mode
 * Uses Transformers.js for real WebAssembly-based AI models in the browser
 */

class AIModelManager {
    constructor() {
        this.models = new Map();
        this.currentModel = null;
        this.isLoading = false;
        this.loadedModels = new Set();
        
        // Available models with their configurations
        this.availableModels = {
            'distilbert-base-uncased': {
                name: 'DistilBERT Base',
                size: '250MB',
                type: 'text-classification',
                description: 'Fast and efficient for text analysis',
                capabilities: ['sentiment', 'classification', 'qa']
            },
            'gpt2': {
                name: 'GPT-2 Small',
                size: '500MB',
                type: 'text-generation',
                description: 'Text generation and conversation',
                capabilities: ['generation', 'chat', 'completion']
            },
            't5-small': {
                name: 'T5 Small',
                size: '240MB',
                type: 'text2text-generation',
                description: 'Versatile text-to-text model',
                capabilities: ['summarization', 'translation', 'qa']
            },
            'sentence-transformers/all-MiniLM-L6-v2': {
                name: 'MiniLM Embeddings',
                size: '90MB',
                type: 'feature-extraction',
                description: 'Semantic search and similarity',
                capabilities: ['embeddings', 'similarity', 'search']
            }
        };
    }

    async initialize() {
        console.log('🤖 Initializing AI Model Manager');
        
        try {
            // Import Transformers.js dynamically
            if (typeof window !== 'undefined') {
                // Load from CDN in browser
                await this.loadTransformersJS();
            }
            
            // Try to load a cached model
            await this.loadCachedModel();
            
            console.log('✅ AI Model Manager initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize AI Model Manager:', error);
            return false;
        }
    }

    async loadTransformersJS() {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (window.transformers) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';
            script.type = 'module';
            
            script.onload = () => {
                console.log('📦 Transformers.js loaded from CDN');
                resolve();
            };
            
            script.onerror = (error) => {
                console.error('Failed to load Transformers.js:', error);
                reject(error);
            };
            
            document.head.appendChild(script);
        });
    }

    async loadCachedModel() {
        try {
            // Check if we have any stored models
            const storedModels = await this.getStoredModels();
            
            if (storedModels && storedModels.length > 0) {
                // Use the most recently downloaded model
                const latestModel = storedModels.sort((a, b) => 
                    new Date(b.downloadedAt) - new Date(a.downloadedAt)
                )[0];
                
                console.log(`Found cached model: ${latestModel.id}`);
                
                // Load the model
                await this.downloadModel(latestModel.id);
                return true;
            }
            
            // If no stored models, load a default lightweight model
            console.log('No cached models found, loading default model');
            const defaultModel = 'sentence-transformers/all-MiniLM-L6-v2';
            
            if (this.availableModels[defaultModel]) {
                await this.downloadModel(defaultModel);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error loading cached model:', error);
            return false;
        }
    }

    async downloadModel(modelId, progressCallback) {
        console.log(`📥 Downloading model: ${modelId}`);
        
        if (this.loadedModels.has(modelId)) {
            console.log(`✅ Model ${modelId} already loaded`);
            return this.models.get(modelId);
        }

        this.isLoading = true;
        
        try {
            const modelConfig = this.availableModels[modelId];
            if (!modelConfig) {
                throw new Error(`Unknown model: ${modelId}`);
            }

            // Simulate download progress for UI
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 10;
                if (progress > 90) progress = 90;
                progressCallback?.(Math.round(progress));
            }, 200);

            // Load the actual model using Transformers.js
            const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');
            
            let model;
            switch (modelConfig.type) {
                case 'text-generation':
                    model = await pipeline('text-generation', modelId);
                    break;
                case 'text-classification':
                    model = await pipeline('text-classification', modelId);
                    break;
                case 'text2text-generation':
                    model = await pipeline('text2text-generation', modelId);
                    break;
                case 'feature-extraction':
                    model = await pipeline('feature-extraction', modelId);
                    break;
                default:
                    model = await pipeline('text-generation', modelId);
            }

            clearInterval(progressInterval);
            progressCallback?.(100);

            // Store the model
            this.models.set(modelId, {
                pipeline: model,
                config: modelConfig,
                loadedAt: new Date()
            });
            
            this.loadedModels.add(modelId);
            this.currentModel = modelId;

            console.log(`✅ Model ${modelId} loaded successfully`);
            
            // Store in IndexedDB for persistence
            await this.storeModelMetadata(modelId, modelConfig);
            
            return model;
            
        } catch (error) {
            console.error(`❌ Failed to download model ${modelId}:`, error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    async generateResponse(prompt, options = {}) {
        if (!this.currentModel || !this.models.has(this.currentModel)) {
            throw new Error('No model loaded. Please download a model first.');
        }

        const modelData = this.models.get(this.currentModel);
        const { pipeline, config } = modelData;

        console.log(`🧠 Generating response with ${this.currentModel}`);

        try {
            let result;
            
            switch (config.type) {
                case 'text-generation':
                    result = await pipeline(prompt, {
                        max_length: options.maxLength || 100,
                        temperature: options.temperature || 0.7,
                        do_sample: true,
                        ...options
                    });
                    return result[0].generated_text;

                case 'text2text-generation':
                    result = await pipeline(prompt, {
                        max_length: options.maxLength || 100,
                        ...options
                    });
                    return result[0].generated_text;

                case 'text-classification':
                    result = await pipeline(prompt);
                    return this.formatClassificationResult(result, prompt);

                default:
                    // Fallback to text generation
                    result = await pipeline(prompt, {
                        max_length: options.maxLength || 100,
                        ...options
                    });
                    return result[0].generated_text;
            }
        } catch (error) {
            console.error('Error generating response:', error);
            throw error;
        }
    }

    formatClassificationResult(result, originalPrompt) {
        const topResult = result[0];
        return `Based on my analysis of "${originalPrompt}", I can classify this as ${topResult.label} with ${(topResult.score * 100).toFixed(1)}% confidence. ${this.getClassificationExplanation(topResult.label)}`;
    }

    getClassificationExplanation(label) {
        const explanations = {
            'POSITIVE': 'This appears to have a positive sentiment or tone.',
            'NEGATIVE': 'This appears to have a negative sentiment or tone.',
            'NEUTRAL': 'This appears to have a neutral sentiment or tone.',
            'LABEL_0': 'This falls into the first category based on the model\'s training.',
            'LABEL_1': 'This falls into the second category based on the model\'s training.'
        };
        return explanations[label] || 'This represents a specific classification based on the model\'s analysis.';
    }

    async streamResponse(prompt, onToken, options = {}) {
        if (!this.currentModel || !this.models.has(this.currentModel)) {
            throw new Error('No model loaded. Please download a model first.');
        }

        const modelData = this.models.get(this.currentModel);
        const { config } = modelData;

        // For models that support streaming
        if (config.type === 'text-generation' && typeof window !== 'undefined' && window.shouldStopGeneration !== undefined) {
            try {
                const fullResponse = await this.generateResponse(prompt, options);
                const words = fullResponse.split(' ');
                
                let currentText = '';
                for (let i = 0; i < words.length; i++) {
                    // Check if we should stop
                    if (window.shouldStopGeneration) {
                        window.shouldStopGeneration = false;
                        break;
                    }
                    
                    currentText += (i > 0 ? ' ' : '') + words[i];
                    onToken(currentText);
                    
                    // Simulate typing delay
                    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
                }
                
                return currentText;
            } catch (error) {
                console.error('Error streaming response:', error);
                throw error;
            }
        } else {
            // For models that don't support streaming
            const response = await this.generateResponse(prompt, options);
            onToken(response);
            return response;
        }
    }

    async getEmbeddings(text) {
        const embeddingModelId = 'sentence-transformers/all-MiniLM-L6-v2';
        
        if (!this.models.has(embeddingModelId)) {
            await this.downloadModel(embeddingModelId);
        }

        const modelData = this.models.get(embeddingModelId);
        const result = await modelData.pipeline(text);
        
        return result;
    }

    async storeModelMetadata(modelId, config) {
        try {
            const db = await this.openIndexedDB();
            const transaction = db.transaction(['models'], 'readwrite');
            const store = transaction.objectStore('models');
            
            await this.promisifyRequest(store.put({
                id: modelId,
                config: config,
                downloadedAt: new Date(),
                version: '1.0'
            }));
            
            console.log(`📦 Model metadata stored for ${modelId}`);
        } catch (error) {
            console.error('Failed to store model metadata:', error);
        }
    }

    async getStoredModels() {
        try {
            const db = await this.openIndexedDB();
            const transaction = db.transaction(['models'], 'readonly');
            const store = transaction.objectStore('models');
            const request = store.getAll();
            
            return await this.promisifyRequest(request);
        } catch (error) {
            console.error('Failed to get stored models:', error);
            return [];
        }
    }

    getAvailableModels() {
        return Object.entries(this.availableModels).map(([id, config]) => ({
            id,
            ...config,
            isLoaded: this.loadedModels.has(id),
            isCurrent: this.currentModel === id
        }));
    }

    switchModel(modelId) {
        if (this.models.has(modelId)) {
            this.currentModel = modelId;
            console.log(`🔄 Switched to model: ${modelId}`);
            return true;
        }
        return false;
    }

    unloadModel(modelId) {
        if (this.models.has(modelId)) {
            this.models.delete(modelId);
            this.loadedModels.delete(modelId);
            
            if (this.currentModel === modelId) {
                this.currentModel = null;
            }
            
            console.log(`🗑️ Unloaded model: ${modelId}`);
            return true;
        }
        return false;
    }

    getModelInfo(modelId) {
        const config = this.availableModels[modelId];
        const isLoaded = this.loadedModels.has(modelId);
        const isCurrent = this.currentModel === modelId;
        
        return {
            id: modelId,
            ...config,
            isLoaded,
            isCurrent,
            memoryUsage: isLoaded ? this.estimateMemoryUsage(modelId) : 0
        };
    }

    estimateMemoryUsage(modelId) {
        const sizes = {
            'distilbert-base-uncased': 250,
            'gpt2': 500,
            't5-small': 240,
            'sentence-transformers/all-MiniLM-L6-v2': 90
        };
        return sizes[modelId] || 100;
    }

    async openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AIQuestionsOffline', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('models')) {
                    db.createObjectStore('models', { keyPath: 'id' });
                }
            };
        });
    }

    promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }
}

// Export for browser and Node.js environments
if (typeof window !== 'undefined') {
    window.AIModelManager = AIModelManager;
} else if (typeof module !== 'undefined') {
    module.exports = AIModelManager;
}
