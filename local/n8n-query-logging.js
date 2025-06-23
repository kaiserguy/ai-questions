/**
 * Modified query-logging.js to use n8n Chat Integration
 * Handles client-side chat interactions and query logging
 */

// Import the n8n Chat Integration
const n8nChatIntegration = require('./n8n-chat-integration');

document.addEventListener('DOMContentLoaded', function() {
    // Initialize n8n Chat Integration
    n8nChatIntegration.initialize();
    
    // ID counter for generating unique message IDs
    let idCounter = 0;
    
    function generateId() {
        idCounter = (idCounter + 1) % 100000;
        return idCounter.toString(36).padStart(5, '0');
    }
    
    // Chat context for conversation history
    let chatContext = [];
    
    // Query logs for tracking Wikipedia searches and other operations
    let queryLogs = [];
    
    // Initialize chat UI
    function initChat() {
        const chatContainer = document.getElementById('chat-container');
        if (!chatContainer) return;
        
        // Set up event listeners
        const sendBtn = document.getElementById('chat-send-btn');
        const input = document.getElementById('chat-input');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', sendChatMessageWithLogging);
        }
        
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    sendChatMessageWithLogging();
                }
            });
        }
        
        // Set up query log toggle
        const logToggle = document.getElementById('query-log-toggle');
        if (logToggle) {
            logToggle.addEventListener('click', toggleQueryLog);
        }
        
        // Set up clear log button
        const clearLogBtn = document.getElementById('clear-query-log');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', clearQueryLogs);
        }
    }
    
    // Add a message to the chat UI
    function addChatMessage(role, content, isTyping = false, wikipediaLinks = []) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        
        const messageId = `msg-${Date.now()}-${generateId()}`;
        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = `chat-message ${role}-message`;
        
        // Format content with markdown if not typing indicator
        if (!isTyping) {
            // Process markdown (simple version)
            content = content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br>');
        }
        
        messageDiv.innerHTML = `
            <div class="message-avatar ${role}-avatar"></div>
            <div class="message-content">
                <div class="message-text">${content}</div>
                ${wikipediaLinks && wikipediaLinks.length > 0 ? 
                    `<div class="wikipedia-links">
                        <div class="wikipedia-links-header">Wikipedia References:</div>
                        <ul>
                            ${wikipediaLinks.map(link => 
                                `<li><a href="${link.url}" class="wikipedia-link" data-article-id="${link.url.split('/').pop()}">${link.title}</a></li>`
                            ).join('')}
                        </ul>
                    </div>` : ''
                }
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Add click event listeners to Wikipedia links
        if (wikipediaLinks && wikipediaLinks.length > 0) {
            const linkElements = messageDiv.querySelectorAll('.wikipedia-link');
            linkElements.forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const articleId = this.getAttribute('data-article-id');
                    if (articleId) {
                        showWikipediaArticle(articleId);
                    }
                });
            });
        }
        
        return messageId;
    }
    
    // Show Wikipedia article in a modal
    async function showWikipediaArticle(articleId) {
        // Add query log
        addQueryLog('info', `Fetching Wikipedia article: ${articleId}`);
        
        try {
            // Use n8n integration to fetch article
            const articleData = await n8nChatIntegration.getWikipediaArticle(articleId);
            
            if (!articleData.success || !articleData.article) {
                showNotification('Error', 'Failed to load Wikipedia article', 'error');
                addQueryLog('error', `Failed to load Wikipedia article: ${articleId}`);
                return;
            }
            
            const article = articleData.article;
            
            // Create modal for article
            const modal = document.createElement('div');
            modal.className = 'wikipedia-modal';
            
            // Format article content
            let articleContent = '';
            
            // Add infobox if available
            if (article.infobox) {
                articleContent += '<div class="wikipedia-infobox">';
                for (const [key, value] of Object.entries(article.infobox)) {
                    articleContent += `<div class="infobox-row">
                        <div class="infobox-key">${key}</div>
                        <div class="infobox-value">${value}</div>
                    </div>`;
                }
                articleContent += '</div>';
            }
            
            // Add main content
            articleContent += `<div class="wikipedia-content">${article.content}</div>`;
            
            // Add sections
            if (article.sections && article.sections.length > 0) {
                article.sections.forEach(section => {
                    const headingLevel = Math.min(Math.max(section.level, 1), 6);
                    articleContent += `
                        <h${headingLevel} class="wikipedia-section-heading">${section.title}</h${headingLevel}>
                        <div class="wikipedia-section-content">${section.content}</div>
                    `;
                });
            }
            
            // Add links to other articles
            if (article.links && article.links.length > 0) {
                articleContent += '<div class="wikipedia-related-links">';
                articleContent += '<h3>Related Articles</h3>';
                articleContent += '<ul>';
                article.links.slice(0, 10).forEach(link => {
                    articleContent += `<li><a href="#" class="wikipedia-link" data-article-id="${link.id}">${link.title}</a></li>`;
                });
                articleContent += '</ul></div>';
            }
            
            // Create modal content
            modal.innerHTML = `
                <div class="wikipedia-modal-content">
                    <div class="wikipedia-modal-header">
                        <h2>${article.title}</h2>
                        <span class="wikipedia-modal-close">&times;</span>
                    </div>
                    <div class="wikipedia-modal-body">
                        ${articleContent}
                    </div>
                </div>
            `;
            
            // Add modal to document
            document.body.appendChild(modal);
            
            // Add close functionality
            const closeBtn = modal.querySelector('.wikipedia-modal-close');
            closeBtn.addEventListener('click', function() {
                modal.remove();
            });
            
            // Add click event listeners to Wikipedia links in the article
            const linkElements = modal.querySelectorAll('.wikipedia-link');
            linkElements.forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const newArticleId = this.getAttribute('data-article-id');
                    if (newArticleId) {
                        modal.remove();
                        showWikipediaArticle(newArticleId);
                    }
                });
            });
            
            // Add query log
            addQueryLog('info', `Displayed Wikipedia article: ${article.title}`);
            
        } catch (error) {
            console.error('Error fetching Wikipedia article:', error);
            showNotification('Error', 'Failed to load Wikipedia article', 'error');
            addQueryLog('error', `Error fetching Wikipedia article: ${error.message}`);
        }
    }
    
    // Add a log entry to the query log
    function addQueryLog(type, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        queryLogs.push({ type, message, timestamp, metadata });
        updateQueryLogDisplay();
        updateQueryLogIndicator();
    }
    
    // Update the query log display
    function updateQueryLogDisplay() {
        const logContainer = document.getElementById('query-log-content');
        if (!logContainer) return;
        
        logContainer.innerHTML = '';
        
        if (queryLogs.length === 0) {
            logContainer.innerHTML = '<div class="empty-log">No logs yet</div>';
            return;
        }
        
        queryLogs.forEach(log => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry log-${log.type}`;
            
            const icon = getLogTypeIcon(log.type);
            
            logEntry.innerHTML = `
                <div class="log-icon">${icon}</div>
                <div class="log-message">${log.message}</div>
                <div class="log-time">${formatTime(log.timestamp)}</div>
            `;
            
            logContainer.appendChild(logEntry);
        });
        
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    // Update the query log indicator
    function updateQueryLogIndicator() {
        const indicator = document.getElementById('query-log-indicator');
        if (!indicator) return;
        
        if (queryLogs.length > 0) {
            indicator.textContent = queryLogs.length;
            indicator.style.display = 'flex';
        } else {
            indicator.style.display = 'none';
        }
    }
    
    // Toggle the query log visibility
    function toggleQueryLog() {
        const logPanel = document.getElementById('query-log-panel');
        if (!logPanel) return;
        
        const isVisible = logPanel.classList.contains('visible');
        
        if (isVisible) {
            logPanel.classList.remove('visible');
        } else {
            logPanel.classList.add('visible');
            updateQueryLogDisplay();
        }
    }
    
    // Clear all query logs
    function clearQueryLogs() {
        queryLogs = [];
        updateQueryLogDisplay();
        updateQueryLogIndicator();
    }
    
    // Enhanced sendChatMessage with query logging
    function sendChatMessageWithLogging() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        const modelSelect = document.getElementById('chat-model-select');
        const selectedModel = modelSelect.value;
        
        if (!message) return;
        if (!selectedModel) {
            showNotification('No Model Selected', 'Please select an AI model first.', 'error');
            return;
        }
        
        // Clear input
        input.value = '';
        
        // Add user message to chat
        addChatMessage('user', message);
        
        // Log the start of the query
        addQueryLog('search', `Starting search for: "${message}"`);
        
        // Show typing indicator
        const typingId = addChatMessage('assistant', '⏳ Thinking...', true);
        
        // Disable send button
        const sendBtn = document.getElementById('chat-send-btn');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';
        
        // Prepare context if enabled
        const useContext = document.getElementById('chat-context-enabled').checked;
        const contextMessages = useContext ? chatContext.slice(-6) : []; // Last 3 exchanges
        
        // Send to AI using n8n integration
        n8nChatIntegration.sendChatMessage({
            message: message,
            model: selectedModel,
            context: contextMessages,
            includeWikipedia: document.getElementById('chat-wikipedia-enabled').checked,
            enableQueryLogging: true // Request detailed logging
        })
        .then(data => {
            // Remove typing indicator
            document.getElementById(typingId).remove();
            
            if (data.success) {
                // Log Wikipedia search details if available
                if (data.wikipediaSearchLog) {
                    data.wikipediaSearchLog.forEach(logEntry => {
                        addQueryLog('search', logEntry);
                    });
                }
                
                // Log the final result
                addQueryLog('result', `Response generated using model: ${selectedModel}`, {
                    model: selectedModel,
                    hasWikipediaLinks: data.wikipediaLinks && data.wikipediaLinks.length > 0,
                    wikipediaLinksCount: data.wikipediaLinks ? data.wikipediaLinks.length : 0
                });
                
                // Add AI response
                addChatMessage('assistant', data.response, false, data.wikipediaLinks);
                
                // Update context
                if (useContext) {
                    chatContext.push({ role: 'user', content: message });
                    chatContext.push({ role: 'assistant', content: data.response });
                    
                    // Keep only last 10 messages
                    if (chatContext.length > 10) {
                        chatContext = chatContext.slice(-10);
                    }
                }
            } else {
                // Log error
                addQueryLog('error', `Error: ${data.error || 'Unknown error occurred'}`);
                
                // Add error message
                addChatMessage('assistant', `❌ Error: ${data.error || 'Something went wrong. Please try again.'}`, false);
            }
        })
        .catch(error => {
            console.error('Chat error:', error);
            
            // Log error
            addQueryLog('error', `Network error: ${error.message}`);
            
            // Remove typing indicator
            const typingElement = document.getElementById(typingId);
            if (typingElement) {
                typingElement.remove();
            }
            
            // Add error message
            addChatMessage('assistant', '❌ Network error. Please check your connection and try again.', false);
        })
        .finally(() => {
            // Re-enable send button
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
        });
    }
    
    // Helper function to get icon for log type
    function getLogTypeIcon(type) {
        switch (type) {
            case 'search': return '🔍';
            case 'info': return 'ℹ️';
            case 'result': return '✅';
            case 'error': return '❌';
            default: return '📝';
        }
    }
    
    // Helper function to format timestamp
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    }
    
    // Show notification
    function showNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('notification-hide');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
    }
    
    // Initialize chat when DOM is loaded
    initChat();
    
    // Export functions for external use
    window.chatFunctions = {
        sendChatMessage: sendChatMessageWithLogging,
        addQueryLog,
        clearQueryLogs,
        toggleQueryLog
    };
});
