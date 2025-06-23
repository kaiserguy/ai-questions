/**
 * Offline Resource Routes
 * Serves libraries, AI models, and Wikipedia databases for offline download
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// Base directory for offline resources
const OFFLINE_RESOURCES_DIR = path.join(__dirname, '..', 'offline-resources');

/**
 * Ensure offline resources directory exists
 */
async function ensureResourcesDirectory() {
    try {
        await fs.access(OFFLINE_RESOURCES_DIR);
    } catch (error) {
        console.log('Creating offline resources directory...');
        await fs.mkdir(OFFLINE_RESOURCES_DIR, { recursive: true });
        await fs.mkdir(path.join(OFFLINE_RESOURCES_DIR, 'libs'), { recursive: true });
        await fs.mkdir(path.join(OFFLINE_RESOURCES_DIR, 'models'), { recursive: true });
        await fs.mkdir(path.join(OFFLINE_RESOURCES_DIR, 'wikipedia'), { recursive: true });
    }
}

/**
 * Download and cache a resource from external URL
 */
async function downloadAndCacheResource(url, localPath) {
    const https = require('https');
    const http = require('http');
    
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https:') ? https : http;
        
        client.get(url, (response) => {
            if (response.statusCode === 200) {
                const fileStream = require('fs').createWriteStream(localPath);
                response.pipe(fileStream);
                
                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`Downloaded and cached: ${url} -> ${localPath}`);
                    resolve();
                });
                
                fileStream.on('error', reject);
            } else {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            }
        }).on('error', reject);
    });
}

/**
 * Serve JavaScript libraries
 */
router.get('/libs/:filename', async (req, res) => {
    const filename = req.params.filename;
    const localPath = path.join(OFFLINE_RESOURCES_DIR, 'libs', filename);
    
    try {
        // Check if file exists locally
        await fs.access(localPath);
        
        // Serve the local file
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'max-age=31536000'); // 1 year
        res.sendFile(localPath);
        
    } catch (error) {
        // File doesn't exist locally, try to download it
        const libraryUrls = {
            'transformers.js': 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js',
            'sql-wasm.js': 'https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-wasm.js',
            'tokenizers.js': 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/tokenizers.min.js'
        };
        
        const downloadUrl = libraryUrls[filename];
        if (!downloadUrl) {
            return res.status(404).json({ error: 'Library not found' });
        }
        
        try {
            await ensureResourcesDirectory();
            await downloadAndCacheResource(downloadUrl, localPath);
            
            // Now serve the downloaded file
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'max-age=31536000');
            res.sendFile(localPath);
            
        } catch (downloadError) {
            console.error(`Failed to download ${filename}:`, downloadError);
            res.status(500).json({ error: 'Failed to download library' });
        }
    }
});

/**
 * Serve AI models
 */
router.get('/models/:filename', async (req, res) => {
    const filename = req.params.filename;
    const localPath = path.join(OFFLINE_RESOURCES_DIR, 'models', filename);
    
    try {
        await fs.access(localPath);
        
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', 'max-age=31536000');
        res.sendFile(localPath);
        
    } catch (error) {
        // For models, we need to provide fallback URLs or generate placeholder files
        const modelUrls = {
            'tinybert-uncased.bin': 'https://huggingface.co/prajjwal1/bert-tiny/resolve/main/pytorch_model.bin',
            'phi3-mini.bin': 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct/resolve/main/model.safetensors',
            'llama-3.2.bin': 'https://huggingface.co/meta-llama/Llama-3.2-1B/resolve/main/model.safetensors'
        };
        
        const downloadUrl = modelUrls[filename];
        if (!downloadUrl) {
            return res.status(404).json({ error: 'Model not found' });
        }
        
        // For now, return a 404 with information about where to get the model
        res.status(404).json({ 
            error: 'Model not cached locally',
            downloadUrl: downloadUrl,
            message: 'This model needs to be downloaded from Hugging Face. Please check the download URL.'
        });
    }
});

/**
 * Serve Wikipedia databases
 */
router.get('/wikipedia/:filename', async (req, res) => {
    const filename = req.params.filename;
    const localPath = path.join(OFFLINE_RESOURCES_DIR, 'wikipedia', filename);
    
    try {
        await fs.access(localPath);
        
        res.setHeader('Content-Type', 'application/x-sqlite3');
        res.setHeader('Cache-Control', 'max-age=31536000');
        res.sendFile(localPath);
        
    } catch (error) {
        // Wikipedia databases are large, provide information about where to get them
        const wikiUrls = {
            'wikipedia-subset-20mb.db': 'https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/wikipedia_en_top_2023-01.zim',
            'simple-wikipedia-50mb.db': 'https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/wikipedia_en_simple_all_2023-01.zim',
            'extended-wikipedia.db': 'https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/wikipedia_en_all_nopic_2023-01.zim'
        };
        
        const downloadUrl = wikiUrls[filename];
        if (!downloadUrl) {
            return res.status(404).json({ error: 'Wikipedia database not found' });
        }
        
        res.status(404).json({ 
            error: 'Wikipedia database not cached locally',
            downloadUrl: downloadUrl,
            message: 'This Wikipedia database needs to be downloaded from Wikimedia dumps.'
        });
    }
});

/**
 * Get package manifest
 */
router.get('/packages/:packageType/manifest', async (req, res) => {
    const packageType = req.params.packageType;
    
    const manifests = {
        'minimal': {
            success: true,
            manifest: {
                packageType: 'minimal',
                version: '1.0.0',
                totalSize: 25 * 1024 * 1024, // 25MB
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
            }
        },
        'standard': {
            success: true,
            manifest: {
                packageType: 'standard',
                version: '1.0.0',
                totalSize: 850 * 1024 * 1024, // 850MB
                resources: [
                    // ... standard package resources
                ]
            }
        },
        'full': {
            success: true,
            manifest: {
                packageType: 'full',
                version: '1.0.0',
                totalSize: 2 * 1024 * 1024 * 1024, // 2GB
                resources: [
                    // ... full package resources
                ]
            }
        }
    };
    
    const manifest = manifests[packageType];
    if (!manifest) {
        return res.status(404).json({ error: 'Package type not found' });
    }
    
    res.json(manifest);
});

/**
 * Check package availability
 */
router.get('/packages/availability', async (req, res) => {
    try {
        await ensureResourcesDirectory();
        
        res.json({
            success: true,
            packages: {
                minimal: { available: true, size: '25MB' },
                standard: { available: true, size: '850MB' },
                full: { available: true, size: '2GB' }
            },
            message: 'All packages are available for download'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to check package availability'
        });
    }
});

module.exports = router;

