#!/bin/bash

# AI Questions Offline Installer
# This script will install and configure AI Questions for local use

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 AI Questions Offline Installer${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""
echo "This installer will set up AI Questions for completely offline use."
echo "No internet connection will be required after installation."
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should not be run as root${NC}"
   echo "Please run as a regular user with sudo privileges."
   exit 1
fi

# Check for required commands
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $1 is available${NC}"
        return 0
    fi
}

echo -e "${BLUE}📋 Checking system requirements...${NC}"

# Check for basic tools
MISSING_TOOLS=0
check_command "curl" || MISSING_TOOLS=1
check_command "unzip" || MISSING_TOOLS=1
check_command "sudo" || MISSING_TOOLS=1

if [ $MISSING_TOOLS -eq 1 ]; then
    echo -e "${RED}❌ Missing required tools. Please install them first:${NC}"
    echo "sudo apt update && sudo apt install -y curl unzip sudo"
    exit 1
fi

# Check Ubuntu version
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" == "ubuntu" ]]; then
        echo -e "${GREEN}✅ Ubuntu $VERSION_ID detected${NC}"
        if [[ "$VERSION_ID" < "20.04" ]]; then
            echo -e "${YELLOW}⚠️  Ubuntu 20.04+ recommended, but continuing...${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Non-Ubuntu system detected. This installer is optimized for Ubuntu.${NC}"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Check available disk space (need at least 2GB)
AVAILABLE_SPACE=$(df . | tail -1 | awk '{print $4}')
REQUIRED_SPACE=2097152  # 2GB in KB
if [ $AVAILABLE_SPACE -lt $REQUIRED_SPACE ]; then
    echo -e "${RED}❌ Insufficient disk space${NC}"
    echo "Required: 2GB, Available: $(($AVAILABLE_SPACE / 1024 / 1024))GB"
    exit 1
fi

echo -e "${GREEN}✅ System requirements met${NC}"
echo ""

# Extract the application files
echo -e "${BLUE}📦 Extracting application files...${NC}"
if [ ! -f "ai-questions-local.zip" ]; then
    echo -e "${RED}❌ ai-questions-local.zip not found${NC}"
    echo "This file should be in the same directory as this installer."
    exit 1
fi

# Create installation directory
INSTALL_DIR="$HOME/ai-questions-local"
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}⚠️  Installation directory already exists: $INSTALL_DIR${NC}"
    read -p "Remove existing installation and continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        echo "Installation cancelled."
        exit 1
    fi
fi

# Extract files
unzip -q ai-questions-local.zip -d "$HOME/"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Files extracted to $INSTALL_DIR${NC}"
else
    echo -e "${RED}❌ Failed to extract files${NC}"
    exit 1
fi

# Change to installation directory
cd "$INSTALL_DIR"

# Make scripts executable
chmod +x *.sh

# Run the main setup script
echo -e "${BLUE}🔧 Running main setup script...${NC}"
echo ""
./setup-local.sh

echo ""
echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Start the application:"
echo "   cd $INSTALL_DIR"
echo "   ./start-local.sh"
echo ""
echo "2. Open your browser to: http://localhost:3000"
echo ""
echo "3. To stop the application: ./stop-local.sh"
echo "4. To check status: ./status-local.sh"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "- README-LOCAL.md - Complete local setup guide"
echo "- LOCAL-AI-GUIDE.md - AI model management"
echo "- WIKIPEDIA-GUIDE.md - Wikipedia integration"
echo "- TROUBLESHOOTING.md - Common issues and solutions"
echo ""
echo -e "${GREEN}✅ Your private AI Questions instance is ready!${NC}"

