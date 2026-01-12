const logger = require('./logger');
const axios = require("axios");
const AiInterface = require("./ai-interface");

class OllamaClient extends AiInterface {
    constructor(baseUrl = "http://localhost:11434") {
        super();
        this.baseUrl = baseUrl;
        this.available = false;
        this.checkAvailability();
    }

    async checkAvailability() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
            this.available = true;
            logger.info("✅ Ollama service is available");
            return true;
        } catch (error) {
            this.available = false;
            logger.info("⚠️ Ollama service not available:", error.message);
            return false;
        }
    }

    async generateResponse(model, prompt, context = "") {
        if (!this.available) {
            throw new Error("Ollama service is not available");
        }

        const fullPrompt = context ? `Context: ${context}\n\nQuestion: ${prompt}` : prompt;

        try {
            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: model,
                prompt: fullPrompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    top_k: 40,
                },
            }, { timeout: 120000 }); // 2 minute timeout

            return {
                answer: response.data.response,
                model: model,
                model_name: this.getModelDisplayName(model),
                confidence: 0.8, // Default confidence for local models
                tokens_used: response.data.eval_count || 0,
                response_time: response.data.total_duration ? Math.round(response.data.total_duration / 1000000) : 0,
            };
        } catch (error) {
            logger.error("Ollama generation error:", error.message);
            throw new Error(`Local AI model error: ${error.message}`);
        }
    }

    async listModels() {
        if (!this.available) {
            return { models: [] };
        }

        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`);
            return response.data;
        } catch (error) {
            logger.error("Error listing Ollama models:", error.message);
            return { models: [] };
        }
    }

    getModelDisplayName(model) {
        const modelNames = {
            "llama3.2:3b": "Llama 3.2 3B (Local)",
            "llama3.2:1b": "Llama 3.2 1B (Local)",
            "phi3:mini": "Phi-3 Mini (Local)",
            "phi3:medium": "Phi-3 Medium (Local)",
            "gemma:2b": "Gemma 2B (Local)",
            "gemma:7b": "Gemma 7B (Local)",
            "mistral:7b": "Mistral 7B (Local)",
            "codellama:7b": "CodeLlama 7B (Local)",
            "tinyllama": "TinyLlama (Local)",
            "qwen2:1.5b": "Qwen2 1.5B (Local)",
            "qwen2:7b": "Qwen2 7B (Local)",
        };
        return modelNames[model] || `${model} (Local)`;
    }

    async getRecommendedModels() {
        return [
            {
                name: "llama3.2:3b",
                displayName: "Llama 3.2 3B",
                size: "2GB",
                description: "Fast and efficient for general tasks",
                recommended: true,
                minRam: "4GB",
            },
            {
                name: "phi3:mini",
                displayName: "Phi-3 Mini",
                size: "2GB",
                description: "Microsoft's efficient model",
                recommended: true,
                minRam: "4GB",
            },
            {
                name: "gemma:2b",
                displayName: "Gemma 2B",
                size: "1.5GB",
                description: "Google's compact model",
                recommended: false,
                minRam: "3GB",
            },
            {
                name: "mistral:7b",
                displayName: "Mistral 7B",
                size: "4GB",
                description: "Higher quality responses",
                recommended: false,
                minRam: "8GB",
            },
            {
                name: "tinyllama",
                displayName: "TinyLlama",
                size: "1GB",
                description: "Ultra-lightweight for low-end hardware",
                recommended: false,
                minRam: "2GB",
            },
        ];
    }

    async pullModel(modelName) {
        if (!this.available) {
            throw new Error("Ollama service is not available");
        }

        try {
            const response = await axios.post(`${this.baseUrl}/api/pull`, {
                name: modelName,
            }, { timeout: 600000 }); // 10 minute timeout for model download

            return response.data;
        } catch (error) {
            logger.error("Error pulling Ollama model:", error.message);
            throw new Error(`Failed to download model: ${error.message}`);
        }
    }

    async deleteModel(modelName) {
        if (!this.available) {
            throw new Error("Ollama service is not available");
        }

        try {
            const response = await axios.delete(`${this.baseUrl}/api/delete`, {
                data: { name: modelName },
            });
            return response.data;
        } catch (error) {
            logger.error("Error deleting Ollama model:", error.message);
            throw new Error(`Failed to delete model: ${error.message}`);
        }
    }
}

module.exports = OllamaClient;


