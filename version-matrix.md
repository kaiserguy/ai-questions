# AI Questions Version Matrix

## Overview

AI Questions is available in two primary deployment flavors: a publicly-hosted version and a locally-hosted version. This document outlines the key differences between these versions, their feature sets, and deployment considerations.

## Version Comparison Matrix

| Feature | Publicly-Hosted Version | Locally-Hosted Version |
|---------|-------------------------|------------------------|
| **Deployment** | Cloud-based (Heroku) | Local machine |
| **Authentication** | Google OAuth | None (single user) |
| **Database** | PostgreSQL | In-memory placeholder DB |
| **AI Models** | External APIs (OpenAI, Anthropic, etc.) | Local Ollama models |
| **API Keys** | User-provided or system-wide | Not required |
| **n8n Integration** | No | Yes |
| **Offline Mode** | HTML5 offline support | Fully offline by design |
| **Wikipedia Integration** | Optional | Included by default |
| **Multi-user Support** | Yes | No |
| **Data Persistence** | Yes (PostgreSQL) | Limited (session only) |
| **Scalability** | High | Limited to local resources |
| **Updates** | Automatic | Manual |
| **Analytics** | Available | None |

## Feature Details

### Authentication and User Management

**Publicly-Hosted Version:**
- Google OAuth integration for user authentication
- User profiles and preferences
- User-specific API keys for external LLMs
- Multi-user support with data isolation

**Locally-Hosted Version:**
- No authentication required
- Single-user mode with default profile
- No user management
- No login/logout UI elements

### AI Model Support

**Publicly-Hosted Version:**
- Integration with commercial LLM providers:
  - OpenAI (GPT-3.5, GPT-4)
  - Anthropic (Claude models)
  - Google (Gemini models)
  - Hugging Face models
- Requires API keys (user-provided or system-wide)
- Model preference management

**Locally-Hosted Version:**
- Integration with Ollama for local LLM execution
- Recommended models:
  - Llama 3.2 (1B, 3B)
  - Phi-3 (Mini, Medium)
  - Gemma (2B, 7B)
  - Mistral (7B)
  - TinyLlama
- No API keys required
- Model management through Ollama

### Database and Data Persistence

**Publicly-Hosted Version:**
- PostgreSQL database
- Full data persistence
- User data isolation
- Scheduled backups

**Locally-Hosted Version:**
- In-memory database
- Session-only persistence
- Data lost on application restart
- Optional file-based storage for answers

### n8n Integration

**Publicly-Hosted Version:**
- No n8n integration

**Locally-Hosted Version:**
- Full n8n workflow integration
- Pre-configured workflows:
  - Offline question processor
  - Online enhanced processor
  - Connectivity monitor
  - AI chat processor
  - Wikipedia article processor
- n8n management portal
- Workflow scheduling and execution

### Offline Capabilities

**Publicly-Hosted Version:**
- HTML5 offline mode via /offline endpoint
- Service worker for resource caching
- Local AI chat when offline
- Local Wikipedia AI search offline

**Locally-Hosted Version:**
- Fully offline by design
- No internet connection required after installation
- Complete functionality without connectivity

### Wikipedia Integration

**Publicly-Hosted Version:**
- Offline AI Wikipedia integration
- Basic English Wikipedia installed during offline initilization
- Offline search and context extraction

**Locally-Hosted Version:**
- Included by default
- Basic English Wikipedia installed during setup
- Offline search and context extraction

### Scalability and Performance

**Publicly-Hosted Version:**
- Cloud-based scalability
- Handles multiple concurrent users
- Performance limited by cloud resources

**Locally-Hosted Version:**
- Limited by local machine resources
- Single-user performance
- AI model performance depends on local hardware

### Updates and Maintenance

**Publicly-Hosted Version:**
- Automatic updates
- Centralized maintenance
- No user intervention required

**Locally-Hosted Version:**
- Manual updates
- User responsible for maintenance
- Update notifications via n8n connectivity monitor

### Analytics and Monitoring

**Publicly-Hosted Version:**
- Usage analytics
- Error monitoring
- Performance tracking

**Locally-Hosted Version:**
- Basic local logs
- No analytics
- Limited error reporting

## Deployment Considerations

### Publicly-Hosted Version

**Requirements:**
- Heroku account or similar cloud platform
- PostgreSQL database
- API keys for LLM providers
- Google OAuth credentials

**Setup:**
1. Deploy to Heroku or similar platform
2. Configure environment variables
3. Set up PostgreSQL database
4. Configure Google OAuth

**Maintenance:**
- Regular database backups
- API key rotation
- Security updates

### Locally-Hosted Version

**Requirements:**
- Node.js environment
- Ollama installation
- 4GB+ RAM recommended
- 10GB+ disk space for Wikipedia

**Setup:**
1. Download package from public version
2. Run setup script
4. Download recommended AI models
5. Download Wikipedia dump
6. Configure n8n workflows
7. Start n8n management portal
8. Configure Ollama models
9. Start local server

**Maintenance:**
- Manual updates
- Local backups if needed
- Model updates through Ollama

## Code Structure and Reusability

The project has been re-architected to maximize code reuse between versions:

- `core/` - Shared components used by both versions
  - `app.js` - Base Express application setup
  - `db-interface.js` - Database interface
  - `pg-db.js` - PostgreSQL implementation
  - `db.js` - In-memory implementation
  - `ai-interface.js` - AI model interface
  - `ollama-client.js` - Local AI implementation
  - `external-llm-client.js` - External API implementation
  - `wikipedia-integration.js` - Wikipedia integration
  - `routes.js` - Common API routes

- `hosted-app.js` - Entry point for publicly-hosted version
- `local-app.js` - Entry point for locally-hosted version

- `local/` - Local-specific components
  - `n8n-integration.js` - n8n workflow integration
  - `setup-local.sh` - Local setup script
  - `start-local.sh` - Local startup script

- `views/` - Shared EJS templates
- `public/` - Shared static assets

## Conclusion

The AI Questions application has been designed to provide flexibility in deployment while maintaining a consistent core experience. The publicly-hosted version offers multi-user support, cloud scalability, and integration with commercial LLM providers, while the locally-hosted version provides complete offline functionality, privacy, and integration with local AI models through Ollama and workflow automation through n8n.

