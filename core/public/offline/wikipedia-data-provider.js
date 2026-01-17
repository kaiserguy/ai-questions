/**
 * Wikipedia Data Provider - Abstract interface for Wikipedia data access
 * Supports both server-side (API) and client-side (SQLite) implementations
 */

/**
 * Escape special SQL characters to prevent SQL injection
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeSqlString(str) {
    if (typeof str !== 'string') return str;
    // Escape single quotes by doubling them, and escape backslashes
    return str.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

/**
 * Sanitize and validate a limit parameter
 * @param {number} limit - The limit value
 * @param {number} maxLimit - Maximum allowed limit
 * @returns {number} Safe limit value
 */
function sanitizeLimit(limit, maxLimit = 100) {
    const parsed = parseInt(limit, 10);
    if (Number.isNaN(parsed) || parsed < 1) return 10;
    return Math.min(parsed, maxLimit);
}

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
        const safeLimit = sanitizeLimit(limit);
        const response = await fetch(`/api/wikipedia/search?query=${encodeURIComponent(query)}&limit=${safeLimit}`);
        if (!response.ok) {
            throw new Error(`Search failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async getRandomArticles(count = 5) {
        const safeCount = sanitizeLimit(count, 20);
        const response = await fetch(`/api/wikipedia/random?count=${safeCount}`);
        if (!response.ok) {
            throw new Error(`Failed to get random articles: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async getStatistics() {
        const response = await fetch('/api/wikipedia/stats');
        if (!response.ok) {
            throw new Error(`Failed to get statistics: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async getArticle(idOrTitle) {
        const response = await fetch(`/api/wikipedia/article?id=${encodeURIComponent(idOrTitle)}`);
        if (!response.ok) {
            throw new Error(`Failed to get article: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async getCategories() {
        const response = await fetch('/api/wikipedia/categories');
        if (!response.ok) {
            throw new Error(`Failed to get categories: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async getArticlesByCategory(category, limit = 20) {
        const safeLimit = sanitizeLimit(limit);
        const response = await fetch(`/api/wikipedia/category/${encodeURIComponent(category)}?limit=${safeLimit}`);
        if (!response.ok) {
            throw new Error(`Failed to get articles by category: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
}

/**
 * Client-side provider using SQL.js database
 * Uses parameterized queries to prevent SQL injection
 */
class WikipediaClientProvider extends WikipediaDataProvider {
    constructor(database) {
        super();
        this.db = database;
    }

    async search(query, limit = 10) {
        if (!this.db) throw new Error('Database not initialized');

        const safeLimit = sanitizeLimit(limit);
        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        
        if (terms.length === 0) {
            return [];
        }

        // Build parameterized query with conditions
        const conditions = [];
        const params = [];
        
        terms.forEach((term) => {
            const escapedTerm = '%' + escapeSqlString(term) + '%';
            conditions.push(`(title LIKE ? OR content LIKE ? OR summary LIKE ?)`);
            params.push(escapedTerm, escapedTerm, escapedTerm);
        });

        const sql = `
            SELECT id, title, summary, categories, word_count
            FROM wikipedia_articles
            WHERE ${conditions.join(' OR ')}
            ORDER BY word_count DESC
            LIMIT ?
        `;
        params.push(safeLimit);

        const stmt = this.db.prepare(sql);
        stmt.bind(params);
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

        const safeCount = sanitizeLimit(count, 20);
        const sql = `
            SELECT id, title, summary, categories
            FROM wikipedia_articles
            ORDER BY RANDOM()
            LIMIT ?
        `;

        const stmt = this.db.prepare(sql);
        stmt.bind([safeCount]);
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

        const idOrTitleStr = String(idOrTitle);
        const isId = typeof idOrTitle === 'number' || /^\d+$/.test(idOrTitleStr);
        
        // Use parameterized query for both cases
        const sql = `SELECT * FROM wikipedia_articles WHERE ${isId ? 'id' : 'title'} = ? LIMIT 1`;
        const boundValue = isId ? Number(idOrTitleStr) : idOrTitle;

        const stmt = this.db.prepare(sql);
        stmt.bind([boundValue]);

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

        const safeLimit = sanitizeLimit(limit);
        const escapedCategory = '%' + escapeSqlString(category) + '%';
        
        const sql = `
            SELECT id, title, summary, categories
            FROM wikipedia_articles
            WHERE categories LIKE ?
            LIMIT ?
        `;

        const stmt = this.db.prepare(sql);
        stmt.bind([escapedCategory, safeLimit]);
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
    window.escapeSqlString = escapeSqlString;
    window.sanitizeLimit = sanitizeLimit;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WikipediaDataProvider,
        WikipediaServerProvider,
        WikipediaClientProvider,
        escapeSqlString,
        sanitizeLimit
    };
}
