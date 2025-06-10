# AI Questions - Windows Installer
# This script installs AI Questions offline version on Windows using WSL2

param(
    [switch]$SkipWSL,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
AI Questions - Windows Installer

This script installs the AI Questions offline version on Windows.
It uses WSL2 (Windows Subsystem for Linux) to run the Ubuntu-based application.

Usage:
    .\install-windows.ps1          # Full installation with WSL2
    .\install-windows.ps1 -SkipWSL # Skip WSL installation (if already installed)
    .\install-windows.ps1 -Help    # Show this help

Requirements:
- Windows 10 version 2004+ or Windows 11
- Administrator privileges (for WSL installation)
- At least 8GB RAM and 10GB free disk space

What this script does:
1. Checks system requirements
2. Installs/enables WSL2 and Ubuntu
3. Installs Node.js, PostgreSQL, and Ollama in Ubuntu
4. Downloads and configures AI Questions
5. Sets up local AI models and Wikipedia
6. Creates Windows shortcuts for easy access

"@
    exit 0
}

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Magenta = "`e[35m"
$Cyan = "`e[36m"
$White = "`e[37m"
$Reset = "`e[0m"

function Write-ColorOutput {
    param($Color, $Message)
    Write-Host "$Color$Message$Reset"
}

function Write-Header {
    param($Message)
    Write-Host ""
    Write-ColorOutput $Cyan "=" * 60
    Write-ColorOutput $Cyan "  $Message"
    Write-ColorOutput $Cyan "=" * 60
    Write-Host ""
}

function Write-Step {
    param($Message)
    Write-ColorOutput $Blue "🔄 $Message"
}

function Write-Success {
    param($Message)
    Write-ColorOutput $Green "✅ $Message"
}

function Write-Warning {
    param($Message)
    Write-ColorOutput $Yellow "⚠️  $Message"
}

function Write-Error {
    param($Message)
    Write-ColorOutput $Red "❌ $Message"
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-WindowsVersion {
    $version = [System.Environment]::OSVersion.Version
    $build = (Get-ItemProperty "HKLM:SOFTWARE\Microsoft\Windows NT\CurrentVersion").CurrentBuild
    
    # Windows 10 version 2004 (build 19041) or later required for WSL2
    return ($version.Major -eq 10 -and [int]$build -ge 19041) -or ($version.Major -gt 10)
}

function Install-WSL {
    Write-Step "Installing WSL2 and Ubuntu..."
    
    try {
        # Enable WSL and Virtual Machine Platform features
        Write-Step "Enabling Windows features..."
        dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
        dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
        
        # Set WSL2 as default
        wsl --set-default-version 2
        
        # Install Ubuntu
        Write-Step "Installing Ubuntu from Microsoft Store..."
        winget install Canonical.Ubuntu.2204 --accept-source-agreements --accept-package-agreements
        
        Write-Success "WSL2 and Ubuntu installed successfully"
        Write-Warning "A system restart may be required for WSL2 to work properly"
        
        return $true
    }
    catch {
        Write-Error "Failed to install WSL2: $($_.Exception.Message)"
        return $false
    }
}

function Test-WSL {
    try {
        $wslVersion = wsl --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "WSL2 is available"
            return $true
        }
    }
    catch {
        # WSL not available
    }
    
    Write-Warning "WSL2 is not available or not installed"
    return $false
}

function Install-InWSL {
    Write-Step "Setting up AI Questions in Ubuntu..."
    
    # Create the installation script for Ubuntu
    $ubuntuScript = @"
#!/bin/bash
set -e

echo "🚀 AI Questions Ubuntu Setup"
echo "Setting up AI Questions in WSL Ubuntu environment..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required packages
echo "📦 Installing system dependencies..."
sudo apt install -y curl wget git unzip postgresql postgresql-contrib nodejs npm python3 python3-pip

# Install Node.js 20
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Ollama
echo "🤖 Installing Ollama..."
curl -fsSL https://ollama.ai/install.sh | sh

# Start PostgreSQL
echo "🗄️  Starting PostgreSQL..."
sudo service postgresql start

# Create database user
echo "🗄️  Setting up database..."
sudo -u postgres psql -c "CREATE USER aiuser WITH PASSWORD 'aipassword';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE ai_questions_local OWNER aiuser;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ai_questions_local TO aiuser;" 2>/dev/null || true

# Extract and setup AI Questions
echo "📁 Setting up AI Questions..."
cd /home/\$USER
unzip -o ai-questions-local.zip
cd ai-questions-local

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Setup environment
echo "⚙️  Configuring environment..."
if [ ! -f .env.local ]; then
    cat > .env.local << 'ENVEOF'
# Local AI Questions Configuration
NODE_ENV=development
PORT=3000
LOCAL_MODE=true

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_questions_local
DB_USER=aiuser
DB_PASSWORD=aipassword

# Local AI Configuration
OLLAMA_HOST=http://localhost:11434
WIKIPEDIA_AUTO_DOWNLOAD=true
WIKIPEDIA_DB_PATH=./wikipedia.db

# Disable cloud features
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SESSION_SECRET=local-dev-secret-key
ENVEOF
fi

# Setup database
echo "🗄️  Setting up database..."
sudo -u postgres psql -c "CREATE USER aiuser WITH PASSWORD 'aipassword';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE ai_questions_local OWNER aiuser;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ai_questions_local TO aiuser;" 2>/dev/null || true

# Start Ollama service
echo "🤖 Starting Ollama service..."
ollama serve &
sleep 5

# Download basic AI models
echo "🤖 Downloading AI models (this may take a while)..."
ollama pull phi3:mini
ollama pull llama3.2:1b

# Download Wikipedia
echo "📚 Downloading Wikipedia database..."
if [ -f wikipedia_downloader.py ]; then
    python3 wikipedia_downloader.py --dataset simple --output ./wikipedia.db
else
    echo "⚠️  Wikipedia downloader not found, skipping..."
fi

# Create Windows shortcuts
echo "🔗 Creating Windows shortcuts..."
cat > /mnt/c/Users/\$USER/Desktop/AI-Questions.bat << 'EOF'
@echo off
echo Starting AI Questions...
wsl -d Ubuntu-22.04 -e bash -c "cd /home/\$USER/ai-questions-local && ./start-local.sh"
EOF

cat > /mnt/c/Users/\$USER/Desktop/AI-Questions-Stop.bat << 'EOF'
@echo off
echo Stopping AI Questions...
wsl -d Ubuntu-22.04 -e bash -c "cd /home/\$USER/ai-questions-local && ./stop-local.sh"
EOF

echo ""
echo "✅ Installation complete!"
echo ""
echo "🎯 To start AI Questions:"
echo "   - Double-click 'AI-Questions.bat' on your desktop"
echo "   - Or run: wsl -d Ubuntu-22.04 -e bash -c 'cd /home/\$USER/ai-questions-local && ./start-local.sh'"
echo ""
echo "🌐 Access the application at: http://localhost:3000"
echo "🛑 To stop: Double-click 'AI-Questions-Stop.bat' or run the stop script"
echo ""
"@

    # Write the script to a temporary file
    $scriptPath = "$env:TEMP\ubuntu-setup.sh"
    $ubuntuScript | Out-File -FilePath $scriptPath -Encoding UTF8
    
    # Copy script to WSL and run it
    try {
        wsl -d Ubuntu-22.04 -e bash -c "cd ~ && cat > ubuntu-setup.sh" < $scriptPath
        wsl -d Ubuntu-22.04 -e bash -c "chmod +x ubuntu-setup.sh && ./ubuntu-setup.sh"
        
        Write-Success "AI Questions installed successfully in Ubuntu"
        return $true
    }
    catch {
        Write-Error "Failed to install in Ubuntu: $($_.Exception.Message)"
        return $false
    }
    finally {
        Remove-Item $scriptPath -ErrorAction SilentlyContinue
    }
}

function Show-CompletionMessage {
    Write-Header "Installation Complete!"
    
    Write-Host @"
🎉 AI Questions has been successfully installed!

🚀 How to start:
   • Double-click 'AI-Questions.bat' on your desktop
   • Or open PowerShell and run: wsl -d Ubuntu-22.04 -e bash -c 'cd ~/ai-questions-local && npm start'

🌐 Access the application:
   • Open your web browser and go to: http://localhost:3000

🛑 How to stop:
   • Double-click 'AI-Questions-Stop.bat' on your desktop
   • Or close the terminal window

📚 Features available:
   • 🔒 Complete privacy - no data leaves your computer
   • 🤖 Local AI models (Phi-3, Llama 3.2)
   • 📖 Local Wikipedia database
   • 💬 Private chat with AI models
   • 🚫 No API keys or internet required

🔧 Troubleshooting:
   • If you encounter issues, restart your computer and try again
   • Make sure Windows is up to date
   • Check that WSL2 is enabled in Windows Features

📖 For more help, see the README.md file in the installation directory.

"@
}

# Main installation process
try {
    Write-Header "AI Questions - Windows Installer"
    
    # Check if running as administrator
    if (-not (Test-Administrator)) {
        Write-Error "This script requires administrator privileges to install WSL2."
        Write-Host "Please run PowerShell as Administrator and try again."
        exit 1
    }
    
    # Check Windows version
    if (-not (Test-WindowsVersion)) {
        Write-Error "Windows 10 version 2004 (build 19041) or later is required for WSL2."
        Write-Host "Please update Windows and try again."
        exit 1
    }
    
    Write-Success "System requirements check passed"
    
    # Check if WSL is already installed
    if (-not $SkipWSL -and -not (Test-WSL)) {
        Write-Step "WSL2 not found, installing..."
        if (-not (Install-WSL)) {
            Write-Error "Failed to install WSL2. Please install manually and run with -SkipWSL"
            exit 1
        }
        
        Write-Warning "Please restart your computer and run this script again with -SkipWSL parameter"
        Read-Host "Press Enter to exit"
        exit 0
    }
    
    # Verify WSL is working
    if (-not (Test-WSL)) {
        Write-Error "WSL2 is not working properly. Please check your installation."
        exit 1
    }
    
    # Check if Ubuntu is installed
    $ubuntuInstalled = wsl -l -v | Select-String "Ubuntu-22.04"
    if (-not $ubuntuInstalled) {
        Write-Error "Ubuntu 22.04 is not installed in WSL. Please install it from Microsoft Store."
        exit 1
    }
    
    # Install AI Questions in Ubuntu
    if (-not (Install-InWSL)) {
        Write-Error "Failed to install AI Questions in Ubuntu"
        exit 1
    }
    
    Show-CompletionMessage
    
    Write-Host ""
    Write-ColorOutput $Green "🎉 Installation completed successfully!"
    Write-Host ""
    Read-Host "Press Enter to exit"
    
}
catch {
    Write-Error "Installation failed: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Please check the error message above and try again."
    Write-Host "If the problem persists, please report it on GitHub."
    Read-Host "Press Enter to exit"
    exit 1
}

