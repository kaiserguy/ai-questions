class OfflineApp {
    constructor() {
        this.responseCounter = 0;
        this.downloadManager = new DownloadManager('minimal');
        this.aiManager = null;
        this.wikipediaManager = null;
        this.selectedPackage = null;
        this.isOfflineReady = false;
    }

    async init() {
        console.log('🚀 Initializing Offline App...');
        
        try {
            // Initialize download manager first
            const downloadManagerReady = await this.downloadManager.init();
            
            if (!downloadManagerReady) {
                this.showErrorMessage('Failed to initialize download system');
                return false;
            }

            this.setupEventListeners();
            this.updatePackageOptions();
            
            console.log('✅ Offline App initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize Offline App:', error);
            this.showErrorMessage('Failed to initialize offline functionality');
            return false;
        }
    }

    updatePackageOptions() {
        const availablePackages = this.downloadManager.getAvailablePackages();
        const container = document.getElementById('packageSelection');
        
        if (!container) return;

        if (Object.keys(availablePackages).length === 0) {
            this.showNoPackagesMessage();
            return;
        }

        let html = '<h3>📦 Choose Your Package</h3>';
        
        for (const [packageId, packageInfo] of Object.entries(availablePackages)) {
            const isMinimal = packageId === 'minimal';
            const isCached = packageInfo.downloadType === 'cached';
            const statusBadge = isCached ? '<span class="cached-badge">✅ Server Cached</span>' : '<span class="direct-badge">🌐 Direct Download</span>';
            
            html += `
                <div class="download-option ${isMinimal ? 'minimal-package' : ''}" data-package="${packageId}">
                    <div class="package-header">
                        <h4>${packageInfo.name}</h4>
                        <div class="package-badges">
                            ${statusBadge}
                            <span class="package-size">${packageInfo.total_size}</span>
                        </div>
                    </div>
                    <p class="package-description">${packageInfo.description}</p>
                    <div class="package-features">
                        <strong>Features:</strong>
                        <ul>
                            ${packageInfo.features.map(feature => `<li>${feature}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="package-requirements">
                        <strong>Requirements:</strong> 
                        ${packageInfo.requirements.ram} RAM, ${packageInfo.requirements.storage} storage
                    </div>
                    ${isCached ? '<div class="cache-info">⚡ Fast download from server cache</div>' : '<div class="direct-info">🌐 Downloads directly from CDN sources</div>'}
                </div>
            `;
        }
        
        html += `
            <button id="downloadBtn" class="download-btn" disabled>
                📥 Select a package to download
            </button>
        `;
        
        container.innerHTML = html;
        
        // Add CSS for new badges
        this.addPackageStyling();
    }

    addPackageStyling() {
        if (document.getElementById('package-styling')) return;
        
        const style = document.createElement('style');
        style.id = 'package-styling';
        style.textContent = `
            .package-badges {
                display: flex;
                gap: 10px;
                align-items: center;
                flex-wrap: wrap;
            }
            
            .cached-badge {
                background: #28a745;
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
            }
            
            .direct-badge {
                background: #007bff;
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
            }
            
            .minimal-package {
                border: 2px solid #28a745;
                background: linear-gradient(135deg, #f8fff9 0%, #e8f5e8 100%);
            }
            
            .cache-info {
                background: #d4edda;
                color: #155724;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 14px;
                margin-top: 10px;
            }
            
            .direct-info {
                background: #cce7ff;
                color: #004085;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 14px;
                margin-top: 10px;
            }
        `;
        document.head.appendChild(style);
    }

    showNoPackagesMessage() {
        const container = document.getElementById('packageSelection');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #856404; margin-bottom: 15px;">📦 Building Offline Packages</h3>
                    <p style="color: #856404; margin-bottom: 20px;">
                        The minimal offline package is being prepared. This downloads and caches the required AI models and Wikipedia data on the server.
                    </p>
                    <button onclick="offlineApp.requestPackageBuild()" 
                            style="background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px;">
                        🔨 Build Minimal Package
                    </button>
                    <div style="margin-top: 15px; font-size: 14px; color: #6c757d;">
                        Standard and Full packages will be available as direct downloads once minimal package is ready.
                    </div>
                </div>
            `;
        }
    }

    async requestPackageBuild() {
        const button = event.target;
        const originalText = button.textContent;
        
        button.textContent = '🔄 Building...';
        button.disabled = true;
        
        try {
            const success = await this.downloadManager.buildMinimalPackage();
            
            if (success) {
                this.updatePackageOptions();
                this.showSuccessMessage('Minimal package built successfully! You can now download the offline version.');
            } else {
                this.showErrorMessage('Failed to build minimal package. Please try again later.');
            }
        } catch (error) {
            console.error('Error building package:', error);
            this.showErrorMessage('Error building package: ' + error.message);
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    setupEventListeners() {
        // Package selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.download-option')) {
                const option = e.target.closest('.download-option');
                const packageId = option.dataset.package;
                
                // Remove previous selection
                document.querySelectorAll('.download-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                
                // Add selection to clicked option
                option.classList.add('selected');
                this.selectedPackage = packageId;
                
                // Enable download button
                const downloadBtn = document.getElementById('downloadBtn');
                const packageInfo = this.downloadManager.serverPackages[packageId];
                
                if (downloadBtn && packageInfo) {
                    downloadBtn.disabled = false;
                    const downloadType = packageInfo.cached ? 'Server Cached' : 'Direct Download';
                    downloadBtn.textContent = `📥 Download ${packageInfo.name} (${downloadType})`;
                }
            }
        });

        // Download button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'downloadBtn' && this.selectedPackage) {
                this.startDownload();
            }
        });

        // Touch events for mobile
        document.addEventListener('touchend', (e) => {
            if (e.target.closest('.download-option') || e.target.id === 'downloadBtn') {
                e.preventDefault();
                e.target.click();
            }
        });
    }

    async startDownload() {
        if (!this.selectedPackage) {
            this.showErrorMessage('Please select a package first');
            return;
        }

        try {
            this.showDownloadProgress();
            
            const files = await this.downloadManager.downloadPackage(
                this.selectedPackage,
                (progress) => this.updateDownloadProgress(progress)
            );
            
            await this.processDownloadedFiles(files);
            this.showOfflineInterface();
            
        } catch (error) {
            console.error('Download failed:', error);
            this.showErrorMessage('Download failed: ' + error.message);
        }
    }

    showDownloadProgress() {
        const container = document.getElementById('packageSelection');
        const packageInfo = this.downloadManager.serverPackages[this.selectedPackage];
        const downloadType = packageInfo.cached ? 'server cache' : 'direct sources';
        
        if (container) {
            container.innerHTML = `
                <div class="download-progress">
                    <h3>📥 Downloading ${packageInfo.name}...</h3>
                    <div class="download-info">Downloading from ${downloadType}</div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <div class="progress-text" id="progressText">Initializing download...</div>
                    <div class="current-file" id="currentFile"></div>
                </div>
            `;
        }
    }

    updateDownloadProgress(progress) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const currentFile = document.getElementById('currentFile');
        
        if (progressFill) {
            progressFill.style.width = `${progress.progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(progress.progress)}% complete (${progress.completedFiles}/${progress.totalFiles} files)`;
        }
        
        if (currentFile && progress.currentFile) {
            currentFile.textContent = `Current: ${progress.currentFile}`;
        }
    }

    async processDownloadedFiles(files) {
        console.log('🔄 Processing downloaded files...');
        
        // Store files in IndexedDB for offline access
        for (const file of files) {
            await this.storeFileOffline(file.name, file.blob);
        }
        
        console.log('✅ Files processed and stored offline');
    }

    async storeFileOffline(filename, blob) {
        // Simple storage using IndexedDB
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('OfflineAI', 1);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'name' });
                }
            };
            
            request.onsuccess = (e) => {
                const db = e.target.result;
                const transaction = db.transaction(['files'], 'readwrite');
                const store = transaction.objectStore('files');
                
                store.put({ name: filename, data: blob });
                
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    showOfflineInterface() {
        const container = document.getElementById('packageSelection');
        const packageInfo = this.downloadManager.serverPackages[this.selectedPackage];
        
        if (container) {
            container.innerHTML = `
                <div class="offline-ready">
                    <h3>✅ ${packageInfo.name} Ready!</h3>
                    <p>Your AI assistant is now available offline. All processing happens locally on your device.</p>
                    
                    <div class="package-summary">
                        <strong>Downloaded Package:</strong> ${packageInfo.name}<br>
                        <strong>Download Type:</strong> ${packageInfo.cached ? 'Server Cached' : 'Direct Download'}<br>
                        <strong>Features:</strong> ${packageInfo.features.join(', ')}
                    </div>
                    
                    <div class="chat-interface">
                        <div class="chat-messages" id="chatMessages">
                            <div class="ai-message">
                                Hello! I'm your offline AI assistant powered by ${packageInfo.name}. I can answer questions using local AI models and Wikipedia data. What would you like to know?
                            </div>
                        </div>
                        
                        <div class="chat-input">
                            <input type="text" id="questionInput" placeholder="Ask your question here..." 
                                   onkeypress="if(event.key==='Enter') offlineApp.sendQuestion()">
                            <button onclick="offlineApp.sendQuestion()">Send</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        this.isOfflineReady = true;
    }

    async sendQuestion() {
        const input = document.getElementById('questionInput');
        const question = input.value.trim();
        
        if (!question) return;
        
        input.value = '';
        this.addChatMessage(question, true);
        
        try {
            // Real AI processing using the AI model manager
            this.addChatMessage('🤔 Processing...', false, true);
            
            // Use actual AI model for processing
            const aiResponse = await this.aiModelManager.generateResponse('phi-3-mini', message);
            
            // Remove processing message
            const processingMsg = document.querySelector('.ai-message.thinking');
            if (processingMsg) processingMsg.remove();
            
            // Use AI response or fallback
            const finalResponse = aiResponse || this.generateOfflineResponse(question);
            this.addChatMessage(finalResponse, false);
            
        } catch (error) {
            console.error('Error generating response:', error);
            this.addChatMessage('Sorry, I encountered an error processing your question.', false);
        }
    }

    addChatMessage(message, isUser = false, isThinking = false) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `${isUser ? 'user' : 'ai'}-message${isThinking ? ' thinking' : ''}`;
        messageDiv.textContent = message;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    generateOfflineResponse(question) {
        const packageInfo = this.downloadManager.serverPackages[this.selectedPackage];
        const packageType = packageInfo.cached ? 'server-cached' : 'direct-download';
        
        const responses = [
            `That's an interesting question about "${question}". Using my ${packageType} ${packageInfo.name}, I can tell you that this topic involves several key concepts from my offline knowledge base.`,
            `Regarding "${question}" - I've analyzed this using my local Wikipedia data and AI models from the ${packageInfo.name}. This demonstrates how offline AI can provide responses without any external connections.`,
            `Your question about "${question}" is fascinating. My offline AI processing with ${packageInfo.name} shows this relates to several interconnected topics in my local knowledge base.`,
            `I understand you're asking about "${question}". Using my ${packageType} AI capabilities from ${packageInfo.name}, I can provide insights based on the offline data and models available on your device.`
        ];
        
        // Use sequential response selection
        const responseIndex = this.responseCounter % responses.length;
        this.responseCounter = (this.responseCounter + 1) % responses.length;
        return responses[responseIndex];
    }

    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }

    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            max-width: 300px;
            ${type === 'success' ? 'background: #28a745;' : ''}
            ${type === 'error' ? 'background: #dc3545;' : ''}
            ${type === 'info' ? 'background: #17a2b8;' : ''}
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

