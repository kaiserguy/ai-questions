const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

class OfflineResourceCache {
    constructor() {
        this.cacheDir = path.join(__dirname, 'cache');
        this.manifestPath = path.join(this.cacheDir, 'manifest.json');
        this.ensureCacheDir();
    }

    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    async downloadFile(url, filename, onProgress = null) {
        return new Promise((resolve, reject) => {
            const filePath = path.join(this.cacheDir, filename);
            const file = fs.createWriteStream(filePath);
            
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloadedSize = 0;

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (onProgress && totalSize) {
                        const progress = (downloadedSize / totalSize) * 100;
                        onProgress(progress, downloadedSize, totalSize);
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve(filePath);
                });

                file.on('error', (err) => {
                    fs.unlink(filePath, () => {}); // Delete partial file
                    reject(err);
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }

    async cacheMinimalPackageResources() {
        console.log('Starting minimal package resource caching...');
        
        const resources = [
            {
                name: 'tinybert-model',
                url: 'https://huggingface.co/Xenova/distilbert-base-uncased/resolve/main/onnx/model_quantized.onnx',
                filename: 'tinybert-model.onnx',
                size: 67000000, // ~67MB
                type: 'ai-model'
            },
            {
                name: 'tokenizer-config',
                url: 'https://huggingface.co/Xenova/distilbert-base-uncased/resolve/main/tokenizer.json',
                filename: 'tokenizer.json',
                size: 712000, // ~712KB
                type: 'tokenizer'
            },
            {
                name: 'wikipedia-sample',
                url: 'https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-pages-articles1.xml-p1p41242.bz2',
                filename: 'wikipedia-sample.xml.bz2',
                size: 50000000, // ~50MB
                type: 'wikipedia'
            }
        ];

        const manifest = {
            package: 'minimal',
            version: '1.0.0',
            created: new Date().toISOString(),
            resources: [],
            totalSize: 0
        };

        for (const resource of resources) {
            try {
                console.log(`Downloading ${resource.name}...`);
                
                const filePath = await this.downloadFile(
                    resource.url, 
                    resource.filename,
                    (progress, downloaded, total) => {
                        process.stdout.write(`\r${resource.name}: ${progress.toFixed(1)}% (${this.formatBytes(downloaded)}/${this.formatBytes(total)})`);
                    }
                );

                console.log(`\n${resource.name} downloaded successfully`);

                // Verify file exists and get actual size
                const stats = fs.statSync(filePath);
                const hash = await this.calculateFileHash(filePath);

                manifest.resources.push({
                    name: resource.name,
                    filename: resource.filename,
                    type: resource.type,
                    size: stats.size,
                    hash: hash,
                    cached: true
                });

                manifest.totalSize += stats.size;

            } catch (error) {
                console.error(`\nFailed to download ${resource.name}:`, error.message);
                
                // Add to manifest as unavailable
                manifest.resources.push({
                    name: resource.name,
                    filename: resource.filename,
                    type: resource.type,
                    size: resource.size,
                    hash: null,
                    cached: false,
                    error: error.message
                });
            }
        }

        // Save manifest
        fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2));
        console.log('\nMinimal package caching complete!');
        console.log(`Total cached size: ${this.formatBytes(manifest.totalSize)}`);
        
        return manifest;
    }

    async calculateFileHash(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);
            
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getManifest() {
        if (fs.existsSync(this.manifestPath)) {
            return JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
        }
        return null;
    }

    isMinimalPackageReady() {
        const manifest = this.getManifest();
        if (!manifest) return false;
        
        return manifest.resources.every(resource => resource.cached === true);
    }

    getCachedFilePath(filename) {
        const filePath = path.join(this.cacheDir, filename);
        return fs.existsSync(filePath) ? filePath : null;
    }

    getPackageInfo() {
        const manifest = this.getManifest();
        if (!manifest) {
            return {
                available: false,
                reason: 'No cached resources found'
            };
        }

        const cachedResources = manifest.resources.filter(r => r.cached);
        const totalCached = cachedResources.reduce((sum, r) => sum + r.size, 0);

        return {
            available: this.isMinimalPackageReady(),
            package: manifest.package,
            version: manifest.version,
            created: manifest.created,
            totalResources: manifest.resources.length,
            cachedResources: cachedResources.length,
            totalSize: this.formatBytes(totalCached),
            resources: manifest.resources
        };
    }
}

module.exports = OfflineResourceCache;

