# AI Questions Local - Installation Package

This package contains everything needed to run AI Questions locally on Ubuntu.

## 📦 Package Contents

```
ai-questions-local/
├── README.md                 # Quick start guide
├── README-LOCAL.md          # Comprehensive documentation
├── TROUBLESHOOTING.md       # Problem solving guide
├── setup-local.sh          # Main installation script
├── start-local.sh          # Start the application
├── stop-local.sh           # Stop the application
├── status-local.sh         # Check application status
├── test-installation.sh    # Test installation
├── demo-setup.sh           # Set up demo with examples
├── .env.example            # Environment configuration template
├── local-config.js         # Local mode configuration
├── example-questions.json  # Example questions and scenarios
├── package.json            # Node.js dependencies
├── local-index.js          # Main application file
├── views/                 # Web interface templates
└── logs/                  # Application logs (created at runtime)
```

## 🚀 Quick Installation

1. **Extract the package:**
   ```bash
   unzip ai-questions-local.zip
   cd ai-questions-local
   ```

2. **Run the setup script:**
   ```bash
   chmod +x setup-local.sh
   ./setup-local.sh
   ```

3. **Configure API keys:**
   ```bash
   nano .env.local
   # Add your HUGGING_FACE_API_KEY or OPENAI_API_KEY
   ```

4. **Start the application:**
   ```bash
   ./start-local.sh
   ```

5. **Access the interface:**
   Open http://localhost:3000 in your browser

## 📋 System Requirements

- **OS**: Ubuntu 18.04+ (tested on 20.04 and 22.04)
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 5GB free space
- **Network**: Internet connection for setup and AI API calls
- **Privileges**: sudo access for installation

## 🔑 API Keys Required

You need at least one AI API key:

### Hugging Face (Recommended - Free Tier Available)
- Sign up at https://huggingface.co/
- Go to Settings → Access Tokens
- Create a new token
- Supports: DeepSeek R1, Llama 2, Mistral 7B, FLAN-T5

### OpenAI (Paid Service)
- Sign up at https://platform.openai.com/
- Add billing information
- Create an API key
- Supports: GPT-3.5 Turbo, GPT-4

## 🎯 Key Features

- **Private & Local**: All data stays on your machine
- **No Authentication**: Direct access without login
- **Automated Scheduling**: Set questions to run daily, weekly, or monthly
- **Multi-Model Support**: Compare responses from different AI models
- **Advanced Analytics**: Track trends and model performance
- **Easy Backup**: Built-in backup and restore functionality

## 📚 Documentation

- **README-LOCAL.md**: Complete installation and usage guide
- **TROUBLESHOOTING.md**: Solutions for common issues
- **example-questions.json**: Sample questions and use cases

## 🛠️ Available Commands

```bash
./setup-local.sh      # Install and configure everything
./start-local.sh      # Start the application
./stop-local.sh       # Stop the application
./status-local.sh     # Check status and system info
./test-installation.sh # Test installation
./demo-setup.sh       # Add example questions
```

## 🎬 Demo Mode

To quickly try the application with example questions:

```bash
./demo-setup.sh
```

This adds sample questions about AI ethics, technology trends, and business strategy.

## 🔧 Customization

### Change Port
Edit `.env.local`:
```bash
PORT=8080
```

### Add Custom Questions
Use the web interface or edit `example-questions.json` and import via the demo script.

### Configure Scheduling
Set up automated questioning through the web interface:
1. Click the Schedule button (⏰) on any question
2. Choose frequency and AI models
3. Save the schedule

## 📊 Usage Examples

### AI Researcher
- 5 questions about AI ethics and capabilities
- Weekly frequency with 3 AI models
- 780 responses per year for trend analysis

### Business Analyst
- 8 questions about market trends
- Monthly frequency with 2 AI models
- 192 responses per year for strategic insights

### Technology Consultant
- 12 questions about tech trends
- Weekly frequency with 3 AI models
- 1,872 responses per year for client insights

## 🔒 Security & Privacy

- **Local Only**: No data sent to external services except AI APIs
- **No Tracking**: No analytics or telemetry
- **Firewall Ready**: UFW firewall configuration included
- **Backup Encryption**: Optional backup encryption available

## 🆘 Support

1. **Check the logs**: `./status-local.sh`
2. **Run tests**: `./test-installation.sh`
3. **Read troubleshooting**: `TROUBLESHOOTING.md`
4. **Reset installation**: Re-run `./setup-local.sh`

## 📄 License

This software is provided as-is for personal and educational use. See the main project repository for full license terms.

## 🌟 Getting Started

Ready to start? Run the setup script and you'll be monitoring AI responses in minutes:

```bash
./setup-local.sh
```

The script will guide you through the entire process and let you know when everything is ready to use.

