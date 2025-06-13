class DatabaseInterface {
    constructor() {
        if (this.constructor === DatabaseInterface) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }

    async initialize() {
        throw new Error("Method 'initialize()' must be implemented.");
    }

    async getDailyQuestion(date) {
        throw new Error("Method 'getDailyQuestion()' must be implemented.");
    }

    async getAnswer(question, model) {
        throw new Error("Method 'getAnswer()' must be implemented.");
    }

    async saveAnswer(question, context, answer, model, modelName, confidence, date, userId, personalQuestionId, isPersonal, promptVersion) {
        throw new Error("Method 'saveAnswer()' must be implemented.");
    }

    async getHistory(question) {
        throw new Error("Method 'getHistory()' must be implemented.");
    }

    async deleteAnswer(id) {
        throw new Error("Method 'deleteAnswer()' must be implemented.");
    }

    async getUser(googleId) {
        throw new Error("Method 'getUser()' must be implemented.");
    }

    async createUser(googleId, email, name, avatarUrl) {
        throw new Error("Method 'createUser()' must be implemented.");
    }

    async getUserById(id) {
        throw new Error("Method 'getUserById()' must be implemented.");
    }
    
    async getPersonalQuestions(userId) {
        throw new Error("Method 'getPersonalQuestions()' must be implemented.");
    }

    async getPersonalQuestionById(questionId, userId) {
        throw new Error("Method 'getPersonalQuestionById()' must be implemented.");
    }

    async createPersonalQuestion(userId, question, context) {
        throw new Error("Method 'createPersonalQuestion()' must be implemented.");
    }

    async updatePersonalQuestion(questionId, userId, question, context) {
        throw new Error("Method 'updatePersonalQuestion()' must be implemented.");
    }

    async deletePersonalQuestion(questionId, userId) {
        throw new Error("Method 'deletePersonalQuestion()' must be implemented.");
    }

    async getPersonalQuestionAnswers(questionId, userId) {
        throw new Error("Method 'getPersonalQuestionAnswers()' must be implemented.");
    }

    async saveUserApiKey(userId, provider, apiKey) {
        throw new Error("Method 'saveUserApiKey()' must be implemented.");
    }

    async getUserApiKey(userId, provider) {
        throw new Error("Method 'getUserApiKey()' must be implemented.");
    }

    async getUserModelPreferences(userId) {
        throw new Error("Method 'getUserModelPreferences()' must be implemented.");
    }

    async saveUserModelPreference(userId, modelId, isEnabled, displayOrder) {
        throw new Error("Method 'saveUserModelPreference()' must be implemented.");
    }

    async getQuestionSchedules(userId) {
        throw new Error("Method 'getQuestionSchedules()' must be implemented.");
    }

    async getQuestionScheduleById(scheduleId, userId) {
        throw new Error("Method 'getQuestionScheduleById()' must be implemented.");
    }

    async createQuestionSchedule(scheduleData) {
        throw new Error("Method 'createQuestionSchedule()' must be implemented.");
    }

    async updateQuestionSchedule(scheduleId, userId, scheduleData) {
        throw new Error("Method 'updateQuestionSchedule()' must be implemented.");
    }

    async deleteQuestionSchedule(scheduleId, userId) {
        throw new Error("Method 'deleteQuestionSchedule()' must be implemented.");
    }

    async logScheduledExecution(logData) {
        throw new Error("Method 'logScheduledExecution()' must be implemented.");
    }

    async getScheduledExecutions(scheduleId, userId) {
        throw new Error("Method 'getScheduledExecutions()' must be implemented.");
    }

    async getDueSchedules() {
        throw new Error("Method 'getDueSchedules()' must be implemented.");
    }

    async updateScheduleNextRun(scheduleId, nextRunDate) {
        throw new Error("Method 'updateScheduleNextRun()' must be implemented.");
    }
}

module.exports = DatabaseInterface;


