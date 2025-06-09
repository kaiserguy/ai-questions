# AI Questions Local - Wikipedia Integration Guide

## 🎯 Overview

The AI Questions Local application now includes comprehensive offline Wikipedia capabilities, enabling AI agents to reference factual information without internet connectivity. This transforms your local AI system into a knowledge-enhanced platform perfect for research, fact-checking, and context-aware responses.

## 📚 Wikipedia Integration Features

### **Offline Knowledge Base**
- **Complete Wikipedia Access**: Download and index Wikipedia articles locally
- **Multiple Dataset Options**: Simple English (~500MB) or Full English (~20GB)
- **Fast Search**: Optimized SQLite database with full-text search
- **Context Extraction**: Intelligent article summarization for AI prompts

### **AI Enhancement**
- **Automatic Context**: AI responses enhanced with relevant Wikipedia information
- **Source Attribution**: Responses include Wikipedia article sources
- **Confidence Scoring**: Context relevance scoring for quality control
- **Fallback Support**: Graceful degradation when Wikipedia unavailable

### **Management Interface**
- **Web-based Search**: Search Wikipedia directly from the application
- **Article Browser**: View full Wikipedia articles with categories
- **Random Discovery**: Explore random articles for inspiration
- **Category Navigation**: Browse articles by topic categories

## 🚀 Quick Start

### **1. Download Wikipedia Dataset**

Choose your preferred dataset size:

```bash
# Simple English Wikipedia (Recommended for most users)
./manage-wikipedia.sh download simple

# Full English Wikipedia (For comprehensive research)
./manage-wikipedia.sh download full
```

### **2. Verify Installation**

```bash
# Check Wikipedia status
./manage-wikipedia.sh status

# Test functionality
./manage-wikipedia.sh test
```

### **3. Enable Wikipedia Context**

In the web interface:
1. Navigate to "Personal Questions" section
2. Find the "Wikipedia Knowledge Base" panel
3. Ensure "Enhance AI responses with Wikipedia context" is checked

## 📖 Dataset Options

### **Simple English Wikipedia**
- **Size**: ~500MB compressed, ~2GB extracted
- **Articles**: ~200,000 articles
- **Language**: Simplified English for clarity
- **Best For**: General use, modest hardware, educational content
- **Download Time**: 10-30 minutes (depending on connection)

### **Full English Wikipedia**
- **Size**: ~20GB compressed, ~80GB extracted  
- **Articles**: ~6,000,000 articles
- **Language**: Complete English Wikipedia
- **Best For**: Comprehensive research, professional use
- **Download Time**: 2-8 hours (depending on connection)

### **Custom Datasets** *(Coming Soon)*
- **Selective Categories**: Download specific topic areas
- **Multiple Languages**: Support for non-English editions
- **Size Optimization**: Choose article count limits
- **Quality Filtering**: Filter by article quality ratings

## 🔍 Using Wikipedia Features

### **Search Wikipedia**

From the web interface:
1. Go to Personal Questions → Wikipedia Knowledge Base
2. Enter search terms in the "Quick Search" box
3. Click "Search" or press Enter
4. Browse results and click articles to view full content

From command line:
```bash
./manage-wikipedia.sh search "artificial intelligence"
./manage-wikipedia.sh search "climate change"
```

### **Browse Categories**

1. Click "📂 Browse Categories" in the Wikipedia section
2. View popular categories with article counts
3. Click any category to see articles within it
4. Use articles as context for your questions

### **Random Article Discovery**

1. Click "🎲 Random Articles" to discover content
2. Explore diverse topics for inspiration
3. Use interesting articles as question contexts

### **AI Context Enhancement**

When asking questions:
1. Ensure Wikipedia context is enabled (checkbox checked)
2. Ask your question normally
3. AI will automatically search Wikipedia for relevant context
4. Response will include Wikipedia sources when used

Example enhanced response:
```
AI Response: Artificial intelligence refers to machine intelligence...

*Sources: Artificial intelligence, Machine learning, Neural network*
```

## ⚙️ Management Commands

### **Status and Statistics**

```bash
# Check database status
./manage-wikipedia.sh status

# View detailed statistics
./manage-wikipedia.sh stats

# Test all functionality
./manage-wikipedia.sh test
```

### **Database Management**

```bash
# Remove Wikipedia database (frees up space)
./manage-wikipedia.sh remove

# Re-download if needed
./manage-wikipedia.sh download simple
```

## 🔧 Configuration

### **Environment Variables**

In your `.env.local` file:

```bash
# Wikipedia Settings
WIKIPEDIA_ENABLED=true
WIKIPEDIA_DB_PATH=./wikipedia.db
WIKIPEDIA_AUTO_DOWNLOAD=false
WIKIPEDIA_DATASET=simple
```

### **Configuration Options**

- **WIKIPEDIA_ENABLED**: Enable/disable Wikipedia integration
- **WIKIPEDIA_DB_PATH**: Path to Wikipedia database file
- **WIKIPEDIA_AUTO_DOWNLOAD**: Auto-download on first run
- **WIKIPEDIA_DATASET**: Default dataset (simple/full)

## 🎯 Use Cases

### **Research and Analysis**
- **Academic Research**: Access comprehensive factual information
- **Market Analysis**: Get background on companies, industries, technologies
- **Historical Context**: Understand historical events and timelines
- **Scientific Information**: Access scientific concepts and discoveries

### **Content Creation**
- **Fact Checking**: Verify information in AI responses
- **Background Research**: Gather context for articles or reports
- **Educational Content**: Create learning materials with factual backing
- **Creative Writing**: Research settings, characters, historical periods

### **Professional Applications**
- **Business Intelligence**: Research companies, markets, technologies
- **Legal Research**: Background on legal concepts, cases, precedents
- **Medical Information**: Access medical terminology and concepts
- **Technical Documentation**: Research technical concepts and standards

## 🚀 Performance Optimization

### **Hardware Recommendations**

**Minimum Requirements:**
- **RAM**: 4GB (Simple), 8GB (Full)
- **Storage**: 5GB (Simple), 100GB (Full)
- **CPU**: 2+ cores recommended

**Optimal Performance:**
- **RAM**: 8GB+ (Simple), 16GB+ (Full)
- **Storage**: SSD recommended for faster search
- **CPU**: 4+ cores for concurrent operations

### **Search Performance**

- **Simple Wikipedia**: ~50-200ms search times
- **Full Wikipedia**: ~100-500ms search times
- **Context Extraction**: ~200-1000ms depending on complexity
- **Concurrent Searches**: Supported with minimal performance impact

## 🔒 Privacy and Security

### **Complete Offline Operation**
- **No External Calls**: Wikipedia data accessed locally only
- **Privacy Protection**: No search queries sent to external services
- **Data Control**: Complete control over knowledge base content
- **Compliance Ready**: Suitable for regulated environments

### **Data Management**
- **Local Storage**: All data stored on your machine
- **Easy Removal**: Simple database deletion for cleanup
- **Version Control**: Track Wikipedia dataset versions
- **Backup Support**: Standard SQLite database backup procedures

## 🛠️ Troubleshooting

### **Common Issues**

**Wikipedia Database Not Found:**
```bash
# Download the database
./manage-wikipedia.sh download simple

# Check status
./manage-wikipedia.sh status
```

**Search Not Working:**
```bash
# Test functionality
./manage-wikipedia.sh test

# Check Python dependencies
pip3 install --user sqlite3 requests beautifulsoup4
```

**Performance Issues:**
- Ensure sufficient RAM for your dataset size
- Consider using SSD storage for better performance
- Monitor system resources during large queries

**Database Corruption:**
```bash
# Remove corrupted database
./manage-wikipedia.sh remove

# Re-download
./manage-wikipedia.sh download simple
```

### **Getting Help**

1. **Check Status**: Run `./manage-wikipedia.sh status`
2. **Test Functionality**: Run `./manage-wikipedia.sh test`
3. **Review Logs**: Check application logs for error messages
4. **Verify Dependencies**: Ensure Python packages are installed

## 🔄 Updates and Maintenance

### **Updating Wikipedia Data**

Wikipedia datasets are updated regularly. To get the latest data:

```bash
# Remove old database
./manage-wikipedia.sh remove

# Download latest version
./manage-wikipedia.sh download simple
```

### **Maintenance Tasks**

- **Regular Testing**: Run `./manage-wikipedia.sh test` monthly
- **Storage Monitoring**: Monitor disk space usage
- **Performance Monitoring**: Check search response times
- **Backup Planning**: Include Wikipedia database in backup procedures

## 🌟 Advanced Features

### **API Integration**

The Wikipedia system provides REST API endpoints:

```bash
# Search articles
GET /api/wikipedia/search?q=query&limit=5

# Get article context
GET /api/wikipedia/context?q=query&maxLength=2000

# Get article by ID
GET /api/wikipedia/article/:id

# Random articles
GET /api/wikipedia/random?count=5

# Browse categories
GET /api/wikipedia/categories?limit=20

# Search by category
GET /api/wikipedia/category/:category?limit=10

# Database statistics
GET /api/wikipedia/stats

# System status
GET /api/wikipedia/status
```

### **Custom Integration**

For advanced users, the Wikipedia system can be extended:

- **Custom Search Algorithms**: Modify search ranking
- **Additional Data Sources**: Integrate other knowledge bases
- **Specialized Extractors**: Create domain-specific context extractors
- **Performance Tuning**: Optimize for specific use cases

## 📈 Future Enhancements

### **Planned Features**
- **Multi-language Support**: Support for non-English Wikipedia editions
- **Custom Categories**: Download specific topic areas only
- **Real-time Updates**: Incremental updates without full re-download
- **Advanced Search**: Semantic search and concept matching
- **Integration APIs**: Connect with external knowledge sources

### **Community Contributions**
- **Dataset Optimization**: Improved compression and indexing
- **Search Algorithms**: Enhanced relevance scoring
- **User Interface**: Better visualization and navigation
- **Performance**: Faster search and context extraction

---

The Wikipedia integration transforms AI Questions Local into a comprehensive knowledge platform, providing the factual foundation needed for accurate, well-informed AI responses while maintaining complete privacy and offline operation.

