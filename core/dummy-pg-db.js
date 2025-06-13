class DummyPgDb {
    constructor() {
        console.log("Using Dummy PostgreSQL DB for testing.");
    }

    async query(sql, params) {
        console.log(`Dummy DB Query: ${sql} with params: ${params}`);
        if (sql.includes("SELECT * FROM answers")) {
            return { rows: [] };
        }
        return { rows: [] };
    }

    async getAnswer(question, modelId) {
        return null; // Simulate no answer found
    }

    async saveAnswer(question, context, answer, model, model_name, confidence, timestamp, userId, personal_question_id, is_personal, prompt_version) {
        console.log("Dummy DB: Saving answer");
        return { id: Date.now(), question, answer, model, model_name, confidence, timestamp, userId, personal_question_id, is_personal, prompt_version };
    }

    async getHistory(questionText) {
        return [];
    }

    async deleteAnswer(id) {
        return { success: true };
    }

    async saveUserModelPreference(userId, modelId, isEnabled, displayOrder) {
        return { userId, modelId, isEnabled, displayOrder };
    }

    async getUserModelPreferences(userId) {
        return [];
    }

    async saveUserApiKey(userId, provider, apiKey) {
        return { userId, provider, apiKey };
    }

    async createPersonalQuestion(userId, question, context) {
        return { id: Date.now(), userId, question, context };
    }

    async getPersonalQuestions(userId) {
        return [];
    }

    async updatePersonalQuestion(id, userId, question, context) {
        return { id, userId, question, context };
    }

    async deletePersonalQuestion(id, userId) {
        return { success: true };
    }

    async getPersonalQuestionById(id, userId) {
        return null;
    }

    async getPersonalQuestionAnswers(id, userId) {
        return [];
    }
}

module.exports = DummyPgDb;


