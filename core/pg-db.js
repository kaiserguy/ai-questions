const { Pool } = require("pg");
const DatabaseInterface = require("./db-interface");

class PgDatabase extends DatabaseInterface {
    constructor(connectionString) {
        super();
        this.pool = new Pool({
            connectionString: connectionString,
            ssl: {
                rejectUnauthorized: false,
            },
        });
    }

    async initialize() {
        try {
            // Create users table first
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    google_id VARCHAR(255) UNIQUE NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    avatar_url TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log("Users table created/verified");

            // Create user API keys table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS user_api_keys (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    provider VARCHAR(50) NOT NULL,
                    api_key_encrypted TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, provider)
                )
            `);
            console.log("User API keys table created/verified");

            // Create user model preferences table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS user_model_preferences (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    model_id VARCHAR(100) NOT NULL,
                    is_enabled BOOLEAN DEFAULT true,
                    display_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, model_id)
                )
            `);
            console.log("User model preferences table created/verified");

            // Create personal_questions table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS personal_questions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    question TEXT NOT NULL,
                    context TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log("Personal questions table created/verified");

            // Create answers table with all columns
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS answers (
                    id SERIAL PRIMARY KEY,
                    question TEXT NOT NULL,
                    context TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    model TEXT NOT NULL,
                    model_name TEXT,
                    confidence REAL NOT NULL,
                    date TIMESTAMP NOT NULL,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    personal_question_id INTEGER REFERENCES personal_questions(id) ON DELETE CASCADE,
                    is_personal BOOLEAN DEFAULT false,
                    prompt_version VARCHAR(10) DEFAULT '1.0'
                )
            `);
            console.log("Answers table created/verified");

            // Create scheduling tables
            await this.createSchedulingTables();

            console.log("Database initialization completed successfully");
        } catch (err) {
            console.error("Error during database initialization:", err);
            throw err;
        }
    }

    async createSchedulingTables() {
        try {
            // Create question_schedules table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS question_schedules (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    question_id INTEGER REFERENCES personal_questions(id) ON DELETE CASCADE,
                    frequency_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom'
                    frequency_value INTEGER, -- For custom intervals (e.g., every 3 days)
                    frequency_unit VARCHAR(10), -- 'days', 'weeks', 'months' for custom
                    selected_models TEXT[], -- Array of model names to query
                    is_enabled BOOLEAN DEFAULT true,
                    next_run_date TIMESTAMP,
                    last_run_date TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create scheduled_executions table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS scheduled_executions (
                    id SERIAL PRIMARY KEY,
                    schedule_id INTEGER REFERENCES question_schedules(id) ON DELETE CASCADE,
                    execution_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    models_executed TEXT[],
                    success_count INTEGER DEFAULT 0,
                    failure_count INTEGER DEFAULT 0,
                    execution_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
                    error_details TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create personal_question_answers table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS personal_question_answers (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    question_id INTEGER REFERENCES personal_questions(id) ON DELETE CASCADE,
                    answer TEXT NOT NULL,
                    model TEXT NOT NULL,
                    model_name TEXT,
                    confidence REAL DEFAULT 0.95,
                    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    schedule_id INTEGER REFERENCES question_schedules(id),
                    execution_id INTEGER REFERENCES scheduled_executions(id),
                    prompt_version VARCHAR(10) DEFAULT '1.0'
                )
            `);

            console.log("Scheduling tables created successfully");
        } catch (err) {
            console.error("Error creating scheduling tables:", err);
            throw err;
        }
    }

    async getDailyQuestion(date) {
        const result = await this.pool.query(
            `SELECT * FROM daily_questions WHERE date = $1`,
            [date]
        );
        return result.rows[0];
    }

    async getAnswer(question, model) {
        const result = await this.pool.query(
            `SELECT * FROM answers WHERE question = $1 AND model = $2 ORDER BY date DESC LIMIT 1`,
            [question, model]
        );
        return result.rows[0];
    }

    async saveAnswer(question, context, answer, model, modelName, confidence, date, userId, personalQuestionId, isPersonal, promptVersion) {
        const result = await this.pool.query(
            `INSERT INTO answers (question, context, answer, model, model_name, confidence, date, user_id, personal_question_id, is_personal, prompt_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [question, context, answer, model, modelName, confidence, date, userId, personalQuestionId, isPersonal, promptVersion]
        );
        return result.rows[0];
    }

    async getHistory(question) {
        const result = await this.pool.query(
            `SELECT * FROM answers WHERE question = $1 AND is_personal = false ORDER BY date DESC`,
            [question]
        );
        return result.rows;
    }

    async deleteAnswer(id) {
        await this.pool.query(`DELETE FROM answers WHERE id = $1`, [id]);
        return { success: true };
    }

    async getUser(googleId) {
        const result = await this.pool.query(
            `SELECT * FROM users WHERE google_id = $1`,
            [googleId]
        );
        return result.rows[0];
    }

    async createUser(googleId, email, name, avatarUrl) {
        const result = await this.pool.query(
            `INSERT INTO users (google_id, email, name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *`,
            [googleId, email, name, avatarUrl]
        );
        return result.rows[0];
    }

    async getUserById(id) {
        const result = await this.pool.query(
            `SELECT * FROM users WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    }

    async getPersonalQuestions(userId) {
        const result = await this.pool.query(
            `SELECT * FROM personal_questions WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async getPersonalQuestionById(questionId, userId) {
        const result = await this.pool.query(
            `SELECT * FROM personal_questions WHERE id = $1 AND user_id = $2`,
            [questionId, userId]
        );
        return result.rows[0];
    }

    async createPersonalQuestion(userId, question, context) {
        const result = await this.pool.query(
            `INSERT INTO personal_questions (user_id, question, context) VALUES ($1, $2, $3) RETURNING *`,
            [userId, question, context]
        );
        return result.rows[0];
    }

    async updatePersonalQuestion(questionId, userId, question, context) {
        const result = await this.pool.query(
            `UPDATE personal_questions SET question = $1, context = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *`,
            [question, context, questionId, userId]
        );
        return result.rows[0];
    }

    async deletePersonalQuestion(questionId, userId) {
        await this.pool.query(
            `DELETE FROM personal_questions WHERE id = $1 AND user_id = $2`,
            [questionId, userId]
        );
        return { success: true };
    }

    async getPersonalQuestionAnswers(questionId, userId) {
        const result = await this.pool.query(
            `SELECT * FROM personal_question_answers WHERE question_id = $1 AND user_id = $2 ORDER BY date DESC`,
            [questionId, userId]
        );
        return result.rows;
    }

    async saveUserApiKey(userId, provider, apiKey) {
        const result = await this.pool.query(
            `INSERT INTO user_api_keys (user_id, provider, api_key_encrypted) VALUES ($1, $2, $3) ON CONFLICT (user_id, provider) DO UPDATE SET api_key_encrypted = EXCLUDED.api_key_encrypted, updated_at = CURRENT_TIMESTAMP RETURNING *`,
            [userId, provider, apiKey]
        );
        return result.rows[0];
    }

    async getUserApiKey(userId, provider) {
        const result = await this.pool.query(
            `SELECT api_key_encrypted FROM user_api_keys WHERE user_id = $1 AND provider = $2`,
            [userId, provider]
        );
        return result.rows[0] ? result.rows[0].api_key_encrypted : null;
    }

    async getUserModelPreferences(userId) {
        const result = await this.pool.query(
            `SELECT * FROM user_model_preferences WHERE user_id = $1`,
            [userId]
        );
        return result.rows;
    }

    async saveUserModelPreference(userId, modelId, isEnabled, displayOrder) {
        const result = await this.pool.query(
            `INSERT INTO user_model_preferences (user_id, model_id, is_enabled, display_order) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, model_id) DO UPDATE SET is_enabled = EXCLUDED.is_enabled, display_order = EXCLUDED.display_order, updated_at = CURRENT_TIMESTAMP RETURNING *`,
            [userId, modelId, isEnabled, displayOrder]
        );
        return result.rows[0];
    }

    async getQuestionSchedules(userId) {
        const result = await this.pool.query(
            `SELECT * FROM question_schedules WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async getQuestionScheduleById(scheduleId, userId) {
        const result = await this.pool.query(
            `SELECT * FROM question_schedules WHERE id = $1 AND user_id = $2`,
            [scheduleId, userId]
        );
        return result.rows[0];
    }

    async createQuestionSchedule(scheduleData) {
        const { userId, questionId, frequencyType, frequencyValue, frequencyUnit, selectedModels, nextRunDate } = scheduleData;
        const result = await this.pool.query(
            `INSERT INTO question_schedules (user_id, question_id, frequency_type, frequency_value, frequency_unit, selected_models, next_run_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [userId, questionId, frequencyType, frequencyValue, frequencyUnit, selectedModels, nextRunDate]
        );
        return result.rows[0];
    }

    async updateQuestionSchedule(scheduleId, userId, scheduleData) {
        const { frequencyType, frequencyValue, frequencyUnit, selectedModels, isEnabled, nextRunDate } = scheduleData;
        const result = await this.pool.query(
            `UPDATE question_schedules SET frequency_type = $1, frequency_value = $2, frequency_unit = $3, selected_models = $4, is_enabled = $5, next_run_date = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 AND user_id = $8 RETURNING *`,
            [frequencyType, frequencyValue, frequencyUnit, selectedModels, isEnabled, nextRunDate, scheduleId, userId]
        );
        return result.rows[0];
    }

    async deleteQuestionSchedule(scheduleId, userId) {
        await this.pool.query(
            `DELETE FROM question_schedules WHERE id = $1 AND user_id = $2`,
            [scheduleId, userId]
        );
        return { success: true };
    }

    async logScheduledExecution(logData) {
        const { scheduleId, modelsExecuted, successCount, failureCount, executionStatus, errorDetails } = logData;
        const result = await this.pool.query(
            `INSERT INTO scheduled_executions (schedule_id, models_executed, success_count, failure_count, execution_status, error_details) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [scheduleId, modelsExecuted, successCount, failureCount, executionStatus, errorDetails]
        );
        return result.rows[0];
    }

    async getScheduledExecutions(scheduleId, userId) {
        const result = await this.pool.query(
            `SELECT se.* FROM scheduled_executions se JOIN question_schedules qs ON se.schedule_id = qs.id WHERE se.schedule_id = $1 AND qs.user_id = $2 ORDER BY se.execution_date DESC`,
            [scheduleId, userId]
        );
        return result.rows;
    }

    async getDueSchedules() {
        const result = await this.pool.query(
            `SELECT * FROM question_schedules WHERE is_enabled = TRUE AND next_run_date <= NOW()`
        );
        return result.rows;
    }

    async updateScheduleNextRun(scheduleId, nextRunDate) {
        await this.pool.query(
            `UPDATE question_schedules SET next_run_date = $1, last_run_date = CURRENT_TIMESTAMP WHERE id = $2`,
            [nextRunDate, scheduleId]
        );
        return { success: true };
    }
}

module.exports = PgDatabase;


