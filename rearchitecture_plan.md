# Re-architecture Plan for AI Questions Project

## 1. Introduction

This document outlines a re-architecture plan for the AI Questions project, aiming to maximize code reuse between its locally-hosted and publicly-hosted versions. The current architecture, while functional, exhibits significant code duplication and lacks clear separation of concerns, making maintenance and feature development challenging. By introducing a modular design with shared core components and distinct flavor-specific implementations, we can achieve greater efficiency, scalability, and maintainability.

## 2. Current Architecture Analysis

The existing project structure involves two primary entry points: `index.cjs` for the publicly-hosted version and `local/index.js` for the locally-hosted version. While both share common functionalities such as question retrieval, answer generation, and EJS templating, their implementations are largely duplicated. Key observations include:

*   **Duplicated Server Setup**: Both versions initialize Express applications, set up view engines, and configure middleware independently.
*   **Divergent Database Handling**: The public version uses PostgreSQL with user authentication and persistent storage, while the local version employs a mock database to avoid external dependencies and simplify local setup.
*   **Separate AI Model Integrations**: The public version integrates with various external LLMs (e.g., OpenAI, Anthropic, Hugging Face) requiring API keys and user authentication. The local version primarily focuses on Ollama integration for local AI models.
*   **Redundant Frontend Logic**: EJS templates and associated client-side JavaScript often contain similar logic for displaying questions, answers, and managing UI interactions, leading to repetition.
*   **Feature Discrepancies**: Features like user login, n8n integration, and offline HTML5 support are tightly coupled within their respective version's codebase, making it difficult to share or selectively enable them.

This duplication complicates updates, introduces potential for inconsistencies, and increases the effort required to introduce new features or fix bugs across both versions.

## 3. Proposed New Architecture

The proposed architecture will introduce a core module containing all shared functionalities, while flavor-specific modules will extend and customize this core for each deployment environment. This approach adheres to the 


principle of "Don't Repeat Yourself" (DRY) and promotes a more maintainable and scalable codebase.

### 3.1. New File Structure

The project will adopt a more modular and organized file structure:

```
/ai-questions
├── core/
│   ├── app.js                  # Shared Express application setup, middleware, and common configurations
│   ├── db-interface.js         # Abstract database interface
│   ├── pg-db.js                # PostgreSQL implementation of db-interface
│   ├── mock-db.js              # Mock database implementation of db-interface
│   ├── ai-interface.js         # Abstract AI model interface
│   ├── ollama-client.js        # Ollama (local AI) implementation of ai-interface
│   ├── external-llm-client.js  # External LLM (e.g., OpenAI, Anthropic, Hugging Face) implementation of ai-interface
│   ├── wikipedia-integration.js # Shared Wikipedia integration logic
│   └── routes.js               # Common API routes and logic (e.g., daily question, answer saving)
├── public-flavor/
│   ├── app.js                  # Publicly-hosted specific application setup (authentication, external LLMs)
│   └── views/                  # EJS templates specific to the public version
├── local-flavor/
│   ├── app.js                  # Locally-hosted specific application setup (no authentication, n8n, Ollama)
│   └── views/                  # EJS templates specific to the local version
├── shared-views/               # EJS templates common to both versions
├── public/                     # Static assets (CSS, JS, images) common to both versions
├── migrations/                 # Database migration scripts
├── scripts/                    # Deployment and utility scripts (e.g., `start-local.sh`)
├── package.json
├── package-lock.json
└── README.md
```

### 3.2. Shared Interfaces

To facilitate code reuse and maintain a clear separation of concerns, we will define abstract interfaces for key functionalities, with concrete implementations for each flavor.

#### 3.2.1. Database Interface

A `db-interface.js` will define the contract for database operations, such as `getDailyQuestion()`, `saveAnswer()`, `getPersonalQuestions()`, etc. Two primary implementations will be provided:

*   `pg-db.js`: This implementation will connect to a PostgreSQL database, suitable for the publicly-hosted version where persistent storage and user management are critical. It will handle all interactions with the PostgreSQL database, including user authentication data, question schedules, and answer history.
*   `mock-db.js`: This implementation will provide an in-memory, non-persistent database. It will be used by the locally-hosted version to avoid the overhead of setting up and managing a full-fledged database. This is particularly useful for quick local deployments and scenarios where data persistence across sessions is not required.

This abstraction ensures that the core application logic can interact with the database without needing to know the underlying storage mechanism.

#### 3.2.2. AI Model Interface

An `ai-interface.js` will define methods for interacting with AI models, such as `generateResponse()`, `listModels()`, etc. Implementations will include:

*   `ollama-client.js`: This client will handle communication with locally-running Ollama instances. It will be the primary AI backend for the locally-hosted version, enabling users to leverage their local hardware for AI inference. This client will manage model pulling, deletion, and response generation specific to the Ollama API.
*   `external-llm-client.js`: This client will manage interactions with various external LLM providers (e.g., OpenAI, Anthropic, Hugging Face). It will handle API key management, rate limiting, and error handling specific to each external service. This client will be used by the publicly-hosted version to offer a wide range of AI models.

This interface allows the application to switch between local and external AI models seamlessly, based on the deployment flavor.

#### 3.2.3. Wikipedia Integration

The `wikipedia-integration.js` module will encapsulate the logic for searching and extracting context from Wikipedia. This module will be shared across both versions, as the core functionality of interacting with Wikipedia data remains consistent. However, the local version will have specific UI elements to manage local Wikipedia database downloads and updates, while the public version might rely on a pre-configured or cloud-based Wikipedia data source.

### 3.3. Core Shared Components

*   **`core/app.js`**: This file will contain the foundational Express application setup, including common middleware (e.g., `express.json()`, `express.static()`), EJS view engine configuration, and any other settings that are universal to both flavors. It will serve as the base for both `public-flavor/app.js` and `local-flavor/app.js`.
*   **`core/routes.js`**: This module will house all API routes and their corresponding logic that are common to both versions. This includes routes for fetching daily questions, saving answers, and any other shared data interactions. These routes will utilize the abstract `db-interface` and `ai-interface` to perform their operations, ensuring portability.

This modularization ensures that changes to core functionalities only need to be made in one place, reducing the risk of inconsistencies and simplifying maintenance. The next section will detail the implementation of flavor-specific features.

