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
        this.updateUI();
        
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

    updateUI() {
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
        this.updateModelSelector();
    }

    updateModelSelector() {
        const modelSelect = document.getElementById('modelSelect');
        if (!modelSelect) return;
        
        // Clear existing options
        modelSelect.innerHTML = '';
        
        if (this.localAI && this.isOffline) {
            // Get available models from LocalAI
            const models = this.localAI.getAvailableModels();
            
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
            
            // Create LocalAI instance
            this.localAI = new LocalAIModel();
            
            // Initialize the AI system
            const backends = await this.localAI.initialize();
            console.log('LocalAI initialized with backends:', backends);
            
            // Set up event listeners
            this.localAI.on('error', (data) => {
                console.error('LocalAI error:', data);
                this.showError(`AI model error: ${data.message}`);
            });
            
            this.localAI.on('loading', (data) => {
                console.log(`Loading model ${data.model}: ${Math.round(data.progress * 100)}%`);
                this.showMessage(`Loading AI model: ${Math.round(data.progress * 100)}%`, 'info');
            });
            
            this.localAI.on('loaded', (data) => {
                console.log(`Model ${data.model} loaded successfully`);
                this.showMessage(`AI model ${data.model} loaded successfully`, 'success');
                this.aiModel = {
                    loaded: true,
                    name: data.model,
                    executionProvider: data.executionProvider
                };
            });
            
            // Update UI to reflect available models
            this.updateModelSelector();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize LocalAI:', error);
            this.showError(`Failed to initialize AI system: ${error.message}`);
            return false;
        }
    }

    async handleChatSubmit(event) {
        event.preventDefault();
        
        if (!this.isOffline) {
            this.showMessage('Please download offline resources first', 'error');
            return;
        }

        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message) return;

        // Clear input
        chatInput.value = '';
        
        // Add user message to chat
        this.addMessageToChat('user', message);
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Get context from Wikipedia if available
            let context = '';
            if (this.resourceStatus.wikipedia.available) {
                try {
                    const wikipediaResults = await this.searchWikipedia(message);
                    if (wikipediaResults && wikipediaResults.length > 0) {
                        context = wikipediaResults.map(result => 
                            `From Wikipedia article "${result.title}": ${result.snippet || result.content?.substring(0, 200)}`
                        ).join('\n\n');
                    }
                } catch (error) {
                    console.error('Wikipedia search failed:', error);
                    // Continue without Wikipedia context
                }
            }
            
            // Get AI response
            const response = await this.getAIResponse(message, context);
            
            // Remove typing indicator
            this.hideTypingIndicator();
            
            // Add AI response to chat
            this.addMessageToChat('assistant', response);
            
        } catch (error) {
            console.error('Chat error:', error);
            this.hideTypingIndicator();
            this.addMessageToChat('system', `Error: ${error.message}`);
        }
    }

    async getAIResponse(message, context = '') {
        // Check if we have a real AI model available
        if (this.localAI && this.localAI.isLoaded) {
            try {
                // Use the real model for inference
                const result = await this.localAI.generateResponse(message, context);
                return result.response;
            } catch (error) {
                console.error('AI inference failed:', error);
                throw new Error(`AI inference failed: ${error.message}`);
            }
        } else if (this.resourceStatus.models.available) {
            // We have models but they're not loaded yet
            try {
                // Load the default model
                if (!this.localAI) {
                    await this.initializeLocalAI();
                }
                
                // Load the first available model
                const models = this.localAI.getAvailableModels();
                if (models.length > 0) {
                    await this.localAI.loadModel(models[0].id, (progress) => {
                        console.log(`Loading model: ${Math.round(progress * 100)}%`);
                    });
                    
                    // Now try to generate a response
                    const result = await this.localAI.generateResponse(message, context);
                    return result.response;
                } else {
                    throw new Error('No AI models available');
                }
            } catch (error) {
                console.error('Failed to load and use AI model:', error);
                throw new Error(`Failed to use AI model: ${error.message}`);
            }
        } else {
            // No real models available, explain the situation
            return `I'm sorry, but I can't provide a real AI response because the AI models aren't available offline yet. Please download the complete offline package including AI models to enable real AI chat functionality.`;
        }
    }

    async loadAIModel(modelId) {
        if (!this.localAI) {
            await this.initializeLocalAI();
        }
        
        if (!this.localAI) {
            throw new Error('AI system not available');
        }
        
        try {
            this.showMessage('Loading AI model...', 'info');
            
            // Load the specified model
            const result = await this.localAI.loadModel(modelId, (progress) => {
                // Update UI with loading progress
                const progressPercent = Math.round(progress * 100);
                this.showMessage(`Loading model: ${progressPercent}%`, 'info');
            });
            
            this.aiModel = { 
                loaded: true, 
                name: modelId,
                executionProvider: result.executionProvider
            };
            
            this.showMessage(`Model ${modelId} loaded successfully`, 'success');
            return this.aiModel;
            
        } catch (error) {
            console.error('Failed to load AI model:', error);
            this.showError(`Failed to load model: ${error.message}`);
            throw error;
        }
    }

    addMessageToChat(role, content) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const timestamp = new Date().toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="role">${role === 'user' ? '👤 You' : role === 'assistant' ? '🤖 AI' : '⚠️ System'}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${content}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Store in conversation history
        this.conversationHistory.push({ role, content, timestamp });
    }

    showTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.className = 'message assistant typing';
        typingDiv.innerHTML = `
            <div class="message-header">
                <span class="role">🤖 AI</span>
                <span class="timestamp">typing...</span>
            </div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
        this.conversationHistory = [];
        this.showMessage('Chat cleared', 'info');
    }

    async switchModel(modelId) {
        if (!modelId) return;
        
        try {
            await this.loadAIModel(modelId);
        } catch (error) {
            console.error('Failed to switch model:', error);
            this.showMessage(`Failed to switch to ${modelId}`, 'error');
        }
    }

    downloadResources() {
        // Redirect to download page
        window.location.href = '/offline';
    }

    showResourceStatus() {
        // Create a modal to display resource status
        let modalContainer = document.getElementById('resourceStatusModal');
        
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'resourceStatusModal';
            modalContainer.className = 'resource-status-modal';
            document.body.appendChild(modalContainer);
        }
        
        // Generate status content
        const scriptsStatus = this.resourceStatus.scripts.available ? 
            '✅ Available' : '❌ Missing';
        
        const modelsStatus = this.resourceStatus.models.available ? 
            '✅ Available' : '❌ Missing';
        
        const wikiStatus = this.resourceStatus.wikipedia.available ? 
            '✅ Available' : '❌ Missing';
        
        const wikiDetails = this.resourceStatus.wikipedia.details;
        const wikiArticles = wikiDetails.articleCount || 'Unknown';
        
        modalContainer.innerHTML = `
            <div class="resource-status-content">
                <div class="resource-status-header">
                    <h2>Offline Resources Status</h2>
                    <button id="closeResourceStatus" class="close-button">×</button>
                </div>
                <div class="resource-status-body">
                    <div class="resource-item">
                        <div class="resource-name">Core Scripts</div>
                        <div class="resource-status ${this.resourceStatus.scripts.available ? 'available' : 'missing'}">
                            ${scriptsStatus}
                        </div>
                        <div class="resource-details">
                            ${this.resourceStatus.scripts.details.available || 0}/${this.resourceStatus.scripts.details.total || 0} files available
                        </div>
                    </div>
                    
                    <div class="resource-item">
                        <div class="resource-name">AI Models</div>
                        <div class="resource-status ${this.resourceStatus.models.available ? 'available' : 'missing'}">
                            ${modelsStatus}
                        </div>
                        <div class="resource-details">
                            ${this.resourceStatus.models.details.available || 0}/${this.resourceStatus.models.details.total || 0} files available
                        </div>
                    </div>
                    
                    <div class="resource-item">
                        <div class="resource-name">Wikipedia Database</div>
                        <div class="resource-status ${this.resourceStatus.wikipedia.available ? 'available' : 'missing'}">
                            ${wikiStatus}
                        </div>
                        <div class="resource-details">
                            ${wikiArticles} articles available
                        </div>
                    </div>
                    
                    <div class="resource-summary">
                        <div class="summary-title">Overall Status</div>
                        <div class="summary-status ${this.isOffline ? 'available' : 'missing'}">
                            ${this.isOffline ? '✅ Fully Offline Ready' : '❌ Not Ready for Offline Use'}
                        </div>
                    </div>
                </div>
                <div class="resource-status-footer">
                    <button id="refreshResourceStatus" class="refresh-button">🔄 Refresh Status</button>
                    ${!this.isOffline ? '<button id="downloadMissingResources" class="download-button">📥 Download Missing Resources</button>' : ''}
                </div>
            </div>
        `;
        
        // Add styles
        this.addResourceStatusStyles();
        
        // Show the modal
        modalContainer.style.display = 'flex';
        
        // Add event listeners
        document.getElementById('closeResourceStatus').addEventListener('click', () => {
            modalContainer.style.display = 'none';
        });
        
        document.getElementById('refreshResourceStatus').addEventListener('click', async () => {
            await this.checkOfflineStatus();
            this.showResourceStatus();
        });
        
        const downloadBtn = document.getElementById('downloadMissingResources');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadResources();
            });
        }
    }

    addResourceStatusStyles() {
        if (document.getElementById('resourceStatusStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'resourceStatusStyles';
        style.textContent = `
            .resource-status-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }
            
            .resource-status-content {
                background-color: white;
                border-radius: 8px;
                width: 90%;
                max-width: 500px;
                max-height: 90%;
                overflow-y: auto;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            
            .resource-status-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                border-bottom: 1px solid #eee;
            }
            
            .resource-status-header h2 {
                margin: 0;
                font-size: 18px;
                color: #333;
            }
            
            .close-button {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            }
            
            .resource-status-body {
                padding: 20px;
            }
            
            .resource-item {
                margin-bottom: 15px;
                padding-bottom: 15px;
                border-bottom: 1px solid #eee;
            }
            
            .resource-name {
                font-weight: bold;
                margin-bottom: 5px;
            }
            
            .resource-status {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 14px;
                margin-bottom: 5px;
            }
            
            .resource-status.available {
                background-color: #d4edda;
                color: #155724;
            }
            
            .resource-status.missing {
                background-color: #f8d7da;
                color: #721c24;
            }
            
            .resource-details {
                font-size: 14px;
                color: #666;
            }
            
            .resource-summary {
                margin-top: 20px;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 4px;
            }
            
            .summary-title {
                font-weight: bold;
                margin-bottom: 5px;
            }
            
            .summary-status {
                font-size: 16px;
                font-weight: bold;
            }
            
            .resource-status-footer {
                padding: 15px 20px;
                border-top: 1px solid #eee;
                display: flex;
                justify-content: space-between;
            }
            
            .refresh-button, .download-button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }
            
            .refresh-button {
                background-color: #e2e6ea;
                color: #212529;
            }
            
            .download-button {
                background-color: #007bff;
                color: white;
            }
            
            @media (max-width: 576px) {
                .resource-status-content {
                    width: 95%;
                }
                
                .resource-status-footer {
                    flex-direction: column;
                    gap: 10px;
                }
                
                .refresh-button, .download-button {
                    width: 100%;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    showMessage(message, type = 'info') {
        let messageContainer = document.getElementById('appMessage');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'appMessage';
            messageContainer.className = 'app-message';
            document.body.appendChild(messageContainer);
        }

        messageContainer.className = `app-message ${type}`;
        messageContainer.textContent = message;
        messageContainer.style.display = 'block';

        // Auto-hide after 3 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                messageContainer.style.display = 'none';
            }, 3000);
        }
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    initializeQueryLogger() {
        // Initialize the query logger
        if (typeof OfflineQueryLogger !== 'undefined') {
            this.queryLogger = new OfflineQueryLogger();
            console.log('✅ Query logger initialized');
        } else {
            console.warn('⚠️ OfflineQueryLogger not available');
        }
    }

    async searchWikipedia(query) {
        if (!this.wikipediaDB) {
            console.warn('Wikipedia database not available');
            return [];
        }

        // Log search start
        if (this.queryLogger) {
            this.queryLogger.logSearchStart(query);
        }

        try {
            // Initialize enhanced search if not already done
            if (!this.enhancedWikipediaSearch && typeof EnhancedWikipediaSearch !== 'undefined') {
                this.enhancedWikipediaSearch = new EnhancedWikipediaSearch(this.wikipediaDB);
            }

            let searchResults;
            
            if (this.enhancedWikipediaSearch) {
                // Use enhanced search with logging
                const result = await this.enhancedWikipediaSearch.enhancedSearch(query, 5);
                
                // Add logs to query logger
                if (this.queryLogger && result.status_log) {
                    this.queryLogger.addLogs(result.status_log);
                }
                
                searchResults = result.results || [];
            } else {
                // Fallback to basic search
                searchResults = await this.basicWikipediaSearch(query);
            }

            // Log search completion
            if (this.queryLogger) {
                this.queryLogger.logSearchComplete(searchResults.length);
            }

            return searchResults;

        } catch (error) {
            console.error('Wikipedia search failed:', error);
            
            // Log search error
            if (this.queryLogger) {
                this.queryLogger.logSearchError(error.message);
            }
            
            return [];
        }
    }

    async basicWikipediaSearch(query) {
        // Basic search implementation for fallback
        if (!this.wikipediaDB || !this.wikipediaDB.db) {
            return [];
        }

        try {
            const stmt = this.wikipediaDB.db.prepare(`
                SELECT title, content, snippet(wikipedia_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
                FROM wikipedia_fts 
                WHERE wikipedia_fts MATCH ?
                ORDER BY rank 
                LIMIT 5
            `);
            
            const results = [];
            stmt.bind([query.toLowerCase()]);
            
            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push({
                    title: row.title,
                    content: row.content,
                    snippet: row.snippet || row.content?.substring(0, 200) + '...',
                    url: `/offline/wikipedia/article/${encodeURIComponent(row.title)}`
                });
            }
            
            stmt.free();
            return results;
            
        } catch (error) {
            console.error('Basic Wikipedia search failed:', error);
            return [];
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.offlineApp = new OfflineAppEnhanced();
});
