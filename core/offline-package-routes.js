const logger = require('./logger');
// Enhanced offline package routes with server-side caching
const OfflineResourceCache = require('./offline-resource-cache');

function addOfflinePackageRoutes(app) {
    const cache = new OfflineResourceCache();
    
    // Cache is initialized in constructor, no need to call init()
    logger.info('✅ Offline resource cache ready');

    // Check package availability
    app.get('/api/offline/packages/availability', async (req, res) => {
        try {
            const packages = {};
            
            // Only include minimal package if it's available
            if (cache.isMinimalPackageAvailable()) {
                const manifest = cache.getMinimalPackageManifest();
                if (manifest) {
                    packages.minimal = {
                        id: 'minimal',
                        name: manifest.name,
                        description: manifest.description,
                        total_size: manifest.totalSizeFormatted,
                        features: manifest.features,
                        requirements: manifest.requirements,
                        available: true,
                        cached: true
                    };
                }
            }
            
            // Standard and Full packages are always available as direct downloads
            packages.standard = {
                id: 'standard',
                name: 'Standard Package',
                description: 'Advanced AI chat with full feature set',
                total_size: '~800MB',
                features: [
                    'Advanced AI chat (Phi-3 Mini)',
                    'Simple Wikipedia (50MB)',
                    'Full feature set',
                    'Recommended for most users'
                ],
                requirements: {
                    ram: '4GB',
                    storage: '1GB'
                },
                available: true,
                cached: false,
                directDownload: true
            };
            
            packages.full = {
                id: 'full',
                name: 'Full Package',
                description: 'Complete AI experience with multiple models',
                total_size: '~2GB',
                features: [
                    'Multiple AI models',
                    'Extended Wikipedia',
                    'Advanced features',
                    'Best experience'
                ],
                requirements: {
                    ram: '8GB',
                    storage: '3GB'
                },
                available: true,
                cached: false,
                directDownload: true
            };
            
            res.json({
                success: true,
                packages: packages,
                cacheStatus: {
                    minimalAvailable: cache.isMinimalPackageAvailable(),
                    cacheInitialized: cache.isInitialized
                }
            });
            
        } catch (error) {
            logger.error('Error checking package availability:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check package availability'
            });
        }
    });

    // Build minimal package
    app.post('/api/offline/packages/build', async (req, res) => {
        try {
            logger.info('📦 Building minimal package...');
            
            const manifest = await cache.buildMinimalPackage();
            
            res.json({
                success: true,
                message: 'Minimal package built successfully',
                package: {
                    id: 'minimal',
                    name: manifest.name,
                    description: manifest.description,
                    total_size: manifest.totalSizeFormatted,
                    features: manifest.features,
                    requirements: manifest.requirements,
                    files: manifest.files.length,
                    createdAt: manifest.createdAt
                }
            });
            
        } catch (error) {
            logger.error('Error building package:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to build package: ' + error.message
            });
        }
    });

    // Serve cached files for minimal package
    app.get('/offline/packages/minimal/:filename', (req, res) => {
        try {
            const filename = req.params.filename;
            const filePath = cache.getCachedFile(filename);
            
            if (!filePath) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found in cache'
                });
            }
            
            // Set appropriate headers
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            // Stream the file
            const fs = require('fs');
            const fileStream = fs.createReadStream(filePath);
            
            fileStream.on('error', (error) => {
                logger.error('Error streaming file:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to stream file'
                    });
                }
            });
            
            fileStream.pipe(res);
            
        } catch (error) {
            logger.error('Error serving cached file:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to serve file'
            });
        }
    });

    // Get minimal package manifest
    app.get('/api/offline/packages/minimal/manifest', (req, res) => {
        try {
            // Return a basic manifest for the minimal package
            const manifest = {
                success: true,
                packageType: 'minimal',
                name: 'Minimal Package',
                version: '1.0.0',
                totalSize: 25 * 1024 * 1024, // 25MB
                cached: false,
                resources: [
                    {
                        type: 'library',
                        name: 'transformers.js',
                        filename: 'transformers.js',
                        size: 2.5 * 1024 * 1024,
                        cached: true
                    },
                    {
                        type: 'library',
                        name: 'sql-wasm.js',
                        filename: 'sql-wasm.js',
                        size: 1.2 * 1024 * 1024,
                        cached: true
                    },
                    {
                        type: 'library',
                        name: 'tokenizers.js',
                        filename: 'tokenizers.js',
                        size: 0.8 * 1024 * 1024,
                        cached: true
                    },
                    {
                        type: 'ai-model',
                        name: 'TinyBERT',
                        filename: 'tinybert-uncased.bin',
                        size: 17 * 1024 * 1024,
                        cached: false
                    },
                    {
                        type: 'wikipedia',
                        name: 'Wikipedia-Subset-20MB',
                        filename: 'wikipedia-subset-20mb.db',
                        size: 20 * 1024 * 1024,
                        cached: false
                    }
                ]
            };
            
            res.json({
                success: true,
                manifest: manifest
            });
            
        } catch (error) {
            logger.error('Error getting manifest:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get manifest'
            });
        }
    });

    // Clean cache (admin endpoint)
    app.delete('/api/offline/packages/cache', async (req, res) => {
        try {
            const success = await cache.cleanCache();
            
            res.json({
                success: success,
                message: success ? 'Cache cleaned successfully' : 'Failed to clean cache'
            });
            
        } catch (error) {
            logger.error('Error cleaning cache:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to clean cache'
            });
        }
    });
}

module.exports = { addOfflinePackageRoutes };

