#!/bin/bash

# AI Questions Local Start Script
# Starts the AI Questions application in local mode

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting AI Questions Local Instance...${NC}"

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ Error: .env.local file not found${NC}"
    echo "Please run ./setup-local.sh first or copy .env.example to .env.local"
    exit 1
fi

# Load environment variables
export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)

# Check if required services are available
echo -e "${BLUE}🔍 Checking local services...${NC}"

# Check if Ollama is available
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}❌ Error: Ollama not found${NC}"
    echo "Please run ./setup-local.sh first to install Ollama"
    exit 1
fi

# Start Ollama if not running
if ! pgrep -x "ollama" > /dev/null; then
    echo -e "${BLUE}🤖 Starting Ollama service...${NC}"
    ollama serve &
    sleep 3
fi

# Check if PostgreSQL is running
if ! systemctl is-active --quiet postgresql; then
    echo -e "${BLUE}🗄️  Starting PostgreSQL...${NC}"
    sudo systemctl start postgresql
fi

# Check database connection
if ! psql "postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME" -c '\q' 2>/dev/null; then
    echo -e "${RED}❌ Error: Cannot connect to database${NC}"
    echo "Please check your PostgreSQL installation and database configuration"
    exit 1
fi

# Check if port is available
if netstat -tuln | grep -q ":$PORT "; then
    echo -e "${RED}❌ Error: Port $PORT is already in use${NC}"
    echo "Please stop the existing service or change the PORT in .env.local"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

echo -e "${GREEN}✅ Environment checks passed${NC}"
echo -e "${BLUE}🌐 Starting server on http://localhost:$PORT${NC}"
echo -e "${BLUE}📝 Logs will be written to logs/app.log${NC}"
echo -e "${BLUE}🤖 Using local AI models via Ollama${NC}"
echo -e "${BLUE}📚 Wikipedia database: $WIKIPEDIA_DB_PATH${NC}"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the application with logging
node index.js 2>&1 | tee logs/app.log

