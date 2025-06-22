#!/bin/bash

# Simplified start-local.sh for testing re-architected application
# This script will directly start the local-app.js without Docker dependencies.

echo "Starting AI Questions (Local) directly..."

# Define directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "Port 3000 is already in use. Attempting to free it..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        echo "Failed to free port 3000. Please close the application using this port and try again."
        exit 1
    else
        echo "Successfully freed port 3000."
    fi
fi

# Start AI Questions with improved error handling
echo "Starting AI Questions..."
export LOCAL_MODE=true
export PORT=3000
export N8N_READY=false # TODO: Check actual n8n status for direct processing fallback

# Start in background but capture PID
(node local-app.js) &
AI_QUESTIONS_PID=$!

# Wait for AI Questions to be ready
echo "Waiting for AI Questions to be ready..."
max_attempts=20
attempt=0
ai_questions_ready=false

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:3000 > /dev/null; then
        echo "AI Questions is ready!"
        ai_questions_ready=true
        break
    fi
    
    # Check if process is still running
    if ! ps -p $AI_QUESTIONS_PID > /dev/null; then
        echo "AI Questions process has terminated unexpectedly."
        echo "Check for errors in the console output above."
        exit 1
    fi
    
    attempt=$((attempt+1))
    echo "Waiting for AI Questions to start (attempt $attempt/$max_attempts)..."
    sleep 2
done

if [ "$ai_questions_ready" = false ]; then
    echo "AI Questions failed to start within the expected time."
    echo "Exiting."
    kill $AI_QUESTIONS_PID 2>/dev/null
    exit 1
fi

# Display success message with enhanced information
echo "=================================================="
echo "AI Questions (Local) is now running!"
echo "=================================================="
echo "AI Questions: http://localhost:3000"
echo "n8n Status: Not Running (TODO: Implement actual fallback)"
echo "=================================================="
echo "Press Ctrl+C to stop the service"

# Handle graceful shutdown
trap cleanup INT TERM
cleanup() {
    echo "Stopping AI Questions..."
    
    # Kill AI Questions process
    if ps -p $AI_QUESTIONS_PID > /dev/null; then
        echo "Stopping AI Questions process..."
        kill $AI_QUESTIONS_PID 2>/dev/null
        sleep 1
        # Force kill if still running
        if ps -p $AI_QUESTIONS_PID > /dev/null; then
            kill -9 $AI_QUESTIONS_PID 2>/dev/null
        fi
    fi
    
    echo "Service stopped successfully."
    exit 0
}

# Keep the script running and monitor the AI Questions process
while true; do
    if ! ps -p $AI_QUESTIONS_PID > /dev/null; then
        echo "AI Questions process has terminated unexpectedly."
        exit 1
    fi
    sleep 5
done


