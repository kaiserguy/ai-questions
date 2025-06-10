# AI Questions - Offline Version

## 🏠 Complete Privacy & Offline AI Research Platform

This is the **offline version** of AI Questions - a completely private, local installation that runs on your own computer without any internet dependencies after setup.

### 🎯 What You Get

- **Complete Privacy**: All data stays on your computer
- **No API Costs**: Uses local AI models via Ollama
- **Offline Wikipedia**: Local knowledge base for enhanced responses  
- **Chat Interface**: Real-time conversations with local AI models
- **Question Tracking**: Monitor AI responses over time
- **Scheduling**: Automated question asking at set intervals
- **No Internet Required**: Works completely offline after setup

### 📋 System Requirements

- **Operating System**: Ubuntu 20.04+ (or compatible Linux distribution)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space (more for larger AI models)
- **CPU**: Modern multi-core processor
- **Internet**: Required only for initial setup and downloads

### 🚀 Quick Installation

1. **Download** this package and extract it
2. **Run the installer**:
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
3. **Start the application**:
   ```bash
   cd ~/ai-questions-local
   ./start-local.sh
   ```
4. **Open your browser** to: http://localhost:3000

### 📦 What Gets Installed

#### **Core Application**
- Node.js v20 (latest LTS)
- PostgreSQL database (local)
- AI Questions web application
- Management scripts

#### **AI Models** (via Ollama)
- Phi-3 Mini (3.8B parameters) - Fast and efficient
- Llama 3.1 8B - Balanced performance
- Mistral 7B - Excellent reasoning
- Additional models available on demand

#### **Knowledge Base**
- Basic English Wikipedia (~50MB)
- Upgrade options for full Wikipedia
- Local search and article viewer

#### **Management Tools**
- `start-local.sh` - Start the application
- `stop-local.sh` - Stop the application  
- `status-local.sh` - Check application status
- `manage-models.sh` - AI model management
- `manage-wikipedia.sh` - Wikipedia management

### 🔧 Configuration

The application runs with these default settings:
- **Port**: 3000 (http://localhost:3000)
- **Database**: PostgreSQL on port 5432
- **AI Service**: Ollama on port 11434
- **Authentication**: Disabled (local use only)

### 🎮 Features

#### **Daily Questions from "1984"**
- Automated daily questions about George Orwell's novel
- Track how different AI models respond over time
- Historical comparison and analysis

#### **Personal Questions**
- Create your own custom questions
- Schedule automated asking at intervals
- Compare responses across different AI models
- Export data to CSV for analysis

#### **Local AI Chat**
- Real-time conversations with local AI models
- Wikipedia integration for enhanced responses
- No conversation logging (complete privacy)
- Multiple model options

#### **Wikipedia Integration**
- Local Wikipedia database
- Automatic article linking in AI responses
- Clean article viewer
- Upgrade options for different datasets

### 📚 Documentation

After installation, you'll find these guides:

- **README-LOCAL.md** - Complete setup and usage guide
- **LOCAL-AI-GUIDE.md** - AI model management and optimization
- **WIKIPEDIA-GUIDE.md** - Wikipedia setup and management
- **TROUBLESHOOTING.md** - Common issues and solutions

### 🔒 Privacy & Security

#### **Complete Privacy**
- **No data collection**: Nothing is sent to external servers
- **Local processing**: All AI inference happens on your machine
- **No tracking**: No analytics, cookies, or user tracking
- **Offline operation**: Works without internet after setup

#### **Data Control**
- **Your data**: All questions, answers, and conversations stay local
- **Export options**: CSV export for your own analysis
- **Backup friendly**: Standard PostgreSQL database for easy backup
- **No vendor lock-in**: Open source, modify as needed

### 🛠️ Troubleshooting

#### **Common Issues**

**Port already in use**:
```bash
./stop-local.sh
./start-local.sh
```

**AI models not responding**:
```bash
./manage-models.sh
# Select option to restart Ollama service
```

**Database connection issues**:
```bash
sudo systemctl restart postgresql
./start-local.sh
```

**Low disk space**:
```bash
./manage-models.sh
# Remove unused AI models
```

#### **Getting Help**

1. Check `TROUBLESHOOTING.md` for detailed solutions
2. Review logs in the `logs/` directory
3. Use the status script: `./status-local.sh`
4. Visit the GitHub repository for community support

### 🔄 Updates

To update your installation:

1. Download the latest package
2. Stop the current application: `./stop-local.sh`
3. Run the new installer (it will preserve your data)
4. Restart: `./start-local.sh`

### 🌟 Advanced Usage

#### **Custom AI Models**
Add your own Ollama-compatible models:
```bash
./manage-models.sh
# Select "Add Custom Model"
```

#### **Wikipedia Datasets**
Upgrade to different Wikipedia versions:
```bash
./manage-wikipedia.sh
# Choose from Simple, Full, or Custom datasets
```

#### **Database Access**
Direct PostgreSQL access for advanced users:
```bash
sudo -u postgres psql ai_questions_local
```

### 📄 License

This software is open source. See the LICENSE file for details.

### 🤝 Contributing

This is the offline distribution of AI Questions. For development and contributions, visit the main repository at: https://github.com/kaiserguy/ai-questions

---

**Enjoy your completely private AI research platform!** 🎉

No internet required, no data collection, no API costs - just you and your AI models working together locally.

