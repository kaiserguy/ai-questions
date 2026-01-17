/**
 * Browser-based Wikipedia Downloader
 * Downloads and processes Wikipedia dumps directly in the browser
 * Mimics local/wikipedia_downloader.py functionality
 */

class WikipediaDownloader {
    constructor() {
        // Wikipedia data sources - same as Python version
        this.datasets = {
            'minimal': {
                name: 'Simple English Wikipedia (Minimal)',
                // Using Wikimedia Cirrussearch JSON dump (smaller, pre-processed)
                url: 'https://dumps.wikimedia.org/other/cirrussearch/current/simplewiki-20240101-cirrussearch-content.json.gz',
                size_mb: 50,
                articles: 10000,
                description: 'Lightweight Wikipedia subset, pre-processed for search'
            },
            'standard': {
                name: 'Simple English Wikipedia',
                // Full Simple Wikipedia articles
                url: 'https://dumps.wikimedia.org/simplewiki/latest/simplewiki-latest-abstract.xml.gz',
                size_mb: 200,
                articles: 200000,
                description: 'Complete Simple English Wikipedia'
            },
            'full': {
                name: 'English Wikipedia Sample',
                // Sample of English Wikipedia
                url: 'https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-abstract1.xml.gz',
                size_mb: 800,
                articles: 1000000,
                description: 'Large sample of English Wikipedia'
            }
        };
    }

    /**
     * Download and process Wikipedia dataset
     * @param {string} datasetName - Dataset to download (minimal/standard/full)
     * @param {Function} progressCallback - Progress callback function
     * @returns {Promise<Uint8Array>} SQLite database as binary data
     */
    async downloadAndProcess(datasetName, progressCallback) {
        const dataset = this.datasets[datasetName];
        if (!dataset) {
            throw new Error(`Unknown dataset: ${datasetName}`);
        }

        console.log(`[WikipediaDownloader] Starting download: ${dataset.name}`);
        progressCallback?.({ stage: 'downloading', progress: 0, message: `Downloading ${dataset.name}...` });

        try {
            // Download the compressed data
            const compressedData = await this.downloadWithProgress(dataset.url, (progress) => {
                progressCallback?.({ 
                    stage: 'downloading', 
                    progress: progress * 0.5, // First 50% is download
                    message: `Downloading ${dataset.name}... ${Math.round(progress)}%` 
                });
            });

            console.log(`[WikipediaDownloader] Downloaded ${compressedData.byteLength} bytes`);
            progressCallback?.({ stage: 'decompressing', progress: 50, message: 'Decompressing data...' });

            // Decompress the data
            const decompressedData = await this.decompress(compressedData);
            console.log(`[WikipediaDownloader] Decompressed to ${decompressedData.byteLength} bytes`);

            progressCallback?.({ stage: 'processing', progress: 60, message: 'Processing Wikipedia data...' });

            // Process into SQLite database
            const dbData = await this.processToSQLite(decompressedData, dataset, (progress) => {
                progressCallback?.({ 
                    stage: 'processing', 
                    progress: 60 + (progress * 0.4), // Last 40% is processing
                    message: `Processing articles... ${Math.round(progress)}%` 
                });
            });

            console.log(`[WikipediaDownloader] Created database: ${dbData.byteLength} bytes`);
            progressCallback?.({ stage: 'complete', progress: 100, message: 'Wikipedia database ready!' });

            return dbData;

        } catch (error) {
            console.error('[WikipediaDownloader] Download failed:', error);
            throw new Error(`Failed to download Wikipedia: ${error.message}`);
        }
    }

    /**
     * Download with progress tracking
     */
    async downloadWithProgress(url, progressCallback) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        
        let loaded = 0;
        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            loaded += value.length;

            if (total > 0) {
                const progress = (loaded / total) * 100;
                progressCallback?.(progress);
            }
        }

        // Combine chunks
        const combined = new Uint8Array(loaded);
        let position = 0;
        for (const chunk of chunks) {
            combined.set(chunk, position);
            position += chunk.length;
        }

        return combined.buffer;
    }

    /**
     * Decompress gzip data
     */
    async decompress(compressedData) {
        // Use native browser decompression if available
        if (typeof DecompressionStream !== 'undefined') {
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new Uint8Array(compressedData));
                    controller.close();
                }
            });

            const decompressedStream = stream.pipeThrough(
                new DecompressionStream('gzip')
            );

            const chunks = [];
            const reader = decompressedStream.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const result = new Uint8Array(totalLength);
            let position = 0;
            for (const chunk of chunks) {
                result.set(chunk, position);
                position += chunk.length;
            }

            return result.buffer;
        } else {
            // Fallback: use pako library if available
            if (typeof pako !== 'undefined') {
                return pako.ungzip(new Uint8Array(compressedData)).buffer;
            }
            throw new Error('No decompression method available');
        }
    }

    /**
     * Process Wikipedia data into SQLite database
     * Mimics local/wikipedia_downloader.py processing
     */
    async processToSQLite(data, dataset, progressCallback) {
        // Load SQL.js (should already be loaded)
        if (typeof initSqlJs === 'undefined') {
            throw new Error('SQL.js not loaded');
        }

        const SQL = await initSqlJs({
            locateFile: file => `/offline/libs/${file}`
        });

        const db = new SQL.Database();

        // Create schema - same as Python version
        db.run(`
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                summary TEXT,
                url TEXT,
                links TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.run(`CREATE INDEX IF NOT EXISTS idx_title ON articles(title)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_content ON articles(content)`);

        // Parse and insert articles
        const text = new TextDecoder().decode(data);
        await this.parseAndInsert(db, text, dataset, progressCallback);

        // Export database
        const dbData = db.export();
        db.close();

        return dbData;
    }

    /**
     * Parse Wikipedia data and insert into database
     */
    async parseAndInsert(db, text, dataset, progressCallback) {
        console.log(`[WikipediaDownloader] Parsing Wikipedia data...`);

        // Check if it's JSON (Cirrussearch) or XML (abstracts)
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            await this.parseJSON(db, text, progressCallback);
        } else if (text.includes('<?xml')) {
            await this.parseXML(db, text, progressCallback);
        } else {
            throw new Error('Unknown Wikipedia data format');
        }
    }

    /**
     * Parse Cirrussearch JSON format
     */
    async parseJSON(db, text, progressCallback) {
        const lines = text.split('\n').filter(line => line.trim());
        const articles = [];

        // Cirrussearch format: alternating index/document lines
        for (let i = 0; i < lines.length; i += 2) {
            if (i + 1 >= lines.length) break;

            try {
                const doc = JSON.parse(lines[i + 1]);
                if (doc.title && doc.text) {
                    articles.push({
                        title: doc.title,
                        content: doc.text,
                        summary: doc.text.substring(0, 500),
                        url: `https://simple.wikipedia.org/wiki/${encodeURIComponent(doc.title)}`
                    });
                }

                if (articles.length % 100 === 0) {
                    progressCallback?.((articles.length / (lines.length / 2)) * 100);
                }
            } catch (e) {
                // Skip malformed JSON
            }
        }

        // Insert articles in batches
        console.log(`[WikipediaDownloader] Inserting ${articles.length} articles...`);
        const stmt = db.prepare('INSERT INTO articles (title, content, summary, url) VALUES (?, ?, ?, ?)');

        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            stmt.run([article.title, article.content, article.summary, article.url]);

            if (i % 1000 === 0) {
                progressCallback?.((i / articles.length) * 100);
            }
        }

        stmt.free();
        console.log(`[WikipediaDownloader] Inserted ${articles.length} articles`);
    }

    /**
     * Parse XML abstract format
     */
    async parseXML(db, text, progressCallback) {
        console.log(`[WikipediaDownloader] Parsing XML abstracts...`);

        // Simple XML parsing for abstracts
        const articleRegex = /<doc>([\s\S]*?)<\/doc>/g;
        const titleRegex = /<title>(.*?)<\/title>/;
        const abstractRegex = /<abstract>(.*?)<\/abstract>/;
        const urlRegex = /<url>(.*?)<\/url>/;

        const articles = [];
        let match;
        let count = 0;

        while ((match = articleRegex.exec(text)) !== null) {
            const docXml = match[1];
            
            const titleMatch = titleRegex.exec(docXml);
            const abstractMatch = abstractRegex.exec(docXml);
            const urlMatch = urlRegex.exec(docXml);

            if (titleMatch && abstractMatch) {
                const title = titleMatch[1].replace(/Wikipedia: /, '');
                const content = abstractMatch[1];
                
                articles.push({
                    title: title,
                    content: content,
                    summary: content.substring(0, 500),
                    url: urlMatch ? urlMatch[1] : `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`
                });

                count++;
                if (count % 1000 === 0) {
                    progressCallback?.(count / 10000); // Estimate
                }
            }

            // Limit to prevent memory issues
            if (articles.length >= 50000) break;
        }

        // Insert articles
        console.log(`[WikipediaDownloader] Inserting ${articles.length} articles...`);
        const stmt = db.prepare('INSERT INTO articles (title, content, summary, url) VALUES (?, ?, ?, ?)');

        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            stmt.run([article.title, article.content, article.summary, article.url]);

            if (i % 1000 === 0) {
                progressCallback?.((i / articles.length) * 100);
            }
        }

        stmt.free();
        console.log(`[WikipediaDownloader] Inserted ${articles.length} articles`);
    }

    /**
     * Get dataset info
     */
    getDatasetInfo(datasetName) {
        return this.datasets[datasetName];
    }

    /**
     * List available datasets
     */
    listDatasets() {
        return Object.entries(this.datasets).map(([key, info]) => ({
            key,
            ...info
        }));
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.WikipediaDownloader = WikipediaDownloader;
}
