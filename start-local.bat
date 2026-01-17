@echo off
REM AI Questions - Local Version Startup Script for Windows
REM This script starts the locally-hosted version of AI Questions

echo ========================================
echo AI Questions - Local Version
echo ========================================
echo.

REM Set environment variables for local mode
set LOCAL_MODE=true
set PORT=3000
set NODE_ENV=development

echo Starting local server on port 3000...
echo.
echo Access the application at: http://localhost:3000
echo.
echo Note: Some features require additional services:
echo   - Ollama (AI models): http://localhost:11434
echo   - Wikipedia database: ./wikipedia.db
echo.
echo Press Ctrl+C to stop the server
echo.

REM Change to local directory and start the application
cd /d "%~dp0local"
node local-app.js

pause
