#!/bin/bash

# AI Questions Local - Test Installation Script
# This script tests the local installation to ensure everything works correctly

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 AI Questions Local - Installation Test${NC}"
echo "=============================================="
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    echo -n "Testing $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        if [ "$expected_result" = "success" ]; then
            echo -e "${GREEN}✅ PASS${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}❌ FAIL (unexpected success)${NC}"
            ((TESTS_FAILED++))
        fi
    else
        if [ "$expected_result" = "fail" ]; then
            echo -e "${GREEN}✅ PASS (expected failure)${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}❌ FAIL${NC}"
            ((TESTS_FAILED++))
        fi
    fi
}

# Function to test with output
test_with_output() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${BLUE}Testing $test_name...${NC}"
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((TESTS_FAILED++))
    fi
    echo ""
}

echo -e "${BLUE}📋 System Requirements Tests${NC}"
echo "--------------------------------"

# Test Node.js
run_test "Node.js installation" "command -v node" "success"
run_test "Node.js version (16+)" "node --version | grep -E 'v(1[6-9]|[2-9][0-9])'" "success"

# Test npm
run_test "npm installation" "command -v npm" "success"

# Test PostgreSQL
run_test "PostgreSQL installation" "command -v psql" "success"
run_test "PostgreSQL service" "systemctl is-active postgresql" "success"

echo ""
echo -e "${BLUE}📦 Application Files Tests${NC}"
echo "--------------------------------"

# Test required files
run_test "package.json exists" "test -f package.json" "success"
run_test "index.js exists" "test -f index.js" "success"
run_test "local-config.js exists" "test -f local-config.js" "success"
run_test ".env.example exists" "test -f .env.example" "success"

# Test scripts
run_test "setup-local.sh exists" "test -f setup-local.sh" "success"
run_test "start-local.sh exists" "test -f start-local.sh" "success"
run_test "stop-local.sh exists" "test -f stop-local.sh" "success"
run_test "status-local.sh exists" "test -f status-local.sh" "success"

# Test script permissions
run_test "setup-local.sh executable" "test -x setup-local.sh" "success"
run_test "start-local.sh executable" "test -x start-local.sh" "success"
run_test "stop-local.sh executable" "test -x stop-local.sh" "success"
run_test "status-local.sh executable" "test -x status-local.sh" "success"

echo ""
echo -e "${BLUE}🗄️  Database Tests${NC}"
echo "--------------------------------"

# Load environment if available
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
fi

# Test database connection
if [ ! -z "$DATABASE_URL" ]; then
    run_test "Database connection" "psql '$DATABASE_URL' -c '\q'" "success"
    
    # Test tables exist
    test_with_output "Database tables" "psql '$DATABASE_URL' -c '\dt' | grep -E '(users|personal_questions|answers)'"
else
    echo -e "${YELLOW}⚠️  No DATABASE_URL found, skipping database tests${NC}"
fi

echo ""
echo -e "${BLUE}📦 Dependencies Tests${NC}"
echo "--------------------------------"

# Test npm dependencies
if [ -d node_modules ]; then
    run_test "node_modules exists" "test -d node_modules" "success"
    run_test "express installed" "test -d node_modules/express" "success"
    run_test "pg installed" "test -d node_modules/pg" "success"
    run_test "axios installed" "test -d node_modules/axios" "success"
else
    echo -e "${YELLOW}⚠️  node_modules not found, run 'npm install' first${NC}"
    ((TESTS_FAILED++))
fi

echo ""
echo -e "${BLUE}⚙️  Configuration Tests${NC}"
echo "--------------------------------"

# Test environment file
if [ -f .env.local ]; then
    run_test ".env.local exists" "test -f .env.local" "success"
    run_test "LOCAL_MODE set" "grep -q 'LOCAL_MODE=true' .env.local" "success"
    run_test "PORT configured" "grep -q 'PORT=' .env.local" "success"
    
    # Check for API keys
    if grep -q 'HUGGING_FACE_API_KEY=' .env.local && ! grep -q 'HUGGING_FACE_API_KEY=$' .env.local; then
        echo -e "Hugging Face API Key... ${GREEN}✅ CONFIGURED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "Hugging Face API Key... ${YELLOW}⚠️  NOT CONFIGURED${NC}"
    fi
    
    if grep -q 'OPENAI_API_KEY=' .env.local && ! grep -q 'OPENAI_API_KEY=$' .env.local; then
        echo -e "OpenAI API Key... ${GREEN}✅ CONFIGURED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "OpenAI API Key... ${YELLOW}⚠️  NOT CONFIGURED${NC}"
    fi
else
    echo -e "${RED}❌ .env.local not found${NC}"
    echo "Run the setup script or copy .env.example to .env.local"
    ((TESTS_FAILED++))
fi

echo ""
echo -e "${BLUE}🔥 Network Tests${NC}"
echo "--------------------------------"

# Test firewall
if command -v ufw > /dev/null; then
    run_test "UFW firewall installed" "command -v ufw" "success"
    
    # Check if port is allowed (if we know the port)
    if [ ! -z "$PORT" ]; then
        if ufw status | grep -q "$PORT"; then
            echo -e "Port $PORT firewall rule... ${GREEN}✅ CONFIGURED${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "Port $PORT firewall rule... ${YELLOW}⚠️  NOT CONFIGURED${NC}"
            echo "  Run: sudo ufw allow $PORT/tcp"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  UFW not installed, firewall tests skipped${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Application Startup Test${NC}"
echo "--------------------------------"

# Test if application can start (dry run)
if [ -f .env.local ]; then
    echo "Testing application startup (dry run)..."
    
    # Check if port is available
    if [ ! -z "$PORT" ]; then
        if netstat -tuln | grep -q ":$PORT "; then
            echo -e "${YELLOW}⚠️  Port $PORT is already in use${NC}"
            echo "Stop any existing services or change PORT in .env.local"
        else
            echo -e "Port $PORT... ${GREEN}✅ AVAILABLE${NC}"
            ((TESTS_PASSED++))
        fi
    fi
    
    # Test Node.js syntax
    if node -c index.js > /dev/null 2>&1; then
        echo -e "JavaScript syntax... ${GREEN}✅ VALID${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "JavaScript syntax... ${RED}❌ INVALID${NC}"
        echo "Check index.js for syntax errors"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${YELLOW}⚠️  Cannot test startup without .env.local${NC}"
fi

echo ""
echo -e "${BLUE}📊 Test Results${NC}"
echo "=================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"

echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Your installation looks good.${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Configure API keys in .env.local (if not already done)"
    echo "2. Start the application: ./start-local.sh"
    echo "3. Open http://localhost:${PORT:-3000} in your browser"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the issues above.${NC}"
    echo ""
    echo -e "${BLUE}Common solutions:${NC}"
    echo "1. Run the setup script: ./setup-local.sh"
    echo "2. Install missing dependencies: npm install"
    echo "3. Configure environment: cp .env.example .env.local"
    echo "4. Check the troubleshooting guide: TROUBLESHOOTING.md"
    exit 1
fi

