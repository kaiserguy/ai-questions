// Local mode configuration for AI Questions application
// This file modifies the application to work without authentication

const LOCAL_CONFIG = {
  // Local mode settings
  enabled: process.env.LOCAL_MODE === 'true',
  
  // Default user for local mode
  defaultUser: {
    id: 1,
    google_id: 'local_user',
    email: process.env.LOCAL_USER_EMAIL || 'user@localhost',
    name: process.env.LOCAL_USER_NAME || 'Local User',
    avatar_url: null,
    created_at: new Date()
  },
  
  // Database settings for local mode
  database: {
    host: 'localhost',
    port: 5432,
    database: 'ai_questions_local',
    user: 'aiuser',
    password: 'aipassword'
  },
  
  // Security settings
  session: {
    secret: process.env.SESSION_SECRET || 'local-dev-secret-change-in-production',
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  
  // Application settings
  app: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0', // Allow external connections
    title: 'AI Questions - Local Instance',
    description: 'Private AI monitoring and analysis platform'
  },
  // Ollama settings
  ollama: {
    url: process.env.OLLLAMA_URL || 'http://localhost:11434',
    enabled: process.env.OLLAMA_ENABLED === 'true',
    fallbackToCloud: process.env.OLLAMA_FALLBACK_TO_CLOUD === 'true',
  }
};

module.exports = LOCAL_CONFIG;

