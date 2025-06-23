// TODO: Replace with actual database implementation for local testing without PostgreSQL
class PlaceholderDatabase {
  constructor() {
    this.users = new Map();
    this.questions = new Map();
    this.answers = new Map();
    this.personalQuestions = new Map();
    
    // Add default user
    this.users.set(1, {
      id: 1,
      google_id: 'local_user',
      email: 'user@localhost',
      name: 'Local User',
      avatar_url: null,
      created_at: new Date()
    });
    
    // Add some sample questions
    this.questions.set(1, {
      id: 1,
      question: "How might surveillance technology impact personal freedom in modern society?",
      context: "Consider the balance between security and privacy in an increasingly connected world.",
      created_at: new Date()
    });
  }
  
  async query(sql, params = []) {
    // TODO: Implement actual database queries
    if (sql.includes('SELECT * FROM users WHERE google_id')) {
      const googleId = params[0];
      const user = Array.from(this.users.values()).find(u => u.google_id === googleId);
      return { rows: user ? [user] : [] };
    }
    
    if (sql.includes('SELECT * FROM questions ORDER BY created_at DESC LIMIT 1')) {
      const questions = Array.from(this.questions.values());
      return { rows: questions.slice(0, 1) };
    }
    
    if (sql.includes('SELECT * FROM personal_questions WHERE user_id')) {
      return { rows: [] };
    }
    
    if (sql.includes('INSERT INTO') || sql.includes('UPDATE') || sql.includes('DELETE')) {
      return { rows: [], rowCount: 1 };
    }
    
    if (sql.includes('CREATE TABLE')) {
      return { rows: [] };
    }
    
    return { rows: [] };
  }
  
  async end() {
    // TODO: Implement actual cleanup
  }
}

module.exports = PlaceholderDatabase;

