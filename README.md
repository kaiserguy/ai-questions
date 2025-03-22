# Simple Daily AI Question Website - Documentation

## Overview
This is a simplified version of the Daily AI Question website that asks a public free AI the same question every day via an API call and shows the answer. The website focuses on questions from George Orwell's "1984" to track AI responses over time, allowing users to monitor if AI systems change their answers to politically sensitive questions.

## Features
- Daily selection of questions from "1984" based on the date
- Integration with Hugging Face's Inference API for AI responses
- Database storage of all responses for historical tracking
- Clean, responsive user interface
- Scheduled daily question asking via cron job
- Historical view of all answers to each question

## Technical Stack
- **Backend**: Node.js with Express
- **Database**: SQLite (via sqlite3)
- **Frontend**: EJS templates with vanilla CSS
- **Scheduling**: node-cron for automated daily tasks
- **API Integration**: Axios for HTTP requests

## Project Structure
```
simple-daily-ai-question/
├── index.js           # Main application file with all logic
├── package.json       # Project dependencies
├── database.sqlite    # SQLite database (created on first run)
├── views/             # EJS templates
│   ├── index.ejs      # Home page showing today's question
│   ├── history.ejs    # Page showing answer history for a question
│   └── error.ejs      # Error page
└── .env               # Environment variables (create this file)
```

## Setup Instructions

### Prerequisites
- Node.js (v14 or later)
- npm (v6 or later)
- Hugging Face account for API key

### Installation

1. **Clone or extract the project files**

2. **Install dependencies**
   ```bash
   cd simple-daily-ai-question
   npm install
   ```

3. **Create an environment file**
   Create a file named `.env` in the project root with the following content:
   ```
   HUGGING_FACE_API_KEY=your_api_key_here
   PORT=3000
   ```
   Replace `your_api_key_here` with your Hugging Face API key.

4. **Start the application**
   ```bash
   npm start
   ```

5. **Access the website**
   Open your browser and navigate to `http://localhost:3000`

## Usage

### Viewing Today's Question and Answer
- The home page displays today's question based on the date
- If an answer has already been fetched today, it will be displayed
- If no answer is available, you can click "Ask AI Now" to fetch one

### Viewing Answer History
- Click "View answer history for this question" to see all historical answers for a specific question
- This allows you to track changes in AI responses over time

### Automated Daily Questions
- The application includes a cron job that runs at midnight UTC every day
- This job automatically fetches a new answer for the day's question
- No manual intervention is required for daily updates

## Deployment Options

### Deploying to a VPS or Cloud Provider
1. Set up a Node.js environment on your server
2. Clone the repository to your server
3. Install dependencies with `npm install`
4. Set up environment variables (HUGGING_FACE_API_KEY)
5. Use a process manager like PM2 to keep the application running:
   ```bash
   npm install -g pm2
   pm2 start index.js --name "daily-ai-question"
   ```

### Deploying to Heroku
1. Create a Heroku account and install the Heroku CLI
2. Initialize a git repository in the project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
3. Create a Heroku app:
   ```bash
   heroku create
   ```
4. Set the environment variable:
   ```bash
   heroku config:set HUGGING_FACE_API_KEY=your_api_key_here
   ```
5. Deploy the application:
   ```bash
   git push heroku main
   ```

## Customization

### Changing the Questions
To modify the questions, edit the `QUESTIONS_1984` array in `index.js`. Each question requires:
- `id`: A unique identifier
- `question`: The question text
- `context`: Background information to help the AI provide a relevant answer

### Changing the AI Model
The application uses Hugging Face's "deepset/roberta-base-squad2" model by default. To use a different model:
1. Find a suitable question-answering model on Hugging Face
2. Update the URL in the `askQuestion` function in `index.js`

### Customizing the UI
The UI styling is contained within the EJS templates in the `views` directory. You can modify the inline CSS in these files to change the appearance of the website.

## Troubleshooting

### API Key Issues
If you see "API key not configured" errors, check that your Hugging Face API key is correctly set in the .env file.

### Database Errors
If you encounter database errors, try deleting the `database.sqlite` file and restarting the application. The database will be recreated automatically.

### Deployment Issues
This simplified version uses standard Node.js and Express, which should deploy easily to most hosting platforms. If you encounter issues:
- Check that Node.js and npm are installed on your server
- Verify that all dependencies are installed
- Ensure environment variables are properly set
- Check server logs for specific error messages

## License
This project is licensed under the MIT License.
