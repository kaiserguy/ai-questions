# Deployment Guide

## Overview

This application is configured to deploy automatically to Heroku when changes are pushed to the `main` branch.

## Deployment Process

### Automatic Deployment (GitHub Actions)

1. **Validation Phase** - Runs comprehensive tests and validations:
   - Unit tests execution
   - JavaScript syntax validation 
   - Common error pattern detection
   - Package configuration validation
   - DOM element validation
   - Server startup testing
   - Critical route accessibility validation
   - View path configuration validation

2. **Deployment Phase** - Deploys to Heroku:
   - Installs dependencies
   - Runs tests (must pass)
   - Deploys to Heroku using `heroku-deploy` action
   - Verifies deployment connectivity

3. **Production Validation** - Validates the live deployment:
   - Health check and response time validation
   - Critical user path validation
   - API endpoint accessibility testing
   - Offline functionality verification
   - JavaScript error detection

### Configuration Files

- **`Procfile`**: Specifies the web process command (`web: node hosted/hosted-app.js`)
- **`package.json`**: Contains start script and dependencies
- **`.github/workflows/deploy.yml`**: GitHub Actions deployment workflow

### Entry Point

The application uses `hosted/hosted-app.js` as the main entry point for Heroku deployment. This file:
- Uses modular architecture with core components
- Handles PostgreSQL database connections
- Supports Google OAuth authentication
- Mounts offline resource routes
- Serves the offline HTML5 application

### Environment Variables

Required for production deployment:
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption secret
- `GOOGLE_CLIENT_ID`: Google OAuth client ID (optional)
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret (optional)
- `HUGGING_FACE_API_KEY`: API key for Hugging Face models (optional)
- `OPENAI_API_KEY`: API key for OpenAI models (optional)

### Deployment Status

The deployment pipeline includes multiple validation layers to ensure:
- ✅ Code quality and syntax correctness
- ✅ Server startup functionality
- ✅ Critical route accessibility
- ✅ Database connection handling
- ✅ Production environment compatibility

### Troubleshooting

If deployment fails, check:
1. GitHub Actions logs for validation failures
2. Heroku deployment logs
3. Environment variable configuration
4. Database connectivity

All validation scripts are designed to catch common deployment issues before they reach production.