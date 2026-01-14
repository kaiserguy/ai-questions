/**
 * LunrSearch - Full-text search implementation for Wikipedia articles using Lunr.js
 * Provides fast, client-side search with ranking, highlighting, and category filtering
 */

// Import lunr.js - works in both Node.js and browser
let lunr;
if (typeof require !== 'undefined') {
    try {
        lunr = require('lunr');
    } catch (e) {
        // If lunr is not available in Node, it might be loaded globally in browser
        if (typeof window !== 'undefined' && window.lunr) {
            lunr = window.lunr;
        }
    }
}

class LunrSearch {
    constructor() {
        this.index = null;
        this.articles = []; // Test expects array
        this.indexReady = false;
        this.indexData = null;
    }

    /**
     * Build search index from articles array
     * @param {Array} articles - Array of article objects with id, title, content, category
     * @returns {boolean} Success status
     */
    async buildIndex(articles) {
        if (!articles || !Array.isArray(articles) || articles.length === 0) {
            throw new Error('Articles array is required and must not be empty');
        }

        if (!lunr) {
            throw new Error('Lunr.js is not available');
        }

        try {
            // Store articles
            this.articles = articles;

            // Build the Lunr index
            this.index = lunr(function() {
                // Define fields to index with optional boosting
                this.ref('id');
                this.field('title', { boost: 10 });
                this.field('summary', { boost: 5 });
                this.field('content', { boost: 1 });
                this.field('category');

                // Add each article to the index
                articles.forEach(article => {
                    this.add({
                        id: article.id || Math.random().toString(36).substr(2, 9),
                        title: article.title || '',
                        summary: article.summary || '',
                        content: article.content || '',
                        category: article.category || ''
                    });
                });
            });

            this.indexReady = true;
            this.indexData = this.getIndexData();

            return true;
        } catch (error) {
            console.error('[LunrSearch] Failed to build index:', error);
            this.indexReady = false;
            throw error;
        }
    }

    /**
     * Load a pre-built serialized index
     * @param {Object} indexData - Serialized index data
     * @param {Array} articles - Articles array
     * @returns {boolean} Success status
     */
    async loadIndex(indexData, articles) {
        if (!indexData) {
            throw new Error('Index data is required');
        }
        
        if (!articles || !Array.isArray(articles)) {
            throw new Error('Articles array is required');
        }

        if (!lunr) {
            throw new Error('Lunr.js is not available');
        }

        try {
            // Load the serialized index
            this.index = lunr.Index.load(indexData);
            this.articles = articles;
            this.indexReady = true;
            this.indexData = indexData;

            return true;
        } catch (error) {
            console.error('[LunrSearch] Failed to load index:', error);
            this.indexReady = false;
            throw error;
        }
    }

    /**
     * Search the index with a query
     * @param {string} query - Search query
     * @param {Object} options - Search options (limit, includeContent)
     * @returns {Array} Array of search results with highlights
     */
    async search(query, options = {}) {
        if (!this.indexReady || !this.index) {
            throw new Error('Index not ready');
        }

        if (query === null || query === undefined || query === '') {
            throw new Error('Search query is required');
        }

        if (typeof query !== 'string' || query.trim() === '') {
            return [];
        }

        const { limit = 10, includeContent = true } = options;

        try {
            // Perform the search
            const rawResults = this.index.search(query);

            // Process and enrich results
            return rawResults
                .map(result => {
                    const article = this.articles.find(a => a.id === result.ref);
                    if (!article) return null;

                    const enrichedResult = {
                        id: article.id,
                        title: article.title,
                        summary: article.summary,
                        category: article.category,
                        score: result.score,
                        matchData: result.matchData,
                        snippet: this.getHighlightedSnippet(result.matchData, article.content, 150)
                    };

                    if (includeContent) {
                        enrichedResult.content = article.content;
                    }

                    return enrichedResult;
                })
                .filter(result => result !== null)
                .slice(0, limit);
        } catch (error) {
            console.error('[LunrSearch] Search error:', error);
            return [];
        }
    }

    /**
     * Search by category
     * @param {string} query - Search query
     * @param {string} category - Category filter
     * @param {Object} options - Search options
     * @returns {Array} Filtered search results
     */
    async searchByCategory(query, category, options = {}) {
        if (!this.indexReady || !this.index) {
            throw new Error('Search index not available');
        }

        const results = await this.search(query, { ...options, limit: 1000 });
        return results
            .filter(res => res.category === category)
            .slice(0, options.limit || 10);
    }

    /**
     * Generate highlighted snippet from content
     * @param {Object} matchData - Lunr match data
     * @param {string} content - Text content
     * @param {number} contextLength - Length of snippet
     * @returns {string} Highlighted snippet
     */
    getHighlightedSnippet(matchData, content, contextLength = 150) {
        if (!content) return '';
        
        // Extract terms from matchData if available
        let terms = [];
        if (matchData && matchData.metadata) {
            terms = Object.keys(matchData.metadata);
        }

        if (terms.length === 0) {
            return content.substring(0, contextLength) + (content.length > contextLength ? '...' : '');
        }

        const contentLower = content.toLowerCase();
        let bestPos = 0;
        let maxMatches = 0;

        // Find position with most query term matches
        for (let i = 0; i < Math.max(1, content.length - contextLength); i += 20) {
            const window = contentLower.substring(i, i + contextLength);
            let matches = 0;
            terms.forEach(term => {
                if (window.includes(term)) matches++;
            });
            
            if (matches > maxMatches) {
                maxMatches = matches;
                bestPos = i;
            }
        }

        let start = Math.max(0, bestPos - 20);
        let end = Math.min(content.length, start + contextLength);
        
        let snippet = content.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';

        // Highlight terms
        terms.forEach(term => {
            const regex = new RegExp(`(${term})`, 'gi');
            snippet = snippet.replace(regex, '<mark>$1</mark>');
        });

        return snippet;
    }

    /**
     * Get serialized index data
     * @returns {Object} Serialized index
     */
    getIndexData() {
        return this.index ? this.index.toJSON() : null;
    }

    /**
     * Get index statistics
     * @returns {Object} Stats
     */
    getStats() {
        return {
            indexReady: this.indexReady,
            articleCount: this.articles.length,
            indexSize: this.index ? JSON.stringify(this.index.toJSON()).length : 0
        };
    }

    /**
     * Check if index is ready
     * @returns {boolean}
     */
    isReady() {
        return this.indexReady;
    }

    /**
     * Clear the index and free memory
     */
    clear() {
        this.index = null;
        this.articles = []; // Test expects array
        this.indexReady = false;
        this.indexData = null;
    }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LunrSearch;
}

if (typeof window !== 'undefined') {
    window.LunrSearch = LunrSearch;
}
