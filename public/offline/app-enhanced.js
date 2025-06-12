class OfflineAppEnhanced {
    constructor() {
        this.isOffline = false;
        this.serviceWorker = null;
        this.aiModel = null;
        this.localAI = null;
        this.wikipediaDB = null;
        this.conversationHistory = [];
        this.queryLogger = null;
        this.enhancedWikipediaSearch = null;
        this.resourceStatus = {
            models: { available: false, details: {} },
            wikipedia: { available: false, details: {} },
            scripts: { available: false, details: {} }
        };
        this.init();
    }

    async init() {
        console.log('Initializing Enhanced Offline App...');
        
        // Check browser compatibility
        if (!this.checkCompatibility()) {
            this.showError('Your browser does not support the required features for offline mode.');
            return;
        }

        // Check if offline resources are available
        await this.checkOfflineStatus();
        
        // Initialize UI
        this.setupEventListeners();
        await this.updateUI();
        
        // Initialize query logger
        this.initializeQueryLogger();
        
        // Register service worker
        await this.registerServiceWorker();
        
        // Initialize local AI if available
        if (this.isOffline) {
            this.initializeLocalAI();
        }
        
        console.log('Enhanced Offline App initialized');
    }

    checkCompatibility() {
        const required = [
            'serviceWorker' in navigator,
            'indexedDB' in window,
            'WebAssembly' in window,
            'fetch' in window
        ];
        
        return required.every(feature => feature);
    }

    async checkOfflineStatus() {
        try {
            // Step 1: Check cached resources
            const resourceStatus = await this.verifyOfflineResources();
            
            // Step 2: Determine overall offline status
            this.isOffline = resourceStatus.isFullyOfflineCapable;
            
            // Step 3: Store detailed resource status
            this.resourceStatus = resourceStatus.resources;
            
            console.log('Offline status:', this.isOffline ? 'Ready' : 'Not ready');
            console.log('Resource status:', this.resourceStatus);
            
        } catch (error) {
            console.error('Failed to check offline status:', error);
            this.isOffline = false;
        }
    }

    async verifyOfflineResources() {
        const resources = {
            scripts: { available: false, details: {} },
            models: { available: false, details: {} },
            wikipedia: { available: false, details: {} }
        };
        
        // Step 1: Check essential script resources
        try {
            const cache = await caches.open('ai-questions-offline-v1');
            const cachedRequests = await cache.keys();
            
            const essentialScripts = [
                '/offline/ai-models.js',
                '/offline/wikipedia.js',
                '/offline/app-enhanced.js',
                '/offline/local-ai-model.js',
                '/offline/libs/onnxruntime-web.min.js',
                '/offline/enhanced-wikipedia-search.js',
                '/offline/query-logger.js',
                '/offline/wikipedia-content-parser.js'
            ];
            
            const availableScripts = essentialScripts.filter(script => 
                cachedRequests.some(request => request.url.includes(script))
            );
            
            resources.scripts.available = availableScripts.length === essentialScripts.length;
            resources.scripts.details = {
                total: essentialScripts.length,
                available: availableScripts.length,
                missing: essentialScripts.filter(script => 
                    !availableScripts.includes(script)
                )
            };
        } catch (error) {
            console.error('Failed to check script resources:', error);
            resources.scripts.available = false;
            resources.scripts.details.error = error.message;
        }
        
        // Step 2: Check AI models
        try {
            const modelPaths = [
                '/offline/models/tinyml-qa.onnx',
                '/offline/models/tinyml-qa-vocab.json',
                '/offline/models/tinyml-qa-config.json'
            ];
            
            const modelChecks = await Promise.all(modelPaths.map(async path => {
                try {
                    const cache = await caches.open('ai-questions-offline-v1');
                    const match = await cache.match(path);
                    return { path, available: !!match };
                } catch (e) {
                    return { path, available: false };
                }
            }));
            
            const availableModels = modelChecks.filter(check => check.available);
            resources.models.available = availableModels.length === modelPaths.length;
            resources.models.details = {
                total: modelPaths.length,
                available: availableModels.length,
                missing: modelChecks.filter(check => !check.available).map(check => check.path)
            };
        } catch (error) {
            console.error('Failed to check model resources:', error);
            resources.models.available = false;
            resources.models.details.error = error.message;
        }
        
        // Step 3: Check Wikipedia database
        try {
            // Check if Wikipedia database is available in IndexedDB
            const dbExists = await this.checkWikipediaDatabase();
            resources.wikipedia.available = dbExists;
            
            if (dbExists) {
                // Try a test query if database exists
                const testQueryResult = await this.testWikipediaQuery();
                resources.wikipedia.details = {
                    dbExists: true,
                    querySuccess: testQueryResult.success,
                    articleCount: testQueryResult.count || 0
                };
            } else {
                resources.wikipedia.details = {
                    dbExists: false,
                    querySuccess: false
                };
            }
        } catch (error) {
            console.error('Failed to check Wikipedia database:', error);
            resources.wikipedia.available = false;
            resources.wikipedia.details.error = error.message;
        }
        
        // Determine overall offline capability
        const isFullyOfflineCapable = resources.scripts.available && 
                                     resources.models.available && 
                                     resources.wikipedia.available;
        
        // Determine partial offline capability
        const isPartiallyOfflineCapable = resources.scripts.available && 
                                         (resources.models.available || resources.wikipedia.available);
        
        return {
            isFullyOfflineCapable,
            isPartiallyOfflineCapable,
            resources
        };
    }

    async checkWikipediaDatabase() {
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('wikipedia-offline', 1);
                
                request.onsuccess = () => {
                    const db = request.result;
                    const storeNames = Array.from(db.objectStoreNames);
                    db.close();
                    resolve(storeNames.includes('articles'));
                };
                
                request.onerror = () => {
                    resolve(false);
                };
                
                request.onupgradeneeded = () => {
                    request.transaction.abort();
                    resolve(false);
                };
            } catch (error) {
                console.error('Error checking Wikipedia database:', error);
                resolve(false);
            }
        });
    }

    async testWikipediaQuery() {
        if (!window.SQL || !window.initSqlJs) {
            return { success: false, error: 'SQL.js not available' };
        }
        
        try {
            // Try to load the Wikipedia database
            if (!this.wikipediaDB) {
                // Check if Wikipedia.js is loaded
                if (typeof WikipediaManager !== 'undefined') {
                    this.wikipediaDB = new WikipediaManager();
                    await this.wikipediaDB.initialize();
                } else {
                    return { success: false, error: 'WikipediaManager not available' };
                }
            }
            
            // Try a simple query to count articles
            if (this.wikipediaDB && this.wikipediaDB.db) {
                const stmt = this.wikipediaDB.db.prepare('SELECT COUNT(*) as count FROM wikipedia_articles');
                stmt.step();
                const result = stmt.getAsObject();
                stmt.free();
                
                return { 
                    success: true, 
                    count: result.count 
                };
            }
            
            return { success: false, error: 'Database not initialized' };
        } catch (error) {
            console.error('Wikipedia test query failed:', error);
            return { success: false, error: error.message };
        }
    }

    setupEventListeners() {
        // Chat form
        const chatForm = document.getElementById('chatForm');
        if (chatForm) {
            chatForm.addEventListener('submit', (e) => this.handleChatSubmit(e));
        }

        // Chat input
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleChatSubmit(e);
                }
            });
        }

        // Model selector
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => this.switchModel(e.target.value));
        }

        // Clear chat button
        const clearBtn = document.getElementById('clearChat');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearChat());
        }

        // Download resources button
        const downloadBtn = document.getElementById('downloadResources');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadResources());
        }
        
        // Resource status button
        const statusBtn = document.getElementById('resourceStatus');
        if (statusBtn) {
            statusBtn.addEventListener('click', () => this.showResourceStatus());
        }
    }

    async updateUI() {
        // Update offline status indicator
        const statusIndicator = document.getElementById('offlineStatus');
        if (statusIndicator) {
            statusIndicator.textContent = this.isOffline ? '🟢 Offline Ready' : '🔴 Online Only';
            statusIndicator.className = this.isOffline ? 'status-online' : 'status-offline';
        }

        // Show/hide download button
        const downloadBtn = document.getElementById('downloadResources');
        if (downloadBtn) {
            downloadBtn.style.display = this.isOffline ? 'none' : 'block';
        }

        // Enable/disable chat based on offline status
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) {
            if (!this.isOffline) {
                chatContainer.innerHTML = `
                    <div class="offline-notice">
                        <h3>📥 Download Required</h3>
                        <p>To use the offline AI chat, you need to download the required resources first.</p>
                        <button id="downloadResources" class="download-btn">
                            📥 Download Offline Resources
                        </button>
                    </div>
                `;
                
                // Re-attach event listener
                document.getElementById('downloadResources').addEventListener('click', () => this.downloadResources());
            }
        }
        
        // Update model selector if available
        await this.updateModelSelector();
    }

    async updateModelSelector() {
        const modelSelect = document.getElementById('modelSelect');
        if (!modelSelect) return;
        
        // Clear existing options
        modelSelect.innerHTML = '';
        
        if (this.localAI && this.isOffline) {
            try {
                // Get available models from LocalAI - ensure we await the Promise
                const models = await this.localAI.getAvailableModels();
                
                // Ensure models is an array before using forEach
                if (Array.isArray(models) && models.length > 0) {
                    // Add options for each model
                    models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.id;
                        option.textContent = model.name;
                        modelSelect.appendChild(option);
                    });
                    
                    // Enable the selector
                    modelSelect.disabled = false;
                } else {
                    // Handle case where models is not an array or is empty
                    console.warn('No models available or invalid models data:', models);
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'No models available';
                    modelSelect.appendChild(option);
                    modelSelect.disabled = true;
                }
            } catch (error) {
                console.error('Error getting available models:', error);
                // Add fallback option in case of error
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Error loading models';
                modelSelect.appendChild(option);
                modelSelect.disabled = true;
            }
        } else {
            // Add placeholder option
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No models available';
            modelSelect.appendChild(option);
            
            // Disable the selector
            modelSelect.disabled = true;
        }
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/offline/sw.js');
                console.log('Service Worker registered:', registration);
                this.serviceWorker = registration;
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    console.log('Service Worker update found');
                });
                
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    async initializeLocalAI() {
        try {
            // Check if LocalAIModel is available
            if (typeof LocalAIModel === 'undefined') {
                console.error('LocalAIModel not available');
                return false;
            }
            
            // Check if localAI is already initialized
            if (!this.localAI && window.localAI) {
                this.localAI = window.localAI;
            } else if (!this.localAI) {
                // Create LocalAI instance if not available
                this.localAI = new LocalAIModel();
            }
            
            // Initialize the AI system
            try {
                await this.localAI.initialize();
                console.log('LocalAI initialized successfully');
            } catch (error) {
                console.error('Failed to initialize LocalAI:', error);
            }
            
            // Update UI to reflect available models
            await this.updateModelSelector();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize LocalAI:', error);
            return false;
        }
    }

    initializeQueryLogger() {
        try {
            if (typeof QueryLogger !== 'undefined') {
                this.queryLogger = new QueryLogger();
                console.log('✅ Query logger initialized');
            } else {
                console.warn('QueryLogger not available');
            }
        } catch (error) {
            console.error('Failed to initialize query logger:', error);
        }
    }

    async handleChatSubmit(event) {
        if (event) event.preventDefault();
        
        const chatInput = document.getElementById('chatInput');
        const chatContainer = document.getElementById('chatContainer');
        
        if (!chatInput || !chatContainer) return;
        
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Clear input
        chatInput.value = '';
        
        // Add user message to chat
        this.addMessage(message, 'user');
        
        // Log the query
        if (this.queryLogger) {
            this.queryLogger.logQuery(message);
        }
        
        // Process message
        await this.processMessage(message);
    }

    addMessage(message, sender) {
        const chatContainer = document.getElementById('chatContainer');
        if (!chatContainer) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}`;
        
        if (sender === 'user') {
            messageElement.innerHTML = `<strong>You:</strong> ${message}`;
        } else {
            messageElement.innerHTML = `<strong>AI Assistant:</strong> ${message}`;
        }
        
        chatContainer.appendChild(messageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Add to conversation history
        this.conversationHistory.push({
            role: sender === 'user' ? 'user' : 'assistant',
            content: message
        });
    }

    async processMessage(message) {
        if (!this.isOffline) {
            this.addMessage('Offline mode is not available. Please download the required resources first.', 'ai');
            return;
        }
        
        try {
            // Show typing indicator
            this.showTypingIndicator();
            
            // Get selected model
            const modelSelect = document.getElementById('modelSelect');
            const selectedModel = modelSelect ? modelSelect.value : 'tinyml-qa';
            
            // Search Wikipedia for context
            let wikipediaContext = '';
            if (this.wikipediaDB) {
                try {
                    const searchResults = await this.wikipediaDB.search(message);
                    if (searchResults && searchResults.length > 0) {
                        wikipediaContext = searchResults[0].content;
                        
                        // Log the search results
                        if (this.queryLogger) {
                            this.queryLogger.logWikipediaResults(searchResults);
                        }
                    }
                } catch (error) {
                    console.error('Wikipedia search error:', error);
                }
            }
            
            // Generate AI response
            let response;
            if (this.localAI) {
                try {
                    // Prepare prompt with context if available
                    const prompt = wikipediaContext 
                        ? `Context: ${wikipediaContext}\n\nQuestion: ${message}\n\nAnswer:`
                        : message;
                    
                    response = await this.localAI.runInference(selectedModel, prompt);
                } catch (error) {
                    console.error('AI inference error:', error);
                    response = `I'm sorry, I encountered an error while processing your request. ${error.message}`;
                }
            } else {
                response = "I'm sorry, the AI model is not available in offline mode. Please try again later.";
            }
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Add AI response to chat
            this.addMessage(response, 'ai');
            
        } catch (error) {
            console.error('Error processing message:', error);
            this.hideTypingIndicator();
            this.addMessage(`I'm sorry, an error occurred: ${error.message}`, 'ai');
        }
    }

    showTypingIndicator() {
        const chatContainer = document.getElementById('chatContainer');
        if (!chatContainer) return;
        
        const typingElement = document.createElement('div');
        typingElement.className = 'message ai typing';
        typingElement.id = 'typingIndicator';
        typingElement.innerHTML = '<strong>AI Assistant:</strong> <span class="typing-animation">Thinking</span>';
        
        chatContainer.appendChild(typingElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async switchModel(modelId) {
        if (!this.localAI) return;
        
        try {
            this.showMessage(`Switching to model: ${modelId}`, 'info');
            await this.localAI.loadModel(modelId);
            this.showMessage(`Model ${modelId} loaded successfully`, 'success');
        } catch (error) {
            console.error('Error switching model:', error);
            this.showError(`Failed to switch model: ${error.message}`);
        }
    }

    clearChat() {
        const chatContainer = document.getElementById('chatContainer');
        if (!chatContainer) return;
        
        // Keep only the welcome message
        chatContainer.innerHTML = `
            <div class="message ai">
                <strong>AI Assistant:</strong> Hello! I'm running completely offline in your browser. Ask me anything!
            </div>
        `;
        
        // Reset conversation history
        this.conversationHistory = [
            { role: 'assistant', content: 'Hello! I\'m running completely offline in your browser. Ask me anything!' }
        ];
    }

    downloadResources() {
        // Show download section
        const downloadSection = document.getElementById('downloadSection');
        if (downloadSection) {
            downloadSection.style.display = 'block';
        }
        
        // Initialize download manager if available
        if (typeof DownloadManagerEnhanced !== 'undefined') {
            const downloadManager = new DownloadManagerEnhanced();
            downloadManager.init();
        } else {
            this.showError('Download manager not available');
        }
    }

    showResourceStatus() {
        // Create modal for resource status
        const modal = document.createElement('div');
        modal.className = 'resource-status-modal';
        modal.innerHTML = `
            <div class="resource-status-content">
                <h2>📊 Resource Status</h2>
                <div class="resource-status-close">&times;</div>
                <div class="resource-status-details">
                    <h3>Scripts</h3>
                    <p>Status: ${this.resourceStatus.scripts.available ? '✅ Available' : '❌ Missing'}</p>
                    <p>Available: ${this.resourceStatus.scripts.details.available || 0}/${this.resourceStatus.scripts.details.total || 0}</p>
                    
                    <h3>AI Models</h3>
                    <p>Status: ${this.resourceStatus.models.available ? '✅ Available' : '❌ Missing'}</p>
                    <p>Available: ${this.resourceStatus.models.details.available || 0}/${this.resourceStatus.models.details.total || 0}</p>
                    
                    <h3>Wikipedia Database</h3>
                    <p>Status: ${this.resourceStatus.wikipedia.available ? '✅ Available' : '❌ Missing'}</p>
                    <p>Articles: ${this.resourceStatus.wikipedia.details.articleCount || 0}</p>
                </div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .resource-status-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }
            
            .resource-status-content {
                background: white;
                padding: 20px;
                border-radius: 8px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
            }
            
            .resource-status-close {
                position: absolute;
                top: 10px;
                right: 15px;
                font-size: 24px;
                cursor: pointer;
            }
            
            .resource-status-details h3 {
                margin-top: 15px;
                margin-bottom: 5px;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(modal);
        
        // Add close event
        const closeBtn = modal.querySelector('.resource-status-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
        }
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    showMessage(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        // Add styles if not already added
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .toast {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 10px 20px;
                    border-radius: 4px;
                    color: white;
                    font-weight: bold;
                    z-index: 1000;
                    animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
                    opacity: 0;
                    animation-fill-mode: forwards;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                
                .toast.info {
                    background: #3498db;
                }
                
                .toast.success {
                    background: #2ecc71;
                }
                
                .toast.error {
                    background: #e74c3c;
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // Remove after animation
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    showError(message) {
        this.showMessage(message, 'error');
    }
}

// Initialize when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.offlineApp = new OfflineAppEnhanced();
});

// Create a compatibility wrapper for backward compatibility
window.OfflineApp = OfflineAppEnhanced;
