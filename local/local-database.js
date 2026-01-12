const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class LocalDatabase {
    constructor() {
        this.dbPath = path.join(__dirname, 'local.db');
        this.db = new sqlite3.Database(this.dbPath);
        this.initializeDatabase();
    }

    initializeDatabase() {
        this.db.serialize(() => {
            // Create tables for local development
            this.db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                google_id TEXT UNIQUE,
                email TEXT,
                name TEXT,
                avatar_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            this.db.run(`CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                context TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            this.db.run(`CREATE TABLE IF NOT EXISTS answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER,
                answer TEXT NOT NULL,
                model TEXT,
                user_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (question_id) REFERENCES questions (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);
            
            this.db.run(`CREATE TABLE IF NOT EXISTS personal_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                question TEXT NOT NULL,
                answer TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);
            
            // Insert default data
            this.db.run(`INSERT OR IGNORE INTO users (id, google_id, email, name) 
                         VALUES (1, 'local_user', 'user@localhost', 'Local User')`);
            
            this.db.run(`INSERT OR IGNORE INTO questions (id, question, context) 
                         VALUES (1, 'How might surveillance technology impact personal freedom in modern society?', 
                                'Consider the balance between security and privacy in an increasingly connected world.')`);
        });
    }

    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (sql.includes('SELECT')) {
                this.db.all(sql, params, (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ rows: rows || [] });
                    }
                });
            } else {
                this.db.run(sql, params, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ rows: [], rowCount: this.changes || 1, lastID: this.lastID });
                    }
                });
            }
        });
    }

    // Database methods expected by routes.js
    async getAnswer(question, modelId) {
        const result = await this.query(
            'SELECT * FROM answers WHERE question_id = (SELECT id FROM questions WHERE question = ?) AND model = ? ORDER BY created_at DESC LIMIT 1',
            [question, modelId]
        );
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    async saveAnswer(questionText, context, answer, model, modelName, confidence, createdAt, userId = 1, personalQuestionId = null, isPersonal = false, promptVersion = "2.0") {
        // First, ensure the question exists
        let questionResult = await this.query(
            'SELECT id FROM questions WHERE question = ?',
            [questionText]
        );
        
        let questionId;
        if (questionResult.rows.length === 0) {
            // Create the question
            const insertResult = await this.query(
                'INSERT INTO questions (question, context) VALUES (?, ?)',
                [questionText, context]
            );
            questionId = insertResult.lastID;
        } else {
            questionId = questionResult.rows[0].id;
        }

        // Save the answer
        const result = await this.query(
            'INSERT INTO answers (question_id, answer, model, user_id) VALUES (?, ?, ?, ?)',
            [questionId, answer, model, userId]
        );
        
        return { id: result.lastID, question_id: questionId, answer, model, user_id: userId };
    }

    async getHistory(questionText) {
        const result = await this.query(`
            SELECT a.*, q.question, q.context 
            FROM answers a 
            JOIN questions q ON a.question_id = q.id 
            WHERE q.question = ? 
            ORDER BY a.created_at DESC
        `, [questionText]);
        return result.rows;
    }

    async getLatestAnswers(limit = 10) {
        // Note: SQLite schema has simplified structure compared to PostgreSQL
        // Missing fields (model_name, confidence, prompt_version, is_personal) are
        // provided as defaults to match PostgreSQL API response structure
        // All answers in local DB are non-personal (personal ones are in personal_questions table)
        const result = await this.query(`
            SELECT a.id, q.question, q.context, a.answer, a.model, 
                   a.created_at, a.user_id, a.question_id,
                   NULL as model_name, NULL as confidence, NULL as prompt_version,
                   false as is_personal
            FROM answers a 
            JOIN questions q ON a.question_id = q.id 
            ORDER BY a.created_at DESC 
            LIMIT ?
        `, [limit]);
        return result.rows;
    }

    async deleteAnswer(id) {
        const result = await this.query('DELETE FROM answers WHERE id = ?', [id]);
        return result.rowCount > 0;
    }

    // User preference methods (simplified for local use)
    async saveUserModelPreference(userId, modelId, isEnabled, displayOrder) {
        // For local use, just return a simple response since user prefs aren't persisted
        return { id: 1, user_id: userId, model_id: modelId, is_enabled: isEnabled, display_order: displayOrder };
    }

    async getUserModelPreferences(userId) {
        // For local use, return empty array
        return [];
    }

    async saveUserApiKey(userId, provider, apiKey) {
        // For local use, just return a simple response since keys aren't persisted
        return { id: 1, user_id: userId, provider, api_key: apiKey };
    }

    // Personal questions methods
    async getPersonalQuestions(userId) {
        const result = await this.query(
            'SELECT * FROM personal_questions WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        return result.rows;
    }

    async createPersonalQuestion(userId, question, context) {
        const result = await this.query(
            'INSERT INTO personal_questions (user_id, question) VALUES (?, ?)',
            [userId, question]
        );
        return { id: result.lastID, user_id: userId, question, context };
    }

    async updatePersonalQuestion(id, userId, question, context) {
        const result = await this.query(
            'UPDATE personal_questions SET question = ? WHERE id = ? AND user_id = ?',
            [question, id, userId]
        );
        return result.rowCount > 0;
    }

    async deletePersonalQuestion(id, userId) {
        const result = await this.query(
            'DELETE FROM personal_questions WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        return result.rowCount > 0;
    }

    async getPersonalQuestionById(id, userId) {
        const result = await this.query(
            'SELECT * FROM personal_questions WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    async getPersonalQuestionAnswers(questionId, userId) {
        // For local use, return empty array (no separate answers table for personal questions)
        return [];
    }

    // Schedule methods (simplified for local use)
    async getQuestionSchedules(userId) {
        return [];
    }

    async createQuestionSchedule(scheduleData) {
        return { id: 1, ...scheduleData };
    }

    async updateQuestionSchedule(id, userId, scheduleData) {
        return true;
    }

    async deleteQuestionSchedule(id, userId) {
        return true;
    }

    async getQuestionScheduleById(id, userId) {
        return null;
    }

    async getScheduledExecutions(scheduleId, userId) {
        return [];
    }

    async end() {
        return new Promise((resolve) => {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                }
                resolve();
            });
        });
    }

    async getUserApiKeys(userId) {
        // For local use, return empty array since API keys aren't persisted
        return [];
    }

    async deleteUserApiKey(userId, provider) {
        // For local use, just return success
        return { success: true, provider };
    }
}

module.exports = LocalDatabase;

