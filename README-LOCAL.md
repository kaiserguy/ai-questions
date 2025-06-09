# AI Questions - Local Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Quick Start](#quick-start)
4. [Detailed Installation](#detailed-installation)
5. [Configuration](#configuration)
6. [Usage Guide](#usage-guide)
7. [Maintenance](#maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Configuration](#advanced-configuration)
10. [Security Considerations](#security-considerations)

---

## Overview

AI Questions Local is a private, self-hosted version of the AI Questions application that allows you to:

- **Monitor AI responses** to your questions over time
- **Schedule automated questioning** with custom frequencies
- **Compare different AI models** and analyze their performance
- **Maintain complete privacy** - all data stays on your machine
- **Run without authentication** - perfect for personal use

### Key Features

- ✅ **No Authentication Required** - Direct access without login
- ✅ **Local Database** - PostgreSQL running on your machine
- ✅ **Complete Privacy** - No data leaves your system
- ✅ **Full Functionality** - All scheduling and analytics features
- ✅ **Easy Setup** - Automated installation scripts
- ✅ **Multiple AI Models** - Support for OpenAI, Hugging Face models
- ✅ **Automated Scheduling** - Daily, weekly, monthly, or custom intervals
- ✅ **Advanced Analytics** - Trend analysis and model comparison

### What's Different from the Cloud Version

| Feature | Cloud Version | Local Version |
|---------|---------------|---------------|
| Authentication | Google OAuth | None (direct access) |
| Database | Heroku PostgreSQL | Local PostgreSQL |
| Data Privacy | Shared hosting | Complete local control |
| Setup Complexity | None (ready to use) | One-time setup required |
| Maintenance | Managed | Self-managed |
| Cost | Free (with limits) | Free (your hardware) |

---

## System Requirements

### Minimum Requirements

- **Operating System**: Ubuntu 18.04 LTS or newer
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 5GB free space minimum
- **Network**: Internet connection for initial setup and AI API calls
- **User Privileges**: sudo access for installation

### Recommended Requirements

- **Operating System**: Ubuntu 20.04 LTS or 22.04 LTS
- **RAM**: 4GB or more
- **Storage**: 10GB+ free space for logs and backups
- **CPU**: 2+ cores for better performance
- **Network**: Stable broadband connection

### Tested Environments

- ✅ Ubuntu 20.04 LTS (Focal Fossa)
- ✅ Ubuntu 22.04 LTS (Jammy Jellyfish)
- ⚠️ Ubuntu 18.04 LTS (Bionic Beaver) - works but not recommended
- ❓ Other Linux distributions - may work but not officially supported

---

## Quick Start

### 1. Download and Extract

```bash
# Download the latest release
wget https://github.com/your-repo/ai-questions-local/archive/main.zip
unzip main.zip
cd ai-questions-local-main
```

### 2. Run Setup Script

```bash
# Make setup script executable and run it
chmod +x setup-local.sh
./setup-local.sh
```

The setup script will:
- Install Node.js, PostgreSQL, and other dependencies
- Create a local database
- Configure the application
- Set up system services
- Create control scripts

### 3. Configure API Keys

```bash
# Edit the environment file
nano .env.local
```

Add your AI API keys:
```bash
# At least one of these is required:
HUGGING_FACE_API_KEY=your_hugging_face_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. Start the Application

```bash
./start-local.sh
```

### 5. Access the Application

Open your browser to: **http://localhost:3000**

That's it! You now have a private AI Questions instance running locally.

---


## Detailed Installation

### Step-by-Step Installation Process

#### 1. Prepare Your System

Update your system packages:
```bash
sudo apt update && sudo apt upgrade -y
```

Install basic tools if not already present:
```bash
sudo apt install -y curl wget git unzip
```

#### 2. Download AI Questions Local

Choose one of these methods:

**Method A: Direct Download**
```bash
wget https://github.com/your-repo/ai-questions-local/archive/main.zip
unzip main.zip
cd ai-questions-local-main
```

**Method B: Git Clone**
```bash
git clone https://github.com/your-repo/ai-questions-local.git
cd ai-questions-local
```

#### 3. Run the Setup Script

The setup script automates the entire installation process:

```bash
chmod +x setup-local.sh
./setup-local.sh
```

**What the setup script does:**

1. **System Updates**: Updates package lists
2. **Package Installation**: Installs Node.js, PostgreSQL, nginx, and utilities
3. **Database Setup**: Creates database user and database
4. **Application Setup**: Installs npm dependencies
5. **Security Configuration**: Generates session secrets
6. **Service Configuration**: Creates systemd service files
7. **Firewall Setup**: Configures UFW firewall rules
8. **Script Creation**: Creates start/stop/status scripts

#### 4. Manual Installation (Alternative)

If you prefer to install manually or the script fails:

**Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Install PostgreSQL:**
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Create Database:**
```bash
sudo -u postgres psql -c "CREATE USER aiuser WITH PASSWORD 'aipassword';"
sudo -u postgres psql -c "CREATE DATABASE ai_questions_local OWNER aiuser;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ai_questions_local TO aiuser;"
```

**Install Application Dependencies:**
```bash
npm install
```

**Create Environment File:**
```bash
cp .env.example .env.local
# Edit .env.local with your settings
```

---

## Configuration

### Environment Variables

The `.env.local` file contains all configuration options:

#### Required Settings

```bash
# Application mode
NODE_ENV=local
LOCAL_MODE=true
PORT=3000

# Database connection
DATABASE_URL=postgresql://aiuser:aipassword@localhost:5432/ai_questions_local

# At least one AI API key is required
HUGGING_FACE_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```

#### Optional Settings

```bash
# Local user information
LOCAL_USER_NAME=Your Name
LOCAL_USER_EMAIL=your.email@example.com

# Security
SESSION_SECRET=auto_generated_secret

# Debugging
DEBUG=false

# Backup location
BACKUP_DIR=/home/ubuntu/ai-questions-backups
```

### Getting AI API Keys

#### Hugging Face API Key (Recommended - Free Tier Available)

1. Go to [Hugging Face](https://huggingface.co/)
2. Create a free account
3. Go to Settings → Access Tokens
4. Create a new token with "Read" permissions
5. Copy the token to your `.env.local` file

**Supported Models:**
- DeepSeek R1 (Latest)
- Meta Llama 2 (7B)
- Mistral 7B
- Google FLAN-T5 Large

#### OpenAI API Key (Paid Service)

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account and add billing information
3. Go to API Keys section
4. Create a new API key
5. Copy the key to your `.env.local` file

**Supported Models:**
- GPT-3.5 Turbo
- GPT-4 (if you have access)

### Database Configuration

The default database configuration works for most installations:

```bash
# Default settings (automatically configured)
Database: ai_questions_local
User: aiuser
Password: aipassword
Host: localhost
Port: 5432
```

To use a different database configuration, modify the `DATABASE_URL` in `.env.local`:

```bash
DATABASE_URL=postgresql://username:password@host:port/database_name
```

### Network Configuration

By default, the application listens on all interfaces (`0.0.0.0:3000`), making it accessible from other devices on your network.

To restrict access to localhost only, modify `local-config.js`:

```javascript
app: {
  host: '127.0.0.1', // Localhost only
  port: process.env.PORT || 3000
}
```

---

## Usage Guide

### First Time Setup

1. **Start the Application**
   ```bash
   ./start-local.sh
   ```

2. **Access the Interface**
   Open your browser to: http://localhost:3000

3. **Add Your First Question**
   - Click "Add Personal Question"
   - Enter your question and context
   - Click "Save Question"

4. **Test AI Integration**
   - Select an AI model from the dropdown
   - Click "Ask AI" on your question
   - Verify you get a response

### Adding Questions

Personal questions are the core of the system. Each question should be:

- **Specific**: Clear and focused
- **Contextual**: Include relevant background information
- **Consistent**: Phrased the same way for comparable results over time

**Example Questions:**
```
Question: "What are the main ethical concerns with AI development?"
Context: "Consider current AI capabilities and potential future developments. Focus on practical concerns for society."

Question: "How will remote work impact company culture?"
Context: "Assume a technology company with 100-500 employees, considering both benefits and challenges."
```

### Setting Up Schedules

1. **Click the Schedule Button (⏰)** on any personal question

2. **Choose Frequency:**
   - **Daily**: Every day at midnight
   - **Weekly**: Every week on the same day
   - **Monthly**: Every month on the same date
   - **Custom**: Every X days/weeks/months

3. **Select AI Models:**
   - Choose which models to query
   - You can select multiple models
   - Each model will generate a separate response

4. **Save the Schedule:**
   - Click "Save Schedule"
   - The system will automatically run at the specified times

### Viewing Analytics

1. **Click the Analytics Button (📊)** on any question

2. **Review the Data:**
   - **Overview**: Total answers, models used, scheduled vs manual
   - **Model Comparison**: Performance metrics by AI model
   - **Recent Activity**: Latest responses and trends

3. **Export Data:**
   - Use the backup script to export all data
   - Individual responses can be copied from the interface

### Managing the Application

#### Starting and Stopping

```bash
# Start the application
./start-local.sh

# Stop the application
./stop-local.sh

# Check status
./status-local.sh
```

#### Monitoring Logs

```bash
# View real-time logs
tail -f logs/app.log

# View recent logs
./status-local.sh
```

#### Creating Backups

```bash
# Create a backup
./backup-local.sh

# Backups are saved as timestamped archives
ls backups/
```

---

## Maintenance

### Regular Maintenance Tasks

#### Daily
- Check application status: `./status-local.sh`
- Monitor disk space usage
- Review error logs if any issues

#### Weekly
- Create backups: `./backup-local.sh`
- Check for system updates: `sudo apt update && sudo apt list --upgradable`
- Review scheduled question performance

#### Monthly
- Clean old log files: `find logs/ -name "*.log" -mtime +30 -delete`
- Update Node.js dependencies: `npm update`
- Review and optimize database if needed

### Database Maintenance

#### Backup Database
```bash
# Manual database backup
pg_dump postgresql://aiuser:aipassword@localhost:5432/ai_questions_local > backup.sql
```

#### Restore Database
```bash
# Restore from backup
psql postgresql://aiuser:aipassword@localhost:5432/ai_questions_local < backup.sql
```

#### Database Statistics
```bash
# Connect to database
psql postgresql://aiuser:aipassword@localhost:5432/ai_questions_local

# Check table sizes
\dt+

# Check database size
SELECT pg_size_pretty(pg_database_size('ai_questions_local'));
```

### Log Management

#### Log Rotation
Create a logrotate configuration:

```bash
sudo nano /etc/logrotate.d/ai-questions
```

Add this content:
```
/home/ubuntu/ai-questions-local/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
```

#### Manual Log Cleanup
```bash
# Archive old logs
tar -czf logs/archive-$(date +%Y%m%d).tar.gz logs/*.log
rm logs/*.log

# Or simply truncate current log
> logs/app.log
```

### System Updates

#### Update Node.js
```bash
# Check current version
node --version

# Update to latest LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Update Application Dependencies
```bash
# Update npm packages
npm update

# Check for security vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

#### Update System Packages
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Clean up old packages
sudo apt autoremove -y
sudo apt autoclean
```

---

