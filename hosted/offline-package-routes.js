// Enhanced offline package routes with server-side caching
const OfflineResourceCache = require('./offline-resource-cache');

function addOfflinePackageRoutes(app) {
    const cache = new OfflineResourceCache();
    
    // Initialize cache
    cache.init().then(() => {
        console.log('✅ Offline resource cache initialized');
    }).catch(err => {
        console.error('❌ Failed to initialize offline resource cache:', err);
    });

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
            console.error('Error checking package availability:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check package availability'
            });
        }
    });

    // Build minimal package
    app.post('/api/offline/packages/build', async (req, res) => {
        try {
            console.log('📦 Building minimal package...');
            
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
            console.error('Error building package:', error);
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
                console.error('Error streaming file:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to stream file'
                    });
                }
            });
            
            fileStream.pipe(res);
            
        } catch (error) {
            console.error('Error serving cached file:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to serve file'
            });
        }
    });

    // Get minimal package manifest
    app.get('/api/offline/packages/minimal/manifest', (req, res) => {
        try {
            const manifest = cache.getMinimalPackageManifest();
            
            if (!manifest) {
                return res.status(404).json({
                    success: false,
                    error: 'Minimal package not available'
                });
            }
            
            res.json({
                success: true,
                manifest: manifest
            });
            
        } catch (error) {
            console.error('Error getting manifest:', error);
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
            console.error('Error cleaning cache:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to clean cache'
            });
        }
    });
}

module.exports = { addOfflinePackageRoutes };

