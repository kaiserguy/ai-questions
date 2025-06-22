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
                path: '/offline/wikipedia/minimal-wikipedia.sqlite',
                size: '20MB',
                articles: '~10,000 articles'
            },
            standard: {
                path: '/offline/wikipedia/simple-wikipedia.sqlite',
                size: '50MB',
                articles: '~100,000 articles'
            },
            full: {
                path: '/offline/wikipedia/extended-wikipedia.sqlite',
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
            
            // In a real implementation, this would load the actual library
            // For now, we'll simulate loading
            setTimeout(() => {
                // Simulate the SQL global object
                window.SQL = {
                    Database: class {
                        constructor(data) {
                            this.data = data;
                            this.tables = ['articles', 'categories', 'redirects'];
                        }
                        
                        exec(sql) {
                            // Simulate SQL execution
                            console.log(`Executing SQL: ${sql}`);
                            return [];
                        }
                        
                        prepare(sql) {
                            // Simulate prepared statement
                            return {
                                bind: (params) => {},
                                step: () => false,
                                get: () => ({}),
                                getAsObject: () => ({}),
                                getColumnNames: () => [],
                                free: () => {}
                            };
                        }
                    }
                };
                
                this.updateStatus('SQL.js loaded');
                resolve();
            }, 1000);
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
            // Try to load the actual database file
            const response = await fetch(config.path);
            
            if (!response.ok) {
                throw new Error(`Failed to load database: ${response.status} ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Create SQL.js database from the loaded data
            this.db = new window.SQL.Database(uint8Array);
            
            this.updateStatus(`Wikipedia database loaded successfully (${config.articles})`);
            
        } catch (error) {
            console.warn('Failed to load real Wikipedia database, using fallback:', error);
            
            // Fallback to a minimal in-memory database with basic articles
            this.createFallbackDatabase();
            
            this.updateStatus('Using fallback Wikipedia database');
        }
    }
    
    /**
     * Create a fallback in-memory database with basic articles
     */
    createFallbackDatabase() {
        // Create an empty database
        this.db = new window.SQL.Database();
        
        // Create articles table
        this.db.exec(`
            CREATE TABLE articles (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                summary TEXT,
                categories TEXT
            );
        `);
        
        // Insert some basic articles
        const basicArticles = [
            {
                title: 'Poland',
                content: 'Poland, officially the Republic of Poland, is a country in Central Europe. It is divided into 16 administrative provinces called voivodeships, covering an area of 312,696 square kilometres (120,733 sq mi), and has a largely temperate seasonal climate. With a population of nearly 38.5 million people, Poland is the fifth-most populous member state of the European Union.',
                summary: 'Poland is a country in Central Europe with a population of nearly 38.5 million people.',
                categories: 'Countries, Europe, Central Europe'
            },
            {
                title: 'Artificial Intelligence',
                content: 'Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.',
                summary: 'Intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans.',
                categories: 'Computer Science, Technology, Machine Learning'
            },
            {
                title: 'Wikipedia',
                content: 'Wikipedia is a multilingual free online encyclopedia written and maintained by a community of volunteers through open collaboration and a wiki-based editing system. Individual contributors, also called editors, are known as Wikipedians. Wikipedia is the largest and most-read reference work in history.',
                summary: 'A multilingual free online encyclopedia written and maintained by a community of volunteers.',
                categories: 'Encyclopedias, Websites, Knowledge'
            }
        ];
        
        // Insert the articles
        const stmt = this.db.prepare('INSERT INTO articles (title, content, summary, categories) VALUES (?, ?, ?, ?)');
        
        basicArticles.forEach(article => {
            stmt.bind([article.title, article.content, article.summary, article.categories]);
            stmt.step();
        });
        
        stmt.free();
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
            const limit = options.limit || 10;
            
            // Search for articles matching the query
            const searchSQL = `
                SELECT title, summary, content, categories
                FROM articles 
                WHERE title LIKE ? OR content LIKE ? OR summary LIKE ?
                LIMIT ?
            `;
            
            const searchTerm = `%${query}%`;
            const stmt = this.db.prepare(searchSQL);
            stmt.bind([searchTerm, searchTerm, searchTerm, limit]);
            
            const results = [];
            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push({
                    title: row.title,
                    snippet: row.summary || row.content.substring(0, 200) + '...',
                    extract: row.summary,
                    content: row.content,
                    categories: row.categories
                });
            }
            
            stmt.free();
            
            this.updateStatus(`Found ${results.length} Wikipedia articles`);
            return results;
            
        } catch (error) {
            console.error('Wikipedia search error:', error);
            this.updateStatus(`Search error: ${error.message}`, 'error');
            return [];
        }
    }
    
    /**
     * Get a specific Wikipedia article
     */
    async getArticle(titleOrId) {
        if (!this.initialized) {
            throw new Error('Wikipedia manager not initialized');
        }
        
        try {
            const stmt = this.db.prepare('SELECT * FROM articles WHERE title = ? OR id = ?');
            stmt.bind([titleOrId, titleOrId]);
            
            if (stmt.step()) {
                const article = stmt.getAsObject();
                stmt.free();
                return article;
            }
            
            stmt.free();
            return null;
            
        } catch (error) {
            console.error('Error getting Wikipedia article:', error);
            return null;
        }
    }
    
    /**
     * Update status message
     */
    updateStatus(message, type = 'info') {
        console.log(`📚 Wikipedia: ${message}`);
        
        if (this.onStatusUpdate) {
            this.onStatusUpdate(message, type);
        }
    }
}

// Make available globally
window.WikipediaManager = WikipediaManager;
