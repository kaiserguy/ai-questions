/**
 * Download WebLLM model files from HuggingFace
 * Usage: node download-webllm-model.js <model-id> <output-dir>
 */

const fs = require('fs');
const path = require('path');

// Use node-fetch for better redirect handling (available in Node 18+)
const fetchModule = globalThis.fetch ? globalThis : require('https');

const modelId = process.argv[2] || 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
const outputDir = process.argv[3] || path.join(__dirname, 'cache', 'webllm-models', modelId);

// WebLLM models are hosted on HuggingFace
const HUGGINGFACE_BASE = 'https://huggingface.co/mlc-ai';

// Model file list - these are the essential files for Llama-3.2-1B
const MODEL_FILES = [
    'mlc-chat-config.json',
    'ndarray-cache.json',
    'params_shard_0.bin',
    'params_shard_1.bin',
    'params_shard_2.bin',
    'params_shard_3.bin',
    'params_shard_4.bin',
    'params_shard_5.bin',
    'params_shard_6.bin',
    'params_shard_7.bin',
    'params_shard_8.bin',
    'params_shard_9.bin',
    'params_shard_10.bin',
    'params_shard_11.bin',
    'params_shard_12.bin',
    'params_shard_13.bin',
    'params_shard_14.bin',
    'tokenizer.json',
    'tokenizer_config.json'
];

/**
 * Download a file using native Node.js https with manual redirect following
 */
async function downloadFile(url, dest) {
    const filename = path.basename(dest);
    const https = require('https');
    const { URL } = require('url');
    
    return new Promise((resolve, reject) => {
        const makeRequest = (currentUrl, redirectCount = 0) => {
            if (redirectCount > 10) {
                return reject(new Error('Too many redirects'));
            }
            
            https.get(currentUrl, { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': '*/*'
                }
            }, (response) => {
                // Handle redirects manually
                if (response.statusCode === 301 || response.statusCode === 302 || 
                    response.statusCode === 303 || response.statusCode === 307 || 
                    response.statusCode === 308) {
                    const redirectUrl = response.headers.location;
                    if (!redirectUrl) {
                        return reject(new Error('Redirect without location'));
                    }
                    
                    // Handle relative redirects by resolving against current URL
                    let nextUrl;
                    try {
                        nextUrl = new URL(redirectUrl, currentUrl).href;
                    } catch (e) {
                        return reject(new Error(`Invalid redirect URL: ${redirectUrl}`));
                    }
                    
                    console.log(`   → Redirect ${response.statusCode} for ${filename}...`);
                    return makeRequest(nextUrl, redirectCount + 1);
                }
                
                if (response.statusCode !== 200) {
                    return reject(new Error(`HTTP ${response.statusCode}`));
                }
                
                const file = fs.createWriteStream(dest);
                const totalBytes = parseInt(response.headers['content-length'], 10);
                let downloadedBytes = 0;
                
                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    if (totalBytes) {
                        const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
                        const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(1);
                        const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
                        process.stdout.write(`\r   ${filename}: ${percent}% (${downloadedMB}MB / ${totalMB}MB)`);
                    }
                });
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    console.log(`\n   ✓ ${filename} complete`);
                    resolve();
                });
                
                file.on('error', (err) => {
                    file.close();
                    if (fs.existsSync(dest)) {
                        fs.unlinkSync(dest);
                    }
                    reject(err);
                });
            }).on('error', (err) => {
                reject(err);
            });
        };
        
        makeRequest(url);
    });
}

/**
 * Main download function
 */
async function downloadModel() {
    console.log(`Downloading WebLLM model: ${modelId}`);
    console.log(`Output directory: ${outputDir}\n`);
    
    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Build base URL
    const modelRepo = modelId; // HuggingFace repo name
    const baseUrl = `${HUGGINGFACE_BASE}/${modelRepo}/resolve/main`;
    
    let successCount = 0;
    let failCount = 0;
    
    // Download each file
    for (const filename of MODEL_FILES) {
        const url = `${baseUrl}/${filename}`;
        const dest = path.join(outputDir, filename);
        
        // Skip if file already exists
        if (fs.existsSync(dest)) {
            console.log(`   ⊘ ${filename} (already exists)`);
            successCount++;
            continue;
        }
        
        try {
            await downloadFile(url, dest);
            successCount++;
        } catch (error) {
            console.error(`\n   ✗ ${filename}: ${error.message}`);
            failCount++;
            
            // Some models may not have all shard files
            // Continue anyway if it's a shard file
            if (!filename.startsWith('params_shard')) {
                console.error('\n✗ Critical file download failed. Aborting.');
                process.exit(1);
            }
        }
    }
    
    console.log(`\n✓ Download complete: ${successCount} files, ${failCount} failed/skipped`);
    
    if (failCount > 0 && successCount > 0) {
        console.log('Note: Some shard files were not found - this may be normal for smaller models');
    }
    
    // Create a metadata file
    const metadata = {
        modelId,
        downloadDate: new Date().toISOString(),
        files: fs.readdirSync(outputDir),
        baseUrl
    };
    
    fs.writeFileSync(
        path.join(outputDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
    );
    
    console.log('✓ Metadata saved');
}

// Run download
downloadModel().catch((error) => {
    console.error('Download failed:', error);
    process.exit(1);
});
