// AI Questions Offline Mode - Main Application
class OfflineApp {
    constructor() {
        this.isOfflineReady = false;
        this.selectedPackage = 'standard';
        this.downloadProgress = 0;
        this.aiModel = null;
        this.wikipediaDB = null;
        this.chatHistory = [];
        this.downloadManager = new DownloadManager('minimal');
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing AI Questions Offline Mode');
        
        try {
            // Initialize download manager
            await this.downloadManager.initialize();

            // Check browser capabilities
            const capabilitiesSupported = await this.checkCapabilities();
            if (!capabilitiesSupported) {
                console.error('Browser capabilities check failed');
                return;
            }

            // Set up event listeners
            this.setupEventListeners();

            // Check if already offline ready
            await this.checkOfflineStatus();
            
            console.log('✅ AI Questions Offline Mode initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize offline mode:', error);
            this.updateStatus('error', 'Initialization failed', 'Please refresh the page and try again.');
        }
    }

    async checkCapabilities() {
        const capabilities = {
            serviceWorker: 'serviceWorker' in navigator,
            indexedDB: 'indexedDB' in window,
            webAssembly: 'WebAssembly' in window,
            cacheAPI: 'caches' in window
        };

        console.log('Browser capabilities:', capabilities);

        const allSupported = Object.values(capabilities).every(Boolean);
        
        if (allSupported) {
            this.updateStatus('online', 'Browser supports offline mode', 'Your browser has all the required features for offline operation.');
        } else {
            this.updateStatus('error', 'Browser not supported', 'Your browser is missing required features for offline mode.');
            document.getElementById('downloadBtn').disabled = true;
        }

        return allSupported;
    }

    setupEventListeners() {
        // Package selection with both click and touch events for mobile
        document.querySelectorAll('.download-option').forEach(option => {
            const selectPackage = () => {
                document.querySelectorAll('.download-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.selectedPackage = option.dataset.package;
                this.updateDownloadButton();
                
                // Visual feedback for mobile
                option.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    option.style.transform = '';
                }, 150);
            };
            
            option.addEventListener('click', selectPackage);
            option.addEventListener('touchend', (e) => {
                e.preventDefault();
                selectPackage();
            });
        });

        // Download button with both click and touch events
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            const startDownloadHandler = (e) => {
                e.preventDefault();
                console.log('Download button clicked/tapped');
                
                // Visual feedback for mobile
                downloadBtn.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    downloadBtn.style.transform = '';
                }, 150);
                
                this.startDownload();
            };
            
            downloadBtn.addEventListener('click', startDownloadHandler);
            downloadBtn.addEventListener('touchend', startDownloadHandler);
        } else {
            console.error('Download button not found!');
        }

        // Chat functionality
        const sendBtn = document.getElementById('sendBtn');
        const chatInput = document.getElementById('chatInput');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
            sendBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }

    updateDownloadButton() {
        const btn = document.getElementById('downloadBtn');
        const packageNames = {
            minimal: 'Minimal Package',
            standard: 'Standard Package',
            full: 'Full Package'
        };
        btn.textContent = `Download ${packageNames[this.selectedPackage]}`;
    }

    updateStatus(type, text, description) {
        const dot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const statusDescription = document.getElementById('statusDescription');

        dot.className = `status-dot ${type}`;
        statusText.textContent = text;
        statusDescription.textContent = description;
    }

    async checkOfflineStatus() {
        try {
            // Check if service worker is registered and offline assets are cached
            const registration = await navigator.serviceWorker.getRegistration('/offline/');
            const hasCache = await caches.has('ai-questions-offline-v1');
            
            if (registration && hasCache) {
                // Check if AI model and Wikipedia are available
                const hasAIModel = await this.checkStoredModel();
                const hasWikipedia = await this.checkStoredWikipedia();
                
                if (hasAIModel && hasWikipedia) {
                    this.isOfflineReady = true;
                    this.updateStatus('offline', 'Offline mode ready', 'All components downloaded. You can use AI Questions without internet.');
                    this.showChatInterface();
                    return;
                }
            }
        } catch (error) {
            console.log('Offline check failed:', error);
        }

        this.updateStatus('online', 'Online mode', 'Download offline components to use without internet.');
    }

    async checkStoredModel() {
        try {
            const db = await this.openIndexedDB();
            const transaction = db.transaction(['models'], 'readonly');
            const store = transaction.objectStore('models');
            const result = await this.promisifyRequest(store.get('current-model'));
            return result !== undefined;
        } catch (error) {
            return false;
        }
    }

    async checkStoredWikipedia() {
        try {
            const db = await this.openIndexedDB();
            const transaction = db.transaction(['wikipedia'], 'readonly');
            const store = transaction.objectStore('wikipedia');
            const result = await this.promisifyRequest(store.get('database'));
            return result !== undefined;
        } catch (error) {
            return false;
        }
    }

    async startDownload() {
        console.log(`🚀 Starting download of ${this.selectedPackage} package`);
        
        // Show immediate feedback
        this.updateStatus('downloading', 'Starting download...', 'Preparing to download offline components');
        
        // Hide download section, show progress
        const downloadSection = document.getElementById('downloadSection');
        const progressSection = document.getElementById('progressSection');
        
        if (downloadSection && progressSection) {
            downloadSection.style.display = 'none';
            progressSection.style.display = 'block';
        } else {
            console.error('Could not find download or progress sections');
            return;
        }

        try {
            // Register service worker first
            await this.registerServiceWorker();

            // Use the download manager for progressive download
            await this.downloadManager.startPackageDownload(
                this.selectedPackage,
                (percent, text, details) => {
                    this.updateProgress(percent, text, details);
                }
            );

            // Initialize offline components
            await this.initializeOfflineComponents();

            // Show chat interface
            this.showChatInterface();
            this.updateStatus('offline', 'Offline mode ready', 'All components downloaded successfully!');
            
        } catch (error) {
            console.error('Download failed:', error);
            this.updateProgress(0, 'Download failed', 'Please try again or check your internet connection.');
            
            // Show download section again
            if (downloadSection && progressSection) {
                downloadSection.style.display = 'block';
                progressSection.style.display = 'none';
            }
            
            this.updateStatus('error', 'Download failed', error.message || 'Please try again.');
        }
    }

    async registerServiceWorker() {
        this.updateProgress(10, 'Registering service worker...', 'Setting up offline capabilities');
        
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.register('/offline/sw.js');
            console.log('Service worker registered:', registration);
            
            // Wait for service worker to be ready
            await navigator.serviceWorker.ready;
        }
    }

    async downloadPackage() {
        const packages = {
            minimal: {
                aiModel: 'tinybert',
                aiModelSize: 60,
                wikipediaSize: 20,
                totalSize: 200
            },
            standard: {
                aiModel: 'phi3-mini-q8',
                aiModelSize: 600,
                wikipediaSize: 50,
                totalSize: 800
            },
            full: {
                aiModel: 'phi3-mini-full',
                aiModelSize: 1500,
                wikipediaSize: 200,
                totalSize: 2000
            }
        };

        const packageConfig = packages[this.selectedPackage];
        let currentProgress = 20;

        // Download AI model
        this.updateProgress(currentProgress, 'Downloading AI model...', `Downloading ${packageConfig.aiModel} (${packageConfig.aiModelSize}MB)`);
        await this.downloadAIModel(packageConfig.aiModel, (progress) => {
            const modelProgress = (progress * 60) / 100; // AI model takes 60% of download
            this.updateProgress(currentProgress + modelProgress, 'Downloading AI model...', `${Math.round(progress)}% complete`);
        });

        currentProgress = 80;

        // Download Wikipedia database
        this.updateProgress(currentProgress, 'Downloading Wikipedia...', `Downloading Wikipedia database (${packageConfig.wikipediaSize}MB)`);
        await this.downloadWikipedia(this.selectedPackage, (progress) => {
            const wikiProgress = (progress * 15) / 100; // Wikipedia takes 15% of download
            this.updateProgress(currentProgress + wikiProgress, 'Downloading Wikipedia...', `${Math.round(progress)}% complete`);
        });

        currentProgress = 95;

        // Cache application assets
        this.updateProgress(currentProgress, 'Caching application...', 'Storing offline assets');
        await this.cacheApplicationAssets();

        this.updateProgress(100, 'Download complete!', 'All components ready for offline use');
    }

    async downloadAIModel(modelName, progressCallback) {
        // Simulate AI model download with chunked progress
        // In a real implementation, this would download ONNX models from CDN
        
        const chunks = 20;
        for (let i = 0; i <= chunks; i++) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
            progressCallback((i / chunks) * 100);
        }

        // Store model metadata in IndexedDB
        const db = await this.openIndexedDB();
        const transaction = db.transaction(['models'], 'readwrite');
        const store = transaction.objectStore('models');
        
        await this.promisifyRequest(store.put({
            id: 'current-model',
            name: modelName,
            downloadedAt: new Date(),
            size: this.getModelSize(modelName)
        }));

        console.log(`AI model ${modelName} downloaded and stored`);
    }

    async downloadWikipedia(packageType, progressCallback) {
        // Use the real Wikipedia manager
        await this.wikipediaManager.downloadWikipediaPackage(packageType, progressCallback);
        console.log(`Wikipedia database (${packageType}) downloaded and stored`);
    }

    async cacheApplicationAssets() {
        const cache = await caches.open('ai-questions-offline-v1');
        const urlsToCache = [
            '/offline/',
            '/offline/app.js',
            '/offline/sw.js',
            '/offline/manifest.json'
        ];

        await cache.addAll(urlsToCache);
        console.log('Application assets cached');
    }

    async initializeOfflineComponents() {
        this.updateProgress(100, 'Initializing AI model...', 'Loading components for offline use');
        
        // Initialize AI model (simulated)
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.aiModel = new MockAIModel();
        
        // Initialize Wikipedia search with real manager
        if (window.offlineApp && window.offlineApp.wikipediaManager) {
            this.wikipediaDB = window.offlineApp.wikipediaManager;
        } else {
            this.wikipediaDB = new MockWikipediaDB();
        }
        
        console.log('Offline components initialized');
    }

    showChatInterface() {
        document.getElementById('progressSection').style.display = 'none';
        document.getElementById('chatSection').style.display = 'block';
        this.isOfflineReady = true;
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message to chat
        this.addMessageToChat('user', message);
        input.value = '';
        
        // Show loading indicator
        const loadingId = this.addMessageToChat('ai', '<div class="loading"></div>');
        
        try {
            // Get AI response (simulated)
            const response = await this.getAIResponse(message);
            
            // Replace loading with actual response
            this.updateMessage(loadingId, response);
            
        } catch (error) {
            this.updateMessage(loadingId, 'Sorry, I encountered an error processing your message.');
            console.error('AI response error:', error);
        }
    }

    addMessageToChat(sender, content) {
        const chatContainer = document.getElementById('chatContainer');
        const messageDiv = document.createElement('div');
        const messageId = 'msg-' + Date.now();
        
        messageDiv.id = messageId;
        messageDiv.className = `message ${sender}`;
        messageDiv.innerHTML = sender === 'user' 
            ? `<strong>You:</strong> ${content}`
            : `<strong>AI Assistant:</strong> ${content}`;
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        return messageId;
    }

    updateMessage(messageId, content) {
        const messageDiv = document.getElementById(messageId);
        if (messageDiv) {
            messageDiv.innerHTML = `<strong>AI Assistant:</strong> ${content}`;
        }
    }

    async getAIResponse(message) {
        // Simulate AI processing time
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        // Search Wikipedia for relevant context
        const wikipediaContext = await this.searchWikipedia(message);
        
        // Generate response (simulated)
        const responses = [
            `That's an interesting question about "${message}". Based on my analysis, I can provide some insights.`,
            `I understand you're asking about "${message}". Let me think about this carefully.`,
            `Great question! Regarding "${message}", here's what I can tell you.`,
            `Thanks for asking about "${message}". This is a topic I can help with.`
        ];
        
        let response = responses[Math.floor(Math.random() * responses.length)];
        
        if (wikipediaContext) {
            response += `\n\n📚 From Wikipedia: ${wikipediaContext}`;
        }
        
        return response;
    }

    async searchWikipedia(query) {
        if (!this.wikipediaDB) return null;
        
        // Use real Wikipedia search
        const results = await this.wikipediaDB.search(query, 1);
        if (results.length > 0) {
            const article = results[0];
            return `${article.summary} [Read more: ${article.title}]`;
        }
        
        return null;
    }

    updateProgress(percent, text, details) {
        document.getElementById('progressFill').style.width = `${percent}%`;
        document.getElementById('progressText').textContent = text;
        document.getElementById('progressDetails').textContent = details;
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
                
                if (!db.objectStoreNames.contains('wikipedia')) {
                    db.createObjectStore('wikipedia', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('conversations')) {
                    db.createObjectStore('conversations', { keyPath: 'id', autoIncrement: true });
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

    getModelSize(modelName) {
        const sizes = {
            'tinybert': 60,
            'phi3-mini-q8': 600,
            'phi3-mini-full': 1500
        };
        return sizes[modelName] || 100;
    }

    getWikipediaArticleCount(packageType) {
        const counts = {
            'minimal': 10000,
            'standard': 50000,
            'full': 200000
        };
        return counts[packageType] || 10000;
    }
}

// Mock AI Model for demonstration
class MockAIModel {
    constructor() {
        console.log('Mock AI Model initialized');
    }
}

// Mock Wikipedia Database for demonstration
class MockWikipediaDB {
    constructor() {
        console.log('Mock Wikipedia Database initialized');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.offlineApp = new OfflineApp();
});

// Handle service worker updates
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_UPDATED') {
            console.log('Cache updated, new version available');
        }
    });
}

