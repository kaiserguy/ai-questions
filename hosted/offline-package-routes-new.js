const express = require('express');
const path = require('path');
const fs = require('fs');
const OfflineResourceCache = require('./offline-resource-cache');

const router = express.Router();
const cache = new OfflineResourceCache();

// Check package availability
router.get('/api/offline/packages/availability', async (req, res) => {
    try {
        const packageInfo = cache.getPackageInfo();
        
        res.json({
            success: true,
            packages: {
                minimal: {
                    available: packageInfo.available,
                    cached: packageInfo.available,
                    info: packageInfo
                },
                standard: {
                    available: false,
                    cached: false,
                    info: { reason: 'Standard package requires client-side download' }
                },
                full: {
                    available: false,
                    cached: false,
                    info: { reason: 'Full package requires client-side download' }
                }
            }
        });
    } catch (error) {
        console.error('Error checking package availability:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to check package availability',
            message: error.message
        });
    }
});

// Build minimal package cache (admin endpoint)
router.post('/api/offline/packages/build', async (req, res) => {
    try {
        console.log('Starting minimal package build...');
        res.json({ status: 'started', message: 'Building minimal package cache...' });
        
        // Start caching in background
        cache.cacheMinimalPackageResources()
            .then(manifest => {
                console.log('Minimal package build completed:', manifest);
            })
            .catch(error => {
                console.error('Minimal package build failed:', error);
            });
            
    } catch (error) {
        console.error('Error starting package build:', error);
        res.status(500).json({ error: 'Failed to start package build' });
    }
});

// Get package build status
router.get('/api/offline/packages/status', (req, res) => {
    try {
        const packageInfo = cache.getPackageInfo();
        res.json(packageInfo);
    } catch (error) {
        console.error('Error getting package status:', error);
        res.status(500).json({ error: 'Failed to get package status' });
    }
});

// Serve cached files
router.get('/offline/packages/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = cache.getCachedFilePath(filename);
        
        if (!filePath) {
            return res.status(404).json({ error: 'File not found in cache' });
        }

        // Set appropriate headers
        const stats = fs.statSync(filePath);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Stream the file
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        
    } catch (error) {
        console.error('Error serving cached file:', error);
        res.status(500).json({ error: 'Failed to serve file' });
    }
});

// Create minimal package ZIP for download
router.get('/offline/packages/minimal.zip', async (req, res) => {
    try {
        if (!cache.isMinimalPackageReady()) {
            return res.status(404).json({ 
                error: 'Minimal package not ready',
                message: 'Use /api/offline/packages/build to cache resources first'
            });
        }

        const archiver = require('archiver');
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="ai-questions-minimal-offline.zip"');
        
        archive.pipe(res);
        
        // Add cached files to ZIP
        const manifest = cache.getManifest();
        for (const resource of manifest.resources) {
            if (resource.cached) {
                const filePath = cache.getCachedFilePath(resource.filename);
                if (filePath) {
                    archive.file(filePath, { name: `resources/${resource.filename}` });
                }
            }
        }
        
        // Add manifest
        archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
        
        // Add installation script
        const installScript = `#!/bin/bash
# AI Questions Minimal Offline Package Installer

echo "Installing AI Questions Minimal Offline Package..."
echo "Package version: ${manifest.version}"
echo "Total size: ${cache.formatBytes(manifest.totalSize)}"

# Create directories
mkdir -p ./ai-questions-offline/resources
mkdir -p ./ai-questions-offline/cache

# Extract resources
cp resources/* ./ai-questions-offline/resources/
cp manifest.json ./ai-questions-offline/

echo "Installation complete!"
echo "Run: cd ai-questions-offline && npm start"
`;
        
        archive.append(installScript, { name: 'install.sh' });
        
        // Add README
        const readme = `# AI Questions - Minimal Offline Package

This package contains the minimal offline version of AI Questions.

## Contents:
- TinyBERT AI model for basic text processing
- Wikipedia sample database
- Offline web application

## Installation:
1. Extract this ZIP file
2. Run: chmod +x install.sh && ./install.sh
3. Follow the installation instructions

## System Requirements:
- Node.js 16+ 
- 2GB RAM minimum
- 500MB free disk space

Package created: ${manifest.created}
Total size: ${cache.formatBytes(manifest.totalSize)}
`;
        
        archive.append(readme, { name: 'README.md' });
        
        await archive.finalize();
        
    } catch (error) {
        console.error('Error creating minimal package ZIP:', error);
        res.status(500).json({ error: 'Failed to create package' });
    }
});

module.exports = router;

