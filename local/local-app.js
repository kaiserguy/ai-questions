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
app.use('/offline-resources', offlineResourceRoutes);

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
    
    // Auto-download Wikipedia database if not present
    initializeWikipediaCache();
});

/**
 * Initialize Wikipedia cache on server startup
 * Downloads Wikipedia database if not already present
 */
function initializeWikipediaCache() {
    const { spawn } = require('child_process');
    const dbPath = path.join(__dirname, LOCAL_CONFIG.wikipedia.dbPath);
    
    // Check if Wikipedia database already exists
    if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`✅ Wikipedia database ready: ${sizeMB} MB`);
        
        // Verify database tables
        verifyWikipediaTables(dbPath);
        return;
    }
    
    console.log('📥 Wikipedia database not found, downloading minimal package...');
    console.log('⏱️  This may take 5-10 minutes on first startup...');
    
    // Try Python downloader (works on Windows)
    const pythonScript = path.join(__dirname, 'wikipedia_downloader.py');
    
    // Check if Python script exists
    if (!fs.existsSync(pythonScript)) {
        console.log('⚠️  wikipedia_downloader.py not found, skipping auto-download');
        console.log('💡 You can manually download later from the /offline page');
        return;
    }
    
    // Check if Python is available
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    // Step 1: Download compressed file
    console.log('📥 Step 1/2: Downloading Wikipedia dump...');
    const download = spawn(pythonCmd, [
        pythonScript,
        '--action', 'download',
        '--dataset', 'simple',
        '--db-path', dbPath
    ], {
        cwd: __dirname,
        stdio: 'pipe',
        shell: true
    });
    
    download.stdout.on('data', (data) => {
        console.log(`[Wikipedia] ${data.toString().trim()}`);
    });
    
    download.stderr.on('data', (data) => {
        console.log(`[Wikipedia] ${data.toString().trim()}`);
    });
    
    download.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Download complete, processing into SQLite database...');
            processWikipediaDump(pythonCmd, pythonScript, dbPath);
        } else {
            console.log(`⚠️  Wikipedia download failed with code ${code}`);
            console.log('💡 Wikipedia will be available for manual download from /offline page');
        }
    });
    
    download.on('error', (error) => {
        console.error(`❌ Failed to start Wikipedia download: ${error.message}`);
        console.log('💡 Wikipedia will be available for manual download from /offline page');
    });
}

/**
 * Process downloaded Wikipedia dump into SQLite database
 */
function processWikipediaDump(pythonCmd, pythonScript, dbPath) {
    const { spawn } = require('child_process');
    
    console.log('📝 Step 2/2: Processing Wikipedia articles...');
    console.log('⏱️  This will take several minutes...');
    
    const process = spawn(pythonCmd, [
        pythonScript,
        '--action', 'process',
        '--dataset', 'simple',
        '--db-path', dbPath
    ], {
        cwd: path.dirname(pythonScript),
        stdio: 'pipe',
        shell: true
    });
    
    process.stdout.on('data', (data) => {
        console.log(`[Wikipedia] ${data.toString().trim()}`);
    });
    
    process.stderr.on('data', (data) => {
        console.log(`[Wikipedia] ${data.toString().trim()}`);
    });
    
    process.on('close', (code) => {
        if (code === 0) {
            if (fs.existsSync(dbPath)) {
                const stats = fs.statSync(dbPath);
                const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
                console.log(`✅ Wikipedia database ready: ${sizeMB} MB`);
                console.log(`📍 Database location: ${dbPath}`);
                
                // Verify database tables
                verifyWikipediaTables(dbPath);
            } else {
                console.log('⚠️  Processing completed but database file not found');
            }
        } else {
            console.log(`⚠️  Wikipedia processing failed with code ${code}`);
            console.log('💡 Wikipedia will be available for manual download from /offline page');
        }
    });
    
    process.on('error', (error) => {
        console.error(`❌ Failed to process Wikipedia dump: ${error.message}`);
        console.log('💡 Wikipedia will be available for manual download from /offline page');
    });
}

/**
 * Verify Wikipedia database has required tables
 */
function verifyWikipediaTables(dbPath) {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error(`❌ Failed to open database for verification: ${err.message}`);
            return;
        }
        
        // Check for required tables
        db.all(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`, (err, tables) => {
            if (err) {
                console.error(`❌ Failed to query tables: ${err.message}`);
                db.close();
                return;
            }
            
            const tableNames = tables.map(t => t.name);
            console.log(`📊 Database tables: ${tableNames.join(', ')}`);
            
            // Check for FTS table
            const hasFTS = tableNames.some(name => name.includes('fts'));
            if (hasFTS) {
                console.log('✅ Full-text search (FTS) table found');
            } else {
                console.log('⚠️  Warning: No FTS table found - search performance will be limited');
            }
            
            // Get article count
            db.get('SELECT COUNT(*) as count FROM wikipedia_articles', (err, row) => {
                if (err) {
                    console.error(`❌ Failed to count articles: ${err.message}`);
                } else {
                    console.log(`📚 Total articles: ${row.count.toLocaleString()}`);
                }
                db.close();
            });
        });
    });
}


