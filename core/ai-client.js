const logger = require('./logger');
class LocalAiClient {
    constructor() {
        logger.info("Using Local AI Client for testing.");
    }

    async listModels(userId) {
        return { models: [{ id: "local-model", name: "Local AI Model" }] };
    }

    async generateResponse(modelId, question, context, userId) {
        return {
            answer: "This is a response from the local application. n8n and Ollama integrations are temporarily disabled for testing.",
            model: "local-model",
            model_name: "Local AI Model",
            confidence: 0.8,
        };
    }
}

module.exports = LocalAiClient;


