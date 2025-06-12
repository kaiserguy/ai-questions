#!/bin/bash

# start-local.sh
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

# Check if ports are already in use
if check_port 4000; then
    echo -e "${YELLOW}Port 4000 is already in use. AI Questions may already be running.${NC}"
fi

if check_port 5678; then
    echo -e "${YELLOW}Port 5678 is already in use. n8n may already be running.${NC}"
fi

# Start n8n using Docker Compose
echo -e "${GREEN}Starting n8n...${NC}"
cd "$N8N_DIR"
docker-compose up -d

# Wait for n8n to be ready
echo -e "${GREEN}Waiting for n8n to be ready...${NC}"
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:5678 > /dev/null; then
        echo -e "${GREEN}n8n is ready!${NC}"
        break
    fi
    attempt=$((attempt+1))
    echo -e "${YELLOW}Waiting for n8n to start (attempt $attempt/$max_attempts)...${NC}"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}n8n failed to start within the expected time.${NC}"
    echo -e "${YELLOW}Continuing anyway, but n8n integration may not work properly.${NC}"
fi

# Return to the script directory
cd "$SCRIPT_DIR"

# Start AI Questions
echo -e "${GREEN}Starting AI Questions...${NC}"
LOCAL_MODE=true PORT=4000 node index.js &
AI_QUESTIONS_PID=$!

# Wait for AI Questions to be ready
echo -e "${GREEN}Waiting for AI Questions to be ready...${NC}"
max_attempts=15
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:4000 > /dev/null; then
        echo -e "${GREEN}AI Questions is ready!${NC}"
        break
    fi
    attempt=$((attempt+1))
    echo -e "${YELLOW}Waiting for AI Questions to start (attempt $attempt/$max_attempts)...${NC}"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}AI Questions failed to start within the expected time.${NC}"
    echo -e "${RED}Stopping n8n and exiting.${NC}"
    cd "$N8N_DIR"
    docker-compose down
    kill $AI_QUESTIONS_PID 2>/dev/null
    exit 1
fi

# Validate the integration
echo -e "${GREEN}Validating n8n integration...${NC}"

# Test n8n availability
echo "Checking n8n availability..."
n8n_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5678 || echo "failed")

if [ "$n8n_status" = "failed" ] || [ "$n8n_status" != "200" ]; then
    echo -e "${RED}⚠️ n8n is not running properly.${NC}"
    echo -e "${YELLOW}Integration will fall back to direct API calls.${NC}"
else
    echo -e "${GREEN}✅ n8n is running${NC}"
fi

# Test AI Questions server
echo "Checking AI Questions server availability..."
server_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000 || echo "failed")

if [ "$server_status" = "failed" ] || [ "$server_status" != "200" ]; then
    echo -e "${RED}⚠️ AI Questions server is not running properly.${NC}"
    echo -e "${RED}Stopping n8n and exiting.${NC}"
    cd "$N8N_DIR"
    docker-compose down
    kill $AI_QUESTIONS_PID 2>/dev/null
    exit 1
else
    echo -e "${GREEN}✅ AI Questions server is running${NC}"
fi

# Display success message
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}AI Questions with n8n integration is now running!${NC}"
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}AI Questions: http://localhost:4000${NC}"
echo -e "${GREEN}n8n Management Portal: http://localhost:5678${NC}"
echo -e "${GREEN}==================================================${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop both services${NC}"

# Handle graceful shutdown
trap cleanup INT TERM
cleanup() {
    echo -e "${YELLOW}Stopping AI Questions and n8n...${NC}"
    kill $AI_QUESTIONS_PID 2>/dev/null
    cd "$N8N_DIR"
    docker-compose down
    echo -e "${GREEN}Services stopped.${NC}"
    exit 0
}

# Keep the script running
wait $AI_QUESTIONS_PID
