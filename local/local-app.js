/**
 * Local Application Entry Point
 * 
 * This is the entry point for the locally-hosted version of AI Questions.
 * It uses local database, local Ollama models, and n8n integration.
 */

const express = require("express");
const path = require("path");
const fs = require("fs");

// Import core components
const createApp = require("../core/app");
const LocalDatabase = require("./local-database");
const OllamaClient = require("../core/ollama-client");
const WikipediaIntegration = require("../core/wikipedia-integration");
const commonRoutes = require("../core/routes");
const LocalAiClient = require("../core/ai-client");

// Import n8n integration
const N8nAgentIntegration = require("./n8n-agent-integration");

// Local configuration
const LOCAL_CONFIG = {
    isLocal: true,
    app: {
        port: process.env.PORT || 3000,
        name: "AI Questions (Local)"
    },
    session: {
        secret: "local-session-secret",
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    ollama: {
        url: process.env.OLLAMA_URL || "http://localhost:11434"
    },
    wikipedia: {
        dbPath: process.env.WIKIPEDIA_DB_PATH || "./wikipedia.db"
    },
    n8n: {
        url: process.env.N8N_URL || "http://localhost:5678",
        apiKey: process.env.N8N_API_KEY || ""
    }
};

// Initialize database
const db = new LocalDatabase();

// Initialize AI client (using LocalAiClient for testing)
const ai = new LocalAiClient();

// Initialize Wikipedia integration
const wikipedia = new WikipediaIntegration(LOCAL_CONFIG.wikipedia.dbPath);

// Initialize n8n integration (disabled for testing)
const n8n = {
    checkStatus: async () => ({ available: false, n8nConnected: false, internetConnected: false, mode: 'disabled', capabilities: {} }),
    listWorkflows: async () => [],
    executeWorkflow: async () => ({ success: false, error: 'n8n integration disabled for testing' })
};

// Create Express app with core setup
const app = createApp(LOCAL_CONFIG);

// Mount common routes
app.use("/", commonRoutes(db, ai, wikipedia, LOCAL_CONFIG));

// Add offline package routes
const offlinePackageRoutes = require('./offline-package-routes');
app.use('/api/offline', offlinePackageRoutes);

// Add offline resource routes for serving libraries, models, and Wikipedia
const offlineResourceRoutes = require('../core/offline-resource-routes');
app.use('/offline', offlineResourceRoutes);

// Add n8n specific routes (disabled for testing)
app.get("/n8n-status", (req, res) => res.json({ available: false, n8nConnected: false, internetConnected: false, mode: 'disabled' }));
app.get("/n8n-workflows", (req, res) => res.json([]));
app.post("/n8n-execute", (req, res) => res.status(500).json({ error: 'n8n integration disabled for testing' }));

// Add n8n portal button to the UI (disabled for testing)
app.use((req, res, next) => {
    res.locals.n8nPortalUrl = "#";
    res.locals.showN8nPortal = false;
    next();
});

// Serve offline HTML5 endpoint from /core/views/offline
app.get("/offline", (req, res) => {
    res.render("offline", { 
        title: "AI Questions - Offline Mode",
        isLocal: true
    });
});

// Add local package download route
app.get("/download-package", (req, res) => {
    const packagePath = path.join(__dirname, "local-package.zip");
    
    // Check if package exists
    if (fs.existsSync(packagePath)) {
        res.download(packagePath, "ai-questions-local.zip");
    } else {
        res.status(404).send("Package not found. Please generate it first.");
    }
});

// Start the server
const PORT = LOCAL_CONFIG.app.port;
app.listen(PORT, () => {
    console.log(`AI Questions (Local) server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
});


