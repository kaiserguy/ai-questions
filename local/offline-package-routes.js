/**
 * Offline Package Routes for Local Server
 * Provides API endpoints for offline package management
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Package configurations
const PACKAGES = {
    minimal: {
        name: 'Minimal Package',
        size: '200MB',
        description: 'Basic AI chat and Wikipedia subset',
        libraries: [
            { name: 'transformers.js', size: '2.5 MB', url: '/offline/libs/transformers.js' },
            { name: 'sql-wasm.js', size: '1.2 MB', url: '/offline/libs/sql-wasm.js' },
            { name: 'tokenizers.js', size: '819.2 KB', url: '/offline/libs/tokenizers.js' }
        ],
        models: [
            { name: 'Phi-3 Mini Model', size: '500 MB', url: '/offline/models/phi3-mini.bin' }
        ],
        wikipedia: {
            name: 'Simple Wikipedia',
            size: '50 MB',
            url: '/offline/wikipedia/simple-wikipedia.db'
        }
    },
    standard: {
        name: 'Standard Package',
        size: '800MB',
        description: 'Advanced AI chat and full Wikipedia',
        libraries: [
            { name: 'transformers.js', size: '2.5 MB', url: '/offline/libs/transformers.js' },
            { name: 'sql-wasm.js', size: '1.2 MB', url: '/offline/libs/sql-wasm.js' },
            { name: 'tokenizers.js', size: '819.2 KB', url: '/offline/libs/tokenizers.js' }
        ],
        models: [
            { name: 'Phi-3 Mini Model', size: '500 MB', url: '/offline/models/phi3-mini.bin' }
        ],
        wikipedia: {
            name: 'Standard Wikipedia',
            size: '300 MB',
            url: '/offline/wikipedia/standard-wikipedia.db'
        }
    },
    full: {
        name: 'Full Package',
        size: '2GB',
        description: 'Multiple AI models and extended Wikipedia',
        libraries: [
            { name: 'transformers.js', size: '2.5 MB', url: '/offline/libs/transformers.js' },
            { name: 'sql-wasm.js', size: '1.2 MB', url: '/offline/libs/sql-wasm.js' },
            { name: 'tokenizers.js', size: '819.2 KB', url: '/offline/libs/tokenizers.js' }
        ],
        models: [
            { name: 'Phi-3 Mini Model', size: '500 MB', url: '/offline/models/phi3-mini.bin' },
            { name: 'Llama-3.2 Model', size: '1.2 GB', url: '/offline/models/llama-3.2.bin' }
        ],
        wikipedia: {
            name: 'Extended Wikipedia',
            size: '800 MB',
            url: '/offline/wikipedia/extended-wikipedia.db'
        }
    }
};

// Check package availability
router.get('/packages/availability', (req, res) => {
    try {
        console.log('[Offline API] Checking package availability...');
        
        const availability = {};
        
        for (const [packageType, config] of Object.entries(PACKAGES)) {
            availability[packageType] = {
                name: config.name,
                size: config.size,
                description: config.description,
                available: true, // For local server, always available
                libraries: config.libraries.map(lib => ({
                    ...lib,
                    available: true
                })),
                models: config.models.map(model => ({
                    ...model,
                    available: true
                })),
                wikipedia: {
                    ...config.wikipedia,
                    available: true
                }
            };
        }
        
        console.log('[Offline API] Package availability check complete');
        res.json({
            success: true,
            packages: availability
        });
        
    } catch (error) {
        console.error('[Offline API] Error checking package availability:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Download library files
router.get('/download/library/:filename', (req, res) => {
    const filename = req.params.filename;
    console.log(`[Offline API] Downloading library: ${filename}`);
    
    // TODO: Implement actual download with delay
    setTimeout(() => {
        res.json({
            success: true,
            message: `Library ${filename} downloaded successfully`,
            size: 2500000 // 2.5MB for minimal package
        });
    }, 2000); // 2 second delay for minimal package
});

// Download model files
router.get('/download/model/:modelname', (req, res) => {
    const modelname = req.params.modelname;
    console.log(`[Offline API] Downloading model: ${modelname}`);
    
    // TODO: Implement actual download with longer delay for models
    setTimeout(() => {
        res.json({
            success: true,
            message: `Model ${modelname} downloaded successfully`,
            size: 300000000 // 300MB for full package
        });
    }, 5000); // 5 second delay for model download
});

// Download Wikipedia database
router.get('/download/wikipedia/:dbname', (req, res) => {
    const dbname = req.params.dbname;
    console.log(`[Offline API] Downloading Wikipedia database: ${dbname}`);
    
    // TODO: Implement actual download with delay
    setTimeout(() => {
        res.json({
            success: true,
            message: `Wikipedia database ${dbname} downloaded successfully`,
            size: 75000000 // 75MB for Wikipedia database
        });
    }, 3000); // 3 second delay for Wikipedia database
});

// Get package details
router.get('/packages/:packageType', (req, res) => {
    const packageType = req.params.packageType;
    
    if (!PACKAGES[packageType]) {
        return res.status(404).json({
            success: false,
            error: `Package type '${packageType}' not found`
        });
    }
    
    res.json({
        success: true,
        package: PACKAGES[packageType]
    });
});

module.exports = router;

