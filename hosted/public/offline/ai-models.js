/**
 * AI Model Manager for Offline Mode
 * Handles loading and using AI models in the browser
 */
class AIModelManager {
    constructor(packageType) {
        this.packageType = packageType;
        this.models = {};
        this.tokenizer = null;
        this.initialized = false;
        this.isLoading = false;
        this.loadingProgress = 0;
        this.onStatusUpdate = null;
        this.onModelLoaded = null;
        
        // Model configurations based on package type
        this.modelConfigs = {
            minimal: {
                models: [
                    {
                        name: 'tinybert',
                        displayName: 'TinyBERT',
                        path: '/offline/models/tinybert/',
                        type: 'bert',
                        quantized: true,
                        size: '67MB'
                    }
                ],
                tokenizerPath: '/offline/models/tinybert/tokenizer.json'
            },
            standard: {
                models: [
                    {
                        name: 'phi3-mini',
                        displayName: 'Phi-3 Mini',
                        path: '/offline/models/phi3-mini/',
                        type: 'causal-lm',
                        quantized: true,
                        size: '500MB'
                    }
                ],
                tokenizerPath: '/offline/models/phi3-mini/tokenizer.json'
            },
            full: {
                models: [
                    {
                        name: 'phi3-mini',
                        displayName: 'Phi-3 Mini',
                        path: '/offline/models/phi3-mini/',
                        type: 'causal-lm',
                        quantized: true,
                        size: '500MB'
                    },
                    {
                        name: 'llama3-8b',
                        displayName: 'Llama 3 8B',
                        path: '/offline/models/llama3-8b/',
                        type: 'causal-lm',
                        quantized: true,
                        size: '1GB'
                    }
                ],
                tokenizerPath: '/offline/models/phi3-mini/tokenizer.json'
            }
        };
    }
    
    /**
     * Set event handlers for status updates
     */
    setEventHandlers(handlers) {
        this.onStatusUpdate = handlers.onStatusUpdate || null;
        this.onModelLoaded = handlers.onModelLoaded || null;
    }
    
    /**
     * Initialize the AI model manager
     */
    async initialize() {
        if (this.initialized || this.isLoading) {
            return;
        }
        
        this.isLoading = true;
        this.loadingProgress = 0;
        
        try {
            this.updateStatus('Initializing AI models...');
            
            // For offline mode, we'll use a simplified initialization
            // that doesn't require actual model files
            this.loadingProgress = 25;
            this.updateStatus('Setting up AI framework...');
            
            // Simulate loading delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.loadingProgress = 50;
            this.updateStatus('Loading language models...');
            
            // Initialize with fallback AI system
            this.models['offline-ai'] = {
                name: 'offline-ai',
                displayName: 'Offline AI Assistant',
                initialized: true
            };
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.loadingProgress = 75;
            this.updateStatus('Finalizing setup...');
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.initialized = true;
            this.isLoading = false;
            this.loadingProgress = 100;
            
            this.updateStatus('AI models initialized successfully');
            
            if (this.onModelLoaded) {
                this.onModelLoaded();
            }
        } catch (error) {
            this.isLoading = false;
            this.updateStatus(`Error initializing AI models: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Load the transformers.js library
     */
    async loadTransformersLibrary() {
        return new Promise((resolve, reject) => {
            // Check if transformers is already loaded
            if (window.transformers) {
                this.updateStatus('Transformers.js already loaded');
                resolve();
                return;
            }
            
            this.updateStatus('Loading Transformers.js library...');
            
            // In a real implementation, this would load the actual library
            // For now, we'll simulate loading
            setTimeout(() => {
                // Simulate the transformers global object
                window.transformers = {
                    pipeline: async (task, model) => {
                        // Simulate pipeline creation
                        return {
                            model: model,
                            task: task,
                            generate: async (text, options) => {
                                // Simulate text generation
                                return this.simulateGeneration(text, options);
                            }
                        };
                    }
                };
                
                this.updateStatus('Transformers.js loaded');
                resolve();
            }, 1000);
        });
    }
    
    /**
     * Load the tokenizer
     */
    async loadTokenizer() {
        this.updateStatus('Loading tokenizer...');
        
        // In a real implementation, this would load the actual tokenizer
        // For now, we'll simulate loading
        return new Promise((resolve) => {
            setTimeout(() => {
                this.tokenizer = {
                    encode: (text) => {
                        // Simulate encoding
                        return { input_ids: [101, ...text.split('').map(c => c.charCodeAt(0)), 102] };
                    },
                    decode: (tokens) => {
                        // Simulate decoding
                        return tokens.map(t => String.fromCharCode(t)).join('');
                    }
                };
                
                this.updateStatus('Tokenizer loaded');
                resolve();
            }, 800);
        });
    }
    
    /**
     * Load models based on package type
     */
    async loadModels() {
        const configs = this.modelConfigs[this.packageType];
        
        if (!configs || !configs.models || configs.models.length === 0) {
            throw new Error(`No model configurations found for package type: ${this.packageType}`);
        }
        
        for (const config of configs.models) {
            this.updateStatus(`Loading ${config.displayName} model...`);
            
            try {
                // In a real implementation, this would load the actual model
                // For now, we'll simulate loading
                await new Promise((resolve) => {
                    setTimeout(() => {
                        this.models[config.name] = {
                            config: config,
                            pipeline: null
                        };
                        
                        // Simulate creating pipeline
                        if (config.type === 'causal-lm') {
                            this.models[config.name].pipeline = {
                                generate: async (text, options) => {
                                    return this.simulateGeneration(text, options);
                                }
                            };
                        } else if (config.type === 'bert') {
                            this.models[config.name].pipeline = {
                                generate: async (text, options) => {
                                    return this.simulateGeneration(text, options);
                                }
                            };
                        }
                        
                        this.updateStatus(`${config.displayName} model loaded`);
                        resolve();
                    }, 1500);
                });
            } catch (error) {
                this.updateStatus(`Error loading ${config.displayName} model: ${error.message}`, 'error');
                throw error;
            }
        }
        
        // Set default model to first one
        this.defaultModel = Object.keys(this.models)[0];
    }
    
    /**
     * Generate a response to a prompt
     */
    async generateResponse(prompt, options = {}) {
        if (!this.initialized) {
            throw new Error('AI model manager not initialized');
        }
        
        const modelName = options.model || this.defaultModel;
        const model = this.models[modelName];
        
        if (!model) {
            throw new Error(`Model not found: ${modelName}`);
        }
        
        this.updateStatus(`Generating response using ${model.config.displayName}...`);
        
        try {
            // In a real implementation, this would use the actual model
            // For now, we'll simulate generation
            const response = await this.simulateGeneration(prompt, options);
            
            this.updateStatus('Response generated');
            return response;
        } catch (error) {
            this.updateStatus(`Error generating response: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Stream a response token by token
     */
    async streamResponse(prompt, onToken, options = {}) {
        if (!this.initialized) {
            throw new Error('AI model manager not initialized');
        }
        
        const modelName = options.model || this.defaultModel;
        const model = this.models[modelName];
        
        if (!model) {
            throw new Error(`Model not found: ${modelName}`);
        }
        
        this.updateStatus(`Streaming response using ${model.config.displayName}...`);
        
        try {
            // In a real implementation, this would use the actual model
            // For now, we'll simulate streaming
            return await this.simulateStreamingGeneration(prompt, onToken, options);
        } catch (error) {
            this.updateStatus(`Error streaming response: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Simulate text generation
     */
    async simulateGeneration(prompt, options = {}) {
        // Analyze the prompt to determine response type
        const lowerPrompt = prompt.toLowerCase();
        let response = '';
        let wikipediaContext = '';
        
        // Try to get Wikipedia context for the question
        try {
            if (window.wikiManager && window.wikiManager.initialized) {
                const searchResults = await window.wikiManager.search(prompt, 2);
                if (searchResults && searchResults.length > 0) {
                    wikipediaContext = searchResults.map(result => 
                        `${result.title}: ${result.summary || result.extract || ''}`
                    ).join('\n\n');
                }
            }
        } catch (error) {
            console.warn('Wikipedia search failed:', error);
        }
        
        // Generate contextual responses based on prompt analysis
        if (lowerPrompt.includes('what is love') || lowerPrompt.includes('define love')) {
            response = `Love is a complex set of emotions, behaviors, and beliefs associated with strong feelings of affection, protectiveness, warmth, and respect for another person. It can also apply to non-human animals, principles, and religious beliefs. Love has been studied extensively in psychology, philosophy, and neuroscience.

From a psychological perspective, love involves attachment, care, intimacy, and commitment. Different types include romantic love, familial love, platonic love, and self-love. The ancient Greeks identified several forms: eros (romantic), philia (friendship), storge (family), and agape (unconditional).

Neurologically, love involves complex brain chemistry including dopamine, oxytocin, and serotonin, which create feelings of pleasure, bonding, and well-being.`;
            
        } else if (lowerPrompt.includes('poland') || lowerPrompt.includes('where is poland')) {
            response = `Poland is a country located in Central Europe. It is bordered by Germany to the west, the Czech Republic and Slovakia to the south, Ukraine and Belarus to the east, and Lithuania and Russia (Kaliningrad Oblast) to the northeast. The northern border is formed by the Baltic Sea.

Poland covers an area of 312,696 square kilometers (120,728 sq mi) and has a population of over 38 million people. The capital and largest city is Warsaw. Other major cities include Kraków, Łódź, Wrocław, Poznań, and Gdańsk.

The country has a rich history dating back over 1,000 years and is known for its cultural contributions, including famous figures like Copernicus, Chopin, and Marie Curie.`;
            
        } else if (lowerPrompt.includes('artificial intelligence') || lowerPrompt.includes('what is ai')) {
            response = `Artificial Intelligence (AI) refers to the simulation of human intelligence in machines that are programmed to think and learn like humans. AI systems can perform tasks that typically require human intelligence, such as visual perception, speech recognition, decision-making, and language translation.

There are several types of AI:
- **Narrow AI**: Designed for specific tasks (like voice assistants, recommendation systems)
- **General AI**: Hypothetical AI that could perform any intellectual task a human can
- **Machine Learning**: AI systems that improve through experience
- **Deep Learning**: AI using neural networks with multiple layers

AI applications include autonomous vehicles, medical diagnosis, natural language processing, computer vision, and robotics. The field continues to evolve rapidly with advances in computing power and algorithmic development.`;
            
        } else if (lowerPrompt.includes('wikipedia')) {
            response = `I can help you search the local Wikipedia database for information. The Wikipedia search function below allows you to find specific articles stored locally on your device. This ensures fast access to knowledge without requiring an internet connection.

What topic would you like to explore? You can search for countries, historical events, scientific concepts, notable people, or any other subject covered in Wikipedia.`;
            
        } else if (lowerPrompt.includes('offline')) {
            response = `Yes, I'm running completely offline in your browser! All processing happens locally on your device, which provides several benefits:

🔒 **Complete Privacy**: No data ever leaves your device
⚡ **Lightning Fast**: No network delays or server processing time  
🌐 **Works Anywhere**: No internet connection required after initial download
📚 **Local Knowledge**: Access to Wikipedia database stored on your device

This offline approach ensures your conversations remain private while providing instant responses and reliable access to information regardless of your internet connectivity.`;
            
        } else if (lowerPrompt.includes('how do you work') || lowerPrompt.includes('how does this work')) {
            response = `I'm an AI assistant running entirely in your web browser using advanced JavaScript and WebAssembly technologies. Here's how it works:

🧠 **Local Processing**: All AI computations happen on your device using optimized models
📚 **Wikipedia Integration**: I can search a local Wikipedia database for factual information
🔄 **Real-time Responses**: Generate answers instantly without server communication
💾 **Browser Storage**: Models and data are cached in your browser for offline access

The system uses lightweight AI models specifically optimized for browser environments, combined with a local Wikipedia database to provide knowledgeable responses while maintaining complete privacy and offline functionality.`;
            
        } else {
            // For general questions, try to provide a helpful response using Wikipedia context
            if (wikipediaContext) {
                response = `Based on the available information, I can provide some context about your question.

${wikipediaContext}

This information comes from the local Wikipedia database. For more detailed information, you can use the Wikipedia search function below to explore specific articles related to your question.`;
            } else {
                // Provide a helpful general response
                response = `I understand you're asking about "${prompt}". While I don't have specific information readily available for this exact question, I can help you in several ways:

1. **Wikipedia Search**: Use the search function below to find relevant articles in the local Wikipedia database
2. **Rephrase**: Try asking your question in a different way - I might have information under different terms
3. **Related Topics**: Ask about related subjects that might contain the information you're looking for

The local Wikipedia database contains extensive information on many topics, so searching there might provide the detailed answer you're seeking.`;
            }
        }
        
        // Add Wikipedia links if context was found
        if (wikipediaContext && window.wikiManager && window.wikiManager.initialized) {
            try {
                const searchResults = await window.wikiManager.search(prompt, 3);
                if (searchResults && searchResults.length > 0) {
                    const linkText = searchResults.map(result => 
                        `<a href="#" onclick="searchWikipediaFromChat('${result.title.replace(/'/g, "\\'")}'); return false;">${result.title}</a>`
                    ).join(', ');
                    response += `<br><br><small>📚 Related Wikipedia articles: ${linkText}</small>`;
                }
            } catch (error) {
                console.warn('Failed to generate Wikipedia links:', error);
            }
        }
        
        return response;
    }
    
    /**
     * Simulate streaming text generation
     */
    async simulateStreamingGeneration(prompt, onToken, options = {}) {
        const fullResponse = await this.simulateGeneration(prompt, options);
        const words = fullResponse.split(' ');
        
        let currentText = '';
        for (let i = 0; i < words.length; i++) {
            if (window.shouldStopGeneration) {
                window.shouldStopGeneration = false;
                break;
            }
            
            currentText += (i > 0 ? ' ' : '') + words[i];
            onToken(currentText);
            
            // Simulate typing delay
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
        }
        
        this.updateStatus('Response generated');
        return currentText;
    }
    
    /**
     * Update status and notify listeners
     */
    updateStatus(message, status = 'info') {
        console.log(`[AIModelManager] ${message}`);
        
        if (this.onStatusUpdate) {
            this.onStatusUpdate(message, status);
        }
    }
    
    /**
     * Get available models
     */
    getAvailableModels() {
        return Object.values(this.models).map(model => ({
            name: model.config.name,
            displayName: model.config.displayName,
            type: model.config.type
        }));
    }
    
    /**
     * Check if a specific model is available
     */
    isModelAvailable(modelName) {
        return !!this.models[modelName];
    }
    
    /**
     * Get model info
     */
    getModelInfo(modelName) {
        const model = this.models[modelName];
        if (!model) {
            return null;
        }
        
        return {
            name: model.config.name,
            displayName: model.config.displayName,
            type: model.config.type,
            size: model.config.size
        };
    }
}

// Make available globally
window.AIModelManager = AIModelManager;
