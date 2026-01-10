# Contributing to AI Questions

Thank you for your interest in contributing to AI Questions! This guide will help you get started with contributing to our project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style and Standards](#code-style-and-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Deployment](#deployment)
- [Getting Help](#getting-help)

## Getting Started

AI Questions is a web application for tracking AI responses to questions over time. The project has two main deployment options:

- **Hosted Version**: Cloud deployment on Heroku with external AI APIs
- **Local Version**: Offline deployment with local AI models and Wikipedia integration

### Project Structure

```
ai-questions/
├── core/           # Shared application logic, views, routes
├── hosted/         # Cloud version optimized for Heroku
├── local/          # Offline version with local AI models
├── tests/          # Comprehensive test suite
└── docs/           # Additional documentation
```

## Development Setup

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (for hosted version) or SQLite (for local version)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kaiserguy/ai-questions.git
   cd ai-questions
   ```

2. **Install dependencies** (IMPORTANT: Skip Puppeteer download)
   ```bash
   PUPPETEER_SKIP_DOWNLOAD=true npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

### Running the Application

#### Local/Offline Version
```bash
cd local
LOCAL_MODE=true PORT=3000 node local-app.js
```

#### Hosted/Cloud Version
```bash
node core/hosted-index.cjs
```

## Code Style and Standards

### JavaScript/Node.js Best Practices

- Follow existing code patterns in the repository
- Use meaningful variable and function names
- Add comments for complex logic
- Prefer async/await over callbacks
- Use ES6+ features where appropriate

### File Organization

- **Core components**: Place shared functionality in `core/`
- **Version-specific features**: Use `hosted/` or `local/` directories
- **Tests**: Mirror the source structure in `tests/`
- **Documentation**: Keep docs updated with code changes

### Database Changes

- **Hosted version**: Modify PostgreSQL schemas in `hosted/migrations/`
- **Local version**: Update SQLite schemas in `local/local-database.js`
- **Compatibility**: Ensure both database versions remain compatible

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Structure

- **Unit tests**: `tests/unit/` - Test individual components
- **Integration tests**: `tests/integration/` - Test complete workflows
- **Validation tests**: `tests/validation/` - Test deployment and configuration

### Writing Tests

- Write tests for new functionality
- Update existing tests when modifying features
- Follow existing test patterns and naming conventions
- Use descriptive test names that explain the expected behavior

### Expected Test Results

Some tests may fail in development environments due to missing classes or infrastructure limitations. This is normal and expected:
- Typical result: 46 failed, 67 passed
- Focus on ensuring your changes don't introduce new test failures

## Submitting Changes

### Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Keep changes minimal and focused
   - Follow existing code patterns
   - Update documentation if needed

3. **Test your changes**
   ```bash
   npm test
   ./tests/validation/validate-javascript-syntax.sh
   ./tests/validation/test-server-startup.sh
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: your descriptive commit message"
   ```

5. **Push and create pull request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Guidelines

- Use conventional commit format: `type: description`
- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`
- Keep first line under 50 characters
- Add detailed description if needed

### Code Review Process

- All changes require review before merging
- Address feedback promptly and professionally
- Be open to suggestions and improvements
- Ensure CI/CD pipeline passes

## Deployment

### Validation Scripts

Run these validation scripts before submitting:

```bash
# JavaScript syntax validation (2 seconds)
./tests/validation/validate-javascript-syntax.sh

# Server startup validation (30 seconds)
./tests/validation/test-server-startup.sh

# Route validation (10 seconds)
./tests/validation/validate-critical-routes.sh

# Package configuration validation (1 second)
./tests/validation/validate-package-configurations.sh
```

### CI/CD Pipeline

- GitHub Actions automatically runs validation and deployment
- Pipeline includes validation, deployment, and post-deployment testing
- Total pipeline time: 15-25 minutes
- Monitor the Actions tab for deployment status

### Environment Variables

#### Required for Hosted Version
- `DATABASE_URL` - PostgreSQL database URL
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `SESSION_SECRET` - Session encryption secret
- `OPENAI_API_KEY` - OpenAI API key (optional)
- `HUGGING_FACE_API_KEY` - Hugging Face API key (optional)

#### Required for Local Version
- `LOCAL_MODE=true`
- `PORT=3000` (default)

## Getting Help

### Resources

- **Issue Tracker**: Report bugs and request features
- **Discussions**: Ask questions and share ideas
- **Documentation**: Check existing docs in the repository
- **Live Demo**: https://peaceful-sierra-40313-4a09d237c70e.herokuapp.com/

### Common Issues

1. **Dependencies installation fails**: Use `PUPPETEER_SKIP_DOWNLOAD=true npm install`
2. **Database connection errors**: Check environment variables and database setup
3. **Test failures**: Some failures are expected in development environments
4. **Build timeouts**: Long-running operations require patience (60-90 seconds for npm install)

### Support

If you need help:
1. Check existing issues for similar problems
2. Review the documentation in `local/README-LOCAL.md` for detailed setup
3. Create a new issue with detailed information about your problem
4. Include error messages, environment details, and steps to reproduce

## Performance Expectations

### Build Times
- Dependencies install: 60-90 seconds (NEVER CANCEL)
- Test suite execution: 8-10 seconds
- Validation scripts: 1-45 seconds each
- Full CI/CD pipeline: 15-25 minutes

### Development Workflow
- Local app startup: 10-15 seconds
- Hosted app startup: 5-10 seconds (with database)
- AI response generation: 2-10 seconds (depends on model/API)

Remember: NEVER CANCEL long-running operations. Build and deployment processes include network operations that require patience.

Thank you for contributing to AI Questions!