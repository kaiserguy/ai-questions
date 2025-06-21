#!/bin/bash

# AI Questions Local - Quick Demo Setup
# This script sets up a demo environment with example questions

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎬 AI Questions Local - Demo Setup${NC}"
echo "====================================="
echo ""

# Check if application is running
if ! pgrep -f "node index.js" > /dev/null; then
    echo -e "${YELLOW}⚠️  Application is not running. Starting it now...${NC}"
    ./start-local.sh &
    sleep 5
fi

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
fi

PORT=${PORT:-3000}

echo -e "${BLUE}📝 Adding example questions...${NC}"

# Function to add a question via API
add_question() {
    local question="$1"
    local context="$2"
    
    curl -s -X POST "http://localhost:$PORT/api/personal-questions" \
         -H "Content-Type: application/json" \
         -d "{\"question\":\"$question\",\"context\":\"$context\"}" > /dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅${NC} Added: $question"
    else
        echo -e "${RED}❌${NC} Failed to add: $question"
    fi
}

# Add example questions
add_question "What are the main ethical concerns with current AI development?" "Consider recent advances in large language models, computer vision, and autonomous systems. Focus on practical concerns for society, not theoretical scenarios."

add_question "What will be the most significant technology trend in the next 12 months?" "Consider emerging technologies, market adoption, regulatory changes, and societal impact. Focus on realistic, near-term developments rather than speculative breakthroughs."

add_question "How should companies approach digital transformation in 2024?" "Consider cloud adoption, AI integration, cybersecurity, and employee training. Include both technical and organizational change management aspects."

add_question "What skills will be most valuable for knowledge workers in the next 5 years?" "Consider the impact of AI, automation, and changing work patterns. Focus on skills that complement rather than compete with AI capabilities."

add_question "How is remote work changing company culture and productivity?" "Consider both positive and negative impacts. Include perspectives from employees, managers, and business outcomes. Focus on data-driven insights where possible."

echo ""
echo -e "${GREEN}🎉 Demo setup complete!${NC}"
echo ""
echo -e "${BLUE}🌐 Access your AI Questions instance:${NC}"
echo "   http://localhost:$PORT"
echo ""
echo -e "${BLUE}🎯 Try these features:${NC}"
echo "1. Click 'Ask AI' on any question to test AI integration"
echo "2. Click the Schedule button (⏰) to set up automated questioning"
echo "3. Click the Analytics button (📊) to view response data"
echo "4. Add your own questions using the 'Add Personal Question' button"
echo ""
echo -e "${BLUE}📊 Example Usage Scenarios:${NC}"
echo "• Set up weekly schedules for trend monitoring"
echo "• Compare responses from different AI models"
echo "• Track how AI perspectives change over time"
echo "• Export data for research or reporting"
echo ""
echo -e "${YELLOW}💡 Tip:${NC} Configure your API keys in .env.local for full functionality"

