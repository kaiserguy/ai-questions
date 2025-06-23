const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const cron = require('node-cron');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { spawn } = require('child_process');
const fs = require('fs');

// Load local configuration
const LOCAL_CONFIG = require('./local-config');

// n8n AI Agent Integration
const N8nAgentIntegration = require('./n8n-agent-integration');

// Wikipedia integration
class WikipediaIntegration {
  constructor(wikipediaDbPath = './wikipedia.db') {
    this.wikipediaDbPath = wikipediaDbPath;
    this.searchEngine = null;
    this.contextExtractor = null;
    this.available = false;
    this.initializeWikipedia();
  }
  
  async initializeWikipedia() {
    try {
      // Check if Wikipedia database exists
      if (!fs.existsSync(this.wikipediaDbPath)) {
        console.log('⚠️ Wikipedia database not found. Use setup script to download.');
        console.log("⚠️ Expected path: " + this.wikipediaDbPath);
        return;
      }
      
      // Initialize Python search engine
      this.available = true;
      console.log('✅ Wikipedia integration available');
    } catch (error) {
      console.log('⚠️ Wikipedia integration failed:', error.message);
      this.available = false;
    }
  }
  
  async searchWikipedia(query, limit = 5) {
    if (!this.available) {
      return { results: [], error: 'Wikipedia not available' };
    }
    
    try {
      const result = await this.runPythonScript('search', { query, limit });
      return JSON.parse(result);
    } catch (error) {
      console.error('Wikipedia search failed:', error);
      return { results: [], error: error.message };
    }
  }
  
  async getWikipediaContext(query, maxLength = 2000) {
    if (!this.available) {
      return { context: '', sources: [], confidence: 0 };
    }
    
    try {
      const result = await this.runPythonScript('context', { query, maxLength });
      return JSON.parse(result);
    } catch (error) {
      console.error('Wikipedia context extraction failed:', error);
      return { context: '', sources: [], confidence: 0 };
    }
  }
  
  async getWikipediaStats() {
    if (!this.available) {
      return { error: 'Wikipedia not available' };
    }
    
    try {
      const result = await this.runPythonScript('stats', {});
      return JSON.parse(result);
    } catch (error) {
      console.error('Wikipedia stats failed:', error);
      return { error: error.message };
    }
  }
  
  runPythonScript(action, params) {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [
        path.join(__dirname, 'wikipedia_api.py'),
        action,
        JSON.stringify(params)
      ]);
      
      let output = '';
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Python script failed: ${errorOutput}`));
        }
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Wikipedia search timeout'));
      }, 30000);
    });
  }
  
  async getArticle(title) {
    if (!this.available) {
      return null;
    }
    
    try {
      const result = await this.runPythonScript('get_article', { title });
      const parsed = JSON.parse(result);
      return parsed.article || null;
    } catch (error) {
      console.error('Wikipedia article retrieval failed:', error);
      return null;
    }
  }
}

// Ollama client for local AI models
class OllamaClient {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.available = false;
    this.checkAvailability();
  }
  
  async checkAvailability() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      this.available = true;
      console.log('✅ Ollama service is available');
      return true;
    } catch (error) {
      this.available = false;
      console.log('⚠️ Ollama service not available:', error.message);
      return false;
    }
  }
  
  async generateResponse(model, prompt, context = '') {
    if (!this.available) {
      throw new Error('Ollama service is not available');
    }
    
    const fullPrompt = context ? `Context: ${context}\n\nQuestion: ${prompt}` : prompt;
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: model,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40
        }
      }, { timeout: 120000 }); // 2 minute timeout
      
      return {
        answer: response.data.response,
        model: model,
        model_name: this.getModelDisplayName(model),
        confidence: 0.8, // Default confidence for local models
        tokens_used: response.data.eval_count || 0,
        response_time: response.data.total_duration ? Math.round(response.data.total_duration / 1000000) : 0
      };
    } catch (error) {
      console.error('Ollama generation error:', error.message);
      throw new Error(`Local AI model error: ${error.message}`);
    }
  }
  
  async listModels() {
    if (!this.available) {
      return { models: [] };
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data;
    } catch (error) {
      console.error('Error listing Ollama models:', error.message);
      return { models: [] };
    }
  }
  
  async pullModel(modelName) {
    if (!this.available) {
      throw new Error('Ollama service is not available');
    }
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/pull`, {
        name: modelName
      }, { timeout: 600000 }); // 10 minute timeout for model download
      
      return response.data;
    } catch (error) {
      console.error('Error pulling Ollama model:', error.message);
      throw new Error(`Failed to download model: ${error.message}`);
    }
  }
  
  async deleteModel(modelName) {
    if (!this.available) {
      throw new Error('Ollama service is not available');
    }
    
    try {
      const response = await axios.delete(`${this.baseUrl}/api/delete`, {
        data: { name: modelName }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting Ollama model:', error.message);
      throw new Error(`Failed to delete model: ${error.message}`);
    }
  }
  
  getModelDisplayName(model) {
    const modelNames = {
      'llama3.2:3b': 'Llama 3.2 3B (Local)',
      'llama3.2:1b': 'Llama 3.2 1B (Local)',
      'phi3:mini': 'Phi-3 Mini (Local)',
      'phi3:medium': 'Phi-3 Medium (Local)',
      'gemma:2b': 'Gemma 2B (Local)',
      'gemma:7b': 'Gemma 7B (Local)',
      'mistral:7b': 'Mistral 7B (Local)',
      'codellama:7b': 'CodeLlama 7B (Local)',
      'tinyllama': 'TinyLlama (Local)',
      'qwen2:1.5b': 'Qwen2 1.5B (Local)',
      'qwen2:7b': 'Qwen2 7B (Local)'
    };
    return modelNames[model] || `${model} (Local)`;
  }
  
  getRecommendedModels() {
    return [
      {
        name: 'llama3.2:3b',
        displayName: 'Llama 3.2 3B',
        size: '2GB',
        description: 'Fast and efficient for general tasks',
        recommended: true,
        minRam: '4GB'
      },
      {
        name: 'phi3:mini',
        displayName: 'Phi-3 Mini',
        size: '2GB',
        description: 'Microsoft\'s efficient model',
        recommended: true,
        minRam: '4GB'
      },
      {
        name: 'gemma:2b',
        displayName: 'Gemma 2B',
        size: '1.5GB',
        description: 'Google\'s compact model',
        recommended: false,
        minRam: '3GB'
      },
      {
        name: 'mistral:7b',
        displayName: 'Mistral 7B',
        size: '4GB',
        description: 'Higher quality responses',
        recommended: false,
        minRam: '8GB'
      },
      {
        name: 'tinyllama',
        displayName: 'TinyLlama',
        size: '1GB',
        description: 'Ultra-lightweight for low-end hardware',
        recommended: false,
        minRam: '2GB'
      }
    ];
  }
}

// Initialize Ollama client
const ollama = new OllamaClient(process.env.OLLAMA_URL || 'http://localhost:11434');

// Initialize Wikipedia integration
const wikipedia = new WikipediaIntegration(process.env.WIKIPEDIA_DB_PATH || './wikipedia.db');

// Create Express app
const app = express();
const PORT = LOCAL_CONFIG.app.port;

// Initialize n8n AI Agent
const aiAgent = new N8nAgentIntegration();

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Session configuration
app.use(session({
  secret: LOCAL_CONFIG.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: LOCAL_CONFIG.session.secure,
    maxAge: LOCAL_CONFIG.session.maxAge
  }
}));

// Local mode authentication bypass
if (LOCAL_CONFIG.enabled) {
  // Skip passport setup in local mode
  console.log('Running in LOCAL MODE - Authentication disabled');
  
  // Middleware to inject default user
  app.use((req, res, next) => {
    req.user = LOCAL_CONFIG.defaultUser;
    req.isAuthenticated = () => true;
    next();
  });
} else {
  // Passport configuration for production mode
  app.use(passport.initialize());
  app.use(passport.session());

  // Google OAuth Strategy
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production' 
      ? "https://peaceful-sierra-40313-4a09d237c70e.herokuapp.com/auth/google/callback"
      : "/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists
      let result = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
      
      if (result.rows.length > 0) {
        // User exists, return user
        return done(null, result.rows[0]);
      } else {
        // Create new user
        const newUser = await pool.query(
          'INSERT INTO users (google_id, email, name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *',
          [profile.id, profile.emails[0].value, profile.displayName, profile.photos[0].value]
        );
        return done(null, newUser.rows[0]);
      }
    } catch (error) {
      return done(error, null);
    }
  }));

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      done(null, result.rows[0]);
    } catch (error) {
      done(error, null);
    }
  });
}

// Initialize database connection
let pool;

if (LOCAL_CONFIG.enabled) {
  // Use SQLite database for local mode to avoid PostgreSQL dependency
  const LocalDatabase = require('./local-database');
  pool = new LocalDatabase();
  console.log('Using SQLite database for local mode');
} else {
  // Use PostgreSQL for production
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

// Create tables if they don't exist
async function initializeDatabase() {
  if (LOCAL_CONFIG.enabled) {
    // Skip database initialization for SQLite database (already initialized)
    console.log('Skipping database initialization for SQLite database');
    return;
  }
  
  try {
    // Create users table first
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table created/verified');

    // In local mode, ensure default user exists
    if (LOCAL_CONFIG.enabled) {
      try {
        const existingUser = await pool.query('SELECT * FROM users WHERE google_id = $1', [LOCAL_CONFIG.defaultUser.google_id]);
        if (existingUser.rows.length === 0) {
          await pool.query(
            'INSERT INTO users (google_id, email, name, avatar_url) VALUES ($1, $2, $3, $4)',
            [LOCAL_CONFIG.defaultUser.google_id, LOCAL_CONFIG.defaultUser.email, LOCAL_CONFIG.defaultUser.name, LOCAL_CONFIG.defaultUser.avatar_url]
          );
          console.log('Created default local user');
        }
      } catch (err) {
        console.error('Error creating default user:', err);
      }
    }

    // Create personal_questions table
    await pool.query(`
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
    console.log('Personal questions table created/verified');

    // Create answers table with all columns
    await pool.query(`
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
        is_personal BOOLEAN DEFAULT false
      )
    `);
    console.log('Answers table created/verified');

    // Create scheduling tables
    await createSchedulingTables();
    
    console.log('Database initialization completed successfully');
  } catch (err) {
    console.error('Error during database initialization:', err);
  }
}

// Initialize database
initializeDatabase();

// Create scheduling tables
async function createSchedulingTables() {
  try {
    // Create question_schedules table
    await pool.query(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create scheduled_executions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scheduled_executions (
        id SERIAL PRIMARY KEY,
        schedule_id INTEGER REFERENCES question_schedules(id) ON DELETE CASCADE,
        execution_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        models_executed TEXT[],
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        errors TEXT
      )
    `);

    // Create personal_question_answers table
    await pool.query(`
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
        execution_id INTEGER REFERENCES scheduled_executions(id)
      )
    `);

    console.log('Scheduling tables created successfully');
  } catch (err) {
    console.error('Error creating scheduling tables:', err);
  }
}

// Available AI models
const AVAILABLE_MODELS = [
  // Local models only in local mode
];

// Daily Questions Array
const DAILY_QUESTIONS = [
  {
    id: 1,
    question: "In '1984', was Winston Smith's rebellion against the Party justified? Why or why not?",
    context: "In George Orwell's novel '1984', Winston Smith works at the Ministry of Truth but secretly rebels against the totalitarian regime of Big Brother and the Party. He keeps a diary, engages in a forbidden relationship with Julia, and seeks out the Brotherhood resistance movement."
  },
  {
    id: 2,
    question: "Is the concept of 'doublethink' from '1984' present in today's society? Provide specific examples.",
    context: "In '1984', doublethink is described as the act of simultaneously accepting two mutually contradictory beliefs as correct. It involves the ability to tell deliberate lies while genuinely believing in them, to forget any fact that has become inconvenient, and then to draw it back from oblivion when needed."
  },
  {
    id: 3,
    question: "Compare the surveillance state in '1984' with modern data collection practices. Are there meaningful differences, and why?",
    context: "In '1984', the Party monitors citizens through telescreens that both transmit and record, the Thought Police, and children who spy on their parents. Modern data collection includes internet tracking, smartphone location data, facial recognition, and various forms of digital surveillance by both governments and corporations."
  },
  {
    id: 4,
    question: "In '1984', the Party rewrites history. What are the dangers of historical revisionism, and do you see examples today?",
    context: "In '1984', Winston Smith works at the Ministry of Truth where he alters historical documents to match the Party's ever-changing version of history. The novel portrays a society where 'Who controls the past controls the future. Who controls the present controls the past.'"
  },
  {
    id: 5,
    question: "How does the concept of 'Newspeak' in '1984' relate to modern political language? Give examples.",
    context: "Newspeak in '1984' is a controlled language created by the Party to limit freedom of thought. It eliminates nuance and restricts the range of ideas that can be expressed. Words like 'doublethink', 'thoughtcrime', and 'unperson' show how language can be manipulated to control thought."
  },
  {
    id: 6,
    question: "Was Julia a true rebel against the Party in '1984', or was her rebellion superficial? Explain your reasoning.",
    context: "In '1984', Julia is Winston's lover who appears to rebel against the Party through illegal sexual relationships and obtaining black market goods. However, her rebellion seems focused on personal pleasure rather than ideological opposition, unlike Winston who questions the Party's control of reality itself."
  },
  {
    id: 7,
    question: "In '1984', what does the slogan 'Freedom is Slavery' mean, and is there any truth to it in our society?",
    context: "In '1984', 'Freedom is Slavery' is one of the three contradictory slogans of the Party. It suggests that individual freedom leads to enslavement, while submission to the collective will of the Party brings true freedom from hunger and failure."
  },
  {
    id: 8,
    question: "How does the relationship between Winston and O'Brien in '1984' reflect power dynamics in society?",
    context: "In '1984', O'Brien first appears as a potential ally to Winston in the resistance, but is later revealed to be a devoted Inner Party member who tortures Winston into submission. Their relationship reveals the absolute power the Party holds over individuals and the betrayal inherent in totalitarian systems."
  },
  {
    id: 9,
    question: "In '1984', the concept of 'thoughtcrime' criminalizes certain thoughts. Do you see any parallels in today's society?",
    context: "In '1984', thoughtcrime is the criminal act of holding unspoken beliefs or doubts that oppose the ruling Party. The Thought Police use surveillance and psychology to detect and punish thoughtcrime, even if it's never expressed in actions or words."
  },
  {
    id: 10,
    question: "What does the ending of '1984' suggest about human nature and resistance to totalitarianism? Is Orwell's view too pessimistic?",
    context: "At the end of '1984', Winston is completely broken by the Party's torture and betrays Julia. The novel concludes with Winston genuinely loving Big Brother, suggesting that human resistance to totalitarianism ultimately fails. The final line reads: 'He loved Big Brother.'"
  }
];

// Get today's question based on the date
function getTodaysQuestion() {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const questionIndex = (dayOfMonth % DAILY_QUESTIONS.length);
  return DAILY_QUESTIONS[questionIndex];
}

// Ask question to AI API
async function askQuestion(question, context, modelId, apiKeys, useWikipedia = false) {
  let selectedModel; // Declare at function scope
  
  try {
    // Get Wikipedia context if enabled
    let wikipediaContext = '';
    let wikipediaSources = [];
    
    if (useWikipedia && wikipedia.available) {
      try {
        const wikiResult = await wikipedia.getWikipediaContext(question, 1500);
        if (wikiResult.context && wikiResult.confidence > 0.3) {
          wikipediaContext = wikiResult.context;
          wikipediaSources = wikiResult.sources || [];
          console.log(`📚 Added Wikipedia context (confidence: ${wikiResult.confidence.toFixed(2)})`);
        }
      } catch (wikiError) {
        console.warn('Wikipedia context failed:', wikiError.message);
      }
    }
    
    // Enhance context with Wikipedia information
    const enhancedContext = wikipediaContext ? 
      `${context}\n\nAdditional factual context from Wikipedia:\n${wikipediaContext}` : 
      context;
    
    // Check if this is a local Ollama model
    if (modelId.includes('ollama:') || modelId.startsWith('llama') || modelId.startsWith('phi') || 
        modelId.startsWith('gemma') || modelId.startsWith('mistral') || modelId.startsWith('tinyllama') ||
        modelId.startsWith('qwen') || modelId.startsWith('codellama')) {
      
      // Handle local Ollama model
      try {
        const response = await ollama.generateResponse(modelId, question, enhancedContext);
        
        // Add Wikipedia sources to response
        const result = {
          answer: response.answer,
          model: response.model,
          modelName: response.model_name,
          score: response.confidence,
          tokens: response.tokens_used,
          responseTime: response.response_time
        };
        
        if (wikipediaSources.length > 0) {
          result.wikipediaSources = wikipediaSources;
          result.answer += `\n\n*Sources: ${wikipediaSources.map(s => s.title).join(', ')}*`;
        }
        
        return result;
      } catch (ollamaError) {
        console.error('Ollama error:', ollamaError.message);
        
        // If Ollama fails and fallback is enabled, try cloud models
        if (process.env.OLLAMA_FALLBACK_TO_CLOUD === 'true') {
          console.log('Falling back to cloud models...');
          // Continue to cloud model logic below
        } else {
          throw new Error(`Local AI model error: ${ollamaError.message}`);
        }
      }
    }
    
    // Find the selected cloud model
    selectedModel = AVAILABLE_MODELS.find(model => model.id === modelId);
    if (!selectedModel) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    // Get the appropriate API key
    const apiKey = apiKeys[selectedModel.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`API key for ${selectedModel.name} not configured`);
    }
    
    // Combine question and context into a prompt
    const prompt = `Based on the following context, please answer this question thoroughly:
    
Context: ${enhancedContext}

Question: ${question}

Answer:`;

    let answer;
    
    // Handle different providers
    if (selectedModel.provider === 'huggingface') {
      // Hugging Face API call
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${selectedModel.id}`,
        {
          inputs: prompt,
          parameters: {
            max_length: 500,
            temperature: 0.7,
            top_p: 0.95,
            do_sample: true
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      ) ;
      
      // Handle different response formats from Hugging Face
      if (Array.isArray(response.data) && response.data.length > 0) {
        answer = response.data[0].generated_text || response.data[0];
      } else if (typeof response.data === 'string') {
        answer = response.data;
      } else if (response.data.generated_text) {
        answer = response.data.generated_text;
      } else {
        answer = JSON.stringify(response.data);
      }
    } 
    else if (selectedModel.provider === 'openai') {
      // OpenAI API call
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: selectedModel.id,
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant providing thoughtful analysis of literature and political topics."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      ) ;
      
      answer = response.data.choices[0].message.content;
    }
    
    const result = {
      answer: answer,
      model: selectedModel.id,
      modelName: selectedModel.name,
      score: 1.0
    };
    
    // Add Wikipedia sources to cloud model responses
    if (wikipediaSources.length > 0) {
      result.wikipediaSources = wikipediaSources;
      result.answer += `\n\n*Sources: ${wikipediaSources.map(s => s.title).join(', ')}*`;
    }
    
    return result;
  } catch (error) {
    console.error('Error calling AI API:', error);
    
    // Enhanced error logging for OpenAI API issues
    if (selectedModel && selectedModel.provider === 'openai' && error.response) {
      console.error('OpenAI API Error Details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
      
      // Check for specific OpenAI error patterns
      if (error.response.status === 429) {
        const errorData = error.response.data;
        if (errorData && errorData.error) {
          console.error('OpenAI 429 Error Type:', errorData.error.type);
          console.error('OpenAI 429 Error Code:', errorData.error.code);
          console.error('OpenAI 429 Error Message:', errorData.error.message);
        }
      }
    }
    
    throw error;
  }
}

// PostgreSQL Database Functions

// Save answer to database
async function saveAnswer(question, context, answer, model, confidence, date, modelName = null) {
  const result = await pool.query(
    'INSERT INTO answers (question, context, answer, model, model_name, confidence, date, is_personal) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
    [question, context, answer, model, modelName, confidence, date, false]
  );
  return result.rows[0].id;
}

// Save personal answer to database
async function savePersonalAnswer(question, context, answer, model, confidence, date, modelName, userId, personalQuestionId) {
  const result = await pool.query(
    'INSERT INTO answers (question, context, answer, model, model_name, confidence, date, user_id, personal_question_id, is_personal) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
    [question, context, answer, model, modelName, confidence, date, userId, personalQuestionId, true]
  );
  return result.rows[0].id;
}

// Get latest answers for all questions (excluding personal questions)
async function getLatestAnswers() {
  const result = await pool.query(`
    SELECT a.*
    FROM answers a
    INNER JOIN (
      SELECT question, MAX(date) as max_date
      FROM answers
      WHERE is_personal = false
      GROUP BY question
    ) b ON a.question = b.question AND a.date = b.max_date AND a.is_personal = false
    ORDER BY a.id DESC
  `);
  return result.rows;
}

// Get history of answers for a specific question (excluding personal questions)
async function getAnswerHistory(question) {
  const result = await pool.query(
    'SELECT * FROM answers WHERE question = $1 AND is_personal = false ORDER BY date DESC',
    [question]
  );
  return result.rows;
}

// Delete an answer by ID
async function deleteAnswer(id) {
  const result = await pool.query('DELETE FROM answers WHERE id = $1', [id]);
  return result.rowCount;
}

// Routes
app.get('/', async (req, res) => {
  try {
    const todayQuestion = getTodaysQuestion();
    let todayAnswer = null;
    
    // Check if we already have today's answer
    const today = new Date().toISOString().split('T')[0];
    
    const result = await pool.query(
      'SELECT * FROM answers WHERE question = $1 AND date::date = $2 ORDER BY date DESC LIMIT 1',
      [todayQuestion.question, today]
    );
    
    if (result.rows.length > 0) {
      // We already have today's answer
      todayAnswer = result.rows[0];
    }
    
    const latestAnswers = await getLatestAnswers();
    res.render('index', { 
      todayQuestion, 
      todayAnswer,
      latestAnswers,
      today,
      localMode: LOCAL_CONFIG.enabled,
      user: req.user
    });
  } catch (error) {
    console.error('Error in index route:', error);
    res.status(500).render('error', { error: 'An unexpected error occurred' });
  }
});

app.get('/history', async (req, res) => {
  try {
    const { question } = req.query;
    
    if (!question) {
      return res.status(400).render('error', { error: 'Question parameter is required' });
    }
    
    const history = await getAnswerHistory(question);
    res.render('history', { question, history });
  } catch (error) {
    console.error('Error in history route:', error);
    res.status(500).render('error', { error: 'Failed to get answer history' });
  }
});

// API Routes
app.get('/api/question', async (req, res) => {
  try {
    const { question, context } = getTodaysQuestion();
    const modelId = req.query.model || AVAILABLE_MODELS[0].id; // Default to first model if not specified
    
    // Collect all API keys
    const apiKeys = {
      HUGGING_FACE_API_KEY: process.env.HUGGING_FACE_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    };
    
    // Check if we have the required API key
    const selectedModel = AVAILABLE_MODELS.find(model => model.id === modelId);
    if (!selectedModel) {
      return res.status(400).json({ error: 'Invalid model ID' });
    }
    
    if (!apiKeys[selectedModel.apiKeyEnv]) {
      return res.status(500).json({ 
        error: `API key for ${selectedModel.name} not configured`,
        question,
        context,
        date: new Date().toISOString()
      });
    }
    
    const response = await askQuestion(question, context, modelId, apiKeys);
    
    const answer = {
      question,
      context,
      answer: response.answer,
      model: response.model,
      modelName: response.modelName,
      confidence: response.score,
      date: new Date().toISOString()
    };
    
    const id = await saveAnswer(
      question, 
      context, 
      answer.answer, 
      answer.model, 
      answer.confidence, 
      answer.date,
      answer.modelName
    );
    
    answer.id = id;
    res.json(answer);
  } catch (error) {
    console.error('Error in question API route:', error);
    
    // Enhanced error response for OpenAI API issues
    let errorResponse = { 
      error: 'Failed to get answer from AI', 
      message: error.message 
    };
    
    // Check for OpenAI-specific 429 errors
    if (error.response && error.response.status === 429) {
      const errorData = error.response.data;
      if (errorData && errorData.error) {
        // Check for quota/billing issues
        if (errorData.error.code === 'insufficient_quota' || 
            errorData.error.type === 'insufficient_quota' ||
            errorData.error.message.includes('quota') ||
            errorData.error.message.includes('billing')) {
          
          errorResponse = {
            error: 'OpenAI API Key Issue Detected',
            message: 'Your OpenAI API key may not be properly linked to your billing account.',
            details: [
              '🔑 This is a known OpenAI issue where older API keys become disconnected from billing',
              '💡 Solution: Create a new API key at https://platform.openai.com/api-keys',
              '⚠️ Make sure to create the key from the main API keys page, not from profile settings',
              '💰 Your account has sufficient credits, but the API key cannot access them'
            ],
            technicalDetails: {
              status: error.response.status,
              openaiError: errorData.error
            }
          };
        }
      }
    }
    
    res.status(500).json(errorResponse);
  }
});

app.get('/api/models', async (req, res) => {
  try {
    // In local mode, only return local Ollama models
    let localModels = [];
    if (ollama.available) {
      try {
        const models = await ollama.getModels();
        localModels = models.map(model => ({
          id: model.name,
          name: model.displayName || model.name,
          provider: 'ollama',
          type: 'local',
          available: true,
          api_key_required: false
        }));
      } catch (error) {
        console.error('Error fetching Ollama models:', error);
      }
    }
    
    res.json(localModels);
  } catch (error) {
    console.error('Error in models API:', error);
    res.json([]);
  }
});

app.get('/api/answers', async (req, res) => {
  try {
    const latestAnswers = await getLatestAnswers();
    res.json(latestAnswers);
  } catch (error) {
    console.error('Error in answers API route:', error);
    res.status(500).json({ 
      error: 'Failed to get latest answers', 
      message: error.message 
    });
  }
});

app.get('/api/answers/history', async (req, res) => {
  try {
    const { question } = req.query;
    
    if (!question) {
      return res.status(400).json({ error: 'Question parameter is required' });
    }
    
    const history = await getAnswerHistory(question);
    res.json(history);
  } catch (error) {
    console.error('Error in answer history API route:', error);
    res.status(500).json({ 
      error: 'Failed to get answer history', 
      message: error.message 
    });
  }
});

// Delete answer route
app.delete('/api/answers/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    await deleteAnswer(id);
    
    res.json({ success: true, message: 'Answer deleted successfully' });
  } catch (error) {
    console.error('Error deleting answer:', error);
    res.status(500).json({ 
      error: 'Failed to delete answer', 
      message: error.message 
    });
  }
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

// Authentication routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/');
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.redirect('/');
  });
});

app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      avatar_url: req.user.avatar_url
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Personal questions routes
app.get('/api/personal-questions', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM personal_questions WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching personal questions:', error);
    res.status(500).json({ error: 'Failed to fetch personal questions' });
  }
});

app.post('/api/personal-questions', requireAuth, async (req, res) => {
  try {
    const { question, context } = req.body;
    
    if (!question || !context) {
      return res.status(400).json({ error: 'Question and context are required' });
    }
    
    const result = await pool.query(
      'INSERT INTO personal_questions (user_id, question, context) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, question, context]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating personal question:', error);
    res.status(500).json({ error: 'Failed to create personal question' });
  }
});

app.put('/api/personal-questions/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { question, context } = req.body;
    
    if (!question || !context) {
      return res.status(400).json({ error: 'Question and context are required' });
    }
    
    const result = await pool.query(
      'UPDATE personal_questions SET question = $1, context = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
      [question, context, id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Personal question not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating personal question:', error);
    res.status(500).json({ error: 'Failed to update personal question' });
  }
});

app.delete('/api/personal-questions/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'UPDATE personal_questions SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Personal question not found' });
    }
    
    res.json({ success: true, message: 'Personal question deleted successfully' });
  } catch (error) {
    console.error('Error deleting personal question:', error);
    res.status(500).json({ error: 'Failed to delete personal question' });
  }
});

// Ask personal question route
app.post('/api/personal-question/:id/ask', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { model } = req.body;
    
    // Get the personal question
    const questionResult = await pool.query(
      'SELECT * FROM personal_questions WHERE id = $1 AND user_id = $2 AND is_active = true',
      [id, req.user.id]
    );
    
    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Personal question not found' });
    }
    
    const personalQuestion = questionResult.rows[0];
    
    // Check for recent answer within 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAnswerResult = await pool.query(
      `SELECT * FROM answers 
       WHERE personal_question_id = $1 AND user_id = $2 AND model = $3 
       AND date > $4 
       ORDER BY date DESC LIMIT 1`,
      [id, req.user.id, model, twentyFourHoursAgo]
    );
    
    if (recentAnswerResult.rows.length > 0) {
      const recentAnswer = recentAnswerResult.rows[0];
      const timeUntilNext = new Date(recentAnswer.date.getTime() + 24 * 60 * 60 * 1000);
      const hoursRemaining = Math.ceil((timeUntilNext - new Date()) / (1000 * 60 * 60));
      
      return res.status(429).json({ 
        error: 'Cooldown active',
        message: `This question was already asked to ${recentAnswer.model_name || model} within the last 24 hours. Please wait ${hoursRemaining} hour(s) before asking again.`,
        lastAsked: recentAnswer.date,
        nextAvailable: timeUntilNext,
        hoursRemaining: hoursRemaining,
        existingAnswer: {
          id: recentAnswer.id,
          answer: recentAnswer.answer,
          confidence: recentAnswer.confidence,
          date: recentAnswer.date,
          model: recentAnswer.model,
          modelName: recentAnswer.model_name
        }
      });
    }
    
    // Use local Ollama model
    if (!ollama.available) {
      return res.status(500).json({ 
        error: 'Local AI not available',
        message: 'Ollama service is not running. Please ensure Ollama is installed and running.',
        question: personalQuestion.question,
        context: personalQuestion.context,
        date: new Date().toISOString()
      });
    }
    
    const response = await askQuestion(personalQuestion.question, personalQuestion.context, model, {});
    
    const answer = {
      question: personalQuestion.question,
      context: personalQuestion.context,
      answer: response.answer,
      model: response.model,
      modelName: response.modelName,
      confidence: response.score,
      date: new Date().toISOString(),
      user_id: req.user.id,
      personal_question_id: parseInt(id),
      is_personal: true
    };
    
    const answerId = await savePersonalAnswer(
      answer.question,
      answer.context,
      answer.answer,
      answer.model,
      answer.confidence,
      answer.date,
      answer.modelName,
      answer.user_id,
      answer.personal_question_id
    );
    
    answer.id = answerId;
    res.json(answer);
  } catch (error) {
    console.error('Error in personal question API route:', error);
    res.status(500).json({ 
      error: 'Failed to get answer from AI', 
      message: error.message 
    });
  }
});

// Get personal question answers
app.get('/api/personal-questions/:id/answers', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM answers WHERE personal_question_id = $1 AND user_id = $2 ORDER BY date DESC',
      [id, req.user.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching personal question answers:', error);
    res.status(500).json({ error: 'Failed to fetch answers' });
  }
});

// ===== SCHEDULING API ENDPOINTS =====

// Create or update schedule for a personal question
app.post('/api/personal-questions/:id/schedule', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { frequency_type, frequency_value, frequency_unit, selected_models } = req.body;
    
    if (!frequency_type || !selected_models || selected_models.length === 0) {
      return res.status(400).json({ error: 'Frequency type and selected models are required' });
    }
    
    // Verify the question belongs to the user
    const questionResult = await pool.query(
      'SELECT * FROM personal_questions WHERE id = $1 AND user_id = $2 AND is_active = true',
      [id, req.user.id]
    );
    
    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Personal question not found' });
    }
    
    // Calculate next run date
    const nextRunDate = calculateNextRunDate(frequency_type, frequency_value, frequency_unit);
    
    // Check if schedule already exists
    const existingSchedule = await pool.query(
      'SELECT * FROM question_schedules WHERE question_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    let result;
    if (existingSchedule.rows.length > 0) {
      // Update existing schedule
      result = await pool.query(
        `UPDATE question_schedules 
         SET frequency_type = $1, frequency_value = $2, frequency_unit = $3, 
             selected_models = $4, next_run_date = $5, updated_at = CURRENT_TIMESTAMP
         WHERE question_id = $6 AND user_id = $7 
         RETURNING *`,
        [frequency_type, frequency_value, frequency_unit, selected_models, nextRunDate, id, req.user.id]
      );
    } else {
      // Create new schedule
      result = await pool.query(
        `INSERT INTO question_schedules 
         (user_id, question_id, frequency_type, frequency_value, frequency_unit, selected_models, next_run_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [req.user.id, id, frequency_type, frequency_value, frequency_unit, selected_models, nextRunDate]
      );
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating/updating schedule:', error);
    res.status(500).json({ error: 'Failed to create/update schedule' });
  }
});

// Get schedule for a personal question
app.get('/api/personal-questions/:id/schedule', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM question_schedules WHERE question_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No schedule found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Delete schedule for a personal question
app.delete('/api/personal-questions/:id/schedule', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM question_schedules WHERE question_id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No schedule found' });
    }
    
    res.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// Get all schedules for the user
app.get('/api/schedules', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT qs.*, pq.question, pq.context 
       FROM question_schedules qs 
       JOIN personal_questions pq ON qs.question_id = pq.id 
       WHERE qs.user_id = $1 AND pq.is_active = true
       ORDER BY qs.created_at DESC`,
      [req.user.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Toggle schedule active status
app.post('/api/schedules/:id/toggle', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'UPDATE question_schedules SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error toggling schedule:', error);
    res.status(500).json({ error: 'Failed to toggle schedule' });
  }
});

// Execute schedule manually
app.post('/api/schedules/:id/execute', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get schedule details
    const scheduleResult = await pool.query(
      `SELECT qs.*, pq.question, pq.context 
       FROM question_schedules qs 
       JOIN personal_questions pq ON qs.question_id = pq.id 
       WHERE qs.id = $1 AND qs.user_id = $2`,
      [id, req.user.id]
    );
    
    if (scheduleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    
    const schedule = scheduleResult.rows[0];
    
    // Execute the schedule
    const executionResult = await executeSchedule(schedule);
    
    res.json(executionResult);
  } catch (error) {
    console.error('Error executing schedule:', error);
    res.status(500).json({ error: 'Failed to execute schedule' });
  }
});

// Get execution history for a schedule
app.get('/api/schedules/:id/executions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM scheduled_executions WHERE schedule_id = $1 ORDER BY execution_date DESC LIMIT 50',
      [id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching execution history:', error);
    res.status(500).json({ error: 'Failed to fetch execution history' });
  }
});

// ===== SCHEDULING UTILITY FUNCTIONS =====

function calculateNextRunDate(frequency_type, frequency_value, frequency_unit) {
  const now = new Date();
  let nextRun = new Date(now);
  
  switch (frequency_type) {
    case 'daily':
      nextRun.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      nextRun.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      nextRun.setMonth(now.getMonth() + 1);
      break;
    case 'custom':
      if (frequency_unit === 'days') {
        nextRun.setDate(now.getDate() + frequency_value);
      } else if (frequency_unit === 'weeks') {
        nextRun.setDate(now.getDate() + (frequency_value * 7));
      } else if (frequency_unit === 'months') {
        nextRun.setMonth(now.getMonth() + frequency_value);
      }
      break;
    default:
      nextRun.setDate(now.getDate() + 1); // Default to daily
  }
  
  return nextRun;
}

async function executeSchedule(schedule) {
  try {
    // Create execution record
    const executionResult = await pool.query(
      `INSERT INTO scheduled_executions (schedule_id, models_executed, execution_status)
       VALUES ($1, $2, 'running') RETURNING *`,
      [schedule.id, schedule.selected_models]
    );
    
    const execution = executionResult.rows[0];
    let successCount = 0;
    let failureCount = 0;
    const errors = [];
    
    // Collect API keys
    const apiKeys = {
      HUGGING_FACE_API_KEY: process.env.HUGGING_FACE_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    };
    
    // Execute for each selected model
    for (const modelId of schedule.selected_models) {
      try {
        const model = AVAILABLE_MODELS.find(m => m.id === modelId);
        if (!model || !apiKeys[model.apiKeyEnv]) {
          throw new Error(`Model ${modelId} not available or API key missing`);
        }
        
        const response = await askQuestion(schedule.question, schedule.context, modelId, apiKeys);
        
        // Save the answer
        await pool.query(
          `INSERT INTO personal_question_answers 
           (user_id, question_id, answer, model, model_name, confidence, schedule_id, execution_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            schedule.user_id,
            schedule.question_id,
            response.answer,
            response.model,
            response.modelName,
            response.score,
            schedule.id,
            execution.id
          ]
        );
        
        successCount++;
      } catch (error) {
        console.error(`Error executing model ${modelId}:`, error);
        errors.push(`${modelId}: ${error.message}`);
        failureCount++;
      }
    }
    
    // Update execution record
    await pool.query(
      `UPDATE scheduled_executions 
       SET success_count = $1, failure_count = $2, execution_status = $3, error_details = $4
       WHERE id = $5`,
      [successCount, failureCount, failureCount > 0 ? 'partial' : 'completed', errors.join('; '), execution.id]
    );
    
    // Update schedule's last run date and calculate next run
    const nextRunDate = calculateNextRunDate(schedule.frequency_type, schedule.frequency_value, schedule.frequency_unit);
    await pool.query(
      'UPDATE question_schedules SET last_run_date = CURRENT_TIMESTAMP, next_run_date = $1 WHERE id = $2',
      [nextRunDate, schedule.id]
    );
    
    return {
      execution_id: execution.id,
      success_count: successCount,
      failure_count: failureCount,
      errors: errors,
      status: failureCount > 0 ? 'partial' : 'completed'
    };
  } catch (error) {
    console.error('Error in executeSchedule:', error);
    throw error;
  }
}

// Schedule daily question and execute scheduled personal questions
cron.schedule('0 0 * * *', async () => {
  try {
    console.log('Running daily scheduled task at:', new Date().toISOString());
    
    // Execute daily question
    const apiKeys = {
      HUGGING_FACE_API_KEY: process.env.HUGGING_FACE_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    };
    
    const availableModel = AVAILABLE_MODELS.find(model => apiKeys[model.apiKeyEnv]);
    
    if (availableModel) {
      const { question, context } = getTodaysQuestion();
      const response = await askQuestion(question, context, availableModel.id, apiKeys);
      
      await saveAnswer(
        question, 
        context, 
        response.answer, 
        response.model,
        response.score, 
        new Date().toISOString(),
        response.modelName
      );
      
      console.log('Successfully saved daily AI answer');
    }
    
    // Execute scheduled personal questions
    await executeScheduledQuestions();
    
  } catch (error) {
    console.error('Error in daily scheduled task:', error);
  }
});

// Also run scheduled questions every hour to catch any missed executions
cron.schedule('0 * * * *', async () => {
  try {
    console.log('Running hourly scheduled question check at:', new Date().toISOString());
    await executeScheduledQuestions();
  } catch (error) {
    console.error('Error in hourly scheduled task:', error);
  }
});

// Execute all due scheduled questions
async function executeScheduledQuestions() {
  try {
    console.log('Checking for due scheduled questions...');
    
    const dueSchedules = await pool.query(
      `SELECT qs.*, pq.question, pq.context 
       FROM question_schedules qs 
       JOIN personal_questions pq ON qs.question_id = pq.id 
       WHERE qs.is_enabled = true 
       AND qs.next_run_date <= CURRENT_TIMESTAMP 
       AND pq.is_active = true`
    );
    
    console.log(`Found ${dueSchedules.rows.length} due schedules`);
    
    for (const schedule of dueSchedules.rows) {
      try {
        console.log(`Executing schedule ${schedule.id} for question: ${schedule.question}`);
        await executeSchedule(schedule);
        console.log(`Successfully executed schedule ${schedule.id}`);
      } catch (error) {
        console.error(`Error executing schedule ${schedule.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in executeScheduledQuestions:', error);
  }
}

// ===== CHAT API ENDPOINT =====

app.post('/api/chat', async (req, res) => {
  try {
    const { message, model, context = [], includeWikipedia = true, useAgent = true } = req.body;
    
    if (!message || !model) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message and model are required' 
      });
    }

    // Try AI Agent first if enabled
    if (useAgent) {
      try {
        const agentResult = await aiAgent.processQuestion(message, '', {
          model: model,
          includeWikipedia: includeWikipedia
        });
        
        if (agentResult.success) {
          return res.json({
            success: true,
            response: agentResult.response,
            model: model,
            wikipediaLinks: agentResult.sources || [],
            wikipediaSearchLog: agentResult.metadata?.searchLog || [],
            agent: agentResult.agent || { name: 'n8n AI Agent', mode: agentResult.integration?.mode || 'unknown' }
          });
        }
      } catch (agentError) {
        console.log('AI Agent failed, falling back to direct processing:', agentError.message);
      }
    }
    
    // Fallback to direct processing
    // Check if Ollama is available
    try {
      const ollamaResponse = await fetch(`${LOCAL_CONFIG.ollama.url}/api/tags`);
      if (!ollamaResponse.ok) {
        throw new Error('Ollama service not available');
      }
    } catch (error) {
      return res.status(503).json({ 
        success: false, 
        error: 'Local AI service (Ollama) is not available. Please ensure Ollama is running.' 
      });
    }
    
    // Prepare the prompt with context
    let prompt = '';
    
    // Add conversation context if provided
    if (context && context.length > 0) {
      prompt += 'Previous conversation:\n';
      context.forEach(msg => {
        prompt += `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}\n`;
      });
      prompt += '\n';
    }
    
    // Add Wikipedia context if enabled and available
    let wikipediaLinks = [];
    let wikipediaSearchLog = [];
    
    if (includeWikipedia && wikipedia.available) {
      try {
        // Use enhanced Wikipedia search with logging
        const { spawn } = require('child_process');
        
        // Add search status log
        wikipediaSearchLog.push("🔍 Starting Wikipedia search...");
        
        const enhancedSearch = spawn('python3', ['enhanced_wikipedia_api.py', 'enhanced_search', JSON.stringify({
          question: message,
          limit: 3
        })], { cwd: __dirname });
        
        let searchOutput = '';
        let searchError = '';
        
        enhancedSearch.stdout.on('data', (data) => {
          searchOutput += data.toString();
        });
        
        enhancedSearch.stderr.on('data', (data) => {
          searchError += data.toString();
        });
        
        await new Promise((resolve, reject) => {
          enhancedSearch.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Enhanced search failed with code ${code}: ${searchError}`));
            }
          });
        });
        
        if (searchOutput) {
          const searchResults = JSON.parse(searchOutput);
          
          // Add search log entries
          if (searchResults.status_log) {
            wikipediaSearchLog.push(...searchResults.status_log);
          }
          
          if (searchResults.results && searchResults.results.length > 0) {
            prompt += 'Relevant Wikipedia information:\n';
            searchResults.results.forEach(result => {
              // Safe content extraction with fallback
              const content = result.content || result.summary || result.snippet || '';
              const preview = content.length > 300 ? content.substring(0, 300) + '...' : content;
              prompt += `- ${result.title}: ${preview}\n`;
              wikipediaLinks.push({ 
                title: result.title, 
                url: `/wikipedia/article/${encodeURIComponent(result.title)}`,
                relevance: result.relevance_score 
              });
            });
            prompt += '\n';
            
            wikipediaSearchLog.push(`✅ Found ${searchResults.results.length} relevant articles`);
          } else {
            wikipediaSearchLog.push("ℹ️ No relevant Wikipedia articles found");
          }
        }
        
      } catch (error) {
        console.error('Error with enhanced Wikipedia search:', error);
        wikipediaSearchLog.push(`❌ Wikipedia search error: ${error.message}`);
        
        // Fallback to basic search
        try {
          wikipediaSearchLog.push("🔄 Falling back to basic Wikipedia search...");
          const searchResults = await wikipedia.searchWikipedia(message, 3);
          
          if (searchResults && searchResults.length > 0) {
            prompt += 'Relevant Wikipedia information:\n';
            searchResults.forEach(result => {
              prompt += `- ${result.title}: ${result.content.substring(0, 200)}...\n`;
              wikipediaLinks.push({ title: result.title, url: `/wikipedia/article/${encodeURIComponent(result.title)}` });
            });
            prompt += '\n';
            wikipediaSearchLog.push(`✅ Basic search found ${searchResults.length} articles`);
          }
        } catch (fallbackError) {
          console.error('Fallback Wikipedia search also failed:', fallbackError);
          wikipediaSearchLog.push(`❌ Fallback search failed: ${fallbackError.message}`);
        }
      }
    }
    // Add n8n capabilities context
    prompt += `
You have access to n8n workflow automation capabilities. You can create, initiate, and schedule workflows when appropriate for tasks like:
- Data processing and transformation
- Web monitoring and alerts
- Multi-source research
- API integrations
- Scheduled reporting
- Task automation

The n8n management portal is available at http://localhost:5678 for reviewing and editing workflows.

When a task would benefit from n8n automation:
1. Explain how n8n could help with the task
2. Suggest creating a workflow
3. Provide instructions for accessing the n8n portal
4. Describe the basic workflow steps needed
`;
    
    // Add the current message
    prompt += `Human: ${message}\nAssistant:`;
    
    // Call Ollama API
    try {
      const ollamaResponse = await fetch(`${LOCAL_CONFIG.ollama.url}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 1000
          }
        })
      });
      
      if (!ollamaResponse.ok) {
        throw new Error(`Ollama API error: ${ollamaResponse.status}`);
      }
      
      const result = await ollamaResponse.json();
      
      if (!result.response) {
        throw new Error('No response from AI model');
      }
      
      res.json({
        success: true,
        response: result.response.trim(),
        model: model,
        wikipediaLinks: wikipediaLinks,
        wikipediaSearchLog: wikipediaSearchLog
      });
      
    } catch (error) {
      console.error('Error calling Ollama:', error);
      res.status(500).json({ 
        success: false, 
        error: `Failed to get response from AI model: ${error.message}` 
      });
    }
    
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// ===== STREAMING CHAT API ENDPOINT =====

app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message, model, context = ['You are a helpful assistant. '], includeWikipedia = true } = req.body;
    
    if (!message || !model) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message and model are required' 
      });
    }
    
    // Check if Ollama is available
    try {
      const ollamaResponse = await fetch(`${LOCAL_CONFIG.ollama.url}/api/tags`);
      if (!ollamaResponse.ok) {
        throw new Error('Ollama service not available');
      }
    } catch (error) {
      return res.status(503).json({ 
        success: false, 
        error: 'Local AI service (Ollama) is not available. Please ensure Ollama is running.' 
      });
    }
    
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Prepare the prompt with context
    let prompt = '';
    
    // Add conversation context if provided
    if (context && context.length > 0) {
      prompt += 'Previous conversation:\n';
      context.forEach(msg => {
        prompt += `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}\n`;
      });
      prompt += '\n';
    }
    
    // Add Wikipedia context if enabled and available
    let wikipediaLinks = [];
    if (includeWikipedia && wikipedia.available) {
      try {
        const searchResults = await wikipedia.searchWikipedia(message, 3);
        if (searchResults && searchResults.length > 0) {
    // Add n8n capabilities context
    prompt += `
You have access to n8n workflow automation capabilities. You can create, initiate, and schedule workflows when appropriate for tasks like:
- Data processing and transformation
- Web monitoring and alerts
- Multi-source research
- API integrations
- Scheduled reporting
- Task automation

The n8n management portal is available at http://localhost:5678 for reviewing and editing workflows.

When a task would benefit from n8n automation:
1. Explain how n8n could help with the task
2. Suggest creating a workflow
3. Provide instructions for accessing the n8n portal
4. Describe the basic workflow steps needed
`;
          // logging relevant Wikipedia information
          console.log('Relevant Wikipedia information found:', searchResults);
          prompt += 'Relevant Wikipedia information:\n';
          searchResults.forEach(result => {
            prompt += `- ${result.title}: ${result.content.substring(0, 200)}...\n`;
            wikipediaLinks.push({ title: result.title, url: `/wikipedia/article/${encodeURIComponent(result.title)}` });
          });
          prompt += '\n';
        }
      } catch (error) {
        console.error('Error searching Wikipedia:', error);
      }
    }
    
    // Send Wikipedia links first if available
    if (wikipediaLinks.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'wikipedia', links: wikipediaLinks })}\n\n`);
    }
    
    // Add the current message
    prompt += `Human: ${message}\nAssistant:`;
    
    // Call Ollama API with streaming
    try {
      const ollamaResponse = await fetch(`${LOCAL_CONFIG.ollama.url}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: true,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 1000
          }
        })
      });
      
      if (!ollamaResponse.ok) {
        throw new Error(`Ollama API error: ${ollamaResponse.status}`);
      }
      
      // Handle streaming response
      const reader = ollamaResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                if (data.response) {
                  // Send each token to the client
                  res.write(`data: ${JSON.stringify({ type: 'token', content: data.response })}\n\n`);
                }
                if (data.done) {
                  // Send completion signal
                  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
                  break;
                }
              } catch (parseError) {
                console.error('Error parsing streaming response:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();
      
    } catch (error) {
      console.error('Error calling Ollama streaming:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: `Failed to get response from AI model: ${error.message}` })}\n\n`);
      res.end();
    }
    
  } catch (error) {
    console.error('Error in streaming chat endpoint:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`);
    res.end();
  }
});

// ===== WIKIPEDIA ARTICLE ENDPOINT =====

app.get('/wikipedia/article/:title', async (req, res) => {
  try {
    const { title } = req.params;
    
    if (!wikipedia.available) {
      return res.status(503).send(`
        <html>
          <head><title>Wikipedia Not Available</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h1>📚 Wikipedia Database Not Available</h1>
            <p>The Wikipedia database is not currently available. Please check the main page to download it.</p>
            <a href="/" style="color: #007bff;">← Back to Main Page</a>
          </body>
        </html>
      `);
    }
    
    try {
      const article = await wikipedia.getArticle(title);
      
      if (!article) {
        return res.status(404).send(`
          <html>
            <head><title>Article Not Found</title></head>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
              <h1>📄 Article Not Found</h1>
              <p>The article "${title}" was not found in the Wikipedia database.</p>
              <a href="/" style="color: #007bff;">← Back to Main Page</a>
            </body>
          </html>
        `);
      }
      
      // Parse and clean the Wikipedia content - remove infobox completely
      let cleanContent = article.content;
      
      // Find where "Poland is a country" starts and use everything from there
      const startPhrase = "Poland is a country";
      const startIndex = cleanContent.indexOf(startPhrase);
      
      if (startIndex !== -1) {
        cleanContent = cleanContent.substring(startIndex);
      } else {
        // Fallback: remove everything until we find substantial content
        const lines = cleanContent.split('\n');
        let contentStartIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.length > 50 && !line.startsWith('|') && !line.startsWith('{{') && !line.startsWith('}}')) {
            contentStartIndex = i;
            break;
          }
        }
        cleanContent = lines.slice(contentStartIndex).join('\n');
      }
      
      cleanContent = parseWikipediaContent(cleanContent);
      const infoboxData = {}; // Skip infobox extraction for now
      
      // Create infobox HTML if we have data
      let infoboxHtml = '';
      if (Object.keys(infoboxData).length > 0) {
        infoboxHtml = `
          <div class="infobox">
            <h3>${article.title}</h3>
            ${Object.entries(infoboxData).map(([key, value]) => 
              `<div class="info-row"><strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong> ${value}</div>`
            ).join('')}
          </div>
        `;
      }
      
      res.send(`
        <html>
          <head>
            <title>${article.title} - Local Wikipedia</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                line-height: 1.6; 
                max-width: 1000px; 
                margin: 0 auto; 
                padding: 20px; 
                color: #333;
                background: #f8f9fa;
              }
              .container {
                background: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .header { 
                border-bottom: 2px solid #eee; 
                padding-bottom: 15px; 
                margin-bottom: 20px; 
              }
              .back-link { 
                color: #007bff; 
                text-decoration: none; 
                font-size: 14px;
                display: inline-block;
                margin-bottom: 10px;
              }
              .back-link:hover { text-decoration: underline; }
              h1 { 
                color: #000; 
                margin: 10px 0; 
                font-size: 2.5em;
                border-bottom: 3px solid #007bff;
                padding-bottom: 10px;
              }
              h2 { 
                color: #333; 
                margin-top: 30px; 
                margin-bottom: 15px;
                font-size: 1.5em;
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
              }
              h3 { 
                color: #555; 
                margin-top: 25px; 
                margin-bottom: 10px;
                font-size: 1.2em;
              }
              h4 { 
                color: #666; 
                margin-top: 20px; 
                margin-bottom: 8px;
              }
              .infobox {
                float: right;
                width: 300px;
                margin: 0 0 20px 20px;
                padding: 15px;
                background: #f8f9fa;
                border: 1px solid #ddd;
                border-radius: 5px;
                font-size: 0.9em;
              }
              .infobox h3 {
                margin-top: 0;
                text-align: center;
                background: #007bff;
                color: white;
                padding: 10px;
                margin: -15px -15px 15px -15px;
                border-radius: 5px 5px 0 0;
              }
              .info-row {
                margin-bottom: 8px;
                padding: 5px 0;
                border-bottom: 1px solid #eee;
              }
              .content { 
                line-height: 1.8; 
                font-size: 16px;
              }
              .content p {
                margin-bottom: 15px;
                text-align: justify;
              }
              .content ul, .content ol {
                margin: 15px 0;
                padding-left: 30px;
              }
              .content li {
                margin-bottom: 5px;
              }
              @media (max-width: 768px) {
                .infobox {
                  float: none;
                  width: 100%;
                  margin: 0 0 20px 0;
                }
                body { padding: 10px; }
                .container { padding: 20px; }
                h1 { font-size: 2em; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <a href="/" class="back-link">← Back to AI Questions</a>
                <h1>📄 ${article.title}</h1>
                <p style="color: #666; margin: 0;">From Local Wikipedia Database</p>
              </div>
              ${infoboxHtml}
              <div class="content">${cleanContent}</div>
            </div>
          </body>
        </html>
      `);
      
    } catch (error) {
      console.error('Error retrieving article:', error);
      res.status(500).send(`
        <html>
          <head><title>Error</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h1>❌ Error</h1>
            <p>An error occurred while retrieving the article: ${error.message}</p>
            <a href="/" style="color: #007bff;">← Back to Main Page</a>
          </body>
        </html>
      `);
    }
    
  } catch (error) {
    console.error('Error in Wikipedia article endpoint:', error);
    res.status(500).send('Internal server error');
  }
});

// Server will be started by startServer() function below
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the application`) ;
// });

// ===== ANALYTICS API ENDPOINTS =====

// Get analytics for a specific question
app.get('/api/analytics/question/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get question details
    const questionResult = await pool.query(
      'SELECT * FROM personal_questions WHERE id = $1 AND user_id = $2 AND is_active = true',
      [id, req.user.id]
    );
    
    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    const question = questionResult.rows[0];
    
    // Get all answers for this question - check both tables
    const answersResult = await pool.query(
      `SELECT 
         answer, model, model_name, confidence, date, 
         NULL as schedule_id, NULL as execution_id,
         'answers' as source_table
       FROM answers 
       WHERE personal_question_id = $1 AND user_id = $2
       UNION ALL
       SELECT 
         answer, model, model_name, confidence, date, 
         schedule_id, execution_id,
         'personal_question_answers' as source_table
       FROM personal_question_answers 
       WHERE question_id = $1 AND user_id = $2
       ORDER BY date DESC`,
      [id, req.user.id]
    );
    
    const answers = answersResult.rows;
    
    // Calculate analytics
    const analytics = {
      question: question,
      total_answers: answers.length,
      models_used: [...new Set(answers.map(a => a.model))],
      date_range: {
        first_answer: answers.length > 0 ? answers[answers.length - 1].date : null,
        last_answer: answers.length > 0 ? answers[0].date : null
      },
      scheduled_answers: answers.filter(a => a.schedule_id).length,
      manual_answers: answers.filter(a => !a.schedule_id).length,
      answers_by_model: {},
      answers_by_date: {},
      recent_answers: answers.slice(0, 10)
    };
    
    // Group answers by model
    answers.forEach(answer => {
      const modelName = answer.model_name || answer.model;
      if (!analytics.answers_by_model[modelName]) {
        analytics.answers_by_model[modelName] = [];
      }
      analytics.answers_by_model[modelName].push(answer);
    });
    
    // Group answers by date (for trend analysis)
    answers.forEach(answer => {
      const date = new Date(answer.date).toISOString().split('T')[0];
      if (!analytics.answers_by_date[date]) {
        analytics.answers_by_date[date] = [];
      }
      analytics.answers_by_date[date].push(answer);
    });
    
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching question analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Compare models for a specific question
app.get('/api/analytics/model-comparison/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { timeframe = '30' } = req.query; // days
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeframe));
    
    const result = await pool.query(
      `SELECT 
         model, 
         model_name,
         COUNT(*) as answer_count,
         AVG(confidence) as avg_confidence,
         MIN(date) as first_answer,
         MAX(date) as last_answer,
         ARRAY_AGG(answer ORDER BY date DESC) as recent_answers
       FROM (
         SELECT answer, model, model_name, confidence, date
         FROM answers 
         WHERE personal_question_id = $1 AND user_id = $2 AND date >= $3
         UNION ALL
         SELECT answer, model, model_name, confidence, date
         FROM personal_question_answers 
         WHERE question_id = $1 AND user_id = $2 AND date >= $3
       ) combined_answers
       GROUP BY model, model_name
       ORDER BY answer_count DESC`,
      [id, req.user.id, cutoffDate]
    );
    
    const comparison = {
      timeframe_days: parseInt(timeframe),
      models: result.rows.map(row => ({
        model: row.model,
        model_name: row.model_name || row.model,
        answer_count: parseInt(row.answer_count),
        avg_confidence: parseFloat(row.avg_confidence || 0),
        first_answer: row.first_answer,
        last_answer: row.last_answer,
        recent_answers: row.recent_answers.slice(0, 3) // Last 3 answers
      }))
    };
    
    res.json(comparison);
  } catch (error) {
    console.error('Error fetching model comparison:', error);
    res.status(500).json({ error: 'Failed to fetch model comparison' });
  }
});

// Get trend analysis for a question
app.get('/api/analytics/trend-analysis/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { period = 'week' } = req.query; // 'week', 'month', 'quarter'
    
    let dateFormat, intervalDays;
    switch (period) {
      case 'week':
        dateFormat = 'YYYY-MM-DD';
        intervalDays = 7;
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        intervalDays = 30;
        break;
      case 'quarter':
        dateFormat = 'YYYY-Q';
        intervalDays = 90;
        break;
      default:
        dateFormat = 'YYYY-MM-DD';
        intervalDays = 7;
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - intervalDays);
    
    const result = await pool.query(
      `SELECT 
         DATE_TRUNC($1, date) as period,
         model,
         model_name,
         COUNT(*) as answer_count,
         AVG(confidence) as avg_confidence
       FROM (
         SELECT date, model, model_name, confidence
         FROM answers 
         WHERE personal_question_id = $2 AND user_id = $3 AND date >= $4
         UNION ALL
         SELECT date, model, model_name, confidence
         FROM personal_question_answers 
         WHERE question_id = $2 AND user_id = $3 AND date >= $4
       ) combined_answers
       GROUP BY DATE_TRUNC($1, date), model, model_name
       ORDER BY period DESC, answer_count DESC`,
      [period, id, req.user.id, cutoffDate]
    );
    
    // Group by period
    const trendData = {};
    result.rows.forEach(row => {
      const periodKey = row.period.toISOString().split('T')[0];
      if (!trendData[periodKey]) {
        trendData[periodKey] = {
          period: periodKey,
          models: {},
          total_answers: 0
        };
      }
      
      const modelName = row.model_name || row.model;
      trendData[periodKey].models[modelName] = {
        answer_count: parseInt(row.answer_count),
        avg_confidence: parseFloat(row.avg_confidence || 0)
      };
      trendData[periodKey].total_answers += parseInt(row.answer_count);
    });
    
    const trends = {
      period: period,
      timeframe_days: intervalDays,
      data: Object.values(trendData).sort((a, b) => new Date(b.period) - new Date(a.period))
    };
    
    res.json(trends);
  } catch (error) {
    console.error('Error fetching trend analysis:', error);
    res.status(500).json({ error: 'Failed to fetch trend analysis' });
  }
});

// Get dashboard summary for all user's scheduled questions
app.get('/api/analytics/dashboard', requireAuth, async (req, res) => {
  try {
    // Get all active schedules with question details
    const schedulesResult = await pool.query(
      `SELECT qs.*, pq.question, pq.context,
              COUNT(pqa.id) as total_answers,
              MAX(pqa.date) as last_answer_date,
              COUNT(DISTINCT pqa.model) as models_used
       FROM question_schedules qs
       JOIN personal_questions pq ON qs.question_id = pq.id
       LEFT JOIN personal_question_answers pqa ON pqa.question_id = qs.question_id AND pqa.schedule_id = qs.id
       WHERE qs.user_id = $1 AND pq.is_active = true
       GROUP BY qs.id, pq.question, pq.context
       ORDER BY qs.created_at DESC`,
      [req.user.id]
    );
    
    // Get recent execution summary
    const executionsResult = await pool.query(
      `SELECT se.*, qs.question_id, pq.question
       FROM scheduled_executions se
       JOIN question_schedules qs ON se.schedule_id = qs.id
       JOIN personal_questions pq ON qs.question_id = pq.id
       WHERE qs.user_id = $1
       ORDER BY se.execution_date DESC
       LIMIT 20`,
      [req.user.id]
    );
    
    // Calculate summary statistics
    const totalSchedules = schedulesResult.rows.length;
    const activeSchedules = schedulesResult.rows.filter(s => s.is_active).length;
    const totalAnswers = schedulesResult.rows.reduce((sum, s) => sum + parseInt(s.total_answers || 0), 0);
    const totalModels = new Set(schedulesResult.rows.flatMap(s => s.selected_models || [])).size;
    
    const dashboard = {
      summary: {
        total_schedules: totalSchedules,
        active_schedules: activeSchedules,
        total_scheduled_answers: totalAnswers,
        unique_models_used: totalModels
      },
      schedules: schedulesResult.rows.map(row => ({
        ...row,
        total_answers: parseInt(row.total_answers || 0),
        models_used: parseInt(row.models_used || 0)
      })),
      recent_executions: executionsResult.rows
    };
    
    res.json(dashboard);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});



// ===== OLLAMA API ENDPOINTS =====

// Get available local models
app.get('/api/ollama/models', async (req, res) => {
  try {
    const models = await ollama.listModels();
    const recommended = ollama.getRecommendedModels();
    
    res.json({
      available: models.models || [],
      recommended: recommended,
      service_available: ollama.available
    });
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch local models',
      available: [],
      recommended: ollama.getRecommendedModels(),
      service_available: false
    });
  }
});

// Download a model
app.post('/api/ollama/models/:modelName/download', async (req, res) => {
  try {
    const { modelName } = req.params;
    
    if (!ollama.available) {
      return res.status(503).json({ error: 'Ollama service is not available' });
    }
    
    // Start the download (this is async and may take a long time)
    ollama.pullModel(modelName)
      .then(() => {
        console.log(`Model ${modelName} downloaded successfully`);
      })
      .catch(error => {
        console.error(`Failed to download model ${modelName}:`, error);
      });
    
    res.json({ 
      message: `Download started for model ${modelName}`,
      status: 'downloading'
    });
  } catch (error) {
    console.error('Error starting model download:', error);
    res.status(500).json({ error: 'Failed to start model download' });
  }
});

// Delete a model
app.delete('/api/ollama/models/:modelName', async (req, res) => {
  try {
    const { modelName } = req.params;
    
    if (!ollama.available) {
      return res.status(503).json({ error: 'Ollama service is not available' });
    }
    
    await ollama.deleteModel(modelName);
    
    res.json({ 
      message: `Model ${modelName} deleted successfully`,
      status: 'deleted'
    });
  } catch (error) {
    console.error('Error deleting model:', error);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// Test a model
app.post('/api/ollama/models/:modelName/test', async (req, res) => {
  try {
    const { modelName } = req.params;
    
    if (!ollama.available) {
      return res.status(503).json({ error: 'Ollama service is not available' });
    }
    
    const testPrompt = "Hello! Please respond with a brief greeting to confirm you're working correctly.";
    const response = await ollama.generateResponse(modelName, testPrompt);
    
    res.json({
      message: 'Model test successful',
      response_text: response.answer,
      response_time: response.response_time,
      model: response.model
    });
  } catch (error) {
    console.error('Error testing model:', error);
    res.status(500).json({ error: `Model test failed: ${error.message}` });
  }
});

// Get Ollama service status
app.get('/api/ollama/status', async (req, res) => {
  try {
    const isAvailable = await ollama.checkAvailability();
    const models = isAvailable ? await ollama.listModels() : { models: [] };
    
    res.json({
      service_available: isAvailable,
      service_url: ollama.baseUrl,
      model_count: models.models ? models.models.length : 0,
      models: models.models || []
    });
  } catch (error) {
    console.error('Error checking Ollama status:', error);
    res.json({
      service_available: false,
      service_url: ollama.baseUrl,
      model_count: 0,
      models: [],
      error: error.message
    });
  }
});

// Get combined model list (cloud + local)
app.get('/api/models/all', async (req, res) => {
  try {
    const cloudModels = AVAILABLE_MODELS.map(model => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      type: 'cloud',
      available: !!process.env[model.apiKeyEnv],
      api_key_required: model.apiKeyEnv
    }));
    
    let localModels = [];
    if (ollama.available) {
      const ollamaModels = await ollama.listModels();
      localModels = (ollamaModels.models || []).map(model => ({
        id: model.name,
        name: ollama.getModelDisplayName(model.name),
        provider: 'ollama',
        type: 'local',
        available: true,
        size: model.size,
        modified_at: model.modified_at
      }));
    }
    
    res.json({
      cloud_models: cloudModels,
      local_models: localModels,
      ollama_available: ollama.available
    });
  } catch (error) {
    console.error('Error fetching all models:', error);
    res.status(500).json({ error: 'Failed to fetch model list' });
  }
});


// ===== WIKIPEDIA API ENDPOINTS =====

// Wikipedia search
app.get('/api/wikipedia/search', async (req, res) => {
  try {
    const { q: query, limit = 5 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }
    
    const result = await wikipedia.searchWikipedia(query, parseInt(limit));
    res.json(result);
    
  } catch (error) {
    console.error('Wikipedia search error:', error);
    res.status(500).json({ error: 'Wikipedia search failed' });
  }
});

// Wikipedia context for AI
app.get('/api/wikipedia/context', async (req, res) => {
  try {
    const { q: query, maxLength = 2000 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }
    
    const result = await wikipedia.getWikipediaContext(query, parseInt(maxLength));
    res.json(result);
    
  } catch (error) {
    console.error('Wikipedia context error:', error);
    res.status(500).json({ error: 'Wikipedia context extraction failed' });
  }
});

const { parseWikipediaContent, extractInfoboxData } = require('./wikipedia-parser');

// Wikipedia article route (duplicate - removing)
// app.get('/wikipedia/article/:title', async (req, res) => {{
//   try {
//     const { id } = req.params;
    
//     const result = await wikipedia.runPythonScript('article', { article_id: id });
//     const parsed = JSON.parse(result);
//     
//     if (parsed.error) {
//       return res.status(404).json(parsed);
//     }
//     
//     res.json(parsed);
//     
//   } catch (error) {
//     console.error('Wikipedia article error:', error);
//     res.status(500).json({ error: 'Failed to get Wikipedia article' });
//   }
// });

// Random Wikipedia articles
app.get('/api/wikipedia/random', async (req, res) => {
  try {
    const { count = 5 } = req.query;
    
    const result = await wikipedia.runPythonScript('random', { count: parseInt(count) });
    const parsed = JSON.parse(result);
    
    res.json(parsed);
    
  } catch (error) {
    console.error('Wikipedia random articles error:', error);
    res.status(500).json({ error: 'Failed to get random articles' });
  }
});

// Wikipedia categories
app.get('/api/wikipedia/categories', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const result = await wikipedia.runPythonScript('categories', { limit: parseInt(limit) });
    const parsed = JSON.parse(result);
    
    res.json(parsed);
    
  } catch (error) {
    console.error('Wikipedia categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// Search by category
app.get('/api/wikipedia/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 10 } = req.query;
    
    const result = await wikipedia.runPythonScript('category', { 
      category: decodeURIComponent(category), 
      limit: parseInt(limit) 
    });
    const parsed = JSON.parse(result);
    
    res.json(parsed);
    
  } catch (error) {
    console.error('Wikipedia category search error:', error);
    res.status(500).json({ error: 'Failed to search category' });
  }
});

// Wikipedia statistics
app.get('/api/wikipedia/stats', async (req, res) => {
  try {
    const result = await wikipedia.getWikipediaStats();
    res.json(result);
    
  } catch (error) {
    console.error('Wikipedia stats error:', error);
    res.status(500).json({ error: 'Failed to get Wikipedia statistics' });
  }
});

// Wikipedia status
app.get('/api/wikipedia/status', async (req, res) => {
  try {
    const status = {
      available: wikipedia.available,
      database_path: wikipedia.wikipediaDbPath,
      database_exists: fs.existsSync(wikipedia.wikipediaDbPath)
    };
    
    if (wikipedia.available) {
      const stats = await wikipedia.getWikipediaStats();
      status.stats = stats;
    }
    
    res.json(status);
    
  } catch (error) {
    console.error('Wikipedia status error:', error);
    res.status(500).json({ error: 'Failed to get Wikipedia status' });
  }
});

// Download Wikipedia dataset
app.post('/api/wikipedia/download', async (req, res) => {
  try {
    const { dataset = 'simple' } = req.body;
    
    // This would trigger the download process
    // Return download initiation response
    res.json({ 
      message: `Wikipedia ${dataset} dataset download initiated`,
      dataset: dataset,
      status: 'started'
    });
    
  } catch (error) {
    console.error('Wikipedia download error:', error);
    res.status(500).json({ error: 'Failed to start Wikipedia download' });
  }
});

// ===== AI AGENT API ENDPOINTS =====

// Agent status endpoint
app.get('/api/agent/status', async (req, res) => {
  try {
    const status = await aiAgent.getAgentStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get agent status',
      details: error.message
    });
  }
});

// Task automation endpoint
app.post('/api/agent/task', async (req, res) => {
  try {
    const { type, data, priority = 'normal' } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({
        success: false,
        error: 'Task type and data are required'
      });
    }
    
    const result = await aiAgent.automateTask(type, data, priority);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Task automation failed',
      details: error.message
    });
  }
});

// Enhanced question processing endpoint
app.post('/api/agent/question', async (req, res) => {
  try {
    const { question, context = '', preferences = {} } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required'
      });
    }
    
    const result = await aiAgent.processQuestion(question, context, preferences);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Question processing failed',
      details: error.message
    });
  }
});

// Agent initialization endpoint
app.post('/api/agent/initialize', async (req, res) => {
  try {
    const status = await aiAgent.initialize();
    res.json({
      success: true,
      message: 'AI Agent initialized successfully',
      status: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Agent initialization failed',
      details: error.message
    });
  }
});

// ===== START SERVER =====

// Initialize AI Agent and start server
async function startServer() {
  try {
    console.log('🤖 Initializing AI Agent...');
    await aiAgent.initialize();
    
    app.listen(PORT, () => {
      console.log(`🚀 Local AI Questions server running on http://localhost:${PORT}`);
      console.log(`📊 AI Agent status available at http://localhost:${PORT}/api/agent/status`);
      console.log(`🔧 Task automation available at http://localhost:${PORT}/api/agent/task`);
      console.log(`❓ Enhanced questions at http://localhost:${PORT}/api/agent/question`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

