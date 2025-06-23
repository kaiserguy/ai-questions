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
}

module.exports = LocalDatabase;

