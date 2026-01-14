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
        this.articles = [];
        this.indexReady = false;
        this.indexData = null; // Serialized index data
    }

    /**
     * Build search index from articles array
     * @param {Array} articles - Array of article objects with id, title, content, category
     * @returns {Promise<boolean>} Success status
     */
    async buildIndex(articles) {
        if (!articles || !Array.isArray(articles) || articles.length === 0) {
            throw new Error('Articles array is required and must not be empty');
        }

        if (!lunr) {
            throw new Error('Lunr.js is not available');
        }

        try {
            console.log(`[LunrSearch] Building index for ${articles.length} articles...`);
            const startTime = Date.now();

            // Store articles for later retrieval
            this.articles = articles;

            // Build the Lunr index
            this.index = lunr(function() {
                // Define fields to index with optional boosting
                this.ref('id');
                this.field('title', { boost: 10 });
                this.field('content', { boost: 1 });
                this.field('category', { boost: 5 });

                // Add each article to the index
                articles.forEach((article, idx) => {
                    this.add({
                        id: article.id || idx.toString(),
                        title: article.title || '',
                        content: article.content || '',
                        category: article.category || ''
                    });
                });
            });

            // Serialize the index for storage
            this.indexData = this.index.toJSON();
            this.indexReady = true;

            const duration = Date.now() - startTime;
            console.log(`[LunrSearch] Index built successfully in ${duration}ms`);

            return true;
        } catch (error) {
            console.error('[LunrSearch] Failed to build index:', error);
            this.indexReady = false;
            throw error;
        }
    }

    /**
     * Load a pre-built serialized index
     * @param {Object} indexData - Serialized Lunr index data
     * @param {Array} articles - Original articles array
     * @returns {Promise<boolean>} Success status
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
            console.log('[LunrSearch] Loading pre-built index...');
            const startTime = Date.now();

            // Load the serialized index
            this.index = lunr.Index.load(indexData);
            this.articles = articles;
            this.indexData = indexData;
            this.indexReady = true;

            const duration = Date.now() - startTime;
            console.log(`[LunrSearch] Index loaded successfully in ${duration}ms`);

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
     * @param {Object} options - Search options (limit, category filter)
     * @returns {Promise<Array>} Array of search results with highlights
     */
    async search(query, options = {}) {
        if (!this.indexReady || !this.index) {
            throw new Error('Index not ready. Build or load an index first.');
        }

        if (!query || typeof query !== 'string' || query.trim() === '') {
            throw new Error('Search query is required');
        }

        const {
            limit = 10,
            category = null
        } = options;

        try {
            console.log(`[LunrSearch] Searching for: "${query}"`);
            const startTime = Date.now();

            // Perform the search
            const rawResults = this.index.search(query);

            // Process and enrich results
            const results = rawResults
                .map(result => {
                    // Find the corresponding article
                    const article = this.articles.find(a => 
                        (a.id || this.articles.indexOf(a).toString()) === result.ref
                    );

                    if (!article) {
                        return null;
                    }

                    // Apply category filter if specified
                    if (category && article.category !== category) {
                        return null;
                    }

                    // Generate highlighted snippet
                    const snippet = this._generateSnippet(article, query);

                    return {
                        id: article.id || result.ref,
                        title: article.title,
                        content: article.content,
                        category: article.category,
                        score: result.score,
                        snippet: snippet,
                        matchData: result.matchData
                    };
                })
                .filter(result => result !== null)
                .slice(0, limit);

            const duration = Date.now() - startTime;
            console.log(`[LunrSearch] Found ${results.length} results in ${duration}ms`);

            return results;
        } catch (error) {
            console.error('[LunrSearch] Search error:', error);
            throw error;
        }
    }

    /**
     * Search with category filtering
     * @param {string} query - Search query
     * @param {string} category - Category to filter by
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array>} Filtered search results
     */
    async searchByCategory(query, category, limit = 10) {
        return this.search(query, { category, limit });
    }

    /**
     * Generate highlighted snippet from article content
     * @private
     * @param {Object} article - Article object
     * @param {string} query - Search query
     * @returns {string} Highlighted snippet
     */
    _generateSnippet(article, query) {
        const content = article.content || '';
        const title = article.title || '';
        
        if (!content) {
            return '';
        }

        // Extract query terms (remove special characters)
        const queryTerms = query
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(term => term.length > 0);

        // Find the best matching position in content
        let bestPosition = 0;
        let maxMatches = 0;

        // Search in windows of 200 characters
        const windowSize = 200;
        const contentLower = content.toLowerCase();

        for (let i = 0; i < content.length - windowSize; i += 50) {
            const window = contentLower.substring(i, i + windowSize);
            const matches = queryTerms.reduce((count, term) => {
                return count + (window.includes(term) ? 1 : 0);
            }, 0);

            if (matches > maxMatches) {
                maxMatches = matches;
                bestPosition = i;
            }
        }

        // Extract snippet around best position
        let snippetStart = Math.max(0, bestPosition - 50);
        let snippetEnd = Math.min(content.length, bestPosition + windowSize + 50);

        // Adjust to word boundaries
        if (snippetStart > 0) {
            const spaceIdx = content.indexOf(' ', snippetStart);
            if (spaceIdx > 0 && spaceIdx < snippetStart + 30) {
                snippetStart = spaceIdx + 1;
            }
        }

        if (snippetEnd < content.length) {
            const spaceIdx = content.lastIndexOf(' ', snippetEnd);
            if (spaceIdx > snippetEnd - 30) {
                snippetEnd = spaceIdx;
            }
        }

        let snippet = content.substring(snippetStart, snippetEnd);

        // Add ellipsis
        if (snippetStart > 0) {
            snippet = '...' + snippet;
        }
        if (snippetEnd < content.length) {
            snippet = snippet + '...';
        }

        // Highlight query terms
        queryTerms.forEach(term => {
            const regex = new RegExp(`\\b(${term})`, 'gi');
            snippet = snippet.replace(regex, '<mark>$1</mark>');
        });

        return snippet;
    }

    /**
     * Get serialized index data for storage
     * @returns {Object|null} Serialized index data
     */
    getIndexData() {
        return this.indexData;
    }

    /**
     * Get statistics about the index
     * @returns {Object} Index statistics
     */
    getStats() {
        return {
            indexReady: this.indexReady,
            articleCount: this.articles.length,
            indexSize: this.indexData ? JSON.stringify(this.indexData).length : 0
        };
    }

    /**
     * Check if the index is ready
     * @returns {boolean} Ready status
     */
    isReady() {
        return this.indexReady && this.index !== null;
    }

    /**
     * Clear the index and free memory
     */
    clear() {
        this.index = null;
        this.articles = [];
        this.indexData = null;
        this.indexReady = false;
        console.log('[LunrSearch] Index cleared');
    }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LunrSearch;
}

if (typeof window !== 'undefined') {
    window.LunrSearch = LunrSearch;
}
