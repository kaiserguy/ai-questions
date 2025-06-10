// Wikipedia Database Manager for Offline Mode
// Uses SQL.js (SQLite compiled to WebAssembly) for local Wikipedia storage

class WikipediaManager {
    constructor() {
        this.db = null;
        this.isInitialized = false;
        this.articles = new Map();
        this.searchIndex = new Map();
        
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
            // Load SQL.js (SQLite WebAssembly)
            await this.loadSQLJS();
            
            // Check if we have a cached database
            const cachedDB = await this.loadCachedDatabase();
            if (cachedDB) {
                this.db = cachedDB;
                this.isInitialized = true;
                console.log('✅ Wikipedia database loaded from cache');
                return true;
            }
            
            console.log('📚 Wikipedia Manager initialized (no cached database)');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Wikipedia Manager:', error);
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
        
        // Search index table for full-text search
        this.db.run(`
            CREATE VIRTUAL TABLE search_index USING fts5(
                title, content, summary, categories
            )
        `);
        
        // Categories table
        this.db.run(`
            CREATE TABLE categories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                article_count INTEGER DEFAULT 0
            )
        `);
        
        console.log('✅ Database tables created');
    }

    async downloadArticles(packageType, progressCallback) {
        console.log(`📄 Downloading articles for ${packageType} package`);
        
        const packageConfig = this.packages[packageType];
        const articles = await this.generateSampleArticles(packageConfig);
        
        let processed = 0;
        const total = articles.length;
        
        // Insert articles in batches for better performance
        const batchSize = 100;
        for (let i = 0; i < articles.length; i += batchSize) {
            const batch = articles.slice(i, i + batchSize);
            
            // Prepare batch insert
            const stmt = this.db.prepare(`
                INSERT INTO articles (title, content, summary, categories, links)
                VALUES (?, ?, ?, ?, ?)
            `);
            
            for (const article of batch) {
                stmt.run([
                    article.title,
                    article.content,
                    article.summary,
                    JSON.stringify(article.categories),
                    JSON.stringify(article.links)
                ]);
                
                // Also insert into search index
                this.db.run(`
                    INSERT INTO search_index (title, content, summary, categories)
                    VALUES (?, ?, ?, ?)
                `, [
                    article.title,
                    article.content,
                    article.summary,
                    article.categories.join(' ')
                ]);
                
                processed++;
                
                // Update progress
                const progress = (processed / total) * 100;
                progressCallback?.(Math.round(progress));
                
                // Yield control to prevent blocking
                if (processed % 50 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }
            
            stmt.free();
        }
        
        console.log(`✅ Downloaded ${processed} articles`);
    }

    async generateSampleArticles(packageConfig) {
        // Generate sample Wikipedia-style articles
        // In a real implementation, this would download from Wikipedia API
        
        const sampleTopics = [
            'Artificial Intelligence', 'Machine Learning', 'Computer Science', 'Physics', 'Chemistry',
            'Biology', 'Mathematics', 'History', 'Geography', 'Literature', 'Philosophy', 'Psychology',
            'Economics', 'Politics', 'Sociology', 'Anthropology', 'Astronomy', 'Earth Science',
            'Climate Change', 'Renewable Energy', 'Space Exploration', 'Quantum Computing',
            'Biotechnology', 'Nanotechnology', 'Robotics', 'Internet', 'World War II', 'Renaissance',
            'Ancient Rome', 'Ancient Greece', 'Ancient Egypt', 'Industrial Revolution', 'Democracy',
            'Human Rights', 'United Nations', 'European Union', 'Global Warming', 'Biodiversity',
            'Evolution', 'DNA', 'Genetics', 'Neuroscience', 'Medicine', 'Vaccines', 'Antibiotics',
            'Cancer Research', 'Mental Health', 'Nutrition', 'Exercise', 'Sleep', 'Meditation'
        ];
        
        const articles = [];
        const targetCount = Math.min(packageConfig.articleCount, sampleTopics.length * 20);
        
        for (let i = 0; i < targetCount; i++) {
            const baseTopic = sampleTopics[i % sampleTopics.length];
            const variation = Math.floor(i / sampleTopics.length);
            
            let title = baseTopic;
            if (variation > 0) {
                title += ` (${this.getVariationSuffix(variation)})`;
            }
            
            const article = {
                title: title,
                content: this.generateArticleContent(title),
                summary: this.generateSummary(title),
                categories: this.generateCategories(title),
                links: this.generateLinks(title)
            };
            
            articles.push(article);
        }
        
        return articles;
    }

    getVariationSuffix(variation) {
        const suffixes = ['History', 'Applications', 'Research', 'Theory', 'Development', 'Impact', 'Future', 'Ethics', 'Technology', 'Science'];
        return suffixes[variation % suffixes.length];
    }

    generateArticleContent(title) {
        const templates = [
            `${title} is a significant topic in modern science and technology. It encompasses various aspects including theoretical foundations, practical applications, and ongoing research developments. The field has evolved considerably over the past decades, with numerous breakthroughs contributing to our understanding.

Historical Development:
The concept of ${title} emerged from early theoretical work and has since developed into a comprehensive field of study. Key milestones include foundational research, technological advances, and practical implementations.

Current Applications:
Today, ${title} finds applications in numerous domains including research, industry, and everyday life. These applications demonstrate the practical value and importance of continued development in this area.

Future Prospects:
Ongoing research in ${title} promises exciting developments and potential breakthroughs. Scientists and researchers continue to explore new possibilities and applications.`,

            `${title} represents an important area of knowledge with wide-ranging implications. This field combines theoretical understanding with practical applications, making it relevant to both academic research and real-world problem-solving.

Key Concepts:
The fundamental principles underlying ${title} provide a framework for understanding its various aspects. These concepts form the basis for further exploration and development.

Research and Development:
Active research in ${title} continues to advance our knowledge and capabilities. Current projects focus on addressing challenges and exploring new opportunities.

Impact and Significance:
The influence of ${title} extends beyond its immediate domain, affecting related fields and contributing to broader scientific and technological progress.`
        ];
        
        return templates[Math.floor(Math.random() * templates.length)];
    }

    generateSummary(title) {
        return `${title} is an important topic covering theoretical foundations, practical applications, and ongoing research developments in the field.`;
    }

    generateCategories(title) {
        const categoryMap = {
            'Artificial Intelligence': ['technology', 'computer-science', 'ai'],
            'Machine Learning': ['technology', 'computer-science', 'ai', 'data-science'],
            'Physics': ['science', 'physics', 'natural-science'],
            'Chemistry': ['science', 'chemistry', 'natural-science'],
            'Biology': ['science', 'biology', 'life-science'],
            'History': ['humanities', 'history', 'social-science'],
            'Geography': ['science', 'geography', 'earth-science']
        };
        
        return categoryMap[title] || ['general', 'knowledge'];
    }

    generateLinks(title) {
        // Generate related article links
        const relatedTopics = [
            'Science', 'Technology', 'Research', 'Development', 'Theory', 'Application'
        ];
        
        return relatedTopics.slice(0, 3).map(topic => `${topic} and ${title}`);
    }

    async search(query, limit = 10) {
        if (!this.isInitialized || !this.db) {
            console.warn('Wikipedia database not initialized');
            return [];
        }

        try {
            console.log(`🔍 Searching Wikipedia for: "${query}"`);
            
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
            
            console.log(`✅ Found ${results.length} results for "${query}"`);
            return results;
            
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    calculateRelevance(query, title, summary) {
        const queryLower = query.toLowerCase();
        const titleLower = title.toLowerCase();
        const summaryLower = summary.toLowerCase();
        
        let score = 0;
        
        // Exact title match gets highest score
        if (titleLower === queryLower) score += 100;
        else if (titleLower.includes(queryLower)) score += 50;
        
        // Summary matches
        if (summaryLower.includes(queryLower)) score += 25;
        
        // Word matches
        const queryWords = queryLower.split(' ');
        queryWords.forEach(word => {
            if (titleLower.includes(word)) score += 10;
            if (summaryLower.includes(word)) score += 5;
        });
        
        return score;
    }

    async getArticle(id) {
        if (!this.isInitialized || !this.db) {
            return null;
        }

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
            return null;
            
        } catch (error) {
            console.error('Error getting article:', error);
            return null;
        }
    }

    async getRandomArticle() {
        if (!this.isInitialized || !this.db) {
            return null;
        }

        try {
            const stmt = this.db.prepare(`
                SELECT * FROM articles ORDER BY RANDOM() LIMIT 1
            `);
            
            if (stmt.step()) {
                const article = stmt.getAsObject();
                stmt.free();
                return article;
            }
            
            stmt.free();
            return null;
            
        } catch (error) {
            console.error('Error getting random article:', error);
            return null;
        }
    }

    async getStats() {
        if (!this.isInitialized || !this.db) {
            return { articleCount: 0, categories: 0, size: 0 };
        }

        try {
            const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM articles');
            countStmt.step();
            const articleCount = countStmt.getAsObject().count;
            countStmt.free();
            
            const categoryStmt = this.db.prepare('SELECT COUNT(DISTINCT categories) as count FROM articles');
            categoryStmt.step();
            const categoryCount = categoryStmt.getAsObject().count;
            categoryStmt.free();
            
            // Estimate database size
            const sizeBytes = this.db.export().length;
            
            return {
                articleCount,
                categories: categoryCount,
                size: this.formatBytes(sizeBytes)
            };
            
        } catch (error) {
            console.error('Error getting stats:', error);
            return { articleCount: 0, categories: 0, size: '0 B' };
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async cacheDatabase() {
        try {
            const data = this.db.export();
            const db = await this.openIndexedDB();
            const transaction = db.transaction(['wikipedia'], 'readwrite');
            const store = transaction.objectStore('wikipedia');
            
            await this.promisifyRequest(store.put({
                id: 'database',
                data: data,
                cachedAt: new Date(),
                version: '1.0'
            }));
            
            console.log('💾 Wikipedia database cached');
        } catch (error) {
            console.error('Failed to cache database:', error);
        }
    }

    async loadCachedDatabase() {
        try {
            const db = await this.openIndexedDB();
            const transaction = db.transaction(['wikipedia'], 'readonly');
            const store = transaction.objectStore('wikipedia');
            const result = await this.promisifyRequest(store.get('database'));
            
            if (result && result.data) {
                const SQL = window.SQL;
                this.db = new SQL.Database(new Uint8Array(result.data));
                console.log('📚 Loaded cached Wikipedia database');
                return this.db;
            }
            
            return null;
        } catch (error) {
            console.error('Failed to load cached database:', error);
            return null;
        }
    }

    async createSearchIndex() {
        console.log('🔍 Creating search index...');
        // Search index is created during article insertion
        console.log('✅ Search index created');
    }

    async openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AIQuestionsOffline', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('wikipedia')) {
                    db.createObjectStore('wikipedia', { keyPath: 'id' });
                }
            };
        });
    }

    promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WikipediaManager;
} else {
    window.WikipediaManager = WikipediaManager;
}

