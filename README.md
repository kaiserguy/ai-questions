# AI Questions - Local Deployment with Local AI

## 🎯 Overview

AI Questions Local is a self-hosted version that runs completely on your own hardware with **local AI capabilities**. Using Ollama, you can run open-source AI models directly on your machine without requiring external API keys or internet connectivity.

### Key Features

✅ **Local AI Models** - Run open-source models without API keys  
✅ **Complete Privacy** - All data and AI processing stays on your machine  
✅ **No Authentication** - Direct access without login requirements  
✅ **Automated Scheduling** - Set up recurring AI questions  
✅ **Data Export** - CSV downloads for analysis  
✅ **Model Management** - Easy installation and management of AI models  
✅ **Hybrid Support** - Use both local and cloud models  

## 🚀 Quick Start

### Prerequisites
- Ubuntu 20.04+ (64-bit)
- 4GB+ RAM (8GB+ recommended for better models)
- 20GB+ free disk space
- Internet connection for initial setup

### Installation
```bash
# 1. Download and extract
wget https://github.com/your-repo/ai-questions-local/archive/main.zip
unzip main.zip && cd ai-questions-local

# 2. Run setup (installs everything including AI models)
chmod +x setup-local.sh && ./setup-local.sh

# 3. Start the application
./start-local.sh

# 4. Open in browser
# http://localhost:3000
```

## 🤖 Local AI Models

The setup automatically installs AI models based on your system's RAM:

- **4GB+ RAM**: Llama 3.2 3B, Phi-3 Mini (~2GB each)
- **8GB+ RAM**: Adds Mistral 7B (~4GB)
- **2-4GB RAM**: Gemma 2B, TinyLlama (lightweight options)

### Model Management
- **Web Interface**: Manage models through the application UI
- **Command Line**: Use `./manage-models.sh` for advanced management
- **Automatic Selection**: Setup chooses optimal models for your hardware

## 📋 What's Included

### Core Application
- **Modified Backend**: Authentication bypass, local database support, Ollama integration
- **Enhanced Frontend**: Local model selection and management UI
- **Database Setup**: PostgreSQL with automated configuration
- **Environment Config**: Pre-configured for local operation

### Setup and Management Scripts
- `setup-local.sh` - Complete installation including Ollama and AI models
- `start-local.sh` - Start application with Ollama service checks
- `stop-local.sh` - Stop application gracefully
- `status-local.sh` - System status and health checks
- `manage-models.sh` - AI model management tool
- `backup-local.sh` - Database backup utility

### Documentation
- `LOCAL-AI-GUIDE.md` - Comprehensive setup and usage guide
- `TROUBLESHOOTING.md` - Common issues and solutions
- `README-LOCAL.md` - Detailed technical documentation

### Configuration Files
- `.env.example` - Environment template with local AI options
- `local-config.js` - Local mode configuration with Ollama settings
- Service files for systemd integration

## 🔧 Management Commands

```bash
# Application control
./start-local.sh          # Start application and Ollama
./stop-local.sh           # Stop application gracefully
./status-local.sh         # Check status of all services

# Model management
./manage-models.sh list           # List installed models
./manage-models.sh download model # Download new model
./manage-models.sh test model     # Test model functionality
./manage-models.sh recommended    # Show recommended models

# System management
sudo systemctl start ai-questions    # Start as service
sudo systemctl enable ai-questions   # Enable auto-start
```

## 🎯 Use Cases

### Research and Academia
- **Private AI monitoring** without cloud dependency
- **Model comparison** across different AI systems
- **Data export** for academic research and analysis
- **Reproducible results** with consistent local models

### Business and Professional
- **Market trend monitoring** with scheduled questions
- **Competitive intelligence** gathering
- **Regular AI-powered reports** and insights
- **Cost-effective** AI usage without per-request charges

### Personal and Privacy-Focused
- **Complete local control** over AI interactions
- **No data sharing** with third parties
- **Offline capability** for sensitive work
- **Custom model selection** for specific needs

## 🔒 Privacy and Security

### Data Protection
- **Local Processing**: All AI inference happens on your machine
- **No External Calls**: Local models don't communicate with external services
- **Database Security**: PostgreSQL with local-only access
- **File Permissions**: Proper security for configuration files

### Network Security
- **Firewall Ready**: Configurable ports and access controls
- **Local Only**: Default configuration blocks external access
- **Optional Cloud**: Cloud APIs only used if explicitly configured

## 📊 Performance Expectations

### Response Times (Typical)
- **3B Models**: 2-5 seconds per response
- **7B Models**: 5-15 seconds per response
- **Factors**: CPU speed, available RAM, model complexity

### Resource Usage
- **RAM**: 2-8GB depending on model size
- **CPU**: Moderate usage during inference
- **Storage**: 1-5GB per model
- **Network**: Only for initial setup and updates

## 🆘 Support

### Documentation
- **LOCAL-AI-GUIDE.md**: Complete setup and usage guide
- **TROUBLESHOOTING.md**: Common issues and solutions
- **Command Reference**: Built-in help in all scripts

### Diagnostics
```bash
./status-local.sh              # Overall system status
./manage-models.sh status      # AI service status
journalctl -u ai-questions -f  # Application logs
```

### Community
- GitHub Issues for bug reports
- Documentation wiki for guides
- Community discussions for tips and tricks

---

## 🎉 Ready to Start?

1. **Download** the package
2. **Run** `./setup-local.sh`
3. **Start** with `./start-local.sh`
4. **Access** at http://localhost:3000

Transform your AI Questions experience with complete local control, privacy, and your own AI models!

