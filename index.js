const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Initialize database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Create tables if they don't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      context TEXT NOT NULL,
      answer TEXT NOT NULL,
      model TEXT NOT NULL,
      confidence REAL NOT NULL,
      date TEXT NOT NULL
    )
  `);
});

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
    question: "Compare the surveillance state in '1984' with modern data collection practices. Are there meaningful differences?",
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

// Ask question to Hugging Face API - UPDATED to use a text generation model
async function askQuestion(question, context, apiKey) {
  try {
    // Define which model we're using
    const model = "google/flan-t5-large";
    
    // Combine question and context into a prompt for a generative model
    const prompt = `Based on the following context from George Orwell's "1984", please answer this question thoroughly:
    
Context: ${context}

Question: ${question}

Answer:`;

    // Use a text generation model instead of a question answering model
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${model}`,
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
    );
    
    // Handle different response formats from the API
    let answer;
    if (Array.isArray(response.data) && response.data.length > 0) {
      // Some models return an array of generated texts
      answer = response.data[0].generated_text || response.data[0];
    } else if (typeof response.data === 'string') {
      // Some models return the text directly
      answer = response.data;
    } else if (response.data.generated_text) {
      // Some models return an object with generated_text
      answer = response.data.generated_text;
    } else {
      // Fallback
      answer = JSON.stringify(response.data);
    }
    
    return {
      answer: answer,
      model: model,
      score: 1.0  // Confidence score is not relevant for generative models, so we set it to 1.0
    };
  } catch (error) {
    console.error('Error calling Hugging Face API:', error);
    throw error;
  }
}

// Save answer to database
function saveAnswer(question, context, answer, model, confidence, date) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO answers (question, context, answer, model, confidence, date) VALUES (?, ?, ?, ?, ?, ?)',
      [question, context, answer, model, confidence, date],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

// Get latest answers for all questions
function getLatestAnswers() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT a.*
      FROM answers a
      INNER JOIN (
        SELECT question, MAX(date) as max_date
        FROM answers
        GROUP BY question
      ) b ON a.question = b.question AND a.date = b.max_date
      ORDER BY a.id DESC
    `, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Get history of answers for a specific question
function getAnswerHistory(question) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM answers WHERE question = ? ORDER BY date DESC',
      [question],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

// Delete an answer by ID
function deleteAnswer(id) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM answers WHERE id = ?',
      [id],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      }
    );
  });
}

// Routes
app.get('/', async (req, res) => {
  try {
    const todayQuestion = getTodaysQuestion();
    let todayAnswer = null;
    
    // Check if we already have today's answer
    const today = new Date().toISOString().split('T')[0];
    
    db.get(
      'SELECT * FROM answers WHERE question = ? AND date LIKE ? ORDER BY date DESC LIMIT 1',
      [todayQuestion.question, `${today}%`],
      async (err, row) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).render('error', { error: 'Database error' });
        }
        
        if (row) {
          // We already have today's answer
          todayAnswer = row;
        }
        
        try {
          const latestAnswers = await getLatestAnswers();
          res.render('index', { 
            todayQuestion, 
            todayAnswer,
            latestAnswers,
            today
          });
        } catch (error) {
          console.error('Error getting latest answers:', error);
          res.status(500).render('error', { error: 'Failed to get latest answers' });
        }
      }
    );
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
    const apiKey = process.env.HUGGING_FACE_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'API key not configured',
        question,
        context,
        date: new Date().toISOString()
      });
    }
    
    const response = await askQuestion(question, context, apiKey);
    
    const answer = {
      question,
      context,
      answer: response.answer,
      model: response.model,
      confidence: response.score,
      date: new Date().toISOString()
    };
    
    await saveAnswer(question, context, answer.answer, answer.model, answer.confidence, answer.date);
    
    res.json(answer);
  } catch (error) {
    console.error('Error in question API route:', error);
    res.status(500).json({ 
      error: 'Failed to get answer from AI', 
      message: error.message 
    });
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

// Schedule daily question
cron.schedule('0 0 * * *', async () => {
  try {
    console.log('Running daily scheduled task at:', new Date().toISOString());
    
    const apiKey = process.env.HUGGING_FACE_API_KEY;
    if (!apiKey) {
      console.error('API key not configured for scheduled task');
      return;
    }
    
    const { question, context } = getTodaysQuestion();
    const response = await askQuestion(question, context, apiKey);
    
    await saveAnswer(
      question, 
      context, 
      response.answer, 
      response.model,
      response.score, 
      new Date().toISOString()
    );
    
    console.log('Successfully saved daily AI answer');
  } catch (error) {
    console.error('Error in daily scheduled task:', error);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the application`);
});
