#!/bin/bash

# AI Questions Local - Ollama Model Manager
# Manage local AI models for the AI Questions application

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🤖 AI Questions - Local Model Manager${NC}"
echo "======================================"

# Check if Ollama is installed and running
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}❌ Ollama is not installed. Please run setup-local.sh first.${NC}"
    exit 1
fi

if ! systemctl is-active --quiet ollama; then
    echo -e "${YELLOW}⚠️  Ollama service is not running. Starting it now...${NC}"
    sudo systemctl start ollama
    sleep 3
fi

# Wait for Ollama to be ready
echo -e "${BLUE}⏳ Checking Ollama service...${NC}"
for i in {1..10}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Ollama service is ready${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Ollama service is not responding${NC}"
        exit 1
    fi
    sleep 1
done

# Function to list available models
list_models() {
    echo -e "\n${BLUE}📋 Installed Models:${NC}"
    echo "==================="
    
    MODELS=$(curl -s http://localhost:11434/api/tags | jq -r '.models[]? | "\(.name)\t\(.size)"' 2>/dev/null)
    
    if [ -z "$MODELS" ]; then
        echo -e "${YELLOW}No models installed${NC}"
    else
        echo -e "Model Name\t\tSize"
        echo "----------\t\t----"
        echo -e "$MODELS"
    fi
}

# Function to show recommended models
show_recommended() {
    echo -e "\n${BLUE}💡 Recommended Models for Different Hardware:${NC}"
    echo "=============================================="
    
    TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
    echo -e "Detected RAM: ${TOTAL_RAM}GB\n"
    
    echo -e "${GREEN}🚀 Fast & Efficient (4GB+ RAM):${NC}"
    echo "  llama3.2:3b     - Llama 3.2 3B (~2GB)"
    echo "  phi3:mini       - Phi-3 Mini (~2GB)"
    echo ""
    
    echo -e "${BLUE}⚡ Lightweight (2GB+ RAM):${NC}"
    echo "  gemma:2b        - Gemma 2B (~1.5GB)"
    echo "  tinyllama       - TinyLlama (~1GB)"
    echo ""
    
    echo -e "${YELLOW}🔥 High Quality (8GB+ RAM):${NC}"
    echo "  mistral:7b      - Mistral 7B (~4GB)"
    echo "  codellama:7b    - CodeLlama 7B (~4GB)"
    echo ""
}

# Function to download a model
download_model() {
    local model_name="$1"
    
    if [ -z "$model_name" ]; then
        echo -e "${RED}❌ Please specify a model name${NC}"
        echo "Example: $0 download llama3.2:3b"
        return 1
    fi
    
    echo -e "${BLUE}📥 Downloading model: $model_name${NC}"
    echo "This may take several minutes..."
    
    if ollama pull "$model_name"; then
        echo -e "${GREEN}✅ Model $model_name downloaded successfully${NC}"
    else
        echo -e "${RED}❌ Failed to download model $model_name${NC}"
        return 1
    fi
}

# Function to remove a model
remove_model() {
    local model_name="$1"
    
    if [ -z "$model_name" ]; then
        echo -e "${RED}❌ Please specify a model name${NC}"
        echo "Example: $0 remove llama3.2:3b"
        return 1
    fi
    
    echo -e "${YELLOW}🗑️  Removing model: $model_name${NC}"
    
    if ollama rm "$model_name"; then
        echo -e "${GREEN}✅ Model $model_name removed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to remove model $model_name${NC}"
        return 1
    fi
}

# Function to test a model
test_model() {
    local model_name="$1"
    
    if [ -z "$model_name" ]; then
        echo -e "${RED}❌ Please specify a model name${NC}"
        echo "Example: $0 test llama3.2:3b"
        return 1
    fi
    
    echo -e "${BLUE}🧪 Testing model: $model_name${NC}"
    echo "Sending test prompt..."
    
    local test_prompt="Hello! Please respond with a brief greeting."
    
    if ollama run "$model_name" "$test_prompt"; then
        echo -e "\n${GREEN}✅ Model $model_name is working correctly${NC}"
    else
        echo -e "${RED}❌ Model $model_name test failed${NC}"
        return 1
    fi
}

# Function to show model info
show_info() {
    local model_name="$1"
    
    if [ -z "$model_name" ]; then
        echo -e "${RED}❌ Please specify a model name${NC}"
        echo "Example: $0 info llama3.2:3b"
        return 1
    fi
    
    echo -e "${BLUE}ℹ️  Model Information: $model_name${NC}"
    echo "=========================="
    
    ollama show "$model_name" 2>/dev/null || echo -e "${RED}❌ Model not found or not installed${NC}"
}

# Function to show usage
show_usage() {
    echo -e "\n${BLUE}Usage:${NC}"
    echo "  $0 list                    - List installed models"
    echo "  $0 recommended             - Show recommended models"
    echo "  $0 download <model>        - Download a model"
    echo "  $0 remove <model>          - Remove a model"
    echo "  $0 test <model>            - Test a model"
    echo "  $0 info <model>            - Show model information"
    echo "  $0 status                  - Show Ollama service status"
    echo ""
    echo -e "${BLUE}Examples:${NC}"
    echo "  $0 download llama3.2:3b"
    echo "  $0 test phi3:mini"
    echo "  $0 remove tinyllama"
}

# Function to show status
show_status() {
    echo -e "\n${BLUE}🔍 Ollama Service Status:${NC}"
    echo "========================"
    
    if systemctl is-active --quiet ollama; then
        echo -e "Service: ${GREEN}Running${NC}"
        
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo -e "API: ${GREEN}Responding${NC}"
            
            MODEL_COUNT=$(curl -s http://localhost:11434/api/tags | jq '.models | length' 2>/dev/null || echo "0")
            echo -e "Models: ${GREEN}$MODEL_COUNT installed${NC}"
        else
            echo -e "API: ${RED}Not responding${NC}"
        fi
    else
        echo -e "Service: ${RED}Not running${NC}"
    fi
    
    echo -e "URL: http://localhost:11434"
}

# Main script logic
case "$1" in
    "list")
        list_models
        ;;
    "recommended")
        show_recommended
        ;;
    "download")
        download_model "$2"
        ;;
    "remove")
        remove_model "$2"
        ;;
    "test")
        test_model "$2"
        ;;
    "info")
        show_info "$2"
        ;;
    "status")
        show_status
        ;;
    "help"|"--help"|"-h"|"")
        show_usage
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        show_usage
        exit 1
        ;;
esac

