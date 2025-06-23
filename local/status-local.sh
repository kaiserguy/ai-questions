#!/bin/bash

# AI Questions Local Status Script
# Shows the current status of the AI Questions application

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 AI Questions Local Status${NC}"
echo "================================"
echo ""

# Load environment variables if available
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
fi

# Check if process is running
PID=$(pgrep -f "node local-index.js")
if [ ! -z "$PID" ]; then
    echo -e "${GREEN}✅ Application Status: Running${NC}"
    echo -e "   PID: $PID"
    echo -e "   URL: http://localhost:${PORT:-3000}"
    echo -e "   Started: $(ps -o lstart= -p $PID)"
    
    # Check memory usage
    MEMORY=$(ps -o rss= -p $PID | awk '{print int($1/1024)"MB"}')
    echo -e "   Memory: $MEMORY"
    
    # Check CPU usage
    CPU=$(ps -o %cpu= -p $PID | awk '{print $1"%"}')
    echo -e "   CPU: $CPU"
else
    echo -e "${RED}❌ Application Status: Not Running${NC}"
fi

echo ""

# Check PostgreSQL status
if systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✅ PostgreSQL: Running${NC}"
    
    # Check database connection if we have DATABASE_URL
    if [ ! -z "$DATABASE_URL" ]; then
        if psql "$DATABASE_URL" -c '\q' 2>/dev/null; then
            echo -e "${GREEN}✅ Database Connection: OK${NC}"
            
            # Get database stats
            TABLES=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
            echo -e "   Tables: $TABLES"
            
            # Get user count
            USERS=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM users;" 2>/dev/null | xargs)
            echo -e "   Users: $USERS"
            
            # Get questions count
            QUESTIONS=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM personal_questions WHERE is_active = true;" 2>/dev/null | xargs)
            echo -e "   Active Questions: $QUESTIONS"
            
            # Get answers count
            ANSWERS=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM answers;" 2>/dev/null | xargs)
            echo -e "   Total Answers: $ANSWERS"
        else
            echo -e "${RED}❌ Database Connection: Failed${NC}"
        fi
    fi
else
    echo -e "${RED}❌ PostgreSQL: Not Running${NC}"
fi

echo ""

# Check system resources
echo -e "${BLUE}💻 System Resources:${NC}"
echo -e "   Disk Usage: $(df -h . | tail -1 | awk '{print $5" used of "$2}')"
echo -e "   Memory: $(free -h | grep '^Mem:' | awk '{print $3"/"$2" ("int($3/$2*100)"%)"}')"
echo -e "   Load Average: $(uptime | awk -F'load average:' '{print $2}')"

echo ""

# Check network connectivity
echo -e "${BLUE}🌐 Network Status:${NC}"
if [ ! -z "$PORT" ]; then
    if netstat -tuln | grep -q ":$PORT "; then
        echo -e "${GREEN}✅ Port $PORT: Listening${NC}"
    else
        echo -e "${RED}❌ Port $PORT: Not listening${NC}"
    fi
fi

# Check API key configuration
echo ""
echo -e "${BLUE}🔑 API Configuration:${NC}"
if [ ! -z "$HUGGING_FACE_API_KEY" ]; then
    echo -e "${GREEN}✅ Hugging Face API Key: Configured${NC}"
else
    echo -e "${YELLOW}⚠️  Hugging Face API Key: Not configured${NC}"
fi

if [ ! -z "$OPENAI_API_KEY" ]; then
    echo -e "${GREEN}✅ OpenAI API Key: Configured${NC}"
else
    echo -e "${YELLOW}⚠️  OpenAI API Key: Not configured${NC}"
fi

# Check log files
echo ""
echo -e "${BLUE}📝 Recent Logs:${NC}"
if [ -f logs/app.log ]; then
    echo -e "   Log file: logs/app.log ($(wc -l < logs/app.log) lines)"
    echo -e "   Last updated: $(stat -c %y logs/app.log)"
    echo ""
    echo -e "${BLUE}📄 Last 5 log entries:${NC}"
    tail -5 logs/app.log | sed 's/^/   /'
else
    echo -e "   No log file found"
fi

echo ""
echo -e "${BLUE}🔧 Available Commands:${NC}"
echo "   ./start-local.sh    - Start the application"
echo "   ./stop-local.sh     - Stop the application"
echo "   ./backup-local.sh   - Create a backup"
echo "   ./status-local.sh   - Show this status (current command)"

