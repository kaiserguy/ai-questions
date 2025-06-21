        // Query logging system for Wikipedia searches
        let queryLogs = [];
        let queryLogVisible = false;
        
        function addQueryLog(type, message, details = null) {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = {
                timestamp,
                type, // 'search', 'review', 'result', 'error'
                message,
                details
            };
            queryLogs.push(logEntry);
            
            // Update query log display if visible
            if (queryLogVisible) {
                updateQueryLogDisplay();
            }
            
            // Update query log indicator
            updateQueryLogIndicator();
        }
        
        function toggleQueryLog() {
            queryLogVisible = !queryLogVisible;
            const logContainer = document.getElementById('query-log-container');
            const toggleBtn = document.getElementById('query-log-toggle');
            
            if (queryLogVisible) {
                logContainer.style.display = 'block';
                toggleBtn.textContent = '🔍 Hide Query Logs';
                updateQueryLogDisplay();
            } else {
                logContainer.style.display = 'none';
                toggleBtn.textContent = '🔍 Show Query Logs';
            }
        }
        
        function updateQueryLogDisplay() {
            const logContent = document.getElementById('query-log-content');
            if (!logContent) return;
            
            if (queryLogs.length === 0) {
                logContent.innerHTML = '<div class="query-log-empty">No query logs yet. Start a conversation to see Wikipedia search details.</div>';
                return;
            }
            
            const logsHtml = queryLogs.map(log => {
                const typeClass = `query-log-${log.type}`;
                const detailsHtml = log.details ? `<div class="query-log-details">${JSON.stringify(log.details, null, 2)}</div>` : '';
                
                return `
                    <div class="query-log-entry ${typeClass}">
                        <div class="query-log-header">
                            <span class="query-log-time">${log.timestamp}</span>
                            <span class="query-log-type">${log.type.toUpperCase()}</span>
                        </div>
                        <div class="query-log-message">${log.message}</div>
                        ${detailsHtml}
                    </div>
                `;
            }).join('');
            
            logContent.innerHTML = logsHtml;
            
            // Auto-scroll to bottom
            logContent.scrollTop = logContent.scrollHeight;
        }
        
        function updateQueryLogIndicator() {
            const indicator = document.getElementById('query-log-indicator');
            if (indicator) {
                indicator.textContent = queryLogs.length > 0 ? `(${queryLogs.length})` : '';
            }
        }
        
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
            
            // Send to AI with enhanced logging
            fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    model: selectedModel,
                    context: contextMessages,
                    includeWikipedia: document.getElementById('chat-wikipedia-enabled').checked,
                    enableQueryLogging: true // Request detailed logging
                })
            })
            .then(response => response.json())
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

