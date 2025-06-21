# n8n AI Agent Integration for Locally Hosted AI Questions

This document provides comprehensive details about the n8n AI agent integration with the locally hosted AI Questions application.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Questions  │    │      n8n        │    │  Local Resources│
│   Local App     │◄──►│   AI Agent      │◄──►│   - Ollama      │
│                 │    │   Workflows     │    │   - Wikipedia   │
└─────────────────┘    └─────────────────┘    │   - SQLite      │
                              │                └─────────────────┘
                              ▼
                       ┌─────────────────┐
                       │ Online Resources│
                       │  - Web Search   │
                       │  - APIs         │
                       │  - Cloud AI     │
                       └─────────────────┘
```

## Key Features

### 1. Offline-First Design
- Works entirely with local resources (Ollama, local Wikipedia)
- No internet connection required for core functionality
- All essential workflows run locally

### 2. Online Enhancement
- Automatically leverages internet resources when available
- Web search integration via DuckDuckGo
- Cloud AI integration via HuggingFace
- Multi-source synthesis for comprehensive answers

### 3. Intelligent Connectivity Detection
- Automatic online/offline mode switching
- Regular connectivity monitoring (every 5 minutes)
- Graceful degradation when connectivity changes
- Redis-based status caching for performance

### 4. Wikipedia Integration
- Enhanced search with LLM-driven queries
- Proper linking to local Wikipedia articles
- Relevance scoring and article selection
- SQL query logging for transparency

### 5. User Experience Enhancements
- Real-time status updates during processing
- Client-side query logging (hidden by default)
- Detailed error messages instead of generic failures
- Rate limiting to prevent duplicate queries

## Workflows

The integration includes four main n8n workflows:

1. **Offline Question Processor**
   - Handles questions using only local resources
   - Analyzes questions and determines processing strategy
   - Searches local Wikipedia when relevant
   - Uses local Ollama models for responses

2. **Online Enhanced Processor**
   - Extends processing with online resources
   - Performs web searches for current information
   - Accesses cloud AI for complex questions
   - Synthesizes information from multiple sources

3. **Connectivity Monitor**
   - Checks internet connectivity every 5 minutes
   - Updates Redis cache with current status
   - Notifies application of connectivity changes
   - Enables automatic mode switching

4. **Task Automation Hub**
   - Handles background tasks and automation
   - Manages scheduled operations
   - Processes batch operations
   - Handles resource-intensive operations asynchronously

## Integration Points

### API Endpoints

The AI Questions application exposes these endpoints for n8n integration:

- `/api/agent/status` - Get current agent status
- `/api/agent/question` - Process questions through the agent
- `/api/agent/task` - Submit tasks for automation
- `/api/agent/initialize` - Initialize the agent

### n8n Webhook Endpoints

n8n exposes these webhook endpoints for the application:

- `/webhook/process-question` - Offline question processing
- `/webhook/process-question-online` - Online enhanced processing
- `/webhook/automate-task` - Task automation
- `/webhook/check-connectivity` - Connectivity verification

## Setup Instructions

### Prerequisites

- Docker and Docker Compose installed
- Local AI Questions application set up
- Local Wikipedia database installed

### Installation

1. Run the setup script:
   ```bash
   cd /home/ubuntu/ai-questions/local
   ./setup-ai-agent.sh
   ```

2. Verify services are running:
   ```bash
   docker-compose -f n8n-agent/docker-compose.yml ps
   ```

3. Access the n8n editor:
   - Open http://localhost:5678 in your browser
   - The workflows should be automatically imported

### Configuration

The integration is pre-configured, but you can customize:

1. **AI Models**: 
   - Default: `mistral:7b` and `llama2:7b-chat`
   - Add more models via Ollama: `docker-compose exec ollama ollama pull <model-name>`

2. **Web Search**:
   - Default: DuckDuckGo (no API key required)
   - Can be extended with other search providers

3. **Cloud AI**:
   - Default: HuggingFace public models
   - Can be configured with API keys for premium services

## Usage Examples

### Basic Question Processing

```javascript
// Client-side code
const response = await fetch('/api/agent/question', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: "What is the capital of Poland?",
    preferences: { model: "mistral:7b" }
  })
});

const result = await response.json();
console.log(result.response);
```

### Task Automation

```javascript
// Client-side code
const response = await fetch('/api/agent/task', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: "data_analysis",
    data: { source: "local_csv", file: "data.csv" },
    priority: "normal"
  })
});

const result = await response.json();
console.log(result.taskId); // Track task progress
```

## Troubleshooting

### Common Issues

1. **n8n not responding**
   - Check logs: `docker-compose -f n8n-agent/docker-compose.yml logs n8n`
   - Restart service: `docker-compose -f n8n-agent/docker-compose.yml restart n8n`

2. **Ollama model issues**
   - List models: `docker-compose -f n8n-agent/docker-compose.yml exec ollama ollama list`
   - Pull missing models: `docker-compose -f n8n-agent/docker-compose.yml exec ollama ollama pull mistral:7b`

3. **Redis connectivity**
   - Check Redis: `docker-compose -f n8n-agent/docker-compose.yml exec redis redis-cli ping`
   - Should return: `PONG`

### Logs

- n8n logs: `docker-compose -f n8n-agent/docker-compose.yml logs -f n8n`
- Ollama logs: `docker-compose -f n8n-agent/docker-compose.yml logs -f ollama`
- Redis logs: `docker-compose -f n8n-agent/docker-compose.yml logs -f redis`

## Performance Considerations

- **Memory Usage**: The complete stack requires approximately 4GB RAM
- **Disk Space**: Allow at least 10GB for models and data
- **GPU Acceleration**: Automatically used if available
- **Scaling**: Can be adjusted in docker-compose.yml resource limits

## Security Notes

- The integration is designed for local use only
- No authentication is enabled by default on n8n
- For production use, enable authentication and HTTPS

## Future Enhancements

- Additional AI model support
- More sophisticated task automation workflows
- Enhanced analytics and reporting
- User preference learning and personalization
