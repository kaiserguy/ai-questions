#!/usr/bin/env node

/**
 * Minimal Test Server for CI Validation
 * 
 * This server provides basic route validation without database dependencies
 * to ensure core functionality works in CI environments.
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../core/views'));

// Serve static files from core public directory
app.use(express.static(path.join(__dirname, '../core/public')));
app.use(express.json());

// Basic route that doesn't require database
app.get('/', (req, res) => {
    try {
        res.render('index', { 
            title: 'AI Questions - Test Mode',
            user: null,
            questions: [],
            isLocal: false
        });
    } catch (error) {
        console.error('Error rendering index:', error);
        res.status(500).send('Server Error - Test Mode');
    }
});

// Offline route
app.get('/offline', (req, res) => {
    try {
        res.render('offline', { 
            title: 'Offline AI Chat - Test Mode'
        });
    } catch (error) {
        console.error('Error rendering offline:', error);
        res.status(500).send('Server Error - Offline Test Mode');
    }
});

// Health check route
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        mode: 'test',
        timestamp: new Date().toISOString()
    });
});

// CSS file test route
app.get('/test/css', (req, res) => {
    const fs = require('fs');
    const cssPath = path.join(__dirname, '../core/public/css/styles.css');
    
    if (fs.existsSync(cssPath)) {
        res.json({ css_file: 'exists', path: cssPath });
    } else {
        res.status(404).json({ css_file: 'missing', path: cssPath });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to view the application`);
    console.log('Mode: CI Test Server (no database dependencies)');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Test server shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Test server shutting down gracefully');
    process.exit(0);
});

