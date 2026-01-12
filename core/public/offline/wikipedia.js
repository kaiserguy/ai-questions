/**
 * Wikipedia Manager for Offline Mode
 * Handles loading and searching the local Wikipedia database
 */
class WikipediaManager {
    constructor(packageType) {
        this.packageType = packageType;
        this.db = null;
        this.initialized = false;
        this.isLoading = false;
        this.loadingProgress = 0;
        this.onStatusUpdate = null;
        this.onDatabaseLoaded = null;
        
        // Database configurations based on package type
        this.dbConfigs = {
            minimal: {
                path: '/offline-resources/wikipedia/minimal-wikipedia.sqlite',
                size: '20MB',
                articles: '~10,000 articles'
            },
            standard: {
                path: '/offline-resources/wikipedia/simple-wikipedia.sqlite',
                size: '50MB',
                articles: '~100,000 articles'
            },
            full: {
                path: '/offline-resources/wikipedia/extended-wikipedia.sqlite',
                size: '200MB',
                articles: '~500,000 articles'
            }
        };
    }
    
    /**
     * Set event handlers for status updates
     */
    setEventHandlers(handlers) {
        this.onStatusUpdate = handlers.onStatusUpdate || null;
        this.onDatabaseLoaded = handlers.onDatabaseLoaded || null;
    }
    
    /**
     * Initialize the Wikipedia manager
     */
    async initialize() {
        if (this.initialized || this.isLoading) {
            return;
        }
        
        this.isLoading = true;
        this.loadingProgress = 0;
        
        try {
            this.updateStatus('Initializing Wikipedia database...');
            
            // Load SQL.js library
            await this.loadSQLLibrary();
            
            // Load database based on package type
            await this.loadDatabase();
            
            this.initialized = true;
            this.isLoading = false;
            this.loadingProgress = 100;
            
            this.updateStatus('Wikipedia database initialized successfully');
            
            if (this.onDatabaseLoaded) {
                this.onDatabaseLoaded();
            }
        } catch (error) {
            this.isLoading = false;
            this.updateStatus(`Error initializing Wikipedia database: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Load the SQL.js library
     */
    async loadSQLLibrary() {
        return new Promise((resolve, reject) => {
            // Check if SQL.js is already loaded
            if (window.SQL) {
                this.updateStatus('SQL.js already loaded');
                resolve();
                return;
            }
            
            this.updateStatus('Loading SQL.js library...');
            
            // Load SQL.js from CDN
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
            script.onload = async () => {
                try {
                    // Initialize SQL.js with WASM
                    const SQL = await window.initSqlJs({
                        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
                    });
                    window.SQL = SQL;
                    this.updateStatus('SQL.js library loaded successfully');
                    resolve();
                } catch (error) {
                    this.updateStatus(`Error initializing SQL.js: ${error.message}`, 'error');
                    reject(error);
                }
            };
            script.onerror = () => {
                const error = new Error('Failed to load SQL.js library');
                this.updateStatus(error.message, 'error');
                reject(error);
            };
            document.head.appendChild(script);
        });
    }
    
    /**
     * Load the Wikipedia database
     */
    async loadDatabase() {
        const config = this.dbConfigs[this.packageType];
        
        if (!config) {
            throw new Error(`No database configuration found for package type: ${this.packageType}`);
        }
        
        this.updateStatus(`Loading Wikipedia database (${config.articles})...`);
        
        try {
            // Fetch the SQLite database file
            const response = await fetch(config.path);
            if (!response.ok) {
                throw new Error(`Failed to fetch database: ${response.status} ${response.statusText}`);
            }
            
            // Get the database as an ArrayBuffer
            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Create the SQL.js database instance
            this.db = new window.SQL.Database(uint8Array);
            
            // Verify database structure
            const tables = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");
            if (tables.length === 0) {
                throw new Error('Database appears to be empty or corrupted');
            }
            
            this.updateStatus('Wikipedia database loaded successfully');
            
        } catch (error) {
            // If database file doesn't exist, create a minimal working database
            if (error.message.includes('404') || error.message.includes('Failed to fetch')) {
                this.updateStatus('Database file not found, creating minimal database...');
                await this.createMinimalDatabase();
            } else {
                throw error;
            }
        }
    }
    
    /**
     * Create a minimal Wikipedia database for testing
     */
    async createMinimalDatabase() {
        // Create an empty database
        this.db = new window.SQL.Database();
        
        // Create the articles table
        this.db.run(`
            CREATE TABLE articles (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                summary TEXT,
                categories TEXT,
                links TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Insert some basic articles
        const basicArticles = [
            {
                title: 'Artificial Intelligence',
                summary: 'Artificial intelligence (AI) is intelligence exhibited by machines, in contrast to the natural intelligence displayed by humans and animals.',
                content: 'Artificial intelligence (AI) is intelligence exhibited by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of "intelligent agents": any device that perceives its environment and takes actions that maximize its chance of successfully achieving its goals. Colloquially, the term "artificial intelligence" is often used to describe machines (or computers) that mimic "cognitive" functions that humans associate with the human mind, such as "learning" and "problem solving".',
                categories: 'Technology,Computer Science,AI',
                links: 'Machine Learning,Computer Science,Neural Networks'
            },
            {
                title: 'Machine Learning',
                summary: 'Machine learning (ML) is a field of inquiry devoted to understanding and building methods that "learn".',
                content: 'Machine learning (ML) is a field of inquiry devoted to understanding and building methods that "learn", that is, methods that leverage data to improve performance on some set of tasks. It is seen as a part of artificial intelligence. Machine learning algorithms build a model based on training data in order to make predictions or decisions without being explicitly programmed to do so.',
                categories: 'Technology,Computer Science,AI',
                links: 'Artificial Intelligence,Neural Networks,Deep Learning'
            },
            {
                title: 'Computer Science',
                summary: 'Computer science is the study of algorithmic processes, computational systems and the design of computer systems.',
                content: 'Computer science is the study of algorithmic processes, computational systems and the design of computer systems and their applications. It includes the study of the structure, expression, and algorithms that underlie the acquisition, representation, processing, storage, communication of, and access to information.',
                categories: 'Technology,Science,Computing',
                links: 'Programming,Algorithms,Software Engineering'
            }
        ];
        
        const insertStmt = this.db.prepare(`
            INSERT INTO articles (title, summary, content, categories, links)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        basicArticles.forEach(article => {
            insertStmt.run([
                article.title,
                article.summary,
                article.content,
                article.categories,
                article.links
            ]);
        });
        
        insertStmt.free();
        
        this.updateStatus('Minimal Wikipedia database created with basic articles');
    }
    
    /**
     * Search the Wikipedia database
     */
    async search(query, options = {}) {
        if (!this.initialized) {
            throw new Error('Wikipedia manager not initialized');
        }
        
        this.updateStatus(`Searching Wikipedia for: "${query}"`);
        
        try {
            // Process database search
            const results = await this.searchDatabase(query, options);
            
            this.updateStatus(`Found ${results.length} results for "${query}"`);
            return results;
        } catch (error) {
            this.updateStatus(`Error searching Wikipedia: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Get a Wikipedia article by ID or title
     */
    async getArticle(idOrTitle) {
        if (!this.initialized) {
            throw new Error('Wikipedia manager not initialized');
        }
        
        this.updateStatus(`Getting Wikipedia article: ${idOrTitle}`);
        
        try {
            // Process article retrieval from local database
            const article = await this.getArticleFromDatabase(idOrTitle);
            
            this.updateStatus(`Retrieved article: ${article.title}`);
            return article;
        } catch (error) {
            this.updateStatus(`Error getting article: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Search Wikipedia database
     */
    async searchDatabase(query, options = {}) {
        if (!this.db) {
            throw new Error('Database not loaded');
        }
        
        const limit = options.limit || 10;
        const results = [];
        
        try {
            // Search for articles matching the query in title or content
            const searchStmt = this.db.prepare(`
                SELECT id, title, summary, categories, links,
                       CASE 
                           WHEN title LIKE ? THEN 100
                           WHEN title LIKE ? THEN 90
                           WHEN summary LIKE ? THEN 70
                           WHEN content LIKE ? THEN 50
                           ELSE 0
                       END as relevance_score
                FROM articles 
                WHERE title LIKE ? OR summary LIKE ? OR content LIKE ?
                ORDER BY relevance_score DESC, title ASC
                LIMIT ?
            `);
            
            const searchTerm = `%${query}%`;
            const exactTitle = query;
            const titleStart = `${query}%`;
            
            searchStmt.bind([
                exactTitle, titleStart, searchTerm, searchTerm,
                searchTerm, searchTerm, searchTerm, limit
            ]);
            
            while (searchStmt.step()) {
                const row = searchStmt.getAsObject();
                results.push({
                    id: row.id,
                    title: row.title,
                    summary: row.summary || 'No summary available',
                    categories: row.categories ? row.categories.split(',') : [],
                    links: row.links ? row.links.split(',') : [],
                    relevance: row.relevance_score / 100
                });
            }
            
            searchStmt.free();
            
        } catch (error) {
            console.error('Database search error:', error);
            throw new Error(`Search failed: ${error.message}`);
        }
        
        return results;
    }
    
    /**
     * Get Wikipedia article from database
     */
    async getArticleFromDatabase(idOrTitle) {
        if (!this.db) {
            throw new Error('Database not loaded');
        }
        
        try {
            let stmt;
            let params;
            
            if (typeof idOrTitle === 'number') {
                stmt = this.db.prepare('SELECT * FROM articles WHERE id = ?');
                params = [idOrTitle];
            } else {
                stmt = this.db.prepare('SELECT * FROM articles WHERE title = ? OR title LIKE ?');
                params = [idOrTitle, `%${idOrTitle}%`];
            }
            
            stmt.bind(params);
            
            if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                
                return {
                    id: row.id,
                    title: row.title,
                    content: row.content,
                    summary: row.summary,
                    categories: row.categories ? row.categories.split(',') : [],
                    links: row.links ? row.links.split(',') : [],
                    lastModified: row.created_at
                };
            } else {
                stmt.free();
                throw new Error(`Article not found: ${idOrTitle}`);
            }
            
        } catch (error) {
            console.error('Database article retrieval error:', error);
            throw new Error(`Failed to retrieve article: ${error.message}`);
        }
    }
    
    /**
     * Update status and notify listeners
     */
    updateStatus(message, status = 'info') {
        console.log(`[WikipediaManager] ${message}`);
        
        if (this.onStatusUpdate) {
            this.onStatusUpdate(message, status);
        }
    }
    
    /**
     * Get database info
     */
    getDatabaseInfo() {
        const config = this.dbConfigs[this.packageType];
        if (!config) {
            return null;
        }
        
        return {
            size: config.size,
            articles: config.articles,
            packageType: this.packageType
        };
    }
}

// Make available globally
window.WikipediaManager = WikipediaManager;
