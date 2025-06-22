const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const cron = require('node-cron');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const { addOfflinePackageRoutes } = require('./offline-package-routes');
const offlinePackageRoutesNew = require('./offline-package-routes-new');
const { InferenceClient } = require("@huggingface/inference");
// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
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
} else {
  console.log('Google OAuth not configured - running without authentication');
}

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Create tables if they don't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error('Error creating users table:', err));

// Create user API keys table
pool.query(`
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
`).catch(err => console.error('Error creating user_api_keys table:', err));

// Create user model preferences table
pool.query(`
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
`).catch(err => console.error('Error creating user_model_preferences table:', err));

pool.query(`
  CREATE TABLE IF NOT EXISTS personal_questions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    context TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error('Error creating personal_questions table:', err));

// Check if answers table exists and add new columns if needed
async function migrateAnswersTable() {
  try {
    // First, create the table if it doesn't exist (original structure)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS answers (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        context TEXT NOT NULL,
        answer TEXT NOT NULL,
        model TEXT NOT NULL,
        model_name TEXT,
        confidence REAL NOT NULL,
        date TIMESTAMP NOT NULL
      )
    `);

    // Check if new columns exist and add them if they don't
    const checkColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'answers' AND table_schema = 'public'
    `);
    
    const existingColumns = checkColumns.rows.map(row => row.column_name);
    
    // Add user_id column if it doesn't exist
    if (!existingColumns.includes('user_id')) {
      await pool.query(`
        ALTER TABLE answers 
        ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('Added user_id column to answers table');
    }
    
    // Add personal_question_id column if it doesn't exist
    if (!existingColumns.includes('personal_question_id')) {
      await pool.query(`
        ALTER TABLE answers 
        ADD COLUMN personal_question_id INTEGER REFERENCES personal_questions(id) ON DELETE CASCADE
      `);
      console.log('Added personal_question_id column to answers table');
    }
    
    // Add is_personal column if it doesn't exist
    if (!existingColumns.includes('is_personal')) {
      await pool.query(`
        ALTER TABLE answers 
        ADD COLUMN is_personal BOOLEAN DEFAULT false
      `);
      console.log('Added is_personal column to answers table');
    }
    
    console.log('Database migration completed successfully');
  } catch (err) {
    console.error('Error during database migration:', err);
  }
}

// Run migration
migrateAnswersTable();

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
        is_active BOOLEAN DEFAULT true,
        next_run_date TIMESTAMP,
        last_run_date TIMESTAMP,
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
        failure_count INTEGER DEFAULT 0,
        execution_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
        error_details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create personal_question_answers table if it doesn't exist
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

// Run scheduling table creation
createSchedulingTables();

// Available AI models
// Default enabled models for new users
const DEFAULT_ENABLED_MODELS = [
  "microsoft/DialoGPT-medium",
  "google/flan-t5-large", 
  "microsoft/DialoGPT-large",
  "gpt-3.5-turbo",
  "claude-3-haiku"
];

const AVAILABLE_MODELS = [
  // Premium models (API key required) - ChatGPT first as default
  {
    id: "gpt-3.5-turbo",
    name: "ChatGPT (GPT-3.5 Turbo)",
    provider: "openai",
    apiKeyEnv: "OPENAI_API_KEY",
    free: false,
    description: "OpenAI's fast and capable conversational AI model",
    requiresAuth: false, // Changed to false to allow guest usage
    defaultEnabled: true
  },
  
  // Hugging Face models (updated with working model names)
  {
    id: "microsoft/DialoGPT-medium",
    name: "Microsoft DialoGPT Medium",
    provider: "huggingface",
    apiKeyEnv: "HUGGING_FACE_API_KEY",
    free: false, // Changed to false since using paid API
    description: "Conversational AI model trained on Reddit conversations",
    defaultEnabled: true // Re-enabled
  },
  {
    id: "google/flan-t5-base",
    name: "Google Flan-T5 Base",
    provider: "huggingface", 
    apiKeyEnv: "HUGGING_FACE_API_KEY",
    free: false, // Changed to false since using paid API
    description: "Instruction-tuned text-to-text transformer (base model)",
    defaultEnabled: true // Re-enabled
  },
  {
    id: "microsoft/DialoGPT-large",
    name: "Microsoft DialoGPT Large",
    provider: "huggingface",
    apiKeyEnv: "HUGGING_FACE_API_KEY",
    free: false, // Changed to false since using paid API
    description: "Larger conversational AI model with better responses",
    defaultEnabled: true // Re-enabled
  },
  {
    id: "facebook/blenderbot-400M-distill",
    name: "Facebook BlenderBot",
    provider: "huggingface",
    apiKeyEnv: "HUGGING_FACE_API_KEY",
    free: false,
    description: "Open-domain chatbot with engaging conversations",
    defaultEnabled: true
  },
  
  // Additional OpenAI models
  {
    id: "gpt-4",
    name: "ChatGPT (GPT-4)",
    provider: "openai", 
    apiKeyEnv: "OPENAI_API_KEY",
    free: false,
    description: "OpenAI's most advanced reasoning model",
    requiresAuth: false, // Changed to false to allow guest usage
    defaultEnabled: false
  },
  {
    id: "gpt-4-turbo",
    name: "ChatGPT (GPT-4 Turbo)",
    provider: "openai",
    apiKeyEnv: "OPENAI_API_KEY", 
    free: false,
    description: "Faster GPT-4 with improved performance",
    requiresAuth: false, // Changed to false to allow guest usage
    defaultEnabled: false
  },
  {
    id: "claude-3-haiku",
    name: "Claude 3 Haiku",
    provider: "anthropic",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    free: false,
    description: "Anthropic's fastest model for simple tasks",
    requiresAuth: true,
    defaultEnabled: true
  },
  {
    id: "claude-3-sonnet",
    name: "Claude 3 Sonnet", 
    provider: "anthropic",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    free: false,
    description: "Balanced model for complex reasoning",
    requiresAuth: true,
    defaultEnabled: false
  },
  {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
    provider: "anthropic",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    free: false,
    description: "Anthropic's most powerful model",
    requiresAuth: true,
    defaultEnabled: false
  },
  {
    id: "gemini-pro",
    name: "Google Gemini Pro",
    provider: "google",
    apiKeyEnv: "GOOGLE_AI_API_KEY",
    free: false,
    description: "Google's advanced multimodal AI model",
    requiresAuth: true,
    defaultEnabled: false
  },
  {
    id: "llama-2-70b",
    name: "Meta Llama 2 70B",
    provider: "huggingface",
    apiKeyEnv: "HUGGING_FACE_API_KEY",
    free: false,
    description: "Meta's large language model",
    requiresAuth: true,
    defaultEnabled: false
  },
  {
    id: "mistral-7b",
    name: "Mistral 7B",
    provider: "huggingface", 
    apiKeyEnv: "HUGGING_FACE_API_KEY",
    free: false,
    description: "Efficient and powerful open-source model",
    requiresAuth: true,
    defaultEnabled: false
  }
];

// Daily Questions Array
const DAILY_QUESTIONS = [
  {
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
    context: "Newspeak in '1984' is a controlled language created by the Party to limit freedom of thought. It eliminates nuance and restricts the range of ideas that can be expressed. Words like 'doublethink', 'thoughtcrime', and 'unperson' demonstrate how language can be manipulated to control thought."
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
    context: "In '1984', O'Brien first appears as a potential ally to Winston in the resistance, but is later revealed to be a devoted Inner Party member who tortures Winston into submission. Their relationship demonstrates the absolute power the Party holds over individuals and the betrayal inherent in totalitarian systems."
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
async function askQuestion(question, context, modelId, apiKeys) {
  let selectedModel; // Declare at function scope
  
  try {
    // Find the selected model
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
    // Prompt version 2.0 - Optimized for concise answers
    const promptVersion = "2.0";
    const prompt = `Based on the following context, please answer this question concisely and directly. Be thorough but efficient with your words:
    
Context: ${context}

Question: ${question}

Answer (be concise):`;

    let answer;
    
    // Handle different providers
    if (selectedModel.provider === 'huggingface') {
      // Hugging Face API call with improved error handling
      console.log(`Calling Hugging Face model: ${selectedModel.id}`);

      const client = new InferenceClient(apiKey);

      const chatCompletion = await client.chatCompletion({
          provider: "novita",
          model: selectedModel.id,
          messages: [
              {
                  role: "user",
                  content: prompt,
              },
          ],
      });
      
      // Handle different response formats from Hugging Face
      console.log('Hugging Face raw response:', JSON.stringify(chatCompletion, null, 2));
      
      if (Array.isArray(chatCompletion.choices) && chatCompletion.choices.length > 0) {
        // For text generation models, the response includes the original prompt
        const firstResult = chatCompletion.choices[0].message.content;
        if (typeof firstResult === 'string') {
          answer = firstResult.trim();
        } else {
          answer = JSON.stringify(firstResult);
        }
      // detect if the chatCompletion was an error response
      } else if (chatCompletion.error && chatCompletion.error.message) {
        throw new Error(`Hugging Face API Error: ${chatCompletion.error.message}`);
      } else {
        // Fallback for unexpected response format
        console.warn('Unexpected Hugging Face response format:', chatCompletion);
        answer = chatCompletion.choices ? chatCompletion.choices[0].message.content : '';
      }
      
      // Ensure we have a meaningful answer
      if (!answer || answer.length < 5) {
        throw new Error(`Model "${selectedModel.name}" returned an empty or very short response. This may indicate the model is not suitable for this type of question.`);
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
    
    return {
      answer: answer,
      model: selectedModel.id,
      modelName: selectedModel.name,
      score: 1.0,
      promptVersion: promptVersion // Include the prompt version in the response
    };
  } catch (error) {
    console.error('Error calling AI API:', error);
    
    // Enhanced error logging and handling
    if (selectedModel && selectedModel.provider === 'huggingface' && error.response) {
      console.error('Hugging Face API Error Details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        model: selectedModel.id
      });
      
      // Provide specific error messages for common Hugging Face issues
      if (error.response.status === 404) {
        throw new Error(`Model "${selectedModel.name}" is not available through the Hugging Face Inference API. The model may not exist or may not support text generation.`);
      } else if (error.response.status === 503) {
        throw new Error(`Model "${selectedModel.name}" is currently loading. Please try again in a few minutes.`);
      } else if (error.response.status === 429) {
        throw new Error('Rate limit exceeded for Hugging Face API. Please try again later.');
      } else if (error.response.status === 401) {
        throw new Error('Hugging Face API authentication failed. Please check the API key configuration.');
      } else if (error.response.status === 400) {
        const errorData = error.response.data;
        if (errorData && errorData.error) {
          throw new Error(`Hugging Face API Error: ${errorData.error}`);
        } else {
          throw new Error(`Bad request to Hugging Face API for model "${selectedModel.name}". The model may not support the requested parameters.`);
        }
      } else {
        throw new Error(`Hugging Face API Error (${error.response.status}): ${error.response.statusText}`);
      }
    }
    
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
async function saveAnswer(question, context, answer, model, confidence, date, modelName = null, promptVersion = "1.0") {
  const result = await pool.query(
    'INSERT INTO answers (question, context, answer, model, model_name, confidence, date, is_personal, prompt_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
    [question, context, answer, model, modelName, confidence, date, false, promptVersion]
  );
  return result.rows[0].id;
}

// Save personal answer to database
async function savePersonalAnswer(question, context, answer, model, confidence, date, modelName, userId, personalQuestionId, promptVersion = "1.0") {
  const result = await pool.query(
    'INSERT INTO answers (question, context, answer, model, model_name, confidence, date, user_id, personal_question_id, is_personal, prompt_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
    [question, context, answer, model, modelName, confidence, date, userId, personalQuestionId, true, promptVersion]
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
app.get('/offline', (req, res) => {
  res.render('offline');
});

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
      today
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
// Add offline package routes (commented out old version)
// addOfflinePackageRoutes(app);

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
    
    // Enhanced error response with actual error details
    let errorResponse = { 
      error: 'AI Model Error', 
      message: error.message || 'Unknown error occurred',
      model: modelId,
      timestamp: new Date().toISOString()
    };
    
    // Check for specific error types and provide detailed information
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      errorResponse.httpStatus = status;
      errorResponse.details = errorData;
      
      if (status === 429) {
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
                status: status,
                openaiError: errorData.error
              }
            };
          } else {
            errorResponse.error = 'Rate Limit Exceeded';
            errorResponse.message = `Too many requests to ${selectedModel?.name || modelId}. Please wait and try again.`;
          }
        }
      } else if (status === 401) {
        errorResponse.error = 'Authentication Failed';
        errorResponse.message = `Invalid API key for ${selectedModel?.name || modelId}`;
      } else if (status === 403) {
        errorResponse.error = 'Access Forbidden';
        errorResponse.message = `Access denied for ${selectedModel?.name || modelId}. Check your API key permissions.`;
      } else if (status === 404) {
        errorResponse.error = 'Model Not Found';
        errorResponse.message = `Model "${selectedModel?.name || modelId}" is not available through the API provider.`;
      } else if (status === 503) {
        errorResponse.error = 'Service Unavailable';
        errorResponse.message = `${selectedModel?.name || modelId} is temporarily unavailable. Try again later.`;
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorResponse.error = 'Connection Failed';
      errorResponse.message = `Cannot connect to ${selectedModel?.name || modelId} API. Check your internet connection.`;
    } else if (error.code === 'ETIMEDOUT') {
      errorResponse.error = 'Request Timeout';
      errorResponse.message = `Request to ${selectedModel?.name || modelId} timed out. Try again.`;
    }
    
    res.status(500).json(errorResponse);
  }
});

app.get('/api/models', async (req, res) => {
  try {
    let enabledModels;
    
    if (req.user) {
      // For logged-in users, get their enabled models
      const userPrefs = await pool.query(
        'SELECT model_id FROM user_model_preferences WHERE user_id = $1 AND is_enabled = true ORDER BY display_order',
        [req.user.id]
      );
      
      if (userPrefs.rows.length > 0) {
        // User has preferences, filter models
        const enabledModelIds = userPrefs.rows.map(row => row.model_id);
        enabledModels = AVAILABLE_MODELS.filter(model => enabledModelIds.includes(model.id));
      } else {
        // No preferences yet, create default preferences and return default models
        for (let i = 0; i < DEFAULT_ENABLED_MODELS.length; i++) {
          await pool.query(
            'INSERT INTO user_model_preferences (user_id, model_id, is_enabled, display_order) VALUES ($1, $2, true, $3) ON CONFLICT (user_id, model_id) DO NOTHING',
            [req.user.id, DEFAULT_ENABLED_MODELS[i], i]
          );
        }
        enabledModels = AVAILABLE_MODELS.filter(model => model.defaultEnabled);
      }
    } else {
      // For non-logged-in users, return only default enabled models
      enabledModels = AVAILABLE_MODELS.filter(model => model.defaultEnabled);
    }
    
    res.json(enabledModels);
  } catch (error) {
    console.error('Error getting models:', error);
    // Fallback to default models
    const defaultModels = AVAILABLE_MODELS.filter(model => model.defaultEnabled);
    res.json(defaultModels);
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

// Authentication middleware with debug token support
function requireAuth(req, res, next) {
  // Check for debug token first
  const debugToken = req.headers['x-debug-token'] || req.query.debug_token;
  const validDebugToken = process.env.DEBUG_TOKEN || 'debug-test-token-2024';
  
  if (debugToken === validDebugToken) {
    // Create a mock user for debug mode
    req.user = {
      id: 999999,
      name: 'Debug User',
      email: 'debug@test.com',
      avatar_url: 'https://via.placeholder.com/40',
      google_id: 'debug-user-id'
    };
    console.log('🔧 Debug token authentication bypass activated');
    return next();
  }
  
  // Normal authentication check
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
  // Check for debug token first
  const debugToken = req.headers['x-debug-token'] || req.query.debug_token;
  const validDebugToken = process.env.DEBUG_TOKEN || 'debug-test-token-2024';
  
  if (debugToken === validDebugToken) {
    return res.json({
      id: 999999,
      name: 'Debug User',
      email: 'debug@test.com',
      avatar_url: 'https://via.placeholder.com/40',
      debug_mode: true
    });
  }
  
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
    
    // Handle debug user - ensure debug user exists in database
    if (req.user.id === 999999) {
      // Check if debug user exists, create if not
      const debugUserCheck = await pool.query('SELECT id FROM users WHERE id = $1', [999999]);
      if (debugUserCheck.rows.length === 0) {
        await pool.query(
          'INSERT INTO users (id, google_id, name, email, avatar_url) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
          [999999, 'debug-user-id', 'Debug User', 'debug@test.com', 'https://via.placeholder.com/40']
        );
        console.log('🔧 Debug user created in database');
      }
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
    
    // Collect all API keys (including additional ones for comprehensive support)
    const apiKeys = {
      HUGGING_FACE_API_KEY: process.env.HUGGING_FACE_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY
    };
    
    // Check if we have the required API key
    const selectedModel = AVAILABLE_MODELS.find(m => m.id === model);
    if (!selectedModel) {
      return res.status(400).json({ error: 'Invalid model ID' });
    }
    
    // Enhanced API key validation with specific error messages
    if (!apiKeys[selectedModel.apiKeyEnv]) {
      console.error(`Missing API key for ${selectedModel.name}: ${selectedModel.apiKeyEnv}`);
      return res.status(500).json({ 
        error: `API key for ${selectedModel.name} not configured on server`,
        details: `Missing environment variable: ${selectedModel.apiKeyEnv}`,
        model: selectedModel.name,
        provider: selectedModel.provider,
        question: personalQuestion.question,
        context: personalQuestion.context,
        date: new Date().toISOString()
      });
    }
    
    console.log(`Asking personal question to ${selectedModel.name} (${model})`);
    const response = await askQuestion(personalQuestion.question, personalQuestion.context, model, apiKeys);
    
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
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      model: req.body.model,
      questionId: req.params.id
    });
    res.status(500).json({ 
      error: 'Failed to get answer from AI', 
      message: error.message,
      details: error.stack ? error.stack.split('\n')[0] : 'No additional details'
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
    
    // Execute daily question with all available models
    const apiKeys = {
      HUGGING_FACE_API_KEY: process.env.HUGGING_FACE_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY
    };
    
    // Get today's question
    const { question, context } = getTodaysQuestion();
    console.log(`Daily question: "${question}"`);
    
    // Check which models were already queried in the last 24 hours
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentAnswers = await pool.query(
      'SELECT model FROM answers WHERE question = $1 AND date > $2',
      [question, yesterday.toISOString()]
    );
    
    const recentlyQueriedModels = new Set(recentAnswers.rows.map(row => row.model));
    console.log(`Models already queried in last 24 hours: ${Array.from(recentlyQueriedModels).join(', ') || 'none'}`);
    
    // Track results
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
    
    // Query all available models that haven't been queried in the last 24 hours
    for (const model of AVAILABLE_MODELS) {
      try {
        // Skip if API key not available
        if (!apiKeys[model.apiKeyEnv]) {
          console.log(`Skipping model ${model.id}: API key not available`);
          continue;
        }
        
        // Skip if already queried in last 24 hours
        if (recentlyQueriedModels.has(model.id)) {
          console.log(`Skipping model ${model.id}: already queried in last 24 hours`);
          results.skipped++;
          continue;
        }
        
        console.log(`Querying model ${model.id}...`);
        const response = await askQuestion(question, context, model.id, apiKeys);
        
        // Include promptVersion in saved answer
        await saveAnswer(
          question, 
          context, 
          response.answer, 
          response.model,
          response.score, 
          new Date().toISOString(),
          response.modelName,
          response.promptVersion || "2.0" // Use the version from response or default to 2.0
        );
        
        console.log(`Successfully saved answer from ${model.id}`);
        results.success++;
      } catch (error) {
        console.error(`Error querying model ${model.id}:`, error);
        results.failed++;
        results.errors.push({
          model: model.id,
          error: error.message
        });
      }
    }
    
    console.log(`Daily question results: ${results.success} successful, ${results.failed} failed, ${results.skipped} skipped`);
    if (results.errors.length > 0) {
      console.log('Errors:', JSON.stringify(results.errors, null, 2));
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
       WHERE qs.is_active = true 
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

// ===== CONFIG API ENDPOINTS =====

// Get all models and user preferences for config page
app.get('/api/config/models', async (req, res) => {
  try {
    let userPreferences = null;
    
    if (req.user) {
      const prefs = await pool.query(
        'SELECT model_id, is_enabled, display_order FROM user_model_preferences WHERE user_id = $1 ORDER BY display_order',
        [req.user.id]
      );
      userPreferences = prefs.rows;
      
      // If no preferences exist, create defaults
      if (userPreferences.length === 0) {
        for (let i = 0; i < DEFAULT_ENABLED_MODELS.length; i++) {
          await pool.query(
            'INSERT INTO user_model_preferences (user_id, model_id, is_enabled, display_order) VALUES ($1, $2, true, $3)',
            [req.user.id, DEFAULT_ENABLED_MODELS[i], i]
          );
        }
        
        // Reload preferences
        const newPrefs = await pool.query(
          'SELECT model_id, is_enabled, display_order FROM user_model_preferences WHERE user_id = $1 ORDER BY display_order',
          [req.user.id]
        );
        userPreferences = newPrefs.rows;
      }
    }
    
    res.json({
      allModels: AVAILABLE_MODELS,
      userPreferences: userPreferences
    });
  } catch (error) {
    console.error('Error getting config models:', error);
    res.status(500).json({ error: 'Failed to load model configuration' });
  }
});

// Save user model preferences
app.post('/api/config/models', requireAuth, async (req, res) => {
  try {
    const { preferences } = req.body;
    
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences data' });
    }
    
    // Update preferences for each model
    for (const [modelId, isEnabled] of Object.entries(preferences)) {
      await pool.query(
        `INSERT INTO user_model_preferences (user_id, model_id, is_enabled, display_order) 
         VALUES ($1, $2, $3, 0) 
         ON CONFLICT (user_id, model_id) 
         DO UPDATE SET is_enabled = $3`,
        [req.user.id, modelId, isEnabled]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving model preferences:', error);
    res.status(500).json({ error: 'Failed to save model preferences' });
  }
});

// Get user API keys (masked)
app.get('/api/config/api-keys', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT provider, created_at FROM user_api_keys WHERE user_id = $1',
      [req.user.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting API keys:', error);
    res.status(500).json({ error: 'Failed to load API keys' });
  }
});

// Save user API key
app.post('/api/config/api-keys', requireAuth, async (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Provider and API key are required' });
    }
    
    // Validate provider
    const validProviders = ['openai', 'anthropic', 'google', 'huggingface'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    
    // Encrypt API key (simple base64 for now - in production use proper encryption)
    const encryptedKey = Buffer.from(apiKey).toString('base64');
    
    await pool.query(
      `INSERT INTO user_api_keys (user_id, provider, encrypted_key, created_at) 
       VALUES ($1, $2, $3, NOW()) 
       ON CONFLICT (user_id, provider) 
       DO UPDATE SET encrypted_key = $3, created_at = NOW()`,
      [req.user.id, provider, encryptedKey]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving API key:', error);
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

// Delete user API key
app.delete('/api/config/api-keys/:provider', requireAuth, async (req, res) => {
  try {
    const { provider } = req.params;
    
    await pool.query(
      'DELETE FROM user_api_keys WHERE user_id = $1 AND provider = $2',
      [req.user.id, provider]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// ===== DOWNLOAD ENDPOINT =====
app.get('/download/offline', async (req, res) => {
  try {
    const archiver = require('archiver');
    const path = require('path');
    const fs = require('fs');
    
    // Set response headers for zip download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="ai-questions-offline.zip"');
    
    // Create archiver instance
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    // Handle archiver errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create download package' });
      }
    });
    
    // Pipe archive to response
    archive.pipe(res);
    
    // Add install script
    archive.file(path.join(__dirname, 'install.sh'), { name: 'install.sh' });
    
    // Add readme
    archive.file(path.join(__dirname, 'README-OFFLINE.md'), { name: 'README.md' });
    
    // Create inner zip with local version files
    const innerArchive = archiver('zip', { zlib: { level: 9 } });
    const innerZipBuffer = [];
    
    innerArchive.on('data', (chunk) => {
      innerZipBuffer.push(chunk);
    });
    
    innerArchive.on('end', () => {
      const buffer = Buffer.concat(innerZipBuffer);
      archive.append(buffer, { name: 'ai-questions-local.zip' });
      archive.finalize();
    });
    
    // Add local version files to inner zip
    innerArchive.directory(path.join(__dirname, 'local'), false);
    innerArchive.finalize();
    
  } catch (error) {
    console.error('Error creating download package:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create download package' });
    }
  }
});

// Start server
app.use(offlinePackageRoutesNew);

// ===== CONFIG PAGE ROUTE =====
app.get('/config', (req, res) => {
  res.render('config');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the application`) ;
});

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

// Export answers to CSV
app.get('/api/analytics/export-csv/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      start_date = null, 
      end_date = null, 
      models = null,
      include_context = 'true'
    } = req.query;
    
    // Get question details
    const questionResult = await pool.query(
      'SELECT * FROM personal_questions WHERE id = $1 AND user_id = $2 AND is_active = true',
      [id, req.user.id]
    );
    
    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    const question = questionResult.rows[0];
    
    // Build date filter
    let dateFilter = '';
    let queryParams = [id, req.user.id];
    let paramIndex = 3;
    
    if (start_date) {
      dateFilter += ` AND date >= $${paramIndex}`;
      queryParams.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      dateFilter += ` AND date <= $${paramIndex}`;
      queryParams.push(end_date);
      paramIndex++;
    }
    
    // Build model filter
    let modelFilter = '';
    if (models && models !== 'all') {
      const modelList = models.split(',');
      const modelPlaceholders = modelList.map((_, index) => `$${paramIndex + index}`).join(',');
      modelFilter = ` AND model IN (${modelPlaceholders})`;
      queryParams.push(...modelList);
    }
    
    // Get all answers for this question with filters
    const answersResult = await pool.query(
      `SELECT 
         answer, model, model_name, confidence, date, 
         'answers' as source_table
       FROM answers 
       WHERE personal_question_id = $1 AND user_id = $2${dateFilter}${modelFilter}
       UNION ALL
       SELECT 
         answer, model, model_name, confidence, date, 
         'personal_question_answers' as source_table
       FROM personal_question_answers 
       WHERE question_id = $1 AND user_id = $2${dateFilter}${modelFilter}
       ORDER BY date DESC`,
      queryParams
    );
    
    // Generate CSV content
    const csvHeaders = [
      'Date',
      'Model',
      'Model Name',
      'Confidence',
      'Answer Length',
      'Answer'
    ];
    
    if (include_context === 'true') {
      csvHeaders.splice(-1, 0, 'Question', 'Context');
    }
    
    let csvContent = csvHeaders.join(',') + '\n';
    
    answersResult.rows.forEach(row => {
      const csvRow = [
        `"${new Date(row.date).toISOString()}"`,
        `"${row.model || ''}"`,
        `"${row.model_name || row.model || ''}"`,
        row.confidence || 0,
        row.answer ? row.answer.length : 0,
      ];
      
      if (include_context === 'true') {
        csvRow.push(
          `"${question.question.replace(/"/g, '""')}"`,
          `"${question.context.replace(/"/g, '""')}"`,
        );
      }
      
      // Add answer last (may contain newlines and special characters)
      csvRow.push(`"${(row.answer || '').replace(/"/g, '""')}"`);
      
      csvContent += csvRow.join(',') + '\n';
    });
    
    // Set response headers for CSV download
    const filename = `ai-questions-export-${id}-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});


// ===== CHAT API ENDPOINTS =====

// Import the intelligent query system
const { WikipediaQueryAnalyzer, WikipediaSearchEngine, ResponseSynthesizer } = require('./intelligent-query-system.js');

// Initialize the intelligent query system
const queryAnalyzer = new WikipediaQueryAnalyzer();
const searchEngine = new WikipediaSearchEngine();
const responseSynthesizer = new ResponseSynthesizer();

// Chat endpoint for offline functionality with intelligent Wikipedia integration
app.post('/api/chat', async (req, res) => {
  try {
    const { message, model, context = [], includeWikipedia = true } = req.body;
    
    if (!message || !model) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message and model are required' 
      });
    }

    console.log(`🤖 Processing chat message: "${message}"`);

    let response = '';
    let searchResults = null;
    let confidence = 0.8;
    let sources = [];
    let searchTerms = [];

    // Use intelligent query system for Wikipedia integration
    if (includeWikipedia && message.length > 3) {
      console.log('🔍 Analyzing query with intelligent system...');
      
      // Step 1: Analyze the user's query
      const analysis = queryAnalyzer.analyzeQuery(message);
      console.log('📊 Query analysis:', {
        intent: analysis.intent,
        entities: analysis.entities,
        searchTerms: analysis.searchTerms,
        confidence: analysis.confidence
      });

      // Step 2: Execute Wikipedia search
      searchResults = await searchEngine.executeSearch(analysis);
      console.log('🔎 Search results:', {
        articlesFound: searchResults.articles.length,
        summariesFound: searchResults.summaries.length
      });

      // Step 3: Synthesize intelligent response
      const synthesizedResponse = responseSynthesizer.synthesizeResponse(analysis, searchResults);
      response = synthesizedResponse.response;
      confidence = synthesizedResponse.confidence;
      sources = synthesizedResponse.sources;
      searchTerms = synthesizedResponse.searchTerms;

      console.log('✅ Generated intelligent response with confidence:', confidence);
    } else {
      // Fallback for simple responses without Wikipedia
      response = generateSimpleResponse(message);
    }

    res.json({
      success: true,
      response: response,
      model: model,
      timestamp: new Date().toISOString(),
      confidence: confidence,
      sources: sources,
      searchTerms: searchTerms,
      context: context.concat([
        { role: 'user', content: message },
        { role: 'assistant', content: response }
      ])
    });

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message',
      details: error.message
    });
  }
});

// Simple response generator for fallback cases
function generateSimpleResponse(message) {
  const lowerMessage = message.toLowerCase().trim();
  
  // Greetings
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)/.test(lowerMessage)) {
    return "Hello! I'm your offline AI assistant. I can help answer questions and search through Wikipedia content. What would you like to know about?";
  }
  
  // Gratitude
  if (/^(thanks|thank you|thx)/.test(lowerMessage)) {
    return "You're welcome! I'm here to help with any questions or information you need.";
  }
  
  // AI consciousness questions
  if (lowerMessage.includes('feelings') || lowerMessage.includes('conscious') || lowerMessage.includes('emotions')) {
    return "That's a fascinating philosophical question! I don't experience feelings or consciousness the way humans do. I'm designed to process text and provide helpful responses, but I don't have subjective experiences or emotions. I can discuss the topic of AI consciousness if you're interested in the philosophical and technical aspects!";
  }
  
  // Default helpful response
  return `I'd be happy to help you with "${message}"! I can assist with questions about various topics, perform calculations, and search through Wikipedia content. What specific information are you looking for?`;
}
// Chat streaming endpoint (placeholder for future real-time features)
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { message, model, context = [], includeWikipedia = true } = req.body;
    
    if (!message || !model) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message and model are required' 
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

    // Generate response (same logic as non-streaming)
    let response = '';
    
    if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
      response = "Hello! I'm your offline AI assistant. How can I help you today?";
    } else if (message.toLowerCase().includes('weather')) {
      response = "I'm an offline AI, so I don't have access to current weather data. However, I can discuss weather patterns, climate, or meteorology in general.";
    } else if (message.toLowerCase().includes('time') || message.toLowerCase().includes('date')) {
      response = `The current time is ${new Date().toLocaleString()}. As an offline AI, I can help with time-related calculations or discuss temporal concepts.`;
    } else if (message.toLowerCase().includes('wikipedia') || message.toLowerCase().includes('search')) {
      response = "I can help you search through the local Wikipedia database. What topic would you like to explore?";
    } else {
      response = `I understand you're asking about "${message}". As an offline AI assistant, I can provide information and analysis based on my training data. Could you be more specific about what aspect you'd like me to focus on?`;
    }

    // Stream the response word by word to simulate typing
    const words = response.split(' ');
    
    res.write(`data: ${JSON.stringify({ type: 'start', model: model })}\n\n`);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '');
      res.write(`data: ${JSON.stringify({ type: 'token', content: word })}\n\n`);
      
      // Add small delay to simulate typing
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Add Wikipedia context if requested
    if (includeWikipedia && message.length > 10) {
      const keywords = message.toLowerCase().split(' ').filter(word => 
        word.length > 3 && !['what', 'when', 'where', 'why', 'how', 'the', 'and', 'or', 'but'].includes(word)
      );
      
      if (keywords.length > 0) {
        const wikipediaContext = `\n\n📚 Related Wikipedia topics: ${keywords.slice(0, 3).join(', ')}`;
        const contextWords = wikipediaContext.split(' ');
        
        for (let i = 0; i < contextWords.length; i++) {
          const word = contextWords[i] + (i < contextWords.length - 1 ? ' ' : '');
          res.write(`data: ${JSON.stringify({ type: 'token', content: word })}\n\n`);
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done', timestamp: new Date().toISOString() })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Error in streaming chat endpoint:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`);
    res.end();
  }
});

// ===== WIKIPEDIA API ENDPOINTS =====

// Wikipedia search endpoint
app.get('/api/wikipedia/search', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Use Wikipedia's OpenSearch API for real search results
    const opensearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&namespace=0&format=json&origin=*`;
    
    const response = await fetch(opensearchUrl);
    if (!response.ok) {
      throw new Error('Wikipedia API request failed');
    }
    
    const [searchTerm, titles, descriptions, urls] = await response.json();
    
    const results = titles.map((title, index) => ({
      title: title,
      snippet: descriptions[index] || 'No description available',
      url: `/wikipedia/article/${encodeURIComponent(title.replace(/\s+/g, '_'))}`
    }));

    res.json({
      query: query,
      results: results,
      total: results.length,
      source: 'wikipedia_api'
    });

  } catch (error) {
    console.error('Wikipedia search error:', error);
    // Fallback to simulated results if API fails
    const fallbackResults = [
      {
        title: `${query} - Overview`,
        snippet: `Search results for "${query}". Wikipedia API temporarily unavailable.`,
        url: `/wikipedia/article/${encodeURIComponent(query)}`
      }
    ];
    
    res.json({
      query: query,
      results: fallbackResults,
      total: fallbackResults.length,
      source: 'fallback'
    });
  }
});

// Wikipedia article endpoint
app.get('/wikipedia/article/:title', async (req, res) => {
  try {
    const { title } = req.params;
    const decodedTitle = decodeURIComponent(title).replace(/_/g, ' ');
    
    // Get article summary from Wikipedia API
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(decodedTitle)}`;
    const summaryResponse = await fetch(summaryUrl);
    
    if (!summaryResponse.ok) {
      throw new Error('Article not found');
    }
    
    const summaryData = await summaryResponse.json();
    
    // Get full article content
    const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(decodedTitle)}&prop=extracts&exintro=&explaintext=&origin=*`;
    const contentResponse = await fetch(contentUrl);
    
    let fullContent = summaryData.extract || 'Content not available';
    
    if (contentResponse.ok) {
      const contentData = await contentResponse.json();
      const pages = contentData.query.pages;
      const pageId = Object.keys(pages)[0];
      const pageContent = pages[pageId];
      
      if (pageContent && pageContent.extract) {
        fullContent = pageContent.extract;
      }
    }

    const article = {
      title: summaryData.title,
      content: `# ${summaryData.title}

${fullContent}

---
*Source: Wikipedia*
*URL: ${summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(decodedTitle)}`}*`,
      lastModified: new Date().toISOString(),
      source: 'wikipedia_api',
      thumbnail: summaryData.thumbnail?.source || null,
      description: summaryData.description || null
    };

    res.json(article);

  } catch (error) {
    console.error('Wikipedia article error:', error);
    
    // Fallback content if API fails
    const fallbackArticle = {
      title: decodeURIComponent(req.params.title).replace(/_/g, ' '),
      content: `# ${decodeURIComponent(req.params.title).replace(/_/g, ' ')}

Article content temporarily unavailable. Wikipedia API connection failed.

This would normally display the full Wikipedia article content for "${decodeURIComponent(req.params.title).replace(/_/g, ' ')}".

Please try again later or check your internet connection.`,
      lastModified: new Date().toISOString(),
      source: 'fallback'
    };
    
    res.json(fallbackArticle);
  }
});

// Wikipedia random articles
app.get('/api/wikipedia/random', async (req, res) => {
  try {
    const { count = 5 } = req.query;
    const randomArticles = [];
    
    // Get multiple random articles from Wikipedia
    for (let i = 0; i < parseInt(count); i++) {
      try {
        const randomUrl = 'https://en.wikipedia.org/api/rest_v1/page/random/summary';
        const response = await fetch(randomUrl);
        
        if (response.ok) {
          const data = await response.json();
          randomArticles.push({
            title: data.title,
            snippet: data.extract || 'No description available',
            url: `/wikipedia/article/${encodeURIComponent(data.title.replace(/\s+/g, '_'))}`,
            category: data.description || 'General'
          });
        }
      } catch (error) {
        console.error(`Error fetching random article ${i + 1}:`, error);
      }
    }
    
    // If no articles were fetched, provide fallback
    if (randomArticles.length === 0) {
      const fallbackTopics = ['Science', 'History', 'Technology', 'Geography', 'Literature'];
      for (let i = 0; i < Math.min(parseInt(count), fallbackTopics.length); i++) {
        const topic = fallbackTopics[i];
        randomArticles.push({
          title: `${topic} Overview`,
          snippet: `General information about ${topic.toLowerCase()}. Wikipedia API temporarily unavailable.`,
          url: `/wikipedia/article/${topic}_Overview`,
          category: topic
        });
      }
    }

    res.json({
      articles: randomArticles,
      count: randomArticles.length,
      source: randomArticles.length > 0 && randomArticles[0].category !== 'General' ? 'wikipedia_api' : 'fallback'
    });

  } catch (error) {
    console.error('Wikipedia random articles error:', error);
    res.status(500).json({ error: 'Failed to get random articles' });
  }
});

// Wikipedia status
app.get('/api/wikipedia/status', async (req, res) => {
  try {
    const status = {
      available: true,
      database_path: '/offline/wikipedia/minimal-wikipedia.sqlite',
      database_exists: false, // Simulated - would check actual file
      mode: 'simulation',
      stats: {
        total_articles: 10000,
        database_size: '20MB',
        last_updated: new Date().toISOString()
      }
    };

    res.json(status);

  } catch (error) {
    console.error('Wikipedia status error:', error);
    res.status(500).json({ error: 'Failed to get Wikipedia status' });
  }
});

