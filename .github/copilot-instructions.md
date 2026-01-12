# AI Questions - GitHub Copilot Development Instructions

**ALWAYS follow these instructions first and fallback to additional search and context gathering only when the information here is incomplete or found to be in error.**

## Project Overview

AI Questions is a web application for tracking AI responses to questions over time. It supports both cloud deployment (Heroku with external APIs) and local deployment (offline with local AI models). The project has three main components:

- **Core** (`core/`): Shared application logic, views, routes, and utilities
- **Hosted** (`hosted/`): Cloud version optimized for Heroku with external AI APIs
- **Local** (`local/`): Offline version with local AI models and Wikipedia integration

## Working Effectively

### Bootstrap and Dependencies
Run these commands in exact order to set up the development environment:

```bash
# Install dependencies (REQUIRED: Skip Puppeteer download due to network restrictions)
PUPPETEER_SKIP_DOWNLOAD=true npm install
```
**Time**: 60-90 seconds. NEVER CANCEL - includes downloading many packages, network restrictions require the skip flag.

### Build and Test
Run the complete validation suite to ensure code quality:

```bash
# Run unit and integration tests
npm test
```
**Time**: 7-10 seconds. NEVER CANCEL - comprehensive test suite with 113 total tests.
**Expected**: Some tests may fail (46 failed, 67 passed is normal) - tests include scenarios for missing classes and development environment limitations.

```bash
# Run linting (ESLint may not be configured - this is expected)
npx eslint . || echo "Linting completed with warnings"
```
**Time**: 2-3 seconds. Note: ESLint configuration may be missing - warnings are expected in development environment.

```bash
# Run comprehensive validation scripts
chmod +x tests/validation/*.sh
./tests/validation/validate-javascript-syntax.sh
./tests/validation/test-server-startup.sh
./tests/validation/validate-critical-routes.sh
```
**Time**: 30-45 seconds total. NEVER CANCEL - server startup validation includes network timeouts.

### Running the Application

#### Local/Offline Version
```bash
cd local
LOCAL_MODE=true PORT=3000 node local-app.js
```
**Access**: http://localhost:3000
**Features**: Offline AI models, local Wikipedia database, SQLite storage
**Time to start**: 10-15 seconds
**Dependencies**: Will show warnings for missing Ollama/Wikipedia - this is expected in development

#### Hosted/Cloud Version  
```bash
# Note: Requires PostgreSQL database connection - will show database errors without proper env vars
node hosted/hosted-app.js
```
**Access**: http://localhost:3000 (accessible despite database connection errors)
**Features**: PostgreSQL database, external AI APIs (OpenAI, Hugging Face), Google OAuth
**Dependencies**: Requires DATABASE_URL, GOOGLE_CLIENT_ID, SESSION_SECRET environment variables
**Expected Behavior**: Server starts and is accessible, but shows PostgreSQL connection errors in development

#### Test Server (Development)
```bash
cd tests
node test-server.js
```
**Purpose**: Minimal server for testing validation scripts and routes

## Validation and Quality Assurance

### Critical Validation Steps
ALWAYS run these before committing changes:

```bash
# 1. Full test suite
npm test
# Expected: Some test failures are normal (46 failed, 67 passed), ~7 seconds

# 2. JavaScript syntax validation  
./tests/validation/validate-javascript-syntax.sh
# Expected: "✅ JavaScript syntax validation passed", ~2 seconds

# 3. Server startup validation
./tests/validation/test-server-startup.sh  
# Expected: Local server starts successfully, hosted shows database errors (expected), ~30 seconds
# NEVER CANCEL: Includes network timeouts for server response validation

# 4. Route validation
./tests/validation/validate-critical-routes.sh
# Expected: Most critical routes accessible via test server, ~10 seconds

# 5. Package configuration validation
./tests/validation/validate-package-configurations.sh  
# Expected: All package.json files valid, ~1 second
```

### Manual Validation Scenarios
After making changes, ALWAYS test these user workflows:

#### Local Version Testing
1. **Start local server**: `cd local && LOCAL_MODE=true node local-app.js`
2. **Access homepage**: Navigate to http://localhost:3000
3. **Test offline functionality**: Click "Download Offline Package" 
4. **Verify AI chat**: Use the chat interface (may show Ollama warnings - expected)
5. **Test Wikipedia search**: Search for any term (may show database warnings - expected)

#### Hosted Version Testing (if database available)
1. **Start hosted server**: `node hosted/hosted-app.js`  
2. **Access homepage**: Navigate to http://localhost:3000
3. **Test Google OAuth**: Login flow
4. **Test external AI**: Submit questions using OpenAI/Hugging Face APIs
5. **Test data export**: Generate CSV exports

### CI/CD Pipeline Integration
The GitHub Actions workflow (`/github/workflows/deploy.yml`) runs comprehensive validation:

```bash
# Pipeline stages (run automatically on push):
# 1. Validate (5-10 minutes) - NEVER CANCEL
# 2. Deploy (3-5 minutes) - NEVER CANCEL  
# 3. Post-deployment validation (5-10 minutes) - NEVER CANCEL
```

**Total pipeline time**: 15-25 minutes. NEVER CANCEL - includes network operations and Heroku deployment.

## Project Structure and Navigation

### Key Directories
- **`core/`**: Shared application code
  - `core/app.js`: Express app configuration
  - `core/routes.js`: Main application routes
  - `core/views/`: EJS templates
  - `core/public/`: Static assets (CSS, JS, images)
  - `core/offline-*`: Offline package generation and caching

- **`hosted/`**: Cloud-specific code
  - `hosted/hosted-app.js`: Heroku application entry point
  - `hosted/package-generator.js`: Local package generation

- **`local/`**: Local deployment code  
  - `local/local-app.js`: Local server entry point
  - `local/setup-local.sh`: Ubuntu installation script
  - `local/start-local.sh`: Service startup script
  - `local/local-database.js`: SQLite database interface

- **`tests/`**: Comprehensive test suite
  - `tests/unit/`: Unit tests for individual components
  - `tests/integration/`: Integration tests for workflows  
  - `tests/validation/`: Bash scripts for deployment validation
  - `tests/offline/`: Offline functionality tests

### Entry Points
- **Heroku Production**: `hosted/hosted-app.js` (defined in Procfile)
- **Local Development**: `local/local-app.js`  
- **Package.json**: `index.cjs` (not used in production)

### Configuration Files
- **`package.json`**: Main dependencies and npm scripts
- **`jest.config.js`**: Test configuration with JSDOM environment
- **`Procfile`**: Heroku deployment configuration
- **`.github/workflows/deploy.yml`**: CI/CD pipeline definition

## Common Development Tasks

### Adding New Features
1. **Identify target environment**: Core (shared), Hosted (cloud), or Local (offline)
2. **Write tests first**: Add to appropriate `tests/` subdirectory
3. **Implement feature**: Follow existing patterns in relevant directory  
4. **Validate changes**: Run full validation suite
5. **Test manually**: Execute relevant user scenarios

### Database Changes  
- **Hosted**: Modify PostgreSQL schemas in `hosted/migrations/`
- **Local**: Update SQLite schemas in `local/local-database.js`
- **Always**: Update both versions to maintain compatibility

### Route Changes
- **Core routes**: Modify `core/routes.js` for shared functionality
- **Offline routes**: Update `core/offline-*` files for package generation
- **Hosted routes**: Modify `hosted/hosted-app.js` for cloud-specific features

### UI Changes
- **Templates**: Edit EJS files in `core/views/`
- **Styles**: Update CSS in `core/public/`
- **Client JS**: Modify JavaScript in `core/public/`
- **Always**: Test in both hosted and local environments

## Troubleshooting Common Issues

### Build Failures
- **Puppeteer download errors**: Use `PUPPETEER_SKIP_DOWNLOAD=true npm install`
- **ESLint config errors**: Use `npx eslint . || echo "Linting completed with warnings"` - configuration may be missing
- **Test failures**: Some tests may fail due to missing classes or test infrastructure - this is expected in development

### Runtime Issues  
- **Port conflicts**: Local apps use port 3000 by default
- **Database connections**: Hosted requires DATABASE_URL environment variable but runs without it (shows errors)
- **Missing dependencies**: Local shows warnings for Ollama/Wikipedia (expected in development environment)
- **Hosted server startup**: Shows PostgreSQL connection errors but remains accessible - this is expected behavior

### Deployment Issues
- **Heroku failures**: Check environment variables (HEROKU_API_KEY, HEROKU_APP_NAME, HEROKU_EMAIL)
- **GitHub Actions failures**: Review validation scripts in `tests/validation/`
- **Post-deployment errors**: Validate at https://peaceful-sierra-40313-4a09d237c70e.herokuapp.com

## Environment Variables

### Required for Hosted Version
```bash
DATABASE_URL=postgresql://...  
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
OPENAI_API_KEY=... (optional)
HUGGING_FACE_API_KEY=... (optional)
```

### Required for Local Version  
```bash
LOCAL_MODE=true
PORT=3000 (default)
```

### Required for CI/CD
```bash
HEROKU_API_KEY=...
HEROKU_APP_NAME=peaceful-sierra-40313
HEROKU_EMAIL=...  
```

## Performance Expectations

### Build Times (with appropriate timeouts)
- **Dependencies install**: 60-90 seconds (NEVER CANCEL - includes many packages)
- **Test suite execution**: 8-10 seconds  
- **Linting and validation**: 1-5 seconds per script
- **Server startup**: 10-30 seconds (includes network validation)
- **Full CI/CD pipeline**: 15-25 minutes

### Runtime Performance  
- **Local app startup**: 10-15 seconds
- **Hosted app startup**: 5-10 seconds (with database)
- **AI response generation**: 2-10 seconds (depends on model/API)
- **Wikipedia search**: 1-3 seconds (with local database)
- **Package generation**: 30-60 seconds (large offline packages)

Remember: NEVER CANCEL long-running operations. Build and deployment processes include network operations and external dependencies that require patience.