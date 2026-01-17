/**
 * Wikipedia Download and Processing System (Node.js)
 * Downloads Wikipedia dumps and processes them for offline AI integration
 * 
 * Optimized for low-memory environments (Heroku 512MB dynos)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
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
 * Pre-compiled for performance
 */
const CLEANUP_PATTERNS = [
    [/\{\{[^}]*\}\}/g, ''],           // Remove templates
    [/\[\[Category:[^\]]*\]\]/gi, ''], // Remove category links
    [/\[\[File:[^\]]*\]\]/gi, ''],     // Remove file links
    [/\[\[Image:[^\]]*\]\]/gi, ''],    // Remove image links
    [/<ref[^>]*>.*?<\/ref>/gis, ''],   // Remove references
    [/<ref[^>]*\/>/gi, ''],            // Remove self-closing refs
    [/&lt;.*?&gt;/g, ''],              // Remove HTML entities
];

/**
 * Memory-efficient text cleaning
 * Processes text in place without creating many intermediate strings
 */
function cleanWikipediaMarkup(text) {
    if (!text || text.length === 0) return '';
    
    // Limit text size to prevent memory issues with very long articles
    const MAX_CONTENT_LENGTH = 50000; // 50KB max per article
    if (text.length > MAX_CONTENT_LENGTH) {
        text = text.substring(0, MAX_CONTENT_LENGTH);
    }
    
    // Apply cleanup patterns
    for (const [pattern, replacement] of CLEANUP_PATTERNS) {
        text = text.replace(pattern, replacement);
    }
    
    // Clean wiki links [[Link|Text]] -> Text
    text = text.replace(/\[\[([^|\]]+\|)?([^\]]+)\]\]/g, '$2');
    
    // Clean simple formatting
    text = text.replace(/'''([^']+)'''/g, '$1');  // Bold
    text = text.replace(/''([^']+)''/g, '$1');    // Italic
    
    // Clean up whitespace (single pass)
    text = text.replace(/\n\s*\n+/g, '\n\n').trim();
    
    return text;
}

/**
 * Extract summary efficiently
 */
function extractSummary(content) {
    if (!content) return '';
    
    // Find first substantial paragraph without splitting entire content
    let start = 0;
    let end = 0;
    
    while (start < content.length && start < 5000) { // Only search first 5KB
        // Find end of paragraph
        end = content.indexOf('\n\n', start);
        if (end === -1) end = Math.min(content.length, start + 500);
        
        const para = content.substring(start, end).trim();
        
        // Check if this is a valid paragraph
        if (para.length > 50 && !para.startsWith('=')) {
            return para.length > 500 ? para.substring(0, 500) + '...' : para;
        }
        
        start = end + 2;
    }
    
    return '';
}

/**
 * Extract categories efficiently
 */
function extractCategories(content) {
    if (!content) return '[]';
    
    const categories = [];
    const regex = /\[\[Category:([^\]|]+)/gi;
    let match;
    
    // Limit to first 20 categories
    while ((match = regex.exec(content)) !== null && categories.length < 20) {
        categories.push(match[1].trim());
    }
    
    return JSON.stringify(categories);
}

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
     * Download a Wikipedia dataset with redirect handling
     */
    downloadDataset(datasetName, progressCallback = null) {
        return new Promise((resolve, reject) => {
            if (!this.datasets[datasetName]) {
                reject(new Error(`Unknown dataset: ${datasetName}`));
                return;
            }
            
            const dataset = this.datasets[datasetName];
            const filename = path.join(this.dataDir, `${datasetName}_wikipedia.xml.bz2`);
            
            console.log(`📥 Downloading ${dataset.name} from ${dataset.url}`);
            
            const downloadWithRedirects = (url, redirectCount = 0) => {
                if (redirectCount > 5) {
                    reject(new Error('Too many redirects'));
                    return;
                }
                
                const client = url.startsWith('https') ? https : http;
                
                const request = client.get(url, (response) => {
                    // Handle redirects
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        console.log(`Following redirect to ${response.headers.location}`);
                        downloadWithRedirects(response.headers.location, redirectCount + 1);
                        return;
                    }
                    
                    if (response.statusCode !== 200) {
                        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                        return;
                    }
                    
                    const totalSize = parseInt(response.headers['content-length'], 10) || 0;
                    let downloaded = 0;
                    let lastProgress = 0;
                    
                    const fileStream = fs.createWriteStream(filename);
                    
                    response.on('data', (chunk) => {
                        downloaded += chunk.length;
                        if (progressCallback && totalSize > 0) {
                            const progress = (downloaded / totalSize) * 100;
                            // Only report every 1% to reduce log spam
                            if (progress - lastProgress >= 1) {
                                progressCallback(progress, downloaded, totalSize);
                                lastProgress = progress;
                            }
                        }
                    });
                    
                    response.pipe(fileStream);
                    
                    fileStream.on('finish', () => {
                        fileStream.close();
                        console.log(`\n✅ Downloaded ${dataset.name} to ${filename}`);
                        resolve(filename);
                    });
                    
                    fileStream.on('error', (err) => {
                        fs.unlink(filename, () => {});
                        reject(err);
                    });
                });
                
                request.on('error', (err) => {
                    fs.unlink(filename, () => {});
                    reject(err);
                });
                
                // 10 minute timeout for large files
                request.setTimeout(600000, () => {
                    request.destroy();
                    reject(new Error('Download timeout'));
                });
            };
            
            downloadWithRedirects(dataset.url);
        });
    }
    
    /**
     * Download and stream-process Wikipedia dump without saving compressed file to disk
     * Memory-optimized: HTTP → BZ2 decompress → XML parse → SQLite
     */
    downloadAndStreamProcess(dataset, dbPath, progressCallback = null) {
        return new Promise((resolve, reject) => {
            console.log(`📝 Streaming ${dataset.name} from ${dataset.url}`);
            
            // Initialize database with memory-optimized settings
            const db = new WikipediaDatabase(dbPath);
            db.initialize();
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            const downloadWithRedirects = (url) => {
                const parsedUrl = new URL(url);
                const client = parsedUrl.protocol === 'https:' ? https : http;
                
                const request = client.get(url, (response) => {
                    if (response.statusCode === 301 || response.statusCode === 302) {
                        downloadWithRedirects(response.headers.location);
                        return;
                    }
                    
                    if (response.statusCode !== 200) {
                        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                        return;
                    }
                    
                    const totalSize = parseInt(response.headers['content-length'], 10) || 0;
                    let downloaded = 0;
                    let lastProgress = 0;
                    
                    response.on('data', (chunk) => {
                        downloaded += chunk.length;
                        if (progressCallback && totalSize > 0) {
                            const progress = (downloaded / totalSize) * 100;
                            if (progress - lastProgress >= 5) { // Report every 5%
                                progressCallback(progress, downloaded, totalSize);
                                lastProgress = progress;
                            }
                        }
                    });
                    
                    // Stream pipeline: HTTP → BZ2 → XML Parser → Database
                    const decompressStream = unbzip2();
                    const saxStream = sax.createStream(true, { 
                        trim: true,
                        normalize: true,
                        lowercase: false,
                        xmlns: false,
                        position: false
                    });
                    
                    // Connect streams
                    response.pipe(decompressStream).pipe(saxStream);
                    
                    // Set up XML processing (same as before)
                    this.setupXMLProcessing(saxStream, db, dbPath, resolve, reject);
                });
                
                request.on('error', (err) => reject(err));
                request.setTimeout(600000, () => {
                    request.destroy();
                    reject(new Error('Download timeout'));
                });
            };
            
            downloadWithRedirects(dataset.url);
        });
    }
    
    /**
     * Set up XML processing handlers (extracted from extractAndProcess)
     */
    setupXMLProcessing(saxStream, db, dbPath, resolve, reject) {
        let currentElement = null;
        let pageTitle = '';
        let pageText = '';
        let pageId = '';
        let inPage = false;
        let articlesProcessed = 0;
        let articlesSkipped = 0;
            
            // Batch processing for better performance
            const BATCH_SIZE = 100;
            let batch = [];
            
            saxStream.on('opentag', (node) => {
                const tagName = node.name;
                if (tagName === 'page') {
                    inPage = true;
                    pageTitle = '';
                    pageText = '';
                    pageId = '';
                } else if (inPage && (tagName === 'title' || tagName === 'text' || tagName === 'id')) {
                    currentElement = tagName;
                }
            });
            
            saxStream.on('text', (text) => {
                if (!currentElement || !inPage) return;
                
                if (currentElement === 'title') {
                    pageTitle += text;
                } else if (currentElement === 'text') {
                    // Limit text accumulation to prevent memory issues
                    if (pageText.length < 100000) {
                        pageText += text;
                    }
                } else if (currentElement === 'id' && !pageId) {
                    pageId = text;
                }
            });
            
            saxStream.on('cdata', (cdata) => {
                if (currentElement === 'text' && inPage && pageText.length < 100000) {
                    pageText += cdata;
                }
            });
            
            saxStream.on('closetag', (tagName) => {
                if (tagName === 'page' && inPage) {
                    inPage = false;
                    
                    // Check if valid article
                    if (isValidArticle(pageTitle, pageText)) {
                        // Process article
                        const cleanedContent = cleanWikipediaMarkup(pageText);
                        const summary = extractSummary(cleanedContent);
                        const categories = extractCategories(pageText);
                        const wordCount = cleanedContent.split(/\s+/).length;
                        
                        batch.push({
                            articleId: pageId,
                            title: pageTitle.trim(),
                            content: cleanedContent,
                            summary: summary,
                            categories: categories,
                            wordCount: wordCount
                        });
                        
                        articlesProcessed++;
                        
                        // Insert batch when full
                        if (batch.length >= BATCH_SIZE) {
                            db.insertBatch(batch);
                            batch = [];
                            
                            // Progress update every 500 articles for better visibility
                            if (articlesProcessed % 500 === 0) {
                                const totalPages = articlesProcessed + articlesSkipped;
                                process.stdout.write(`\r📝 Processing: ${articlesProcessed.toLocaleString()} articles | ${articlesSkipped.toLocaleString()} skipped | ${totalPages.toLocaleString()} pages total`);
                                
                                // Periodic garbage collection hint
                                if (articlesProcessed % 10000 === 0 && global.gc) {
                                    global.gc();
                                }
                            }
                        }
                    } else {
                        articlesSkipped++;
                        
                        // Show skipped progress too (every 5000 to avoid spam)
                        if (articlesSkipped % 5000 === 0) {
                            const totalPages = articlesProcessed + articlesSkipped;
                            process.stdout.write(`\r📝 Processing: ${articlesProcessed.toLocaleString()} articles | ${articlesSkipped.toLocaleString()} skipped | ${totalPages.toLocaleString()} pages total`);
                        }
                    }
                    
                    // Clear page data immediately
                    pageTitle = '';
                    pageText = '';
                    pageId = '';
                    currentElement = null;
                } else if (tagName === currentElement) {
                    currentElement = null;
                }
            });
            
            saxStream.on('error', (err) => {
                console.error('SAX parsing error:', err.message);
                // Continue processing despite errors
                saxStream._parser.error = null;
                saxStream._parser.resume();
            });
            
            saxStream.on('end', () => {
                // Insert remaining batch
                if (batch.length > 0) {
                    db.insertBatch(batch);
                    batch = [];
                }
                
                const totalPages = articlesProcessed + articlesSkipped;
                console.log(`\n\n📊 Stream processing complete!`);
                console.log(`📚 Articles saved: ${articlesProcessed.toLocaleString()}`);
                console.log(`⏭️  Pages skipped: ${articlesSkipped.toLocaleString()}`);
                console.log(`📄 Total pages processed: ${totalPages.toLocaleString()}`);
                console.log(`\n📊 Finalizing database...`);
                
                db.createSearchIndex(() => {
                    const stats = db.getStatsSync();
                    console.log(`✅ Database ready!`);
                    console.log(`📚 Total articles in database: ${stats.total_articles.toLocaleString()}`);
                    
                    db.close();
                    resolve(dbPath);
                });
            });
    }

}

/**
 * Check if page is a valid article
 */
function isValidArticle(title, text) {
    if (!title || !text) return false;
    
    // Skip special pages
    if (title.startsWith('Category:') ||
        title.startsWith('Template:') ||
        title.startsWith('File:') ||
        title.startsWith('Wikipedia:') ||
        title.startsWith('Module:') ||
        title.startsWith('MediaWiki:') ||
        title.startsWith('Draft:') ||
        title.startsWith('Portal:') ||
        title.startsWith('Help:') ||
        title.startsWith('User:') ||
        title.startsWith('Talk:')) {
        return false;
    }
    
    // Skip redirects and stubs
    const textUpper = text.substring(0, 100).toUpperCase();
    if (textUpper.includes('#REDIRECT')) {
        return false;
    }
    
    // Skip very short articles
    if (text.trim().length < 200) {
        return false;
    }
    
    return true;
}

/**
 * WikipediaDatabase - SQLite database management with memory optimization
 */
class WikipediaDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }
    
    /**
     * Initialize database schema with memory-optimized settings
     */
    initialize() {
        this.db = new sqlite3.Database(this.dbPath);
        
        // Memory-optimized PRAGMA settings
        this.db.serialize(() => {
            // Use smaller cache to reduce memory
            this.db.run('PRAGMA cache_size = 2000'); // ~2MB cache
            this.db.run('PRAGMA page_size = 4096');
            this.db.run('PRAGMA journal_mode = WAL');
            this.db.run('PRAGMA synchronous = NORMAL');
            this.db.run('PRAGMA temp_store = FILE'); // Use disk for temp storage
            this.db.run('PRAGMA mmap_size = 0'); // Disable memory mapping
            
            // Create tables
            this.db.run(`
                CREATE TABLE IF NOT EXISTS wikipedia_articles (
                    id INTEGER PRIMARY KEY,
                    article_id TEXT UNIQUE,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    summary TEXT,
                    categories TEXT,
                    word_count INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            this.db.run(`
                CREATE TABLE IF NOT EXISTS wikipedia_metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            `);
            
            this.db.run('CREATE INDEX IF NOT EXISTS idx_title ON wikipedia_articles(title)');
            this.db.run('CREATE INDEX IF NOT EXISTS idx_article_id ON wikipedia_articles(article_id)');
        });
    }
    
    /**
     * Insert a batch of articles efficiently
     */
    insertBatch(articles) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO wikipedia_articles 
            (article_id, title, content, summary, categories, word_count)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        this.db.serialize(() => {
            this.db.run('BEGIN TRANSACTION');
            
            for (const article of articles) {
                stmt.run(
                    article.articleId,
                    article.title,
                    article.content,
                    article.summary,
                    article.categories,
                    article.wordCount
                );
            }
            
            this.db.run('COMMIT');
        });
        
        stmt.finalize();
    }
    
    /**
     * Create full-text search index
     */
    createSearchIndex(callback) {
        console.log('✅ Database ready (no FTS index - using direct queries)');
        if (callback) callback();
    }
    
    /**
     * Get database statistics synchronously
     */
    getStatsSync() {
        try {
            // Use synchronous prepare/bind/step for actual sync behavior
            const stmt = this.db.prepare('SELECT COUNT(*) as count FROM wikipedia_articles');
            let result = { total_articles: 0, total_words: 0 };
            
            if (stmt.step()) {
                const row = stmt.getAsObject();
                result.total_articles = row.count || 0;
            }
            
            stmt.free();
            return result;
        } catch (e) {
            console.error('Stats error:', e.message);
            return { total_articles: 0, total_words: 0 };
        }
    }
    
    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
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
    
    // Progress callback for download/processing
    const downloadProgress = (progress, downloaded, total) => {
        const downloadedMB = (downloaded / 1024 / 1024).toFixed(1);
        const totalMB = (total / 1024 / 1024).toFixed(1);
        process.stdout.write(`\r📥 Download & process: ${progress.toFixed(1)}% (${downloadedMB}MB / ${totalMB}MB)`);
    };
    
    try {
        // Get dataset info
        const dataset = DATASETS[datasetName];
        if (!dataset) {
            throw new Error(`Unknown dataset: ${datasetName}`);
        }
        
        console.log(`📥 Downloading from ${dataset.url}`);
        console.log('📥 Streaming and processing Wikipedia (no disk writes)...');
        console.log('⏱️  This will take several minutes...');
        
        // Stream directly: HTTP → BZ2 → XML → SQLite (no compressed file saved)
        const result = await downloader.downloadAndStreamProcess(dataset, dbPath, downloadProgress);
        
        return result;
    } catch (error) {
        console.error(`\n❌ Download/process failed: ${error.message}`);
        throw error;
    }
}

module.exports = {
    WikipediaDownloader,
    WikipediaDatabase,
    downloadAndProcessWikipedia,
    DATASETS,
    cleanWikipediaMarkup,
    extractSummary,
    extractCategories,
    isValidArticle
};
