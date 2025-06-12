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
        // Fix: Check if WikipediaManager exists before instantiating
        this.wikipediaManager = typeof WikipediaManager !== 'undefined' ? new WikipediaManager() : null;
        this.isGenerating = false;
        this.currentGeneration = null;
    }

    async init() {
        console.log('🚀 Initializing Enhanced AI Questions Offline Mode');
        
        try {
            // Initialize AI Manager
            const aiInitialized = await this.aiManager.initialize();
            if (!aiInitialized) {
                console.error('Failed to initialize AI Manager');
            }
            
            // Fix: Check if wikipediaManager exists before calling initialize
            if (this.wikipediaManager) {
                // Initialize Wikipedia Manager
                const wikiInitialized = await this.wikipediaManager.initialize();
                if (!wikiInitialized) {
                    console.error('Failed to initialize Wikipedia Manager');
                }
            } else {
                console.warn('WikipediaManager not available, skipping initialization');
            }
            
            // Call parent initialization
            await super.init();
            
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
        } catch (error) {
            console.error('Error setting up enhanced event listeners:', error);
        }
    }

    updateModelSelection() {
        try {
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
        } catch (error) {
            console.error('Error updating model selection:', error);
        }
    }

    async downloadPackage() {
        try {
            // Call parent download method first
            if (super.downloadPackage) {
                await super.downloadPackage();
            }
            
            // Download the actual AI model
            if (this.selectedAIModel && this.aiManager) {
                this.updateProgress(85, 'Loading AI model...', `Initializing ${this.selectedAIModel}`);
                
                try {
                    await this.aiManager.downloadModel(this.selectedAIModel, (progress) => {
                        this.updateProgress(85 + (progress * 10) / 100, 'Loading AI model...', `${progress}% loaded`);
                    });
                    
                    console.log('✅ AI model loaded successfully');
                } catch (error) {
                    console.error('❌ Failed to load AI model:', error);
                }
            }
        } catch (error) {
            console.error('Error in downloadPackage:', error);
        }
    }

    updateProgress(percent, status, details) {
        try {
            // Update progress UI if available
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            const progressDetails = document.getElementById('progressDetails');
            
            if (progressFill) progressFill.style.width = `${percent}%`;
            if (progressText) progressText.textContent = status;
            if (progressDetails) progressDetails.textContent = details;
        } catch (error) {
            console.error('Error updating progress:', error);
        }
    }

    async handleChatSubmit(event) {
        if (event) event.preventDefault();
        
        try {
            const chatInput = document.getElementById('chatInput');
            const message = chatInput.value.trim();
            
            if (!message) return;
            
            // Clear input
            chatInput.value = '';
            
            // Add user message to chat
            this.addMessageToChat(message, 'user');
            
            // Show thinking indicator
            this.addThinkingIndicator();
            
            // Show stop button
            const stopBtn = document.getElementById('stopBtn');
            if (stopBtn) stopBtn.style.display = 'block';
            
            this.isGenerating = true;
            
            // Get AI response
            try {
                let response;
                
                if (this.aiManager && this.aiManager.currentModel) {
                    // Use real AI model
                    response = await this.getEnhancedAIResponse(message);
                } else {
                    // Fallback to basic response
                    response = await this.getAIResponse(message);
                }
                
                // Remove thinking indicator
                this.removeThinkingIndicator();
                
                // Add AI response to chat
                this.addMessageToChat(response, 'ai');
            } catch (error) {
                console.error('Error getting AI response:', error);
                this.removeThinkingIndicator();
                this.addMessageToChat(`Sorry, I encountered an error: ${error.message}`, 'ai');
            }
            
            // Hide stop button
            if (stopBtn) stopBtn.style.display = 'none';
            
            this.isGenerating = false;
            this.currentGeneration = null;
            
            // Scroll to bottom
            this.scrollChatToBottom();
        } catch (error) {
            console.error('Error handling chat submission:', error);
        }
    }

    async getEnhancedAIResponse(message) {
        try {
            console.log('Getting enhanced AI response...');
            
            // Check if we should search Wikipedia
            const shouldSearchWiki = this.shouldSearchWikipedia(message);
            let wikiContext = '';
            
            if (shouldSearchWiki && this.wikipediaManager) {
                // Add searching indicator
                this.updateThinkingIndicator('Searching Wikipedia...');
                
                // Search Wikipedia
                const searchResults = await this.wikipediaManager.search(message);
                
                if (searchResults.length > 0) {
                    // Get most relevant article
                    const article = await this.wikipediaManager.getArticle(searchResults[0].id);
                    
                    if (article) {
                        wikiContext = `Wikipedia context: ${article.title}\n${article.content}\n\n`;
                        console.log(`Found Wikipedia article: ${article.title}`);
                    }
                }
            }
            
            // Update thinking indicator
            this.updateThinkingIndicator('Generating response...');
            
            // Generate response with AI model
            const fullPrompt = wikiContext + `User: ${message}\nAI Assistant:`;
            
            // Set up generation
            this.currentGeneration = {
                prompt: fullPrompt,
                model: this.aiManager.currentModel
            };
            
            // Stream response
            let finalResponse = '';
            await this.aiManager.streamResponse(fullPrompt, (partialResponse) => {
                if (!this.isGenerating) return;
                
                finalResponse = partialResponse;
                this.updateThinkingIndicator(partialResponse);
            });
            
            return finalResponse;
        } catch (error) {
            console.error('Error in enhanced AI response:', error);
            throw error;
        }
    }

    shouldSearchWikipedia(message) {
        // Simple heuristic to determine if we should search Wikipedia
        const questionWords = ['what', 'who', 'where', 'when', 'why', 'how'];
        const messageLower = message.toLowerCase();
        
        // Check if message starts with question word
        for (const word of questionWords) {
            if (messageLower.startsWith(word)) return true;
        }
        
        // Check for factual keywords
        const factualKeywords = ['explain', 'describe', 'definition', 'history', 'information', 'facts'];
        for (const keyword of factualKeywords) {
            if (messageLower.includes(keyword)) return true;
        }
        
        return false;
    }

    addMessageToChat(message, sender) {
        try {
            const chatContainer = document.getElementById('chatContainer');
            if (!chatContainer) return;
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${sender}`;
            
            if (sender === 'ai') {
                messageDiv.innerHTML = `<strong>AI Assistant:</strong> ${message}`;
            } else {
                messageDiv.innerHTML = `<strong>You:</strong> ${message}`;
            }
            
            chatContainer.appendChild(messageDiv);
            
            // Add to conversation history
            this.conversationHistory.push({
                role: sender === 'ai' ? 'assistant' : 'user',
                content: message
            });
            
            // Scroll to bottom
            this.scrollChatToBottom();
        } catch (error) {
            console.error('Error adding message to chat:', error);
        }
    }

    addThinkingIndicator() {
        try {
            const chatContainer = document.getElementById('chatContainer');
            if (!chatContainer) return;
            
            const thinkingDiv = document.createElement('div');
            thinkingDiv.className = 'message ai thinking';
            thinkingDiv.id = 'thinking-indicator';
            thinkingDiv.innerHTML = `<strong>AI Assistant:</strong> <span class="thinking-text">Thinking...</span>`;
            
            chatContainer.appendChild(thinkingDiv);
            this.scrollChatToBottom();
        } catch (error) {
            console.error('Error adding thinking indicator:', error);
        }
    }

    updateThinkingIndicator(text) {
        try {
            const thinkingIndicator = document.getElementById('thinking-indicator');
            if (!thinkingIndicator) return;
            
            const thinkingText = thinkingIndicator.querySelector('.thinking-text');
            if (thinkingText) {
                thinkingText.textContent = text;
            }
            
            this.scrollChatToBottom();
        } catch (error) {
            console.error('Error updating thinking indicator:', error);
        }
    }

    removeThinkingIndicator() {
        try {
            const thinkingIndicator = document.getElementById('thinking-indicator');
            if (thinkingIndicator) {
                thinkingIndicator.remove();
            }
        } catch (error) {
            console.error('Error removing thinking indicator:', error);
        }
    }

    scrollChatToBottom() {
        try {
            const chatContainer = document.getElementById('chatContainer');
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        } catch (error) {
            console.error('Error scrolling chat to bottom:', error);
        }
    }

    stopGeneration() {
        try {
            console.log('Stopping generation...');
            this.isGenerating = false;
            
            // Hide stop button
            const stopBtn = document.getElementById('stopBtn');
            if (stopBtn) stopBtn.style.display = 'none';
            
            // Update thinking indicator
            this.updateThinkingIndicator('Generation stopped.');
            
            // Remove thinking indicator after a short delay
            setTimeout(() => {
                this.removeThinkingIndicator();
            }, 1000);
        } catch (error) {
            console.error('Error stopping generation:', error);
        }
    }

    clearChat() {
        try {
            const chatContainer = document.getElementById('chatContainer');
            if (!chatContainer) return;
            
            // Keep only the welcome message
            chatContainer.innerHTML = `
                <div class="message ai">
                    <strong>AI Assistant:</strong> Hello! I'm running completely offline in your browser using real AI models. Ask me anything, and I can also search the local Wikipedia database for additional context.
                </div>
            `;
            
            // Clear conversation history
            this.conversationHistory = [];
        } catch (error) {
            console.error('Error clearing chat:', error);
        }
    }

    switchModel(modelId) {
        try {
            if (!this.aiManager) return false;
            
            const success = this.aiManager.switchModel(modelId);
            if (success) {
                this.addMessageToChat(`Switched to model: ${modelId}`, 'ai');
                return true;
            }
            
            // If model not loaded yet, try to download it
            this.addThinkingIndicator();
            this.updateThinkingIndicator(`Loading model ${modelId}...`);
            
            this.aiManager.downloadModel(modelId, (progress) => {
                this.updateThinkingIndicator(`Loading model ${modelId}: ${progress}%`);
            }).then(() => {
                this.aiManager.switchModel(modelId);
                this.removeThinkingIndicator();
                this.addMessageToChat(`Switched to model: ${modelId}`, 'ai');
            }).catch(error => {
                this.removeThinkingIndicator();
                this.addMessageToChat(`Failed to load model: ${error.message}`, 'ai');
            });
            
            return true;
        } catch (error) {
            console.error('Error switching model:', error);
            return false;
        }
    }
}

// Initialize EnhancedOfflineApp when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        window.enhancedOfflineApp = new EnhancedOfflineApp();
        console.log('✅ EnhancedOfflineApp initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize EnhancedOfflineApp:', error);
    }
});
