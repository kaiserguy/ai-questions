#!/bin/bash

# AI Questions Local Setup Script for Ubuntu
# This script installs and configures everything needed to run AI Questions locally

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="ai_questions_local"
DB_USER="aiuser"
DB_PASSWORD="aipassword"
APP_PORT="3000"

echo -e "${BLUE}🚀 AI Questions Local Setup${NC}"
echo "This script will install and configure AI Questions for local use on Ubuntu."
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should not be run as root${NC}"
   echo "Please run as a regular user with sudo privileges."
   exit 1
fi

# Check Ubuntu version
echo -e "${BLUE}📋 Checking system requirements...${NC}"
if ! lsb_release -d | grep -q "Ubuntu"; then
    echo -e "${YELLOW}⚠️  Warning: This script is designed for Ubuntu. Other distributions may work but are not tested.${NC}"
fi

# Update system packages
echo -e "${BLUE}📦 Updating system packages...${NC}"
sudo apt update

# Install required packages
echo -e "${BLUE}🔧 Installing required packages...${NC}"
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    postgresql \
    postgresql-contrib \
    nginx \
    ufw \
    htop \
    nano

# Install Node.js 18.x
echo -e "${BLUE}📦 Installing Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

# Verify Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo -e "${RED}❌ Node.js version 16+ required. Current version: $(node --version)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) installed${NC}"

# Install npm packages globally
echo -e "${BLUE}📦 Installing global npm packages...${NC}"
sudo npm install -g pm2

# Configure PostgreSQL
echo -e "${BLUE}🗄️  Configuring PostgreSQL...${NC}"

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

echo -e "${GREEN}✅ PostgreSQL configured${NC}"

# Install application dependencies
echo -e "${BLUE}📦 Installing application dependencies...${NC}"
npm install

# Install Python dependencies for Wikipedia
echo -e "${BLUE}📚 Installing Python dependencies for Wikipedia...${NC}"
if ! command -v python3 &> /dev/null; then
    sudo apt-get install -y python3 python3-pip
fi

# Install required Python packages
pip3 install --user requests beautifulsoup4 lxml nltk scikit-learn numpy

# Install and configure Ollama
echo -e "${BLUE}🤖 Installing Ollama for local AI models...${NC}"

# Check if Ollama is already installed
if ! command -v ollama &> /dev/null; then
    # Download and install Ollama
    curl -fsSL https://ollama.ai/install.sh | sh
    
    # Wait for installation to complete
    sleep 3
    
    # Start Ollama service
    sudo systemctl start ollama
    sudo systemctl enable ollama
    
    echo -e "${GREEN}✅ Ollama installed and started${NC}"
else
    echo -e "${GREEN}✅ Ollama already installed${NC}"
    # Ensure service is running
    sudo systemctl start ollama
fi

# Wait for Ollama to be ready
echo -e "${BLUE}⏳ Waiting for Ollama service to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Ollama service is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠️  Ollama service not responding, continuing anyway...${NC}"
    fi
    sleep 2
done

# Download recommended models for modest hardware
echo -e "${BLUE}📥 Downloading recommended AI models...${NC}"
echo "This may take several minutes depending on your internet connection..."

# Function to download model with progress
download_model() {
    local model_name="$1"
    local model_display="$2"
    
    echo -e "${BLUE}📥 Downloading $model_display...${NC}"
    if ollama pull "$model_name" 2>/dev/null; then
        echo -e "${GREEN}✅ $model_display downloaded successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Failed to download $model_display (will be available for manual download)${NC}"
    fi
}

# Download models based on available RAM
TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')

if [ "$TOTAL_RAM" -ge 8 ]; then
    echo -e "${BLUE}💾 Detected ${TOTAL_RAM}GB RAM - downloading larger models${NC}"
    download_model "llama3.2:3b" "Llama 3.2 3B"
    download_model "phi3:mini" "Phi-3 Mini"
    download_model "mistral:7b" "Mistral 7B"
elif [ "$TOTAL_RAM" -ge 4 ]; then
    echo -e "${BLUE}💾 Detected ${TOTAL_RAM}GB RAM - downloading efficient models${NC}"
    download_model "llama3.2:3b" "Llama 3.2 3B"
    download_model "phi3:mini" "Phi-3 Mini"
else
    echo -e "${BLUE}💾 Detected ${TOTAL_RAM}GB RAM - downloading lightweight models${NC}"
    download_model "gemma:2b" "Gemma 2B"
    download_model "tinyllama" "TinyLlama"
fi

echo -e "${GREEN}✅ AI model setup complete${NC}"

# Generate session secret
echo -e "${BLUE}🔐 Generating security keys...${NC}"
SESSION_SECRET=$(openssl rand -hex 32)

# Create local environment file
echo -e "${BLUE}⚙️  Creating environment configuration...${NC}"
cat > .env.local << EOF
# AI Questions Local Environment Configuration
# Generated on $(date)

# ===== APPLICATION SETTINGS =====
NODE_ENV=local
LOCAL_MODE=true
PORT=$APP_PORT

# ===== DATABASE SETTINGS =====
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

# ===== LOCAL USER SETTINGS =====
LOCAL_USER_NAME=Local User
LOCAL_USER_EMAIL=user@localhost

# ===== SECURITY SETTINGS =====
SESSION_SECRET=$SESSION_SECRET

# ===== AI API KEYS =====
# Add your API keys here:
# HUGGING_FACE_API_KEY=your_hugging_face_api_key_here
# OPENAI_API_KEY=your_openai_api_key_here

# ===== LOCAL AI SETTINGS =====
# Ollama configuration
OLLAMA_ENABLED=true
OLLAMA_URL=http://localhost:11434
OLLAMA_FALLBACK_TO_CLOUD=true

# ===== WIKIPEDIA SETTINGS =====
# Wikipedia database configuration
WIKIPEDIA_ENABLED=true
WIKIPEDIA_DB_PATH=./wikipedia.db
WIKIPEDIA_AUTO_DOWNLOAD=false
WIKIPEDIA_DATASET=simple

# ===== OPTIONAL SETTINGS =====
DEBUG=false
EOF

echo -e "${GREEN}✅ Environment configuration created${NC}"

# Create systemd service file
echo -e "${BLUE}🔧 Creating system service...${NC}"
sudo tee /etc/systemd/system/ai-questions.service > /dev/null << EOF
[Unit]
Description=AI Questions Local Instance
After=network.target postgresql.service ollama.service
Requires=postgresql.service
Wants=ollama.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=NODE_ENV=local
EnvironmentFile=$(pwd)/.env.local
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable ai-questions

# Configure firewall
echo -e "${BLUE}🔥 Configuring firewall...${NC}"
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow $APP_PORT/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Create start/stop scripts
echo -e "${BLUE}📝 Creating control scripts...${NC}"

# Start script
cat > start-local.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting AI Questions..."

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Check if Ollama is running
if ! systemctl is-active --quiet ollama; then
    echo "🤖 Starting Ollama service..."
    sudo systemctl start ollama
    sleep 3
fi

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama to be ready..."
for i in {1..15}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama is ready"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "⚠️  Ollama not responding, continuing anyway..."
    fi
    sleep 1
done

# Start the application
node index.js
EOF

# Stop script
cat > stop-local.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping AI Questions..."

# Find and kill the process
PID=$(pgrep -f "node index.js")
if [ ! -z "$PID" ]; then
    kill $PID
    echo "✅ AI Questions stopped"
else
    echo "ℹ️  AI Questions is not running"
fi
EOF

# Status script
cat > status-local.sh << 'EOF'
#!/bin/bash
echo "📊 AI Questions Status"
echo "====================="

# Check if process is running
PID=$(pgrep -f "node index.js")
if [ ! -z "$PID" ]; then
    echo "✅ Status: Running (PID: $PID)"
    echo "🌐 URL: http://localhost:$(grep PORT .env.local | cut -d'=' -f2)"
else
    echo "❌ Status: Not running"
fi

# Check Ollama status
if systemctl is-active --quiet ollama; then
    echo "✅ Ollama: Running"
    
    # Check available models
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        MODEL_COUNT=$(curl -s http://localhost:11434/api/tags | jq '.models | length' 2>/dev/null || echo "0")
        echo "🤖 Local Models: $MODEL_COUNT available"
    else
        echo "⚠️  Ollama: Service running but not responding"
    fi
else
    echo "❌ Ollama: Not running"
fi

# Check database connection
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    if psql "$DATABASE_URL" -c '\q' 2>/dev/null; then
        echo "✅ Database: Connected"
    else
        echo "❌ Database: Connection failed"
    fi
fi

# Check disk space
echo "💾 Disk usage: $(df -h . | tail -1 | awk '{print $5}')"

# Check memory usage
echo "🧠 Memory usage: $(free -h | grep '^Mem:' | awk '{print $3"/"$2}')"
EOF

# Make scripts executable
chmod +x start-local.sh stop-local.sh status-local.sh

# Create backup script
cat > backup-local.sh << 'EOF'
#!/bin/bash
echo "💾 Creating backup..."

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Create backup directory
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database
echo "📊 Backing up database..."
pg_dump "$DATABASE_URL" > "$BACKUP_DIR/database.sql"

# Backup configuration
echo "⚙️ Backing up configuration..."
cp .env.local "$BACKUP_DIR/"

# Create archive
echo "📦 Creating archive..."
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

echo "✅ Backup created: $BACKUP_DIR.tar.gz"
EOF

chmod +x backup-local.sh

# Create logs directory
mkdir -p logs

echo ""
echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Add your AI API keys to .env.local:"
echo "   nano .env.local"
echo ""
echo "2. Start the application:"
echo "   ./start-local.sh"
echo ""
echo "3. Open your browser to:"
echo "   http://localhost:$APP_PORT"
echo ""
echo -e "${BLUE}📚 Available Commands:${NC}"
echo "   ./start-local.sh    - Start the application"
echo "   ./stop-local.sh     - Stop the application"
echo "   ./status-local.sh   - Check application status"
echo "   ./backup-local.sh   - Create a backup"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "- Add at least one AI API key to .env.local before starting"
echo "- The application will be accessible from other devices on your network"
echo "- All data is stored locally and privately on this machine"
echo ""
echo -e "${GREEN}✅ Setup complete! Enjoy your private AI Questions instance.${NC}"

