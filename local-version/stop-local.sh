#!/bin/bash

# AI Questions Local Stop Script
# Stops the AI Questions application

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping AI Questions Local Instance...${NC}"

# Find the process
PID=$(pgrep -f "node index.js")

if [ ! -z "$PID" ]; then
    echo -e "${BLUE}📋 Found process with PID: $PID${NC}"
    
    # Try graceful shutdown first
    echo -e "${BLUE}🔄 Attempting graceful shutdown...${NC}"
    kill -TERM $PID
    
    # Wait up to 10 seconds for graceful shutdown
    for i in {1..10}; do
        if ! kill -0 $PID 2>/dev/null; then
            echo -e "${GREEN}✅ AI Questions stopped gracefully${NC}"
            exit 0
        fi
        sleep 1
    done
    
    # Force kill if still running
    echo -e "${YELLOW}⚠️  Forcing shutdown...${NC}"
    kill -KILL $PID
    
    # Verify it's stopped
    if ! kill -0 $PID 2>/dev/null; then
        echo -e "${GREEN}✅ AI Questions stopped${NC}"
    else
        echo -e "${RED}❌ Failed to stop AI Questions${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}ℹ️  AI Questions is not running${NC}"
fi

