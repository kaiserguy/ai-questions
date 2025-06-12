/**
 * Wikipedia Database Manager for Offline Mode
 * Uses SQL.js (SQLite compiled to WebAssembly) for local Wikipedia storage
 */

class WikipediaManager {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.articles = new Map();
        this.searchIndex = new Map();
        this.mockDB = null;
        
        // Wikipedia package configurations
        this.packages = {
            'minimal': {
                name: 'Essential Articles',
                size: '20MB',
                articleCount: 10000,
                description: 'Top 10,000 most important Wikipedia articles',
                categories: ['science', 'history', 'geography', 'biography']
            },
            'standard': {
                name: 'Simple Wikipedia',
                size: '50MB',
                articleCount: 50000,
                description: 'Simple English Wikipedia subset',
                categories: ['all-basic']
            },
            'full': {
                name: 'Extended Collection',
                size: '200MB',
                articleCount: 200000,
                description: 'Comprehensive article collection',
                categories: ['all-extended']
            }
        };
    }

    async initialize() {
        console.log('📚 Initializing Wikipedia Manager');
        
        try {
            // Check if mock database is available
            if (window.mockWikipediaDB) {
                console.log('Using mock Wikipedia database');
                this.mockDB = window.mockWikipediaDB;
                await this.mockDB.initialize();
            }
            
            // Load SQL.js (SQLite WebAssembly)
            await this.loadSQLJS();
            
            // Try to load cached database
            try {
                const cachedDB = await this.loadCachedDatabase();
                if (cachedDB) {
                    this.db = cachedDB;
                    this.isInitialized = true;
                    console.log('✅ Wikipedia database loaded from cache');
                    return true;
                }
            } catch (error) {
                console.warn('Failed to load cached database:', error);
                // Continue with initialization even if cache loading fails
            }
            
            console.log('📚 Wikipedia Manager initialized (no cached database)');
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Wikipedia Manager:', error);
            
            // Fall back to mock database if available
            if (this.mockDB && this.mockDB.initialized) {
                console.log('Falling back to mock Wikipedia database');
                this.isInitialized = true;
                return true;
            }
            
            return false;
        }
    }

    async loadSQLJS() {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (window.SQL) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
            
            script.onload = async () => {
                try {
                    // Initialize SQL.js
                    const SQL = await window.initSqlJs({
                        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
                    });
                    window.SQL = SQL;
                    console.log('📦 SQL.js loaded and initialized');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async loadCachedDatabase() {
        try {
            // Check if IndexedDB is available
            if (!window.indexedDB) {
                throw new Error('IndexedDB not available');
            }
            
            // Open database
            const dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open('wikipedia-offline', 1);
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    // Create object store if it doesn't exist
                    if (!db.objectStoreNames.contains('database')) {
                        db.createObjectStore('database', { keyPath: 'id' });
                    }
                    
                    if (!db.objectStoreNames.contains('articles')) {
                        db.createObjectStore('articles', { keyPath: 'id' });
                    }
                };
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            const db = await dbPromise;
            
            // Get database from object store
            const getDbPromise = new Promise((resolve, reject) => {
                try {
                    const transaction = db.transaction(['database'], 'readonly');
                    const store = transaction.objectStore('database');
                    const request = store.get('wikipedia');
                    
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                } catch (error) {
                    reject(error);
                }
            });
            
            const result = await getDbPromise;
            
            if (!result || !result.data) {
                throw new Error('No cached database found');
            }
            
            // Create database from cached data
            const SQL = window.SQL;
            return new SQL.Database(result.data);
            
        } catch (error) {
            console.error('Failed to load cached database:', error);
            throw error;
        }
    }

    async cacheDatabase() {
        if (!this.db) {
            throw new Error('No database to cache');
        }
        
        try {
            // Export database to binary array
            const data = this.db.export();
            
            // Store in IndexedDB
            const dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open('wikipedia-offline', 1);
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    // Create object store if it doesn't exist
                    if (!db.objectStoreNames.contains('database')) {
                        db.createObjectStore('database', { keyPath: 'id' });
                    }
                };
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            const db = await dbPromise;
            
            // Store database in object store
            const storePromise = new Promise((resolve, reject) => {
                try {
                    const transaction = db.transaction(['database'], 'readwrite');
                    const store = transaction.objectStore('database');
                    const request = store.put({
                        id: 'wikipedia',
                        data: data,
                        timestamp: Date.now()
                    });
                    
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                } catch (error) {
                    reject(error);
                }
            });
            
            await storePromise;
            console.log('✅ Wikipedia database cached successfully');
            
        } catch (error) {
            console.error('Failed to cache database:', error);
            throw error;
        }
    }

    async downloadWikipediaPackage(packageType, progressCallback) {
        console.log(`📥 Downloading Wikipedia package: ${packageType}`);
        
        const packageConfig = this.packages[packageType];
        if (!packageConfig) {
            throw new Error(`Unknown package type: ${packageType}`);
        }

        try {
            // Create new database
            const SQL = window.SQL;
            this.db = new SQL.Database();
            
            // Create tables
            this.createTables();
            
            // Download and populate articles
            await this.downloadArticles(packageType, progressCallback);
            
            // Create search index
            await this.createSearchIndex();
            
            // Cache the database
            await this.cacheDatabase();
            
            this.isInitialized = true;
            console.log(`✅ Wikipedia package ${packageType} downloaded successfully`);
            
        } catch (error) {
            console.error(`❌ Failed to download Wikipedia package:`, error);
            throw error;
        }
    }

    createTables() {
        console.log('🏗️ Creating Wikipedia database tables');
        
        // Articles table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                summary TEXT,
                categories TEXT,
                links TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Search index table for full-text search
        this.db.run(`
            CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
                title, content, summary, categories
            )
        `);
        
        // Categories table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                article_count INTEGER DEFAULT 0
            )
        `);
        
        console.log('✅ Database tables created');
    }

    async createSearchIndex() {
        console.log('🔍 Creating search index');
        
        try {
            // Get all articles
            const stmt = this.db.prepare(`SELECT id, title, content, summary, categories FROM articles`);
            
            let count = 0;
            while (stmt.step()) {
                const article = stmt.getAsObject();
                
                // Insert into search index
                this.db.run(`
                    INSERT INTO search_index (title, content, summary, categories)
                    VALUES (?, ?, ?, ?)
                `, [
                    article.title,
                    article.content,
                    article.summary || '',
                    article.categories || ''
                ]);
                
                count++;
                
                // Yield control to prevent blocking
                if (count % 100 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }
            
            stmt.free();
            console.log(`✅ Created search index for ${count} articles`);
            
        } catch (error) {
            console.error('Failed to create search index:', error);
            throw error;
        }
    }

    async search(query, limit = 10) {
        if (!this.isInitialized) {
            console.warn('Wikipedia database not initialized');
            return [];
        }

        try {
            console.log(`🔍 Searching Wikipedia for: "${query}"`);
            
            // First try using the real database
            if (this.db) {
                try {
                    // Use FTS5 for full-text search
                    const stmt = this.db.prepare(`
                        SELECT 
                            articles.id,
                            articles.title,
                            articles.summary,
                            articles.content,
                            search_index.rank
                        FROM search_index
                        JOIN articles ON articles.rowid = search_index.rowid
                        WHERE search_index MATCH ?
                        ORDER BY search_index.rank
                        LIMIT ?
                    `);
                    
                    const results = [];
                    stmt.bind([query, limit]);
                    
                    while (stmt.step()) {
                        const row = stmt.getAsObject();
                        results.push({
                            id: row.id,
                            title: row.title,
                            summary: row.summary,
                            content: row.content.substring(0, 500) + '...',
                            relevance: this.calculateRelevance(query, row.title, row.summary)
                        });
                    }
                    
                    stmt.free();
                    
                    if (results.length > 0) {
                        console.log(`✅ Found ${results.length} results for "${query}"`);
                        return results;
                    }
                } catch (error) {
                    console.warn('Error searching real database:', error);
                    // Fall back to mock database
                }
            }
            
            // Fall back to mock database if available
            if (this.mockDB) {
                console.log('Falling back to mock database search');
                return await this.mockDB.search(query, limit);
            }
            
            return [];
            
        } catch (error) {
            console.error('Search error:', error);
            
            // Last resort fallback to mock database
            if (this.mockDB) {
                console.log('Error recovery: using mock database search');
                try {
                    return await this.mockDB.search(query, limit);
                } catch (e) {
                    console.error('Mock database search also failed:', e);
                }
            }
            
            return [];
        }
    }

    calculateRelevance(query, title, summary) {
        const queryLower = query.toLowerCase();
        const titleLower = title.toLowerCase();
        const summaryLower = summary ? summary.toLowerCase() : '';
        
        let score = 0;
        
        // Exact title match gets highest score
        if (titleLower === queryLower) score += 100;
        else if (titleLower.includes(queryLower)) score += 50;
        
        // Summary matches
        if (summaryLower.includes(queryLower)) score += 25;
        
        // Word matches
        const queryWords = queryLower.split(' ');
        queryWords.forEach(word => {
            if (word.length > 2) { // Ignore short words
                if (titleLower.includes(word)) score += 10;
                if (summaryLower.includes(word)) score += 5;
            }
        });
        
        // Normalize score to 0-1 range
        return Math.min(score / 100, 1);
    }

    async getArticle(id) {
        if (!this.isInitialized) {
            return null;
        }

        try {
            // First try real database
            if (this.db) {
                try {
                    const stmt = this.db.prepare(`
                        SELECT * FROM articles WHERE id = ?
                    `);
                    
                    stmt.bind([id]);
                    
                    if (stmt.step()) {
                        const article = stmt.getAsObject();
                        stmt.free();
                        
                        return {
                            ...article,
                            categories: JSON.parse(article.categories || '[]'),
                            links: JSON.parse(article.links || '[]')
                        };
                    }
                    
                    stmt.free();
                } catch (error) {
                    console.warn('Error getting article from real database:', error);
                    // Fall back to mock database
                }
            }
            
            // Fall back to mock database
            if (this.mockDB) {
                return await this.mockDB.getArticle(id);
            }
            
            return null;
            
        } catch (error) {
            console.error('Error getting article:', error);
            return null;
        }
    }

    async getRandomArticle() {
        if (!this.isInitialized) {
            return null;
        }

        try {
            // First try real database
            if (this.db) {
                try {
                    const stmt = this.db.prepare(`
                        SELECT * FROM articles ORDER BY RANDOM() LIMIT 1
                    `);
                    
                    if (stmt.step()) {
                        const article = stmt.getAsObject();
                        stmt.free();
                        
                        return {
                            ...article,
                            categories: JSON.parse(article.categories || '[]'),
                            links: JSON.parse(article.links || '[]')
                        };
                    }
                    
                    stmt.free();
                } catch (error) {
                    console.warn('Error getting random article from real database:', error);
                    // Fall back to mock database
                }
            }
            
            // Fall back to mock database
            if (this.mockDB) {
                return await this.mockDB.getRandomArticle();
            }
            
            return null;
            
        } catch (error) {
            console.error('Error getting random article:', error);
            return null;
        }
    }
}
