# AI Questions Local - Hardware Requirements Guide

## 🎯 **Quick Reference**

| Configuration | CPU | RAM | Storage | Use Case |
|---------------|-----|-----|---------|----------|
| **Minimal** | 2 cores | 4GB | 10GB | Basic testing, small AI models |
| **Standard** | 4 cores | 8GB | 50GB | Recommended for most users |
| **Professional** | 6+ cores | 16GB | 100GB | Heavy research, multiple models |
| **Enterprise** | 8+ cores | 32GB | 500GB | Maximum performance, full datasets |

## 💻 **Detailed Requirements by Component**

### **Base Application**
- **CPU**: 2+ cores (any modern processor)
- **RAM**: 2GB for application + database
- **Storage**: 5GB for application, database, and logs
- **OS**: Ubuntu 20.04+ (other Linux distributions supported)

### **Local AI Models (Ollama)**

| Model | Size | RAM Required | CPU Cores | Performance |
|-------|------|-------------|-----------|-------------|
| **TinyLlama** | 1GB | 2GB total | 2 cores | Basic responses, 5-15s |
| **Phi-3 Mini** | 2GB | 4GB total | 2-4 cores | Good quality, 3-8s |
| **Llama 3.2 3B** | 2GB | 4GB total | 4 cores | High quality, 2-6s |
| **Gemma 2B** | 1.5GB | 3GB total | 2-4 cores | Balanced, 3-10s |
| **Llama 3.1 8B** | 5GB | 8GB total | 4+ cores | Excellent quality, 5-15s |
| **Multiple Models** | Varies | +2GB per model | 4+ cores | Concurrent operation |

### **Wikipedia Datasets**

| Dataset | Download | Extracted | RAM Impact | Search Speed |
|---------|----------|-----------|------------|--------------|
| **Simple English** | 500MB | 2GB | +500MB | 50-200ms |
| **Full English** | 20GB | 80GB | +1-2GB | 100-500ms |
| **Both Datasets** | 20.5GB | 82GB | +2-3GB | Variable |

### **PostgreSQL Database**
- **RAM**: 1-2GB for optimal performance
- **Storage**: 1GB base + growth over time
- **CPU**: Minimal impact on modern processors

## 🏆 **Recommended Configurations**

### **🥉 Minimal Setup - "Getting Started"**
**Hardware:**
- **CPU**: 2 cores, 2.0GHz+ (Intel i3, AMD Ryzen 3, or equivalent)
- **RAM**: 4GB total
- **Storage**: 10GB available space
- **Network**: Internet for initial setup only

**Capabilities:**
- ✅ Basic application functionality
- ✅ One small AI model (TinyLlama, Phi-3 Mini)
- ✅ Simple English Wikipedia
- ✅ Basic scheduling and analytics
- ⚠️ Limited concurrent operations
- ⚠️ Slower AI response times (5-15 seconds)

**Best For:**
- Testing and evaluation
- Personal use with basic needs
- Learning and experimentation
- Budget-conscious deployments

### **🥈 Standard Setup - "Recommended"**
**Hardware:**
- **CPU**: 4 cores, 2.5GHz+ (Intel i5, AMD Ryzen 5, or equivalent)
- **RAM**: 8GB total
- **Storage**: 50GB available space (SSD recommended)
- **Network**: Internet for initial setup only

**Capabilities:**
- ✅ Full application functionality
- ✅ 2-3 AI models simultaneously
- ✅ Simple English Wikipedia + room for growth
- ✅ Fast AI responses (2-8 seconds)
- ✅ Concurrent question processing
- ✅ Comprehensive analytics and export

**Best For:**
- Most individual users
- Small team research
- Regular AI monitoring
- Educational institutions
- Small business intelligence

### **🥇 Professional Setup - "High Performance"**
**Hardware:**
- **CPU**: 6+ cores, 3.0GHz+ (Intel i7, AMD Ryzen 7, or equivalent)
- **RAM**: 16GB total
- **Storage**: 100GB available space (SSD strongly recommended)
- **Network**: Internet for initial setup only

**Capabilities:**
- ✅ Maximum application performance
- ✅ Multiple large AI models (8B+ parameters)
- ✅ Full English Wikipedia
- ✅ Very fast AI responses (1-5 seconds)
- ✅ Heavy concurrent operations
- ✅ Large-scale data analysis
- ✅ Multiple simultaneous users

**Best For:**
- Professional researchers
- Medium-large organizations
- Intensive AI research
- High-volume question processing
- Academic institutions

### **🏢 Enterprise Setup - "Maximum Scale"**
**Hardware:**
- **CPU**: 8+ cores, 3.5GHz+ (Intel i9, AMD Ryzen 9, Xeon, or equivalent)
- **RAM**: 32GB+ total
- **Storage**: 500GB+ available space (NVMe SSD recommended)
- **Network**: High-speed internet for setup, optional for operation

**Capabilities:**
- ✅ Enterprise-grade performance
- ✅ All available AI models simultaneously
- ✅ Multiple Wikipedia datasets
- ✅ Sub-second AI responses
- ✅ Massive concurrent operations
- ✅ Real-time analytics
- ✅ Large team collaboration

**Best For:**
- Large enterprises
- Research institutions
- Government agencies
- High-frequency AI monitoring
- Mission-critical applications

## 🔧 **Component-Specific Requirements**

### **CPU Considerations**
**Minimum**: 2 cores, 2.0GHz
- Sufficient for basic operation
- AI responses: 10-30 seconds
- Single concurrent operation

**Recommended**: 4 cores, 2.5GHz+
- Good performance for most use cases
- AI responses: 3-10 seconds
- Multiple concurrent operations

**Optimal**: 6+ cores, 3.0GHz+
- Excellent performance
- AI responses: 1-5 seconds
- Heavy concurrent workloads

**CPU Architecture Notes:**
- x86_64 required (Intel/AMD)
- ARM64 support planned for future releases
- Newer architectures (AVX2, AVX-512) provide better AI performance

### **Memory (RAM) Breakdown**
**Base System**: 1-2GB
- Ubuntu OS and basic services

**Application**: 1-2GB
- Node.js application and dependencies
- PostgreSQL database

**AI Models**: 1-8GB per model
- TinyLlama: 1GB
- Phi-3 Mini: 2GB
- Llama 3.1 8B: 5GB
- Multiple models: Additive

**Wikipedia**: 0.5-3GB
- Simple English: 500MB active, 1GB peak
- Full English: 1-2GB active, 3GB peak

**Operating Buffer**: 1-2GB
- System stability and performance

### **Storage Requirements**

**Application Files**: 2GB
- Node.js application and dependencies
- System configuration files

**Database**: 1-10GB
- PostgreSQL data
- Question/answer history
- Analytics data
- Grows over time with usage

**AI Models**: 1-20GB
- Depends on models selected
- TinyLlama: 1GB
- Phi-3 Mini: 2GB
- Llama 3.1 8B: 5GB
- Multiple models: Additive

**Wikipedia**: 2-80GB
- Simple English: 2GB
- Full English: 80GB
- Both: 82GB

**Logs and Temp**: 1-5GB
- Application logs
- Temporary processing files
- Download cache

**Storage Type Recommendations:**
- **HDD**: Minimum viable, slower performance
- **SSD**: Recommended for good performance
- **NVMe SSD**: Optimal for best performance

## ⚡ **Performance Expectations**

### **AI Response Times**
| Hardware | Small Models | Medium Models | Large Models |
|----------|-------------|---------------|--------------|
| **Minimal** | 10-30s | 30-60s | Not recommended |
| **Standard** | 3-10s | 8-20s | 15-45s |
| **Professional** | 1-5s | 3-12s | 5-20s |
| **Enterprise** | 1-3s | 2-8s | 3-15s |

### **Wikipedia Search Times**
| Hardware | Simple Wikipedia | Full Wikipedia |
|----------|-----------------|----------------|
| **Minimal** | 200-500ms | 500ms-2s |
| **Standard** | 100-300ms | 200-800ms |
| **Professional** | 50-200ms | 100-500ms |
| **Enterprise** | 25-100ms | 50-300ms |

### **Concurrent Operations**
| Hardware | Simultaneous Questions | Simultaneous Users |
|----------|----------------------|-------------------|
| **Minimal** | 1-2 | 1 |
| **Standard** | 3-5 | 2-3 |
| **Professional** | 5-10 | 5-8 |
| **Enterprise** | 10+ | 10+ |

## 🎯 **Optimization Tips**

### **Memory Optimization**
- **Close unused applications** during AI processing
- **Use swap file** if RAM is limited (performance impact)
- **Monitor memory usage** with `htop` or `free -h`
- **Restart application** periodically to clear memory leaks

### **Storage Optimization**
- **Use SSD** for significant performance improvement
- **Separate data drives** for large Wikipedia datasets
- **Regular cleanup** of logs and temporary files
- **Database maintenance** with PostgreSQL VACUUM

### **CPU Optimization**
- **Close background applications** during heavy AI processing
- **Use CPU governor** set to "performance" mode
- **Monitor CPU temperature** to prevent throttling
- **Consider CPU affinity** for dedicated cores

### **Network Optimization**
- **Fast internet** for initial setup and model downloads
- **Local network** sufficient for operation
- **Offline operation** supported after setup

## 🔍 **Hardware Selection Guide**

### **Budget-Conscious Options**
**Refurbished Business Computers:**
- Dell OptiPlex 7040+ (i5-6500, 8GB RAM)
- HP EliteDesk 800 G2+ (i5-6500, 8GB RAM)
- Lenovo ThinkCentre M720+ (i5-8400, 8GB RAM)

**New Budget Options:**
- Intel NUC with i5 processor
- AMD Ryzen 5 mini PC
- Raspberry Pi 4 8GB (limited performance)

### **Mid-Range Options**
**Desktop Computers:**
- Intel i5-12400 with 16GB RAM
- AMD Ryzen 5 5600X with 16GB RAM
- Pre-built business workstations

**Laptops:**
- Business laptops with i5/Ryzen 5 and 16GB RAM
- Gaming laptops (often good value for performance)

### **High-Performance Options**
**Workstations:**
- Intel i7/i9 or AMD Ryzen 7/9
- 32GB+ RAM
- NVMe SSD storage
- Professional workstation brands

**Servers:**
- Intel Xeon or AMD EPYC processors
- ECC RAM for reliability
- RAID storage for redundancy
- Enterprise-grade components

## 🏠 **Home Lab Considerations**

### **Power Consumption**
- **Minimal Setup**: 50-100W
- **Standard Setup**: 100-200W
- **Professional Setup**: 200-400W
- **Enterprise Setup**: 400W+

### **Noise Levels**
- **Fanless systems**: Silent operation
- **Standard desktops**: Low noise
- **High-performance**: Moderate fan noise
- **Servers**: Higher noise levels

### **Heat Generation**
- **Ensure adequate ventilation**
- **Monitor CPU temperatures**
- **Consider room temperature impact**
- **Plan for cooling in enclosed spaces**

## 📊 **Cost Considerations**

### **Initial Hardware Investment**
- **Minimal**: $300-600
- **Standard**: $600-1,200
- **Professional**: $1,200-2,500
- **Enterprise**: $2,500+

### **Ongoing Costs**
- **Electricity**: $5-50/month depending on usage
- **Maintenance**: Minimal for solid-state systems
- **Upgrades**: RAM and storage easily upgradeable

### **Cost vs. Cloud Comparison**
- **Break-even**: Typically 6-12 months vs. cloud AI APIs
- **Long-term savings**: Significant for heavy usage
- **Privacy value**: Priceless for sensitive applications

## ✅ **Compatibility Notes**

### **Operating System Support**
- **Ubuntu 20.04+**: Fully tested and supported
- **Debian 10+**: Compatible with minor adjustments
- **CentOS/RHEL 8+**: Compatible with package manager changes
- **Other Linux**: Generally compatible with modifications

### **Architecture Support**
- **x86_64**: Fully supported
- **ARM64**: Planned for future releases
- **32-bit**: Not supported

### **Virtualization**
- **VMware**: Supported with adequate resource allocation
- **VirtualBox**: Supported but may have performance limitations
- **Docker**: Containerized deployment available
- **Cloud VMs**: Supported on major cloud providers

---

## 🎯 **Recommendation Summary**

For most users, the **Standard Setup** (4 cores, 8GB RAM, 50GB SSD) provides the best balance of performance, features, and cost. This configuration supports:

- ✅ Fast AI responses (2-8 seconds)
- ✅ Simple English Wikipedia
- ✅ Multiple AI models
- ✅ Comprehensive analytics
- ✅ Room for growth

**Start with the Standard Setup and upgrade based on your specific needs and usage patterns.**

