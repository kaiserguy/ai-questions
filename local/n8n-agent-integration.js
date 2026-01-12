const logger = require('../core/logger');
/**
 * n8n AI Agent Integration for Local AI Questions
 * Provides seamless integration between the AI Questions app and n8n workflows
 */

// Import the new Wikipedia parser for n8n integration
const WikipediaParserN8n = require('./wikipedia-parser-n8n');

class N8nAgentIntegration {
    constructor() {
        this.idCounter = 0;
        this.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
        this.agentEndpoints = {
            offline: '/webhook/process-question',
            online: '/webhook/process-question-online',
            task: '/webhook/automate-task',
            connectivity: '/webhook/check-connectivity'
        };
        this.isOnline = false;
        this.lastConnectivityCheck = 0;
        this.connectivityCheckInterval = 30000; // 30 seconds
    }

    /**
     * Check if the system is online and n8n is available
     */
    async checkConnectivity() {
        const now = Date.now();
        if (now - this.lastConnectivityCheck < this.connectivityCheckInterval) {
            return this.isOnline;
        }

        try {
            const response = await fetch(`${this.n8nBaseUrl}/healthz`, {
                method: 'GET',
                timeout: 5000
            });
            
            if (response.ok) {
                // Check internet connectivity
                const internetCheck = await fetch('https://8.8.8.8', {
                    method: 'HEAD',
                    timeout: 3000
                }).catch(() => null);
                
                this.isOnline = !!internetCheck;
            } else {
                this.isOnline = false;
            }
        } catch (error) {
            this.isOnline = false;
        }

        this.lastConnectivityCheck = now;
        return this.isOnline;
    }

    /**
     * Process a question using the AI agent
     */
    async processQuestion(question, context = '', preferences = {}) {
        try {
            // First check if n8n is available
            const isOnline = await this.checkConnectivity();
            
            const payload = {
                question: question,
                context: context,
                preferences: {
                    model: preferences.model || 'mistral:7b',
                    temperature: preferences.temperature || 0.7,
                    maxTokens: preferences.maxTokens || 800,
                    ...preferences
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    mode: isOnline ? 'online' : 'offline',
                    requestId: `req_${Date.now()}_${this.generateId()}`
                }
            };

            // Try to use n8n for processing
            try {
                const endpoint = isOnline ? this.agentEndpoints.online : this.agentEndpoints.offline;
                const response = await fetch(`${this.n8nBaseUrl}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-AI-Agent-Client': 'ai-questions-local'
                    },
                    body: JSON.stringify(payload),
                    timeout: 120000 // 2 minutes
                });

                if (!response.ok) {
                    throw new Error(`AI Agent request failed: ${response.status} ${response.statusText}`);
                }

                const result = await response.json();
                
                // Add integration metadata
                result.integration = {
                    source: 'n8n-ai-agent',
                    mode: isOnline ? 'online' : 'offline',
                    endpoint: endpoint,
                    processingTime: result.metadata?.processingTime || 0
                };

                return result;
            } catch (error) {
                logger.error('AI Agent processing failed:', error);
                
                // Fallback to direct Ollama processing
                return this.fallbackToDirectOllama(question, context, preferences, error);
            }
        } catch (error) {
            logger.error('Error in processQuestion:', error);
            return {
                success: false,
                error: 'Failed to process question: ' + error.message,
                response: 'I apologize, but I encountered an error while processing your question. Please try again later.'
            };
        }
    }

    /**
     * Automate a task using the AI agent
     */
    async automateTask(taskType, taskData, priority = 'normal') {
        const payload = {
            type: taskType,
            data: taskData,
            priority: priority,
            metadata: {
                timestamp: new Date().toISOString(),
                requestId: `task_${Date.now()}_${this.generateId()}`
            }
        };

        try {
            const response = await fetch(`${this.n8nBaseUrl}${this.agentEndpoints.task}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-AI-Agent-Client': 'ai-questions-local'
                },
                body: JSON.stringify(payload),
                timeout: 180000 // 3 minutes for complex tasks
            });

            if (!response.ok) {
                throw new Error(`Task automation failed: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            logger.error('Task automation failed:', error);
            return {
                success: false,
                error: error.message,
                taskType: taskType,
                fallback: true
            };
        }
    }

    /**
     * Fallback to direct Ollama processing when n8n agent is unavailable
     * This doesn't rely on the deprecated wikipedia_api module
     */
    async fallbackToDirectOllama(question, context, preferences, originalError) {
        logger.info('Falling back to direct Ollama processing...');
        
        try {
            // Use local Ollama for response generation without Wikipedia context
            // This is a simplified fallback that doesn't depend on the deprecated module
            const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: preferences.model || 'mistral:7b',
                    prompt: `Question: ${question}\n\n${context ? `Context: ${context}\n\n` : ''}Please provide a comprehensive answer based on your knowledge:`,
                    stream: false,
                    options: {
                        temperature: preferences.temperature || 0.7,
                        max_tokens: preferences.maxTokens || 800
                    }
                }),
                timeout: 60000
            });

            const ollamaResult = await ollamaResponse.json();

            return {
                success: true,
                response: ollamaResult.response || 'I apologize, but I was unable to generate a response.',
                metadata: {
                    mode: 'direct_ollama_fallback',
                    model: preferences.model || 'mistral:7b',
                    originalError: originalError.message,
                    timestamp: new Date().toISOString()
                },
                sources: [],
                integration: {
                    source: 'direct-ollama-fallback',
                    mode: 'offline',
                    endpoint: 'local-ollama'
                }
            };
        } catch (fallbackError) {
            logger.error('Direct Ollama fallback also failed:', fallbackError);
            
            return {
                success: false,
                error: 'Both AI agent and direct Ollama fallback failed',
                response: 'I apologize, but I encountered technical difficulties while processing your question. Please try again later.',
                details: {
                    agentError: originalError.message,
                    fallbackError: fallbackError.message
                },
                metadata: {
                    mode: 'failed',
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Get agent status and capabilities
     */
    async getAgentStatus() {
        const isOnline = await this.checkConnectivity();
        
        return {
            available: true, // Integration is always available
            n8nConnected: isOnline,
            internetConnected: this.isOnline,
            mode: isOnline ? 'online' : 'offline',
            capabilities: {
                offline: ['question-processing', 'wikipedia-search', 'local-ai'],
                online: ['web-search', 'cloud-ai', 'multi-source-synthesis', 'task-automation']
            },
            endpoints: this.agentEndpoints,
            lastConnectivityCheck: new Date(this.lastConnectivityCheck).toISOString()
        };
    }

    /**
     * Initialize the agent integration
     */
    async initialize() {
        logger.info('Initializing n8n AI Agent Integration...');
        
        try {
            const status = await this.getAgentStatus();
            logger.info('AI Agent Status:', status);
            return status;
        } catch (error) {
            logger.error('Error initializing n8n AI Agent Integration:', error);
            return {
                available: false,
                n8nConnected: false,
                internetConnected: false,
                mode: 'error',
                error: error.message
            };
        }
    }
    
    /**
     * Generate sequential ID for requests
     */
    generateId() {
        this.idCounter = (this.idCounter + 1) % 100000;
        return this.idCounter.toString(36).padStart(5, '0');
    }
}

module.exports = N8nAgentIntegration;
