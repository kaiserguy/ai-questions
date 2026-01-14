/**
 * Wikipedia Storage Manager
 * Handles Wikipedia article database storage in IndexedDB
 */
(function() {
    // Get IndexedDBManager from the appropriate source
    const BaseClass = (function() {
        // Browser environment - get from window
        if (typeof window !== 'undefined' && window.IndexedDBManager) {
            return window.IndexedDBManager;
        }
        // Node.js environment - require it
        if (typeof require !== 'undefined') {
            return require('./indexeddb-manager');
        }
        throw new Error('IndexedDBManager not available');
    })();

    class WikipediaStorage extends BaseClass {
        constructor() {
            super('wikipedia-offline', 1);
            this.schema = {
                'articles': {
                    keyPath: 'id',
                    indexes: {
                        'title': { keyPath: 'title' },
                        'categories': { keyPath: 'categories', multiEntry: true }
                    }
                },
                'search-index': {
                    keyPath: 'version'
                },
                'metadata': {
                    keyPath: 'id'
                }
            };
        }

        /**
         * Initialize storage
         * @returns {Promise<void>}
         */
        async initialize() {
            await this.open(this.schema);
        }

        /**
         * Store single article
         * @param {Object} article - Article object with id, title, content, etc.
         * @returns {Promise<void>}
         */
        async storeArticle(article) {
            if (!article || !article.id) {
                throw new Error('Invalid article: ID is required');
            }
            await this.put('articles', article);
        }

        /**
         * Store articles in batch with progress tracking
         * @param {Array<Object>} articles - Array of article objects
         * @param {Function} onProgress - Progress callback (processed, total)
         * @returns {Promise<void>}
         */
        async storeArticlesBatch(articles, onProgress) {
            const batchSize = 100;
            let processed = 0;

            for (let i = 0; i < articles.length; i += batchSize) {
                const batch = articles.slice(i, i + batchSize);
                await this.batchPut('articles', batch);
                processed += batch.length;
                if (onProgress) {
                    onProgress(processed, articles.length);
                }
            }
        }

        /**
         * Get article by ID
         * @param {string} articleId - Article identifier
         * @returns {Promise<Object|null>}
         */
        async getArticle(articleId) {
            return await this.get('articles', articleId);
        }

        /**
         * Get article by title
         * @param {string} title - Article title
         * @returns {Promise<Object|null>}
         */
        async getArticleByTitle(title) {
            const results = await this.queryByIndex('articles', 'title', title);
            return results[0] || null;
        }

        /**
         * Get articles by category
         * @param {string} category - Category name
         * @returns {Promise<Array<Object>>}
         */
        async getArticlesByCategory(category) {
            return await this.queryByIndex('articles', 'categories', category);
        }

        /**
         * Store search index
         * @param {Object} indexData - Lunr.js serialized index
         * @returns {Promise<void>}
         */
        async storeSearchIndex(indexData) {
            await this.put('search-index', {
                version: '1.0',
                index: indexData,
                createdAt: new Date().toISOString()
            });
        }

        /**
         * Get search index
         * @returns {Promise<Object|null>}
         */
        async getSearchIndex() {
            const data = await this.get('search-index', '1.0');
            return data ? data.index : null;
        }

        /**
         * Store metadata
         * @param {Object} metadata - Metadata object
         * @returns {Promise<void>}
         */
        async storeMetadata(metadata) {
            await this.put('metadata', {
                id: 'wikipedia-db',
                ...metadata,
                updatedAt: new Date().toISOString()
            });
        }

        /**
         * Get metadata
         * @returns {Promise<Object|null>}
         */
        async getMetadata() {
            return await this.get('metadata', 'wikipedia-db');
        }

        /**
         * Get article count
         * @returns {Promise<number>}
         */
        async getArticleCount() {
            return await this.count('articles');
        }

        /**
         * Clear all Wikipedia data
         * @returns {Promise<void>}
         */
        async clearAll() {
            await this.clear('articles');
            await this.clear('search-index');
            await this.clear('metadata');
        }
    }

    // Export for use in browser and Node.js
    if (typeof window !== 'undefined') {
        window.WikipediaStorage = WikipediaStorage;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { WikipediaStorage };
    }
})();
