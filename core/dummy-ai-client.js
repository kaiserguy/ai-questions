class DummyAiClient {
    constructor() {
        console.log("Using Dummy AI Client for testing.");
    }

    async listModels(userId) {
        return { models: [{ id: "dummy-model", name: "Dummy AI Model" }] };
    }

    async generateResponse(modelId, question, context, userId) {
        return {
            answer: "This is a dummy answer from the local application. n8n and Ollama integrations are temporarily disabled for testing.",
            model: "dummy-model",
            model_name: "Dummy AI Model",
            confidence: 0.8,
        };
    }
}

module.exports = DummyAiClient;


