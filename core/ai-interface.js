class AiInterface {
    constructor() {
        if (this.constructor === AiInterface) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }

    async generateResponse(model, prompt, context = '') {
        throw new Error("Method 'generateResponse()' must be implemented.");
    }

    async listModels() {
        throw new Error("Method 'listModels()' must be implemented.");
    }

    async getModelDisplayName(model) {
        throw new Error("Method 'getModelDisplayName()' must be implemented.");
    }

    async getRecommendedModels() {
        throw new Error("Method 'getRecommendedModels()' must be implemented.");
    }
}

module.exports = AiInterface;

