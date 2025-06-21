# AI Questions Local - Complete Setup Guide with Local AI

## 🎯 Overview

AI Questions Local now includes **complete local AI capabilities** using Ollama, allowing you to run open-source AI models directly on your hardware without requiring external API keys or internet connectivity. This provides:

- **Complete Privacy**: All AI processing happens locally
- **No API Costs**: No per-request charges or usage limits  
- **Offline Capability**: Works without internet connection
- **Hardware Optimization**: Runs efficiently on modest hardware
- **Model Choice**: Select from various open-source models

## 🖥️ System Requirements

### Minimum Requirements
- **OS**: Ubuntu 20.04+ (64-bit)
- **RAM**: 4GB (for 3B parameter models)
- **Storage**: 20GB free space
- **CPU**: 2+ cores
- **Network**: Internet for initial setup and model downloads

### Recommended Requirements
- **RAM**: 8GB+ (for 7B parameter models)
- **Storage**: 50GB+ free space
- **CPU**: 4+ cores with good single-thread performance
- **GPU**: Optional but improves performance significantly

### Hardware Performance Guide

| RAM | Recommended Models | Expected Response Time |
|-----|-------------------|----------------------|
| 4GB | Llama 3.2 3B, Phi-3 Mini | 3-8 seconds |
| 8GB | Mistral 7B, CodeLlama 7B | 5-15 seconds |
| 16GB+ | Multiple large models | 2-10 seconds |

## 🚀 Quick Start Installation

### 1. Download and Extract
```bash
# Download the AI Questions Local package
wget https://github.com/your-repo/ai-questions-local/archive/main.zip
unzip main.zip
cd ai-questions-local
```

### 2. Run Setup Script
```bash
# Make setup script executable
chmod +x setup-local.sh

# Run the complete setup (includes Ollama and AI models)
./setup-local.sh
```

The setup script will automatically:
- ✅ Install system dependencies (PostgreSQL, Node.js, etc.)
- ✅ Install and configure Ollama
- ✅ Download recommended AI models based on your RAM
- ✅ Create database and configure environment
- ✅ Set up system services

### 3. Start the Application
```bash
# Start the application
./start-local.sh
```

### 4. Access Your Instance
Open your browser and navigate to:
```
http://localhost:3000
```

## 🤖 Local AI Models

### Pre-installed Models

The setup automatically downloads models based on your system's RAM:

#### For 4GB+ RAM Systems
- **Llama 3.2 3B**: Fast, general-purpose model (~2GB)
- **Phi-3 Mini**: Microsoft's efficient model (~2GB)

#### For 8GB+ RAM Systems  
- **Mistral 7B**: Higher quality responses (~4GB)
- **CodeLlama 7B**: Specialized for code tasks (~4GB)

#### For 2-4GB RAM Systems
- **Gemma 2B**: Google's compact model (~1.5GB)
- **TinyLlama**: Ultra-lightweight model (~1GB)

### Model Management

#### Web Interface
1. **Login** to your local instance
2. **Navigate** to "Your Personal Questions" section
3. **View** the "🤖 Local AI Models" panel
4. **Download**, test, or remove models as needed

#### Command Line Tool
```bash
# List installed models
./manage-models.sh list

# Show recommended models
./manage-models.sh recommended

# Download a specific model
./manage-models.sh download llama3.2:3b

# Test a model
./manage-models.sh test phi3:mini

# Remove a model
./manage-models.sh remove tinyllama

# Check service status
./manage-models.sh status
```

## ⚙️ Configuration

### Environment Variables

Edit `.env.local` to configure your instance:

```bash
# ===== LOCAL AI SETTINGS =====
# Enable/disable local AI
OLLAMA_ENABLED=true

# Ollama service URL
OLLAMA_URL=http://localhost:11434

# Fallback to cloud APIs if local AI fails
OLLAMA_FALLBACK_TO_CLOUD=true

# ===== CLOUD API KEYS (OPTIONAL) =====
# Add these for cloud model fallback
# HUGGING_FACE_API_KEY=your_key_here
# OPENAI_API_KEY=your_key_here
```

### Model Selection Priority

The application uses this priority order:
1. **Local models** (if available and selected)
2. **Cloud models** (if API keys configured)
3. **Fallback** (if enabled in configuration)

## 🔧 Management Commands

### Application Control
```bash
# Start the application
./start-local.sh

# Stop the application  
./stop-local.sh

# Check status
./status-local.sh

# View logs
journalctl -u ai-questions -f
```

### System Service Management
```bash
# Enable auto-start on boot
sudo systemctl enable ai-questions

# Start/stop/restart service
sudo systemctl start ai-questions
sudo systemctl stop ai-questions
sudo systemctl restart ai-questions

# Check service status
sudo systemctl status ai-questions
```

### Database Management
```bash
# Backup database
./backup-local.sh

# Connect to database
psql "postgresql://ai_questions_user:your_password@localhost:5432/ai_questions_db"
```

## 🎯 Usage Guide

### Using Local AI Models

1. **Model Selection**
   - Local models appear in all model dropdowns
   - Marked with "(Local)" suffix
   - No API key required

2. **Performance Optimization**
   - Smaller models (3B) for speed
   - Larger models (7B+) for quality
   - Test different models for your use case

3. **Hybrid Approach**
   - Use local models for privacy-sensitive questions
   - Use cloud models for complex reasoning
   - Enable fallback for reliability

### Personal Questions with Local AI

1. **Create Questions**: Add your custom questions
2. **Select Local Model**: Choose from installed models
3. **Ask AI**: Get responses from local models
4. **Schedule Automation**: Set up recurring questions
5. **Export Data**: Download results as CSV

### Scheduling with Local Models

- **Mixed Scheduling**: Use both local and cloud models
- **Local-Only**: Complete privacy with local models
- **Performance Aware**: Adjust frequency based on model speed

## 🔍 Monitoring and Troubleshooting

### Health Checks

```bash
# Complete system status
./status-local.sh

# Ollama service status
./manage-models.sh status

# Test a specific model
./manage-models.sh test llama3.2:3b
```

### Common Issues

#### Ollama Service Not Starting
```bash
# Check if service is running
sudo systemctl status ollama

# Restart Ollama service
sudo systemctl restart ollama

# Check logs
journalctl -u ollama -f
```

#### Model Download Failures
```bash
# Check internet connectivity
ping ollama.ai

# Manually download model
ollama pull llama3.2:3b

# Check disk space
df -h
```

#### Performance Issues
```bash
# Check memory usage
free -h

# Check CPU usage
htop

# Monitor model performance
./manage-models.sh test your-model
```

### Log Locations

- **Application logs**: `journalctl -u ai-questions`
- **Ollama logs**: `journalctl -u ollama`
- **System logs**: `/var/log/syslog`

## 🔒 Security Considerations

### Local AI Benefits
- **No data transmission** to external services
- **Complete control** over AI processing
- **No API key exposure** risks
- **Offline operation** capability

### Network Security
```bash
# Firewall configuration (optional)
sudo ufw enable
sudo ufw allow 3000/tcp  # Application port
sudo ufw deny 11434/tcp  # Block external Ollama access
```

### Data Protection
- All data stored locally in PostgreSQL
- No external API calls for local models
- Regular backups recommended

## 📊 Performance Optimization

### Hardware Optimization

#### CPU Optimization
- Ensure adequate cooling
- Close unnecessary applications
- Use performance CPU governor

#### Memory Optimization
```bash
# Check memory usage
free -h

# Clear cache if needed
sudo sync && sudo sysctl vm.drop_caches=3
```

#### Storage Optimization
- Use SSD for better model loading
- Ensure adequate free space
- Regular cleanup of old models

### Model Selection Strategy

| Use Case | Recommended Model | Reason |
|----------|------------------|---------|
| Quick responses | Llama 3.2 3B | Fast, efficient |
| Code questions | CodeLlama 7B | Specialized |
| General chat | Phi-3 Mini | Balanced |
| Research | Mistral 7B | High quality |
| Low-end hardware | TinyLlama | Minimal resources |

## 🔄 Updates and Maintenance

### Updating Models
```bash
# Check for model updates
./manage-models.sh list

# Update a model (remove and re-download)
./manage-models.sh remove old-model
./manage-models.sh download new-model
```

### Application Updates
```bash
# Backup before updating
./backup-local.sh

# Pull latest code
git pull origin main

# Restart application
./stop-local.sh
./start-local.sh
```

### System Maintenance
```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Clean up disk space
sudo apt autoremove
sudo apt autoclean

# Restart services
sudo systemctl restart ai-questions ollama
```

## 🆘 Support and Resources

### Getting Help

1. **Check Status**: Run `./status-local.sh`
2. **View Logs**: Check application and Ollama logs
3. **Test Models**: Use `./manage-models.sh test`
4. **Documentation**: Refer to `TROUBLESHOOTING.md`

### Useful Commands Reference

```bash
# Quick diagnostics
./status-local.sh
./manage-models.sh status

# Model management
./manage-models.sh list
./manage-models.sh download model-name
./manage-models.sh test model-name

# Service control
./start-local.sh
./stop-local.sh
sudo systemctl restart ollama

# Monitoring
journalctl -u ai-questions -f
journalctl -u ollama -f
htop
```

### Community and Documentation

- **GitHub Repository**: [Link to repository]
- **Issue Tracker**: [Link to issues]
- **Ollama Documentation**: https://ollama.ai/
- **Model Library**: https://ollama.ai/library

---

## 🎉 Congratulations!

You now have a complete, private AI Questions instance running locally with:

✅ **Local AI Models** - No external dependencies  
✅ **Complete Privacy** - All data stays on your machine  
✅ **Automated Scheduling** - Regular AI monitoring  
✅ **Data Export** - CSV downloads for analysis  
✅ **Web Interface** - Easy model management  
✅ **Command Line Tools** - Advanced administration  

Your local AI Questions instance is ready for serious research, monitoring, and analysis work!

