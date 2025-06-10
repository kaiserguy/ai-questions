# AI Questions - Windows Installation Guide

## 🪟 Windows Installation

AI Questions can run on Windows using WSL2 (Windows Subsystem for Linux). This provides the full Linux experience while running natively on Windows.

### 📋 System Requirements

- **Windows 10** version 2004 (build 19041) or later, or **Windows 11**
- **8GB RAM** minimum (16GB recommended for larger AI models)
- **10GB free disk space** (more for additional AI models)
- **Administrator privileges** (for WSL installation)
- **Internet connection** (for initial setup only)

### 🚀 Quick Installation

1. **Download the installer package** from the main site
2. **Extract the zip file** to a folder (e.g., `C:\ai-questions`)
3. **Right-click on PowerShell** and select "Run as Administrator"
4. **Navigate to the extracted folder**:
   ```powershell
   cd C:\ai-questions
   ```
5. **Run the installer**:
   ```powershell
   .\install-windows.ps1
   ```

### 🔧 Installation Options

#### Full Installation (Recommended)
```powershell
.\install-windows.ps1
```
This installs WSL2, Ubuntu, and all dependencies automatically.

#### Skip WSL Installation
```powershell
.\install-windows.ps1 -SkipWSL
```
Use this if you already have WSL2 and Ubuntu installed.

#### Show Help
```powershell
.\install-windows.ps1 -Help
```
Display detailed usage information.

### 📦 What Gets Installed

The installer automatically sets up:

1. **WSL2 (Windows Subsystem for Linux)**
   - Enables WSL and Virtual Machine Platform features
   - Sets WSL2 as the default version
   - May require a system restart

2. **Ubuntu 22.04**
   - Installed from Microsoft Store via winget
   - Configured for AI Questions

3. **System Dependencies**
   - Node.js 20 (latest LTS)
   - PostgreSQL database
   - Python 3 with pip
   - Git and other utilities

4. **AI Components**
   - Ollama (local AI model runner)
   - Phi-3 Mini and Llama 3.2 models
   - Wikipedia database (Simple English)

5. **Windows Integration**
   - Desktop shortcuts for easy access
   - Start/stop batch files

### 🎯 Starting AI Questions

After installation, you can start AI Questions in several ways:

#### Method 1: Desktop Shortcut
- Double-click **AI-Questions.bat** on your desktop

#### Method 2: PowerShell Command
```powershell
wsl -d Ubuntu-22.04 -e bash -c 'cd ~/ai-questions-local && ./start-local.sh'
```

#### Method 3: WSL Terminal
1. Open Ubuntu from Start Menu
2. Run: `cd ~/ai-questions-local && ./start-local.sh`

### 🌐 Accessing the Application

Once started, open your web browser and go to:
```
http://localhost:3000
```

### 🛑 Stopping AI Questions

#### Method 1: Desktop Shortcut
- Double-click **AI-Questions-Stop.bat** on your desktop

#### Method 2: PowerShell Command
```powershell
wsl -d Ubuntu-22.04 -e bash -c 'cd ~/ai-questions-local && ./stop-local.sh'
```

#### Method 3: Close Terminal
- Simply close the terminal window where it's running

### 🔧 Troubleshooting

#### WSL Installation Issues

**Problem**: "WSL is not enabled"
**Solution**: 
1. Open PowerShell as Administrator
2. Run: `dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart`
3. Run: `dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart`
4. Restart your computer

**Problem**: "Virtual Machine Platform not available"
**Solution**: 
1. Ensure virtualization is enabled in BIOS
2. Update Windows to the latest version
3. Install the WSL2 Linux kernel update package

#### Ubuntu Installation Issues

**Problem**: "Ubuntu not found in WSL"
**Solution**:
1. Install Ubuntu 22.04 from Microsoft Store
2. Or run: `winget install Canonical.Ubuntu.2204`

#### Application Issues

**Problem**: "Port 3000 already in use"
**Solution**:
1. Stop any existing instances
2. Run the stop script
3. Restart the application

**Problem**: "Database connection failed"
**Solution**:
1. Restart PostgreSQL: `sudo service postgresql restart`
2. Check database configuration in `.env.local`

#### Performance Issues

**Problem**: "Slow AI responses"
**Solution**:
1. Ensure you have enough RAM (8GB minimum)
2. Close other resource-intensive applications
3. Use smaller AI models (Phi-3 Mini instead of larger models)

### 🔄 Updating

To update AI Questions:

1. **Download the latest version**
2. **Stop the current instance**
3. **Extract to the same folder** (overwrite existing files)
4. **Run the installer again** with `-SkipWSL`:
   ```powershell
   .\install-windows.ps1 -SkipWSL
   ```

### 🗑️ Uninstalling

To completely remove AI Questions:

1. **Stop the application**
2. **Remove desktop shortcuts**
3. **Delete the installation folder**
4. **Remove from WSL** (optional):
   ```bash
   wsl -d Ubuntu-22.04 -e bash -c 'rm -rf ~/ai-questions-local'
   ```

To remove WSL entirely (optional):
1. Open "Turn Windows features on or off"
2. Uncheck "Windows Subsystem for Linux"
3. Restart your computer

### 💡 Tips for Windows Users

1. **Pin to Taskbar**: Right-click the desktop shortcut and pin to taskbar for quick access

2. **Windows Terminal**: Use Windows Terminal for a better WSL experience

3. **File Access**: Access your Windows files from Ubuntu at `/mnt/c/`

4. **Resource Management**: Monitor resource usage in Task Manager

5. **Automatic Startup**: Add the shortcut to Windows Startup folder for automatic startup

### 🆘 Getting Help

If you encounter issues:

1. **Check the logs** in the terminal window
2. **Restart your computer** and try again
3. **Update Windows** to the latest version
4. **Report issues** on the GitHub repository

### 🔒 Privacy & Security

- **All data stays local** - nothing is sent to external servers
- **No internet required** after installation
- **WSL provides isolation** from your main Windows system
- **Database is local** and encrypted
- **AI models run locally** on your hardware

---

## 📚 Additional Resources

- [WSL2 Official Documentation](https://docs.microsoft.com/en-us/windows/wsl/)
- [Ubuntu on WSL Guide](https://ubuntu.com/wsl)
- [Ollama Documentation](https://ollama.ai/docs)
- [Node.js on WSL](https://docs.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-wsl)

