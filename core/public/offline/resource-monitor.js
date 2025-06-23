/**
 * Enhanced Error Handling and User Feedback for Offline Mode
 * Provides clear feedback when resources are missing or unavailable
 */

class OfflineResourceMonitor {
    constructor() {
        this.resources = {
            models: {
                available: false,
                items: []
            },
            wikipedia: {
                available: false,
                articleCount: 0
            },
            scripts: {
                available: false,
                loaded: []
            }
        };
        
        this.statusMessages = {
            success: [],
            warnings: [],
            errors: []
        };
        
        // Initialize
        this.init();
    }
    
    async init() {
        console.log('📊 Initializing Offline Resource Monitor');
        
        try {
            // Check for required scripts
            this.checkScripts();
            
            // Check for AI models
            await this.checkModels();
            
            // Check for Wikipedia database
            await this.checkWikipedia();
            
            console.log('✅ Resource monitoring initialized');
        } catch (error) {
            console.error('❌ Failed to initialize resource monitor:', error);
        }
    }
    
    checkScripts() {
        const requiredScripts = [
            'app-enhanced.js',
            'wikipedia.js'
        ];
        
        const loadedScripts = Array.from(document.querySelectorAll('script'))
            .map(script => {
                const src = script.src;
                const match = src.match(/\/([^\/]+)$/);
                return match ? match[1] : null;
            })
            .filter(Boolean);
        
        const missingScripts = requiredScripts.filter(script => 
            !loadedScripts.some(loaded => loaded.includes(script))
        );
        
        this.resources.scripts.loaded = loadedScripts;
        this.resources.scripts.available = missingScripts.length === 0;
        
        if (missingScripts.length > 0) {
            this.statusMessages.warnings.push(`Missing scripts: ${missingScripts.join(', ')}`);
        } else {
            this.statusMessages.success.push('All required scripts loaded');
        }
    }
    
    async checkModels() {
        try {
            // Check if LocalAI is available
            if (!window.localAI) {
                this.statusMessages.errors.push('LocalAI not available');
                return;
            }
            
            // Wait for backends to be detected
            await new Promise(resolve => {
                if (window.localAI.backends) {
                    resolve();
                } else {
                    window.localAI.on('backendsDetected', () => resolve());
                    // Use AbortController for proper timeout handling
                    const timeoutId = setTimeout(() => {
                        console.warn('Backend detection timeout after 2 seconds');
                        resolve();
                    }, 2000);
                    window.localAI.on('backendsDetected', () => {
                        clearTimeout(timeoutId);
                        resolve();
                    });
                }
            });
            
            // Get available models
            const models = await window.localAI.getAvailableModels();
            
            this.resources.models.items = models;
            this.resources.models.available = models.length > 0;
            
            if (models.length === 0) {
                this.statusMessages.warnings.push('No AI models available');
            } else {
                this.statusMessages.success.push(`${models.length} AI models available`);
            }
            
            // Check for hardware acceleration
            const backends = window.localAI.backends;
            if (backends) {
                if (!backends.webgl && !backends.webgpu) {
                    this.statusMessages.warnings.push('Hardware acceleration not available, AI performance may be limited');
                } else {
                    this.statusMessages.success.push(`Hardware acceleration available: ${backends.webgpu ? 'WebGPU' : 'WebGL'}`);
                }
            }
        } catch (error) {
            console.error('Error checking models:', error);
            this.statusMessages.errors.push(`Failed to check AI models: ${error.message}`);
        }
    }
    
    async checkWikipedia() {
        try {
            // Check if WikipediaManager is available
            if (!window.WikipediaManager) {
                this.statusMessages.errors.push('Wikipedia database not available');
                return;
            }
            
            // TODO: Check if Wikipedia database is initialized
            if (window.localWikipediaDB && window.localWikipediaDB.initialized) {
                const articleCount = window.localWikipediaDB.articles.size;
                
                this.resources.wikipedia.available = true;
                this.resources.wikipedia.articleCount = articleCount;
                
                this.statusMessages.success.push(`Wikipedia database available with ${articleCount} articles`);
            } else {
                // Try to initialize
                const wikiManager = new WikipediaManager('minimal'); // Default to minimal package
                const initialized = await wikiManager.initialize();
                
                if (initialized) {
                    // Get article count if possible
                    let articleCount = 0;
                    if (window.localWikipediaDB) {
                        articleCount = window.localWikipediaDB.articles.size;
                    }
                    
                    this.resources.wikipedia.available = true;
                    this.resources.wikipedia.articleCount = articleCount;
                    
                    this.statusMessages.success.push(`Wikipedia database initialized with ${articleCount} articles`);
                } else {
                    this.statusMessages.warnings.push('Wikipedia database initialization failed');
                }
            }
        } catch (error) {
            console.error('Error checking Wikipedia:', error);
            this.statusMessages.errors.push(`Failed to check Wikipedia database: ${error.message}`);
        }
    }
    
    getStatus() {
        return {
            resources: this.resources,
            messages: this.statusMessages,
            timestamp: new Date().toISOString()
        };
    }
    
    displayStatus() {
        // Create modal for displaying status
        const modal = document.createElement('div');
        modal.className = 'resource-status-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        modal.style.zIndex = '1000';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        
        const content = document.createElement('div');
        content.className = 'resource-status-content';
        content.style.backgroundColor = 'white';
        content.style.borderRadius = '12px';
        content.style.padding = '30px';
        content.style.maxWidth = '600px';
        content.style.width = '90%';
        content.style.maxHeight = '80vh';
        content.style.overflowY = 'auto';
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = '✕';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '10px';
        closeButton.style.right = '15px';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.fontSize = '20px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => modal.remove();
        
        // Add title
        const title = document.createElement('h2');
        title.textContent = 'Offline Resource Status';
        title.style.marginBottom = '20px';
        
        // Add status sections
        const sections = [
            {
                title: 'AI Models',
                status: this.resources.models.available ? '✅ Available' : '❌ Not Available',
                details: this.resources.models.items.map(model => 
                    `${model.name} (${model.size}): ${model.isLoaded ? 'Loaded' : 'Not Loaded'}`
                )
            },
            {
                title: 'Wikipedia Database',
                status: this.resources.wikipedia.available ? '✅ Available' : '❌ Not Available',
                details: [
                    `Articles: ${this.resources.wikipedia.articleCount}`
                ]
            },
            {
                title: 'Required Scripts',
                status: this.resources.scripts.available ? '✅ All Loaded' : '⚠️ Some Missing',
                details: this.resources.scripts.loaded.map(script => `✓ ${script}`)
            }
        ];
        
        sections.forEach(section => {
            const sectionDiv = document.createElement('div');
            sectionDiv.style.marginBottom = '20px';
            
            const sectionTitle = document.createElement('h3');
            sectionTitle.textContent = section.title;
            sectionTitle.style.marginBottom = '10px';
            
            const sectionStatus = document.createElement('div');
            sectionStatus.innerHTML = section.status;
            sectionStatus.style.marginBottom = '10px';
            sectionStatus.style.fontWeight = 'bold';
            
            const sectionDetails = document.createElement('ul');
            sectionDetails.style.marginLeft = '20px';
            
            section.details.forEach(detail => {
                const item = document.createElement('li');
                item.textContent = detail;
                sectionDetails.appendChild(item);
            });
            
            sectionDiv.appendChild(sectionTitle);
            sectionDiv.appendChild(sectionStatus);
            sectionDiv.appendChild(sectionDetails);
            
            content.appendChild(sectionDiv);
        });
        
        // Add messages section
        const messagesDiv = document.createElement('div');
        messagesDiv.style.marginTop = '20px';
        
        const messagesTitle = document.createElement('h3');
        messagesTitle.textContent = 'Status Messages';
        messagesTitle.style.marginBottom = '10px';
        
        messagesDiv.appendChild(messagesTitle);
        
        // Add success messages
        if (this.statusMessages.success.length > 0) {
            const successList = document.createElement('ul');
            successList.style.marginBottom = '10px';
            
            this.statusMessages.success.forEach(message => {
                const item = document.createElement('li');
                item.textContent = `✅ ${message}`;
                item.style.color = '#10b981';
                successList.appendChild(item);
            });
            
            messagesDiv.appendChild(successList);
        }
        
        // Add warning messages
        if (this.statusMessages.warnings.length > 0) {
            const warningList = document.createElement('ul');
            warningList.style.marginBottom = '10px';
            
            this.statusMessages.warnings.forEach(message => {
                const item = document.createElement('li');
                item.textContent = `⚠️ ${message}`;
                item.style.color = '#f59e0b';
                warningList.appendChild(item);
            });
            
            messagesDiv.appendChild(warningList);
        }
        
        // Add error messages
        if (this.statusMessages.errors.length > 0) {
            const errorList = document.createElement('ul');
            
            this.statusMessages.errors.forEach(message => {
                const item = document.createElement('li');
                item.textContent = `❌ ${message}`;
                item.style.color = '#ef4444';
                errorList.appendChild(item);
            });
            
            messagesDiv.appendChild(errorList);
        }
        
        content.appendChild(messagesDiv);
        
        // Add troubleshooting section
        const troubleshootingDiv = document.createElement('div');
        troubleshootingDiv.style.marginTop = '30px';
        troubleshootingDiv.style.padding = '15px';
        troubleshootingDiv.style.backgroundColor = '#f3f4f6';
        troubleshootingDiv.style.borderRadius = '8px';
        
        const troubleshootingTitle = document.createElement('h3');
        troubleshootingTitle.textContent = 'Troubleshooting';
        troubleshootingTitle.style.marginBottom = '10px';
        
        const troubleshootingText = document.createElement('p');
        troubleshootingText.innerHTML = `
            If you're experiencing issues with the offline mode:<br>
            1. Try refreshing the page<br>
            2. Clear your browser cache and reload<br>
            3. Re-download the offline package<br>
            4. Check your browser's console for detailed error messages<br>
            5. Ensure your browser supports WebAssembly and IndexedDB
        `;
        
        troubleshootingDiv.appendChild(troubleshootingTitle);
        troubleshootingDiv.appendChild(troubleshootingText);
        
        content.appendChild(troubleshootingDiv);
        
        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.textContent = `Last updated: ${new Date().toLocaleString()}`;
        timestamp.style.marginTop = '20px';
        timestamp.style.fontSize = '0.8rem';
        timestamp.style.color = '#6b7280';
        
        content.appendChild(timestamp);
        
        // Add close button to content
        content.appendChild(closeButton);
        
        // Add content to modal
        modal.appendChild(content);
        
        // Add modal to body
        document.body.appendChild(modal);
        
        // Add event listener to close on escape key
        const escapeHandler = (event) => {
            if (event.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        
        document.addEventListener('keydown', escapeHandler);
        
        // Add event listener to close on click outside
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    }
    
    showMissingResourceNotification(resourceType, resourceName) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'resource-notification';
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = 'white';
        notification.style.borderRadius = '8px';
        notification.style.padding = '15px 20px';
        notification.style.boxShadow = '0 10px 15px rgba(0, 0, 0, 0.1)';
        notification.style.zIndex = '999';
        notification.style.maxWidth = '350px';
        notification.style.display = 'flex';
        notification.style.alignItems = 'center';
        notification.style.gap = '15px';
        
        // Add icon
        const icon = document.createElement('div');
        icon.innerHTML = '⚠️';
        icon.style.fontSize = '24px';
        
        // Add content
        const content = document.createElement('div');
        
        const title = document.createElement('div');
        title.textContent = `Missing ${resourceType}`;
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '5px';
        
        const message = document.createElement('div');
        message.textContent = `The ${resourceName} is not available. Some features may not work properly.`;
        
        content.appendChild(title);
        content.appendChild(message);
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = '✕';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.fontSize = '16px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.marginLeft = 'auto';
        closeButton.onclick = () => notification.remove();
        
        // Assemble notification
        notification.appendChild(icon);
        notification.appendChild(content);
        notification.appendChild(closeButton);
        
        // Add to body
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s ease';
            
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 5000);
    }
}

// Initialize when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create global instance
    window.resourceMonitor = new OfflineResourceMonitor();
    
    // Add event listener to resource status button
    const resourceStatusBtn = document.getElementById('resourceStatusBtn');
    if (resourceStatusBtn) {
        resourceStatusBtn.addEventListener('click', () => {
            if (window.resourceMonitor) {
                window.resourceMonitor.displayStatus();
            }
        });
    }
});
