/**
 * n8n AI Agent Integration for Local AI Questions
 * Provides seamless integration between the AI Questions app and n8n workflows
 */

class N8nAgentIntegration {
    constructor() {
        this.n8nBaseUrl = process.env.N8N_BASE_URL || 'http://localhost:5678';
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
                requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            }
        };

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
            console.error('AI Agent processing failed:', error);
            
            // Fallback to local processing if agent fails
            return this.fallbackToLocal(question, context, preferences, error);
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
                requestId: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
            console.error('Task automation failed:', error);
            return {
                success: false,
                error: error.message,
                taskType: taskType,
                fallback: true
            };
        }
    }

    /**
     * Fallback to local processing when agent is unavailable
     */
    async fallbackToLocal(question, context, preferences, originalError) {
        console.log('Falling back to local processing...');
        
        // Use the existing local Wikipedia integration
        const wikipedia = require('./wikipedia_api');
        
        try {
            // Search Wikipedia for context
            const wikipediaResults = await wikipedia.search({
                query: question,
                limit: 2
            });

            let wikipediaContext = '';
            if (wikipediaResults.results && wikipediaResults.results.length > 0) {
                wikipediaContext = wikipediaResults.results.map(result => 
                    `**${result.title}**: ${result.summary || result.content?.substring(0, 200) || ''}`
                ).join('\n\n');
            }

            // Use local Ollama for response generation
            const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: preferences.model || 'mistral:7b',
                    prompt: `Question: ${question}\n\n${context ? `Context: ${context}\n\n` : ''}${wikipediaContext ? `Wikipedia Information:\n${wikipediaContext}\n\n` : ''}Please provide a comprehensive answer:`,
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
                    mode: 'local_fallback',
                    model: preferences.model || 'mistral:7b',
                    hasWikipediaContext: wikipediaContext.length > 0,
                    originalError: originalError.message,
                    timestamp: new Date().toISOString()
                },
                sources: wikipediaResults.results || [],
                integration: {
                    source: 'local-fallback',
                    mode: 'offline',
                    endpoint: 'local-ollama'
                }
            };
        } catch (fallbackError) {
            console.error('Local fallback also failed:', fallbackError);
            
            return {
                success: false,
                error: 'Both AI agent and local fallback failed',
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
        console.log('Initializing n8n AI Agent Integration...');
        
        const status = await this.getAgentStatus();
        console.log('AI Agent Status:', status);
        
        return status;
    }
}

module.exports = N8nAgentIntegration;

