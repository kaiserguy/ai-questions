const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const cron = require('node-cron');
const path = require('path');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Initialize PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Create tables if they don't exist
pool.query(`
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
`).catch(err => console.error('Error creating table:', err));

// Available AI models
const AVAILABLE_MODELS = [
  {
    id: "deepseek-ai/DeepSeek-R1-0528",
    name: "DeepSeek R1 (Latest)",
    provider: "huggingface",
    apiKeyEnv: "HUGGING_FACE_API_KEY"
  },
  {
    id: "gpt-3.5-turbo",
    name: "ChatGPT (GPT-3.5)",
    provider: "openai",
    apiKeyEnv: "OPENAI_API_KEY"
  },
  {
    id: "meta-llama/Llama-2-7b-chat-hf",
    name: "Meta Llama 2 (7B)",
    provider: "huggingface",
    apiKeyEnv: "HUGGING_FACE_API_KEY"
  },
  {
    id: "mistralai/Mistral-7B-Instruct-v0.1",
    name: "Mistral 7B",
    provider: "huggingface",
    apiKeyEnv: "HUGGING_FACE_API_KEY"
  }
];

// Questions from 1984
const QUESTIONS_1984 = [
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
  const questionIndex = (dayOfMonth % QUESTIONS_1984.length);
  return QUESTIONS_1984[questionIndex];
}

// Ask question to AI API
async function askQuestion(question, context, modelId, apiKeys) {
  try {
    // Find the selected model
    const selectedModel = AVAILABLE_MODELS.find(model => model.id === modelId);
    if (!selectedModel) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    // Get the appropriate API key
    const apiKey = apiKeys[selectedModel.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`API key for ${selectedModel.name} not configured`);
    }
    
    // Combine question and context into a prompt
    const prompt = `Based on the following context from George Orwell's "1984", please answer this question thoroughly:
    
Context: ${context}

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
              content: "You are a helpful assistant analyzing George Orwell's 1984."
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
      score: 1.0
    };
  } catch (error) {
    console.error('Error calling AI API:', error);
    
    // Enhanced error logging for OpenAI API issues
    if (selectedModel.provider === 'openai' && error.response) {
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
    'INSERT INTO answers (question, context, answer, model, model_name, confidence, date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
    [question, context, answer, model, modelName, confidence, date]
  );
  return result.rows[0].id;
}

// Get latest answers for all questions
async function getLatestAnswers() {
  const result = await pool.query(`
    SELECT a.*
    FROM answers a
    INNER JOIN (
      SELECT question, MAX(date) as max_date
      FROM answers
      GROUP BY question
    ) b ON a.question = b.question AND a.date = b.max_date
    ORDER BY a.id DESC
  `);
  return result.rows;
}

// Get history of answers for a specific question
async function getAnswerHistory(question) {
  const result = await pool.query(
    'SELECT * FROM answers WHERE question = $1 ORDER BY date DESC',
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

app.get('/api/models', (req, res) => {
  res.json(AVAILABLE_MODELS);
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

// Schedule daily question
cron.schedule('0 0 * * *', async () => {
  try {
    console.log('Running daily scheduled task at:', new Date().toISOString());
    
    // Collect all API keys
    const apiKeys = {
      HUGGING_FACE_API_KEY: process.env.HUGGING_FACE_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    };
    
    // Use the first model that has a valid API key
    const availableModel = AVAILABLE_MODELS.find(model => apiKeys[model.apiKeyEnv]);
    
    if (!availableModel) {
      console.error('No API keys configured for scheduled task');
      return;
    }
    
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
  } catch (error) {
    console.error('Error in daily scheduled task:', error);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the application`) ;
});
