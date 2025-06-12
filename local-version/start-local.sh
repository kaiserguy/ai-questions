#!/bin/bash

# Enhanced start-local.sh with robust n8n startup and connection checks
# Seamlessly starts n8n, AI Questions, and validates the integration

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting AI Questions with n8n integration...${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker to run n8n.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed. Please install Docker Compose to run n8n.${NC}"
    exit 1
fi

# Define directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
N8N_DIR="$SCRIPT_DIR/n8n-agent"

# Check if n8n-agent directory exists
if [ ! -d "$N8N_DIR" ]; then
    echo -e "${RED}n8n-agent directory not found. Please ensure it exists at $N8N_DIR${NC}"
    exit 1
fi

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Check if Docker is running
if ! docker info &>/dev/null; then
    echo -e "${RED}Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if ports are already in use
if check_port 4000; then
    echo -e "${YELLOW}Port 4000 is already in use. AI Questions may already be running.${NC}"
    echo -e "${YELLOW}Attempting to free port 4000...${NC}"
    lsof -ti:4000 | xargs kill -9 2>/dev/null || true
    sleep 2
    if check_port 4000; then
        echo -e "${RED}Failed to free port 4000. Please close the application using this port and try again.${NC}"
        exit 1
    else
        echo -e "${GREEN}Successfully freed port 4000.${NC}"
    fi
fi

if check_port 5678; then
    echo -e "${YELLOW}Port 5678 is already in use. n8n may already be running.${NC}"
    
    # Check if it's our n8n container
    if docker ps | grep -q "n8n"; then
        echo -e "${GREEN}Existing n8n container found. Using it.${NC}"
    else
        echo -e "${YELLOW}Attempting to free port 5678...${NC}"
        lsof -ti:5678 | xargs kill -9 2>/dev/null || true
        sleep 2
        if check_port 5678; then
            echo -e "${RED}Failed to free port 5678. Please close the application using this port and try again.${NC}"
            exit 1
        else
            echo -e "${GREEN}Successfully freed port 5678.${NC}"
        fi
    fi
fi

# Start n8n using Docker Compose
echo -e "${GREEN}Starting n8n...${NC}"
cd "$N8N_DIR"

# Check if n8n containers are already running
if docker ps | grep -q "n8n"; then
    echo -e "${GREEN}n8n is already running.${NC}"
else
    # Stop any existing containers first to ensure clean state
    docker-compose down 2>/dev/null
    
    # Start n8n
    docker-compose up -d
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to start n8n containers. Please check Docker and try again.${NC}"
        exit 1
    fi
fi

# Wait for n8n to be ready with improved reliability
echo -e "${GREEN}Waiting for n8n to be ready...${NC}"
max_attempts=45  # Increased timeout for slower systems
attempt=0
n8n_ready=false

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:5678/healthz > /dev/null; then
        echo -e "${GREEN}n8n is ready!${NC}"
        n8n_ready=true
        break
    fi
    attempt=$((attempt+1))
    
    # More informative waiting message
    if [ $((attempt % 5)) -eq 0 ]; then
        echo -e "${YELLOW}Still waiting for n8n to start (attempt $attempt/$max_attempts)...${NC}"
        echo -e "${YELLOW}This may take a minute on first run as containers initialize.${NC}"
    fi
    
    sleep 2
done

if [ "$n8n_ready" = false ]; then
    echo -e "${YELLOW}n8n did not respond within the expected time.${NC}"
    echo -e "${YELLOW}AI Questions will start but may fall back to direct processing.${NC}"
    echo -e "${YELLOW}You can check n8n logs with: docker-compose logs -f n8n${NC}"
fi

# Return to the script directory
cd "$SCRIPT_DIR"

# Start AI Questions with improved error handling
echo -e "${GREEN}Starting AI Questions...${NC}"
export LOCAL_MODE=true
export PORT=4000
export N8N_READY=$n8n_ready

# Start in background but capture PID
node index.js &
AI_QUESTIONS_PID=$!

# Wait for AI Questions to be ready
echo -e "${GREEN}Waiting for AI Questions to be ready...${NC}"
max_attempts=20
attempt=0
ai_questions_ready=false

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:4000 > /dev/null; then
        echo -e "${GREEN}AI Questions is ready!${NC}"
        ai_questions_ready=true
        break
    fi
    
    # Check if process is still running
    if ! ps -p $AI_QUESTIONS_PID > /dev/null; then
        echo -e "${RED}AI Questions process has terminated unexpectedly.${NC}"
        echo -e "${RED}Check for errors in the console output above.${NC}"
        
        # Clean up n8n if needed
        echo -e "${YELLOW}Stopping n8n containers...${NC}"
        cd "$N8N_DIR"
        docker-compose down
        exit 1
    fi
    
    attempt=$((attempt+1))
    echo -e "${YELLOW}Waiting for AI Questions to start (attempt $attempt/$max_attempts)...${NC}"
    sleep 2
done

if [ "$ai_questions_ready" = false ]; then
    echo -e "${RED}AI Questions failed to start within the expected time.${NC}"
    echo -e "${RED}Stopping n8n and exiting.${NC}"
    kill $AI_QUESTIONS_PID 2>/dev/null
    cd "$N8N_DIR"
    docker-compose down
    exit 1
fi

# Display success message with enhanced information
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}AI Questions with n8n integration is now running!${NC}"
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}AI Questions: http://localhost:4000${NC}"
echo -e "${GREEN}n8n Management Portal: http://localhost:5678${NC}"

if [ "$n8n_ready" = true ]; then
    echo -e "${GREEN}n8n Status: Connected and Ready${NC}"
else
    echo -e "${YELLOW}n8n Status: Not Responding - Using Direct Processing Fallback${NC}"
fi

echo -e "${GREEN}==================================================${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop both services${NC}"

# Handle graceful shutdown with improved cleanup
trap cleanup INT TERM
cleanup() {
    echo -e "${YELLOW}Stopping AI Questions and n8n...${NC}"
    
    # Kill AI Questions process
    if ps -p $AI_QUESTIONS_PID > /dev/null; then
        echo -e "${YELLOW}Stopping AI Questions process...${NC}"
        kill $AI_QUESTIONS_PID 2>/dev/null
        sleep 1
        # Force kill if still running
        if ps -p $AI_QUESTIONS_PID > /dev/null; then
            kill -9 $AI_QUESTIONS_PID 2>/dev/null
        fi
    fi
    
    # Stop n8n containers
    echo -e "${YELLOW}Stopping n8n containers...${NC}"
    cd "$N8N_DIR"
    docker-compose down
    
    echo -e "${GREEN}Services stopped successfully.${NC}"
    exit 0
}

# Keep the script running and monitor the AI Questions process
while true; do
    if ! ps -p $AI_QUESTIONS_PID > /dev/null; then
        echo -e "${RED}AI Questions process has terminated unexpectedly.${NC}"
        echo -e "${YELLOW}Stopping n8n containers...${NC}"
        cd "$N8N_DIR"
        docker-compose down
        exit 1
    fi
    sleep 5
done
