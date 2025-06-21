# AI Agent with n8n Integration

This directory contains the n8n-based AI agent implementation for the locally hosted AI Questions system.

## Features

- **Offline-First Design**: Works entirely with local resources (Ollama, local Wikipedia)
- **Online Enhancement**: Leverages internet resources when available
- **Intelligent Routing**: Automatically detects online/offline status
- **Multi-Modal Capabilities**: Text, image, and data processing
- **Workflow Automation**: Complex AI tasks broken into manageable workflows

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Questions  │    │      n8n        │    │  Local Resources│
│   Local App     │◄──►│   AI Agent      │◄──►│   - Ollama      │
│                 │    │   Workflows     │    │   - Wikipedia   │
└─────────────────┘    └─────────────────┘    │   - SQLite      │
                                              └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ Online Resources│
                       │  - Web Search   │
                       │  - APIs         │
                       │  - Cloud AI     │
                       └─────────────────┘
```

## Components

- `docker-compose.yml` - Container orchestration
- `n8n-workflows/` - AI agent workflow definitions
- `integration/` - API integration code
- `config/` - Configuration files

