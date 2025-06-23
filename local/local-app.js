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

// Initialize AI client (using OllamaClient for local models)
const ai = new OllamaClient(LOCAL_CONFIG.ollama.url);

// Initialize Wikipedia integration
const wikipedia = new WikipediaIntegration(LOCAL_CONFIG.wikipedia.dbPath);

// Initialize n8n integration
const n8n = new N8nAgentIntegration(LOCAL_CONFIG.n8n.url, LOCAL_CONFIG.n8n.apiKey);

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

// Add n8n specific routes
app.get("/n8n-status", async (req, res) => {
    try {
        const status = await n8n.checkStatus();
        res.json(status);
    } catch (error) {
        console.error("Error checking n8n status:", error);
        res.json({ available: false, n8nConnected: false, internetConnected: false, mode: 'error', error: error.message });
    }
});

app.get("/n8n-workflows", async (req, res) => {
    try {
        const workflows = await n8n.listWorkflows();
        res.json(workflows);
    } catch (error) {
        console.error("Error listing n8n workflows:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/n8n-execute", async (req, res) => {
    try {
        const result = await n8n.executeWorkflow(req.body.workflowId, req.body.data);
        res.json(result);
    } catch (error) {
        console.error("Error executing n8n workflow:", error);
        res.status(500).json({ error: error.message });
    }
});

// Add n8n portal button to the UI
app.use((req, res, next) => {
    res.locals.n8nPortalUrl = LOCAL_CONFIG.n8n.url;
    res.locals.showN8nPortal = true;
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


