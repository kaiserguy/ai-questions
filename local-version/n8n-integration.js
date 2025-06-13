/**
 * Enhanced n8n Integration Module
 * 
 * This module provides integration with n8n for the local version of AI Questions.
 * It allows for workflow management, execution, and monitoring.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class N8nIntegration {
    constructor(baseUrl = 'http://localhost:5678', apiKey = '') {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.available = false;
        this.checkAvailability();
    }

    async checkAvailability() {
        try {
            const response = await axios.get(`${this.baseUrl}/healthz`, {
                timeout: 5000,
                headers: this.getHeaders()
            });
            this.available = response.status === 200;
            console.log('✅ n8n service is available');
            return true;
        } catch (error) {
            this.available = false;
            console.log('⚠️ n8n service not available:', error.message);
            return false;
        }
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.apiKey) {
            headers['X-N8N-API-KEY'] = this.apiKey;
        }
        
        return headers;
    }

    async getStatus() {
        if (!this.available) {
            return { status: 'unavailable', message: 'n8n service is not available' };
        }
        
        try {
            const response = await axios.get(`${this.baseUrl}/healthz`, {
                headers: this.getHeaders()
            });
            
            return {
                status: 'available',
                message: 'n8n service is available',
                version: response.data.version || 'unknown'
            };
        } catch (error) {
            console.error('Error getting n8n status:', error.message);
            return { status: 'error', message: error.message };
        }
    }

    async listWorkflows() {
        if (!this.available) {
            return { workflows: [] };
        }
        
        try {
            const response = await axios.get(`${this.baseUrl}/api/v1/workflows`, {
                headers: this.getHeaders()
            });
            
            return {
                workflows: response.data.data.map(workflow => ({
                    id: workflow.id,
                    name: workflow.name,
                    active: workflow.active,
                    createdAt: workflow.createdAt,
                    updatedAt: workflow.updatedAt
                }))
            };
        } catch (error) {
            console.error('Error listing n8n workflows:', error.message);
            return { workflows: [] };
        }
    }

    async getWorkflow(id) {
        if (!this.available) {
            return null;
        }
        
        try {
            const response = await axios.get(`${this.baseUrl}/api/v1/workflows/${id}`, {
                headers: this.getHeaders()
            });
            
            return response.data;
        } catch (error) {
            console.error(`Error getting n8n workflow ${id}:`, error.message);
            return null;
        }
    }

    async activateWorkflow(id) {
        if (!this.available) {
            return { success: false, message: 'n8n service is not available' };
        }
        
        try {
            const response = await axios.put(`${this.baseUrl}/api/v1/workflows/${id}/activate`, {}, {
                headers: this.getHeaders()
            });
            
            return {
                success: true,
                message: `Workflow ${id} activated successfully`
            };
        } catch (error) {
            console.error(`Error activating n8n workflow ${id}:`, error.message);
            return { success: false, message: error.message };
        }
    }

    async deactivateWorkflow(id) {
        if (!this.available) {
            return { success: false, message: 'n8n service is not available' };
        }
        
        try {
            const response = await axios.put(`${this.baseUrl}/api/v1/workflows/${id}/deactivate`, {}, {
                headers: this.getHeaders()
            });
            
            return {
                success: true,
                message: `Workflow ${id} deactivated successfully`
            };
        } catch (error) {
            console.error(`Error deactivating n8n workflow ${id}:`, error.message);
            return { success: false, message: error.message };
        }
    }

    async executeWorkflow(id, data = {}) {
        if (!this.available) {
            return { success: false, message: 'n8n service is not available' };
        }
        
        try {
            const response = await axios.post(`${this.baseUrl}/api/v1/workflows/${id}/execute`, {
                data
            }, {
                headers: this.getHeaders()
            });
            
            return {
                success: true,
                executionId: response.data.executionId,
                data: response.data.data
            };
        } catch (error) {
            console.error(`Error executing n8n workflow ${id}:`, error.message);
            return { success: false, message: error.message };
        }
    }

    async getExecutions(workflowId, limit = 20) {
        if (!this.available) {
            return { executions: [] };
        }
        
        try {
            const response = await axios.get(`${this.baseUrl}/api/v1/executions`, {
                params: {
                    workflowId,
                    limit
                },
                headers: this.getHeaders()
            });
            
            return {
                executions: response.data.data.map(execution => ({
                    id: execution.id,
                    finished: execution.finished,
                    mode: execution.mode,
                    startedAt: execution.startedAt,
                    stoppedAt: execution.stoppedAt,
                    status: execution.status
                }))
            };
        } catch (error) {
            console.error(`Error getting n8n executions for workflow ${workflowId}:`, error.message);
            return { executions: [] };
        }
    }

    async getExecution(id) {
        if (!this.available) {
            return null;
        }
        
        try {
            const response = await axios.get(`${this.baseUrl}/api/v1/executions/${id}`, {
                headers: this.getHeaders()
            });
            
            return response.data;
        } catch (error) {
            console.error(`Error getting n8n execution ${id}:`, error.message);
            return null;
        }
    }

    async importWorkflow(workflowData) {
        if (!this.available) {
            return { success: false, message: 'n8n service is not available' };
        }
        
        try {
            const response = await axios.post(`${this.baseUrl}/api/v1/workflows`, workflowData, {
                headers: this.getHeaders()
            });
            
            return {
                success: true,
                id: response.data.id,
                name: response.data.name
            };
        } catch (error) {
            console.error('Error importing n8n workflow:', error.message);
            return { success: false, message: error.message };
        }
    }

    async importWorkflowFromFile(filePath) {
        try {
            const workflowData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return await this.importWorkflow(workflowData);
        } catch (error) {
            console.error(`Error importing n8n workflow from file ${filePath}:`, error.message);
            return { success: false, message: error.message };
        }
    }

    async importDefaultWorkflows() {
        const workflowsDir = path.join(__dirname, 'n8n-agent', 'n8n-workflows');
        const results = [];
        
        try {
            const files = fs.readdirSync(workflowsDir).filter(file => file.endsWith('.json'));
            
            for (const file of files) {
                const filePath = path.join(workflowsDir, file);
                const result = await this.importWorkflowFromFile(filePath);
                results.push({
                    file,
                    ...result
                });
                
                // If workflow was imported successfully, activate it
                if (result.success && result.id) {
                    await this.activateWorkflow(result.id);
                }
            }
            
            return {
                success: true,
                imported: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results
            };
        } catch (error) {
            console.error('Error importing default n8n workflows:', error.message);
            return {
                success: false,
                message: error.message,
                results
            };
        }
    }

    async startN8nServer() {
        return new Promise((resolve, reject) => {
            const n8nProcess = spawn('n8n', ['start'], {
                detached: true,
                stdio: 'ignore'
            });
            
            n8nProcess.unref();
            
            // Wait for n8n to start
            let attempts = 0;
            const maxAttempts = 30;
            const checkInterval = setInterval(async () => {
                attempts++;
                try {
                    const response = await axios.get(`${this.baseUrl}/healthz`, {
                        timeout: 1000
                    });
                    
                    if (response.status === 200) {
                        clearInterval(checkInterval);
                        this.available = true;
                        resolve({ success: true, message: 'n8n server started successfully' });
                    }
                } catch (error) {
                    if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        reject(new Error('Failed to start n8n server after multiple attempts'));
                    }
                }
            }, 2000);
        });
    }
}

module.exports = N8nIntegration;

