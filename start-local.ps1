# AI Questions - Local Version Startup Script for Windows (PowerShell)
# This script starts the locally-hosted version of AI Questions

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AI Questions - Local Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables for local mode
$env:LOCAL_MODE = "true"
$env:PORT = "3000"
$env:NODE_ENV = "development"

Write-Host "Starting local server on port 3000..." -ForegroundColor Green
Write-Host ""
Write-Host "Access the application at: " -NoNewline
Write-Host "http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: Some features require additional services:" -ForegroundColor Gray
Write-Host "  - Ollama (AI models): http://localhost:11434" -ForegroundColor Gray
Write-Host "  - Wikipedia database: ./wikipedia.db" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Change to local directory and start the application
Set-Location -Path "$PSScriptRoot\local"
node local-app.js
