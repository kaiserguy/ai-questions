# AI Questions - Cloud Version

A web application for tracking AI responses to politically sensitive questions over time, deployed on Heroku.

## Features

- **Daily Questions**: Automated daily thought-provoking questions
- **Multiple AI Models**: Support for ChatGPT and Hugging Face models
- **Personal Questions**: Add and track your own questions
- **Analytics Dashboard**: Compare responses across models and time
- **CSV Export**: Export data for analysis
- **Automated Scheduling**: Set up recurring questions

## Live Demo

Visit: https://peaceful-sierra-40313-4a09d237c70e.herokuapp.com/

## Local Installation

For local/private deployment with offline AI capabilities, see the local installation files in this repository.

## Cloud Deployment

This version is optimized for cloud deployment on Heroku with external AI APIs.

### Environment Variables

Required environment variables:
- `DATABASE_URL` - PostgreSQL database URL
- `GOOGLE_CLIENT_ID` - Google OAuth client ID  
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `SESSION_SECRET` - Session encryption secret
- `HUGGING_FACE_API_KEY` - Hugging Face API key (optional)
- `OPENAI_API_KEY` - OpenAI API key (optional)

## Technology Stack

- **Backend**: Node.js, Express, PostgreSQL
- **Frontend**: HTML, CSS, JavaScript
- **Authentication**: Google OAuth 2.0
- **AI APIs**: OpenAI GPT, Hugging Face Transformers
- **Deployment**: Heroku with GitHub Actions

