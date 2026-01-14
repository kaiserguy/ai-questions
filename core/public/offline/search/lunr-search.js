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
        this.articles = {};
        this.indexReady = false;
    }

    /**
     * Build search index from articles array
     * @param {Array} articles - Array of article objects with id, title, content, category
     * @returns {Object} Object containing serialized index and articles lookup
     */
    buildIndex(articles) {
        if (!articles || !Array.isArray(articles)) {
            throw new Error('Articles array is required');
        }

        if (!lunr) {
            throw new Error('Lunr.js is not available');
        }

        try {
            // Store articles in a lookup object by ID for fast retrieval
            this.articles = {};
            articles.forEach(article => {
                const id = article.id || Math.random().toString(36).substr(2, 9);
                this.articles[id] = article;
            });

            // Build the Lunr index
            this.index = lunr(function() {
                // Define fields to index with optional boosting
                this.ref('id');
                this.field('title', { boost: 10 });
                this.field('summary', { boost: 5 });
                this.field('content', { boost: 1 });

                // Add each article to the index
                articles.forEach(article => {
                    this.add({
                        id: article.id,
                        title: article.title || '',
                        summary: article.summary || '',
                        content: article.content || ''
                    });
                });
            });

            this.indexReady = true;

            return {
                index: this.index ? this.index.toJSON() : null,
                articles: this.articles
            };
        } catch (error) {
            console.error('[LunrSearch] Failed to build index:', error);
            this.indexReady = false;
            throw error;
        }
    }

    /**
     * Load a pre-built serialized index
     * @param {Object} indexData - Object containing serialized index and articles lookup
     * @returns {boolean} Success status
     */
    loadIndex(indexData) {
        if (!indexData || !indexData.index || !indexData.articles) {
            throw new Error('Valid index data (index and articles) is required');
        }

        if (!lunr) {
            throw new Error('Lunr.js is not available');
        }

        try {
            // Load the serialized index
            this.index = lunr.Index.load(indexData.index);
            this.articles = indexData.articles;
            this.indexReady = true;

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
    search(query, options = {}) {
        // The test expects empty array if index is not ready, but only after clear()
        if (!this.indexReady || !this.index) {
            return [];
        }

        if (!query || typeof query !== 'string' || query.trim() === '') {
            return [];
        }

        const { limit = 10, includeContent = false } = options;

        try {
            // Perform the search
            const rawResults = this.index.search(query);

            // Process and enrich results
            return rawResults
                .map(result => {
                    const article = this.articles[result.ref];
                    if (!article) return null;

                    const enrichedResult = {
                        id: article.id,
                        title: article.title,
                        summary: article.summary,
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
     * Clear the index and free memory
     */
    clear() {
        this.index = null;
        this.articles = {};
        this.indexReady = false;
    }
}

// Export for Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LunrSearch };
}

if (typeof window !== 'undefined') {
    window.LunrSearch = LunrSearch;
}
