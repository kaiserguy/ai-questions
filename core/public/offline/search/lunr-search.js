/**
 * Lunr.js Search Integration
 * Handles Wikipedia full-text search
 */
class LunrSearch {
    constructor() {
        this.index = null;
        this.articles = new Map();
    }

    /**
     * Build search index from articles
     * @param {Array<Object>} articles - Array of article objects with id, title, summary, content
     * @returns {Object} Serialized index data with index and articles
     */
    buildIndex(articles) {
        // Validate input
        if (!Array.isArray(articles)) {
            throw new Error('Articles must be an array');
        }

        // Clear existing data
        this.articles.clear();

        // Store articles for retrieval
        articles.forEach(article => {
            this.articles.set(article.id, article);
        });

        // Build Lunr index
        this.index = lunr(function () {
            this.ref('id');
            this.field('title', { boost: 10 });
            this.field('summary', { boost: 5 });
            this.field('content');

            articles.forEach(article => {
                this.add({
                    id: article.id,
                    title: article.title,
                    summary: article.summary,
                    content: article.content
                });
            });
        });

        // Return serialized index and articles as plain object
        return {
            index: this.index.toJSON(),
            articles: Object.fromEntries(this.articles)
        };
    }

    /**
     * Load index from serialized data
     * @param {Object} indexData - Object with index and articles properties
     */
    loadIndex(indexData) {
        // Validate input
        if (!indexData || typeof indexData !== 'object') {
            throw new Error('Index data must be an object');
        }
        
        if (!indexData.index || !indexData.articles) {
            throw new Error('Index data must contain index and articles properties');
        }

        // Load the Lunr index
        this.index = lunr.Index.load(indexData.index);

        // Restore articles Map
        this.articles.clear();
        Object.entries(indexData.articles).forEach(([id, article]) => {
            this.articles.set(id, article);
        });
    }

    /**
     * Search for articles
     * @param {string} query - Search query string
     * @param {Object} options - Search options
     * @param {number} options.limit - Maximum number of results to return (default: 10)
     * @param {boolean} options.includeContent - Whether to include full content in results (default: false)
     * @returns {Array<Object>} Search results with articles
     */
    search(query, options = {}) {
        const {
            limit = 10,
            includeContent = false
        } = options;

        if (!this.index) {
            return [];
        }

        // Perform search
        let results;
        try {
            results = this.index.search(query);
        } catch (error) {
            // Return empty array for invalid queries
            return [];
        }

        // Limit results
        const limitedResults = results.slice(0, limit);

        // Enrich with article data
        return limitedResults.map(result => {
            const article = this.articles.get(result.ref);
            if (!article) {
                return null;
            }

            return {
                id: article.id,
                title: article.title,
                summary: article.summary,
                content: includeContent ? article.content : undefined,
                url: article.url,
                categories: article.categories,
                score: result.score,
                matchData: result.matchData
            };
        }).filter(r => r !== null);
    }

    /**
     * Get highlighted snippet from match
     * @param {Object} matchData - Match data from search result
     * @param {string} content - Full content to extract snippet from
     * @param {number} contextLength - Length of context around match (default: 150)
     * @returns {string} Highlighted snippet with <mark> tags
     */
    getHighlightedSnippet(matchData, content, contextLength = 150) {
        // Handle missing match data
        if (!matchData || !matchData.metadata) {
            return content.substring(0, contextLength) + (content.length > contextLength ? '...' : '');
        }

        // Extract matched terms
        const terms = Object.keys(matchData.metadata);
        
        if (terms.length === 0) {
            return content.substring(0, contextLength) + (content.length > contextLength ? '...' : '');
        }
        
        // Find first occurrence
        const lowerContent = content.toLowerCase();
        let firstIndex = -1;
        
        for (const term of terms) {
            const index = lowerContent.indexOf(term.toLowerCase());
            if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
                firstIndex = index;
            }
        }

        if (firstIndex === -1) {
            return content.substring(0, contextLength) + (content.length > contextLength ? '...' : '');
        }

        // Extract context around match
        const start = Math.max(0, firstIndex - Math.floor(contextLength / 2));
        const end = Math.min(content.length, firstIndex + Math.ceil(contextLength / 2));
        let snippet = content.substring(start, end);

        // Add ellipsis
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';

        // Highlight matched terms
        terms.forEach(term => {
            const regex = new RegExp(`(${term})`, 'gi');
            snippet = snippet.replace(regex, '<mark>$1</mark>');
        });

        return snippet;
    }

    /**
     * Clear search index and articles
     */
    clear() {
        this.index = null;
        this.articles.clear();
    }
}

// Export for both browser and Node.js environments
if (typeof window !== 'undefined') {
    window.LunrSearch = LunrSearch;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LunrSearch };
}
