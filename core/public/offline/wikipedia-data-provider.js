/**
 * Wikipedia Data Provider - Abstract interface for Wikipedia data access
 * Supports both server-side (API) and client-side (SQLite) implementations
 */

class WikipediaDataProvider {
    /**
     * Search for articles
     * @param {string} query - Search query
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>} Array of articles
     */
    async search(query, limit = 10) {
        throw new Error('search() must be implemented');
    }

    /**
     * Get random articles
     * @param {number} count - Number of random articles
     * @returns {Promise<Array>} Array of articles
     */
    async getRandomArticles(count = 5) {
        throw new Error('getRandomArticles() must be implemented');
    }

    /**
     * Get database statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        throw new Error('getStatistics() must be implemented');
    }

    /**
     * Get article by ID or title
     * @param {string|number} idOrTitle - Article ID or title
     * @returns {Promise<Object>} Article object
     */
    async getArticle(idOrTitle) {
        throw new Error('getArticle() must be implemented');
    }

    /**
     * Get all unique categories
     * @returns {Promise<Array>} Array of category names
     */
    async getCategories() {
        throw new Error('getCategories() must be implemented');
    }

    /**
     * Get articles by category
     * @param {string} category - Category name
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>} Array of articles
     */
    async getArticlesByCategory(category, limit = 20) {
        throw new Error('getArticlesByCategory() must be implemented');
    }
}

/**
 * Server-side provider using API endpoints
 */
class WikipediaServerProvider extends WikipediaDataProvider {
    async search(query, limit = 10) {
        const response = await fetch(`/api/wikipedia/search?query=${encodeURIComponent(query)}&limit=${limit}`);
        return response.json();
    }

    async getRandomArticles(count = 5) {
        const response = await fetch(`/api/wikipedia/random?count=${count}`);
        return response.json();
    }

    async getStatistics() {
        const response = await fetch('/api/wikipedia/stats');
        return response.json();
    }

    async getArticle(idOrTitle) {
        const response = await fetch(`/api/wikipedia/article?id=${encodeURIComponent(idOrTitle)}`);
        return response.json();
    }

    async getCategories() {
        const response = await fetch('/api/wikipedia/categories');
        return response.json();
    }

    async getArticlesByCategory(category, limit = 20) {
        const response = await fetch(`/api/wikipedia/category/${encodeURIComponent(category)}?limit=${limit}`);
        return response.json();
    }
}

/**
 * Client-side provider using SQL.js database
 */
class WikipediaClientProvider extends WikipediaDataProvider {
    constructor(database) {
        super();
        this.db = database;
    }

    async search(query, limit = 10) {
        if (!this.db) throw new Error('Database not initialized');

        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        const likeConditions = terms.map((term, i) => 
            `(title LIKE '%${term}%' OR content LIKE '%${term}%' OR summary LIKE '%${term}%')`
        ).join(' OR ');

        const sql = `
            SELECT id, title, summary, categories, word_count
            FROM wikipedia_articles
            WHERE ${likeConditions}
            ORDER BY word_count DESC
            LIMIT ${limit}
        `;

        const stmt = this.db.prepare(sql);
        const results = [];

        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push({
                id: row.id,
                title: row.title,
                summary: row.summary,
                categories: row.categories ? row.categories.split(',') : [],
                word_count: row.word_count
            });
        }
        stmt.free();

        return results;
    }

    async getRandomArticles(count = 5) {
        if (!this.db) throw new Error('Database not initialized');

        const sql = `
            SELECT id, title, summary, categories
            FROM wikipedia_articles
            ORDER BY RANDOM()
            LIMIT ${count}
        `;

        const stmt = this.db.prepare(sql);
        const results = [];

        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push({
                id: row.id,
                title: row.title,
                summary: row.summary,
                categories: row.categories ? row.categories.split(',') : []
            });
        }
        stmt.free();

        return results;
    }

    async getStatistics() {
        if (!this.db) throw new Error('Database not initialized');

        const stats = {};

        // Total articles
        let stmt = this.db.prepare('SELECT COUNT(*) as count FROM wikipedia_articles');
        stmt.step();
        stats.totalArticles = stmt.getAsObject().count;
        stmt.free();

        // Average word count
        stmt = this.db.prepare('SELECT AVG(word_count) as avg FROM wikipedia_articles');
        stmt.step();
        stats.averageWordCount = Math.round(stmt.getAsObject().avg || 0);
        stmt.free();

        // Total categories
        stmt = this.db.prepare('SELECT COUNT(DISTINCT categories) as count FROM wikipedia_articles WHERE categories IS NOT NULL');
        stmt.step();
        stats.totalCategories = stmt.getAsObject().count;
        stmt.free();

        return stats;
    }

    async getArticle(idOrTitle) {
        if (!this.db) throw new Error('Database not initialized');

        const isId = typeof idOrTitle === 'number' || /^\d+$/.test(idOrTitle);
        const sql = isId
            ? `SELECT * FROM wikipedia_articles WHERE id = ${idOrTitle} LIMIT 1`
            : `SELECT * FROM wikipedia_articles WHERE title = ? LIMIT 1`;

        const stmt = this.db.prepare(sql);
        if (!isId) stmt.bind([idOrTitle]);

        let article = null;
        if (stmt.step()) {
            const row = stmt.getAsObject();
            article = {
                id: row.id,
                title: row.title,
                content: row.content,
                summary: row.summary,
                categories: row.categories ? row.categories.split(',') : [],
                word_count: row.word_count
            };
        }
        stmt.free();

        return article;
    }

    async getCategories() {
        if (!this.db) throw new Error('Database not initialized');

        const sql = 'SELECT DISTINCT categories FROM wikipedia_articles WHERE categories IS NOT NULL LIMIT 100';
        const stmt = this.db.prepare(sql);
        
        const categoriesSet = new Set();
        while (stmt.step()) {
            const row = stmt.getAsObject();
            if (row.categories) {
                const cats = row.categories.split(',');
                cats.forEach(cat => categoriesSet.add(cat.trim()));
            }
        }
        stmt.free();

        return Array.from(categoriesSet).sort();
    }

    async getArticlesByCategory(category, limit = 20) {
        if (!this.db) throw new Error('Database not initialized');

        const sql = `
            SELECT id, title, summary, categories
            FROM wikipedia_articles
            WHERE categories LIKE '%${category}%'
            LIMIT ${limit}
        `;

        const stmt = this.db.prepare(sql);
        const results = [];

        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push({
                id: row.id,
                title: row.title,
                summary: row.summary,
                categories: row.categories ? row.categories.split(',') : []
            });
        }
        stmt.free();

        return results;
    }
}

// Export for both browser and Node.js
if (typeof window !== 'undefined') {
    window.WikipediaDataProvider = WikipediaDataProvider;
    window.WikipediaServerProvider = WikipediaServerProvider;
    window.WikipediaClientProvider = WikipediaClientProvider;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WikipediaDataProvider,
        WikipediaServerProvider,
        WikipediaClientProvider
    };
}
