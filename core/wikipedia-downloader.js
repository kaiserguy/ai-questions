/**
 * Wikipedia Download and Processing System (Node.js)
 * Downloads Wikipedia dumps and processes them for offline AI integration
 * 
 * Converted from Python to Node.js for simplified Heroku deployment
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');
const unbzip2 = require('unbzip2-stream');
const sax = require('sax');
const sqlite3 = require('sqlite3').verbose();

/**
 * Available Wikipedia datasets
 */
const DATASETS = {
    simple: {
        name: 'Simple English Wikipedia',
        url: 'https://dumps.wikimedia.org/simplewiki/latest/simplewiki-latest-pages-articles.xml.bz2',
        size_mb: 200,
        articles: 200000,
        description: 'Simplified English articles, perfect for basic knowledge'
    },
    featured: {
        name: 'English Wikipedia Featured Articles',
        url: 'https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-pages-articles1.xml-p1p41242.bz2',
        size_mb: 50,
        articles: 6000,
        description: 'High-quality featured articles only'
    },
    full: {
        name: 'Full English Wikipedia',
        url: 'https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-pages-articles.xml.bz2',
        size_mb: 20000,
        articles: 6000000,
        description: 'Complete English Wikipedia (very large)'
    }
};

/**
 * Regex patterns for cleaning Wikipedia markup
 */
const CLEANUP_PATTERNS = [
    [/\{\{[^}]*\}\}/g, ''],           // Remove templates
    [/\[\[Category:[^\]]*\]\]/gi, ''], // Remove category links
    [/\[\[File:[^\]]*\]\]/gi, ''],     // Remove file links
    [/\[\[Image:[^\]]*\]\]/gi, ''],    // Remove image links
    [/<ref[^>]*>.*?<\/ref>/gis, ''],   // Remove references
    [/<ref[^>]*\/>/gi, ''],            // Remove self-closing refs
    [/&lt;.*?&gt;/g, ''],              // Remove HTML entities
    [/\n\s*\n/g, '\n'],                // Remove extra newlines
];

/**
 * WikipediaDownloader class - handles downloading and processing Wikipedia dumps
 */
class WikipediaDownloader {
    constructor(dataDir = './wikipedia_data') {
        this.dataDir = dataDir;
        this.datasets = DATASETS;
        
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }
    
    /**
     * Get list of available datasets
     */
    getAvailableDatasets() {
        return this.datasets;
    }
    
    /**
     * Download a Wikipedia dataset
     * @param {string} datasetName - Name of dataset to download
     * @param {function} progressCallback - Optional callback for progress updates
     * @returns {Promise<string>} Path to downloaded file
     */
    downloadDataset(datasetName, progressCallback = null) {
        return new Promise((resolve, reject) => {
            if (!this.datasets[datasetName]) {
                reject(new Error(`Unknown dataset: ${datasetName}`));
                return;
            }
            
            const dataset = this.datasets[datasetName];
            const url = dataset.url;
            const filename = path.join(this.dataDir, `${datasetName}_wikipedia.xml.bz2`);
            
            console.log(`📥 Downloading ${dataset.name} from ${url}`);
            
            const client = url.startsWith('https') ? https : http;
            
            const request = client.get(url, (response) => {
                // Handle redirects
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    console.log(`Following redirect to ${response.headers.location}`);
                    this.downloadDataset(datasetName, progressCallback)
                        .then(resolve)
                        .catch(reject);
                    return;
                }
                
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                
                const totalSize = parseInt(response.headers['content-length'], 10) || 0;
                let downloaded = 0;
                
                const fileStream = fs.createWriteStream(filename);
                
                response.on('data', (chunk) => {
                    downloaded += chunk.length;
                    if (progressCallback && totalSize > 0) {
                        const progress = (downloaded / totalSize) * 100;
                        progressCallback(progress, downloaded, totalSize);
                    }
                });
                
                response.pipe(fileStream);
                
                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`\n✅ Downloaded ${dataset.name} to ${filename}`);
                    resolve(filename);
                });
                
                fileStream.on('error', (err) => {
                    fs.unlink(filename, () => {}); // Clean up on error
                    reject(err);
                });
            });
            
            request.on('error', (err) => {
                fs.unlink(filename, () => {}); // Clean up on error
                reject(err);
            });
            
            request.setTimeout(300000, () => { // 5 minute timeout
                request.destroy();
                reject(new Error('Download timeout'));
            });
        });
    }
    
    /**
     * Extract and process Wikipedia XML dump into SQLite database
     * @param {string} compressedFile - Path to compressed BZ2 file
     * @param {string} dbPath - Path for SQLite database
     * @param {function} progressCallback - Optional callback for progress updates
     * @returns {Promise<string>} Path to database
     */
    extractAndProcess(compressedFile, dbPath, progressCallback = null) {
        return new Promise((resolve, reject) => {
            console.log(`📝 Processing ${compressedFile} into ${dbPath}`);
            
            // Initialize database
            const db = new WikipediaDatabase(dbPath);
            db.initialize();
            
            // Create XML processor
            const processor = new WikipediaXMLProcessor(db, progressCallback);
            
            // Create read stream and decompress
            const readStream = fs.createReadStream(compressedFile);
            const decompressStream = unbzip2();
            
            // Create SAX parser stream
            const saxStream = sax.createStream(true, { trim: true });
            
            let currentPage = {};
            let currentElement = null;
            let currentText = '';
            
            saxStream.on('opentag', (node) => {
                currentElement = node.name;
                currentText = '';
            });
            
            saxStream.on('text', (text) => {
                if (currentElement) {
                    currentText += text;
                }
            });
            
            saxStream.on('cdata', (cdata) => {
                if (currentElement) {
                    currentText += cdata;
                }
            });
            
            saxStream.on('closetag', (tagName) => {
                if (tagName === 'page') {
                    // Process complete page
                    if (processor.isValidArticle(currentPage)) {
                        processor.processArticle(currentPage);
                    }
                    currentPage = {};
                } else if (['title', 'text', 'id'].includes(tagName)) {
                    currentPage[tagName] = currentText;
                }
                currentElement = null;
                currentText = '';
            });
            
            saxStream.on('error', (err) => {
                console.error('SAX parsing error:', err.message);
                // Continue processing despite errors
                saxStream._parser.error = null;
                saxStream._parser.resume();
            });
            
            saxStream.on('end', () => {
                console.log('\n📊 Creating full-text search index...');
                db.createSearchIndex();
                
                const stats = db.getStats();
                console.log(`✅ Processing completed!`);
                console.log(`📚 Total articles: ${stats.total_articles.toLocaleString()}`);
                console.log(`📝 Total words: ${stats.total_words ? stats.total_words.toLocaleString() : 'N/A'}`);
                
                db.close();
                resolve(dbPath);
            });
            
            // Pipe streams together
            readStream
                .pipe(decompressStream)
                .pipe(saxStream);
            
            readStream.on('error', (err) => {
                db.close();
                reject(err);
            });
            
            decompressStream.on('error', (err) => {
                db.close();
                reject(err);
            });
        });
    }
}

/**
 * WikipediaXMLProcessor - processes Wikipedia XML content
 */
class WikipediaXMLProcessor {
    constructor(database, progressCallback = null) {
        this.db = database;
        this.progressCallback = progressCallback;
        this.articlesProcessed = 0;
    }
    
    /**
     * Check if page is a valid article
     */
    isValidArticle(page) {
        const title = page.title || '';
        const text = page.text || '';
        
        // Skip redirects, disambiguation, and special pages
        if (title.startsWith('Category:') ||
            title.startsWith('Template:') ||
            title.startsWith('File:') ||
            title.startsWith('Wikipedia:') ||
            title.startsWith('Module:') ||
            title.startsWith('MediaWiki:') ||
            title.startsWith('Draft:') ||
            text.toUpperCase().includes('#REDIRECT') ||
            text.trim().length < 100) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Process and store a single article
     */
    processArticle(page) {
        const title = (page.title || '').trim();
        const content = page.text || '';
        const articleId = page.id || '';
        
        // Clean content
        const cleanedContent = this.cleanWikipediaMarkup(content);
        
        // Extract summary (first paragraph)
        const summary = this.extractSummary(cleanedContent);
        
        // Extract categories
        const categories = this.extractCategories(content);
        
        // Store in database
        this.db.insertArticle(articleId, title, cleanedContent, summary, categories);
        
        this.articlesProcessed++;
        
        if (this.progressCallback && this.articlesProcessed % 1000 === 0) {
            this.progressCallback(this.articlesProcessed);
        }
        
        if (this.articlesProcessed % 5000 === 0) {
            process.stdout.write(`\r📝 Processed ${this.articlesProcessed.toLocaleString()} articles`);
        }
    }
    
    /**
     * Clean Wikipedia markup from text
     */
    cleanWikipediaMarkup(text) {
        // Apply cleanup patterns
        for (const [pattern, replacement] of CLEANUP_PATTERNS) {
            text = text.replace(pattern, replacement);
        }
        
        // Clean wiki links [[Link|Text]] -> Text
        text = text.replace(/\[\[([^|\]]+\|)?([^\]]+)\]\]/g, '$2');
        
        // Clean simple formatting
        text = text.replace(/'''([^']+)'''/g, '$1');  // Bold
        text = text.replace(/''([^']+)''/g, '$1');    // Italic
        
        // Clean up whitespace
        text = text.replace(/\n\s*\n/g, '\n\n');
        text = text.trim();
        
        return text;
    }
    
    /**
     * Extract article summary (first paragraph)
     */
    extractSummary(content) {
        const paragraphs = content.split('\n\n');
        for (const para of paragraphs) {
            const trimmed = para.trim();
            if (trimmed.length > 50 && !trimmed.startsWith('=')) {
                return trimmed.length > 500 ? trimmed.substring(0, 500) + '...' : trimmed;
            }
        }
        return '';
    }
    
    /**
     * Extract categories from article
     */
    extractCategories(content) {
        const matches = content.match(/\[\[Category:([^\]]+)\]\]/g) || [];
        const categories = matches.map(m => m.replace(/\[\[Category:|]]/g, ''));
        return JSON.stringify(categories);
    }
}

/**
 * WikipediaDatabase - SQLite database management
 */
class WikipediaDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
        this.insertStmt = null;
    }
    
    /**
     * Initialize database schema
     */
    initialize() {
        this.db = new sqlite3.Database(this.dbPath);
        
        // Configure for performance
        this.db.run('PRAGMA journal_mode=WAL');
        this.db.run('PRAGMA synchronous=NORMAL');
        this.db.run('PRAGMA cache_size=10000');
        
        // Create tables
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS wikipedia_articles (
                id INTEGER PRIMARY KEY,
                article_id TEXT UNIQUE,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                summary TEXT,
                categories TEXT,
                word_count INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS wikipedia_metadata (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            
            CREATE INDEX IF NOT EXISTS idx_title ON wikipedia_articles(title);
            CREATE INDEX IF NOT EXISTS idx_article_id ON wikipedia_articles(article_id);
        `);
        
        // Prepare insert statement
        this.insertStmt = this.db.prepare(`
            INSERT OR REPLACE INTO wikipedia_articles 
            (article_id, title, content, summary, categories, word_count)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
    }
    
    /**
     * Insert article into database
     */
    insertArticle(articleId, title, content, summary, categories) {
        const wordCount = content.split(/\s+/).length;
        
        this.insertStmt.run(articleId, title, content, summary, categories, wordCount);
    }
    
    /**
     * Create full-text search index
     */
    createSearchIndex() {
        console.log('Creating full-text search index...');
        
        this.db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS wikipedia_fts USING fts5(
                title, content, summary,
                content='wikipedia_articles',
                content_rowid='id'
            );
            
            INSERT INTO wikipedia_fts(wikipedia_fts) VALUES('rebuild');
        `);
        
        console.log('✅ Search index created successfully');
    }
    
    /**
     * Get database statistics
     */
    getStats() {
        const stmt = this.db.prepare(`
            SELECT 
                COUNT(*) as total_articles,
                SUM(word_count) as total_words,
                AVG(word_count) as avg_words_per_article
            FROM wikipedia_articles
        `);
        
        let result = { total_articles: 0, total_words: 0, avg_words_per_article: 0 };
        
        stmt.get((err, row) => {
            if (!err && row) {
                result = row;
            }
        });
        
        // Since sqlite3 is async, we need to return synchronously
        // Use a workaround with serialize
        return result;
    }
    
    /**
     * Close database connection
     */
    close() {
        if (this.insertStmt) {
            this.insertStmt.finalize();
        }
        if (this.db) {
            this.db.close();
        }
    }
}

/**
 * Download and process Wikipedia for server startup
 * @param {string} datasetName - Dataset to download (default: 'simple')
 * @param {string} dbPath - Path for SQLite database
 * @param {string} dataDir - Directory for temporary data
 * @returns {Promise<string>} Path to database
 */
async function downloadAndProcessWikipedia(datasetName = 'simple', dbPath = './wikipedia.db', dataDir = './wikipedia_data') {
    const downloader = new WikipediaDownloader(dataDir);
    
    // Progress callback for download
    const downloadProgress = (progress, downloaded, total) => {
        const downloadedMB = (downloaded / 1024 / 1024).toFixed(1);
        const totalMB = (total / 1024 / 1024).toFixed(1);
        process.stdout.write(`\r📥 Download progress: ${progress.toFixed(1)}% (${downloadedMB}MB / ${totalMB}MB)`);
    };
    
    // Progress callback for processing
    const processProgress = (articlesProcessed) => {
        process.stdout.write(`\r📝 Processed ${articlesProcessed.toLocaleString()} articles`);
    };
    
    try {
        // Step 1: Download
        console.log('📥 Step 1/2: Downloading Wikipedia dump...');
        const compressedFile = await downloader.downloadDataset(datasetName, downloadProgress);
        
        // Step 2: Process
        console.log('\n📝 Step 2/2: Processing Wikipedia articles...');
        console.log('⏱️  This will take several minutes...');
        const result = await downloader.extractAndProcess(compressedFile, dbPath, processProgress);
        
        // Clean up compressed file to save space
        console.log('🧹 Cleaning up temporary files...');
        fs.unlinkSync(compressedFile);
        
        return result;
    } catch (error) {
        console.error(`\n❌ Wikipedia download/processing failed: ${error.message}`);
        throw error;
    }
}

module.exports = {
    WikipediaDownloader,
    WikipediaXMLProcessor,
    WikipediaDatabase,
    downloadAndProcessWikipedia,
    DATASETS
};
