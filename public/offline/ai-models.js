// AI Model Manager for Offline Mode
// Uses Transformers.js for real WebAssembly-based AI models

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
        // For streaming responses (simulated for now)
        const fullResponse = await this.generateResponse(prompt, options);
        const words = fullResponse.split(' ');
        
        let currentText = '';
        for (let i = 0; i < words.length; i++) {
            currentText += (i > 0 ? ' ' : '') + words[i];
            onToken(currentText);
            
            // Simulate typing delay
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        }
        
        return fullResponse;
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

// Enhanced Offline App with Real AI Integration
class EnhancedOfflineApp extends OfflineAppEnhanced {
    constructor() {
        super();
        
        // Initialize properties with defensive checks
        this.aiManager = typeof AIModelManager !== 'undefined' ? new AIModelManager() : null;
        this.wikipediaManager = typeof WikipediaManager !== 'undefined' ? new WikipediaManager() : null;
        this.isGenerating = false;
        this.currentGeneration = null;
        
        // Don't call init directly in constructor to avoid async issues
        // Let the parent class handle initialization through its scheduled init
    }

    async init() {
        console.log('🚀 Initializing Enhanced AI Questions Offline Mode');
        
        try {
            // Initialize AI Manager with defensive checks
            if (this.aiManager && typeof this.aiManager.initialize === 'function') {
                try {
                    const aiInitialized = await this.aiManager.initialize();
                    if (!aiInitialized) {
                        console.error('Failed to initialize AI Manager');
                    }
                } catch (aiError) {
                    console.error('Error initializing AI Manager:', aiError);
                }
            } else {
                console.warn('AI Manager not available or missing initialize method');
            }
            
            // Initialize Wikipedia Manager with defensive checks
            if (this.wikipediaManager && typeof this.wikipediaManager.initialize === 'function') {
                try {
                    const wikiInitialized = await this.wikipediaManager.initialize();
                    if (!wikiInitialized) {
                        console.error('Failed to initialize Wikipedia Manager');
                    }
                } catch (wikiError) {
                    console.error('Error initializing Wikipedia Manager:', wikiError);
                }
            } else {
                console.warn('Wikipedia Manager not available or missing initialize method');
            }
            
            // Call parent initialization with defensive check
            if (typeof super.init === 'function') {
                try {
                    await super.init();
                } catch (parentError) {
                    console.error('Error in parent initialization:', parentError);
                }
            } else {
                console.error('Parent init method not available');
            }
            
            // Add enhanced event listeners
            this.setupEnhancedEventListeners();
            
            console.log('✅ EnhancedOfflineApp initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize EnhancedOfflineApp:', error);
            return false;
        }
    }

    setupEnhancedEventListeners() {
        try {
            // Model selection in download options
            const downloadOptions = document.querySelectorAll('.download-option');
            if (downloadOptions && downloadOptions.length > 0) {
                downloadOptions.forEach(option => {
                    if (option) {
                        const originalClickHandler = option.onclick;
                        option.addEventListener('click', () => {
                            this.updateModelSelection();
                        });
                    }
                });
            }

            // Stop generation button
            const stopBtn = document.createElement('button');
            stopBtn.id = 'stopBtn';
            stopBtn.className = 'send-btn';
            stopBtn.textContent = 'Stop';
            stopBtn.style.display = 'none';
            stopBtn.style.background = '#ef4444';
            
            stopBtn.addEventListener('click', () => {
                this.stopGeneration();
            });
            
            const chatInputContainer = document.querySelector('.chat-input-container');
            if (chatInputContainer) {
                chatInputContainer.appendChild(stopBtn);
            }
        } catch (error) {
            console.error('Error setting up enhanced event listeners:', error);
        }
    }

    async updateModelSelection() {
        try {
            const selectedOption = document.querySelector('.download-option.selected');
            if (!selectedOption) return;
            
            const selectedPackage = selectedOption.dataset.package;
            const modelMap = {
                'minimal': ['tinyml-qa'],
                'standard': ['tinyml-qa', 'minillm-chat'],
                'full': ['tinyml-qa', 'minillm-chat', 'gpt2-small']
            };
            
            // Get models for selected package with defensive check
            const models = modelMap[selectedPackage] || ['tinyml-qa'];
            
            // Update model selection UI
            const modelSelection = document.getElementById('modelSelection');
            if (!modelSelection) return;
            
            modelSelection.innerHTML = '';
            
            // Add model options
            models.forEach(modelId => {
                const modelOption = document.createElement('div');
                modelOption.className = 'model-option';
                modelOption.dataset.model = modelId;
                
                // Get model name based on ID
                let modelName = modelId;
                switch (modelId) {
                    case 'tinyml-qa':
                        modelName = 'TinyML QA (15MB)';
                        break;
                    case 'minillm-chat':
                        modelName = 'MiniLLM Chat (40MB)';
                        break;
                    case 'gpt2-small':
                        modelName = 'GPT-2 Small (120MB)';
                        break;
                }
                
                modelOption.innerHTML = `
                    <input type="checkbox" id="${modelId}" name="models" value="${modelId}" checked>
                    <label for="${modelId}">${modelName}</label>
                `;
                
                modelSelection.appendChild(modelOption);
            });
        } catch (error) {
            console.error('Error updating model selection:', error);
        }
    }

    async getAIResponse(message) {
        if (!this.localAI) {
            // Load AI model if not already loaded
            await this.initializeLocalAI();
        }

        try {
            // Check if we have a valid localAI instance with runInference method
            if (this.localAI && typeof this.localAI.runInference === 'function') {
                // Get selected model or use default
                const modelSelect = document.getElementById('modelSelect');
                const selectedModel = modelSelect && modelSelect.value ? modelSelect.value : 'tinyml-qa';
                
                // Search Wikipedia for context if available
                let wikipediaContext = '';
                if (this.wikipediaManager && typeof this.wikipediaManager.search === 'function') {
                    try {
                        const searchResults = await this.wikipediaManager.search(message);
                        if (searchResults && searchResults.length > 0) {
                            wikipediaContext = searchResults[0].content;
                        }
                    } catch (wikiError) {
                        console.error('Wikipedia search error:', wikiError);
                    }
                }
                
                // Prepare prompt with context if available
                const prompt = wikipediaContext 
                    ? `Context: ${wikipediaContext}\n\nQuestion: ${message}\n\nAnswer:`
                    : message;
                
                // Run inference
                return await this.localAI.runInference(selectedModel, prompt);
            } else {
                // Fallback response if localAI is not properly initialized
                return `I'm sorry, the AI model is not properly initialized. Please try refreshing the page.`;
            }
        } catch (error) {
            console.error('Error getting AI response:', error);
            return `I'm sorry, I encountered an error while processing your request: ${error.message}`;
        }
    }

    stopGeneration() {
        if (this.isGenerating && this.currentGeneration) {
            // Cancel current generation if possible
            if (this.localAI && typeof this.localAI.cancelInference === 'function') {
                this.localAI.cancelInference();
            }
            
            this.isGenerating = false;
            this.currentGeneration = null;
            
            // Hide stop button
            const stopBtn = document.getElementById('stopBtn');
            if (stopBtn) {
                stopBtn.style.display = 'none';
            }
            
            // Show send button
            const sendBtn = document.querySelector('.send-btn:not(#stopBtn)');
            if (sendBtn) {
                sendBtn.style.display = 'block';
            }
        }
    }
}

// Initialize when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('✅ EnhancedOfflineApp initialized successfully');
        window.offlineApp = new EnhancedOfflineApp();
    } catch (error) {
        console.error('❌ Failed to initialize EnhancedOfflineApp:', error);
    }
});

// Create a compatibility wrapper for backward compatibility
window.OfflineApp = OfflineAppEnhanced;
