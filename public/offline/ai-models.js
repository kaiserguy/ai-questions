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
        this.aiManager = new AIModelManager();
        this.wikipediaManager = new WikipediaManager();
        this.isGenerating = false;
        this.currentGeneration = null;
    }

    async init() {
        console.log('🚀 Initializing Enhanced AI Questions Offline Mode');
        
        // Initialize AI Manager
        const aiInitialized = await this.aiManager.initialize();
        if (!aiInitialized) {
            console.error('Failed to initialize AI Manager');
        }
        
        // Initialize Wikipedia Manager
        const wikiInitialized = await this.wikipediaManager.initialize();
        if (!wikiInitialized) {
            console.error('Failed to initialize Wikipedia Manager');
        }
        
        // Call parent initialization
        await super.init();
        
        // Add enhanced event listeners
        this.setupEnhancedEventListeners();
    }

    setupEnhancedEventListeners() {
        // Model selection in download options
        document.querySelectorAll('.download-option').forEach(option => {
            const originalClickHandler = option.onclick;
            option.addEventListener('click', () => {
                this.updateModelSelection();
            });
        });

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
    }

    updateModelSelection() {
        const selectedOption = document.querySelector('.download-option.selected');
        if (!selectedOption) return;
        
        const selectedPackage = selectedOption.dataset.package;
        const modelMap = {
            'minimal': 'distilbert-base-uncased',
            'standard': 'gpt2',
            'full': 't5-small'
        };
        
        this.selectedAIModel = modelMap[selectedPackage];
        console.log(`Selected AI model: ${this.selectedAIModel}`);
    }

    async downloadPackage() {
        // Call parent download method first
        await super.downloadPackage();
        
        // Download the actual AI model
        if (this.selectedAIModel) {
            this.updateProgress(85, 'Loading AI model...', `Initializing ${this.selectedAIModel}`);
            
            try {
                await this.aiManager.downloadModel(this.selectedAIModel, (progress) => {
                    this.updateProgress(85 + (progress * 10) / 100, 'Loading AI model...', `${progress}% loaded`);
                });
                
                console.log('✅ AI model loaded successfully');
            } catch (error) {
                console.error('❌ Failed to load AI model:', error);
                throw new Error(`Failed to load AI model: ${error.message}`);
            }
        }
    }

    async getAIResponse(message, context = '') {
        // Use the AI Manager to generate a response
        if (!this.aiManager || !this.aiManager.currentModel) {
            return super.getAIResponse(message, context);
        }
        
        this.isGenerating = true;
        this.showStopButton(true);
        
        try {
            // Get context from Wikipedia if available
            if (!context && this.wikipediaManager) {
                const results = await this.wikipediaManager.search(message, 3);
                if (results && results.length > 0) {
                    context = results.map(result => 
                        `From Wikipedia: ${result.title}\n${result.snippet || result.content?.substring(0, 200)}`
                    ).join('\n\n');
                }
            }
            
            // Prepare prompt with context
            let prompt = message;
            if (context) {
                prompt = `Context information:\n${context}\n\nQuestion: ${message}\n\nAnswer:`;
            }
            
            // Generate response
            const response = await this.aiManager.generateResponse(prompt, {
                maxLength: 150,
                temperature: 0.7
            });
            
            return this.formatAIResponse(response, message);
            
        } catch (error) {
            console.error('AI response generation failed:', error);
            return `I'm sorry, I encountered an error while generating a response: ${error.message}`;
        } finally {
            this.isGenerating = false;
            this.showStopButton(false);
        }
    }

    formatAIResponse(response, originalQuestion) {
        // Clean up the response
        let cleanResponse = response;
        
        // Remove the original question if it's repeated
        if (cleanResponse.includes(originalQuestion)) {
            cleanResponse = cleanResponse.substring(cleanResponse.indexOf(originalQuestion) + originalQuestion.length);
        }
        
        // Remove common prefixes
        const prefixes = ['Answer:', 'Response:', 'AI:', 'Assistant:'];
        for (const prefix of prefixes) {
            if (cleanResponse.trim().startsWith(prefix)) {
                cleanResponse = cleanResponse.trim().substring(prefix.length).trim();
            }
        }
        
        return cleanResponse.trim();
    }

    showStopButton(show) {
        const stopBtn = document.getElementById('stopBtn');
        const sendBtn = document.getElementById('sendBtn');
        
        if (stopBtn) {
            stopBtn.style.display = show ? 'block' : 'none';
        }
        
        if (sendBtn) {
            sendBtn.style.display = show ? 'none' : 'block';
        }
    }

    stopGeneration() {
        if (this.isGenerating) {
            console.log('Stopping AI generation');
            // In a real implementation, this would cancel the generation
            this.isGenerating = false;
            this.showStopButton(false);
        }
    }

    updateProgress(percent, text, details) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const progressDetails = document.getElementById('progressDetails');
        
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
        
        if (progressText) {
            progressText.textContent = text;
        }
        
        if (progressDetails) {
            progressDetails.textContent = details;
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Create a compatibility wrapper for backward compatibility
    window.OfflineApp = OfflineAppEnhanced;
    
    // Initialize the enhanced app
    try {
        window.offlineApp = new EnhancedOfflineApp();
        console.log('✅ EnhancedOfflineApp initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize EnhancedOfflineApp:', error);
        
        // Fallback to basic app
        try {
            window.offlineApp = new OfflineAppEnhanced();
            console.log('✅ Fallback to OfflineAppEnhanced successful');
        } catch (fallbackError) {
            console.error('❌ Fallback initialization failed:', fallbackError);
        }
    }
});
