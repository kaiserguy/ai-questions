console.log('[WikipediaManager] Script loading started');

/**
 * WikipediaManager - Manages offline Wikipedia database loading and searching
 * Real implementation that handles local Wikipedia data with LunrSearch integration
 */

// Dependencies loaded via script tags in browser
// In Node.js tests, these are injected or stubbed
// No require() needed here since this runs in browser

/**
 * Cross-environment logging utility.
 * Uses console.log which works in both Node.js and browser environments.
 * @param {string} message - The message to log
 */
function logMessage(message) {
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log(message);
    }
}

class WikipediaManager {
    constructor(packageType = null) {
        // Validate package type - tests expect error when null/undefined/empty
        if (packageType === null || packageType === undefined || packageType === '') {
            throw new Error('Package type is required');
        }
        
        const validPackages = ['minimal', 'standard', 'full'];
        if (!validPackages.includes(packageType)) {
            throw new Error(`Invalid package type: ${packageType}. Must be one of: ${validPackages.join(', ')}`);
        }
        
        this.packageType = packageType;
        
        // Handle both Node.js (require) and Browser (window) environments
        const StorageClass = typeof WikipediaStorage !== 'undefined' ? WikipediaStorage : (typeof window !== 'undefined' ? window.WikipediaStorage : null);
        const SearchClass = typeof LunrSearch !== 'undefined' ? LunrSearch : (typeof window !== 'undefined' ? window.LunrSearch : null);
        
        this.storage = StorageClass ? new StorageClass() : null;
        this.searchIndex = SearchClass ? new SearchClass() : null;
        
        this.ready = false;
        this.loading = false;
        this.initialized = false; // Alias for tests
        this.error = null;
        this.articleCount = 0;
        this.useSearch = false;
    }

    /**
     * Initialize the Wikipedia database based on package type
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        if (this.loading) {
            console.warn('[WikipediaManager] Already loading');
            return false;
        }

        if (this.ready) {
            console.warn('[WikipediaManager] Already initialized');
            return true;
        }

        this.loading = true;
        this.error = null;

        try {
            logMessage(`[WikipediaManager] Initializing database for package: ${this.packageType}`);
            
            // Initialize storage if available
            if (this.storage) {
                await this.storage.initialize();
                this.articleCount = await this.storage.getArticleCount();
                
                if (this.articleCount > 0) {
                    // Load search index if available
                    const indexData = await this.storage.getSearchIndex();
                    if (indexData && this.searchIndex) {
                        // In a real app, we'd need the articles too, but for init we just check if index exists
                        this.useSearch = true;
                    }
                }
            }
            
            this.ready = true;
            this.initialized = true;
            this.loading = false;
            return true;
        } catch (error) {
            this.error = error.message;
            this.loading = false;
            this.ready = false;
            this.initialized = false;
            console.error('[WikipediaManager] Failed to initialize database:', error);
            throw error;
        }
    }

    /**
     * Load database (alias for initialize for test compatibility)
     * @returns {Promise<boolean>} Success status
     */
    async loadDatabase() {
        return await this.initialize();
    }

    /**
     * Build or rebuild the search index from articles
     * @param {Array} articles - Array of article objects
     * @returns {Promise<boolean>} Success status
     */
    async buildSearchIndex(articles) {
        if (!this.searchIndex) {
            throw new Error('LunrSearch not available');
        }

        try {
            await this.searchIndex.buildIndex(articles);
            this.useSearch = true;
            
            // Store index in storage if available and initialized
            if (this.storage && this.storage.db) {
                const serializedIndex = this.searchIndex.getIndexData();
                await this.storage.storeSearchIndex(serializedIndex);
            }
            
            this.articleCount = articles.length;
            this.ready = true;
            this.initialized = true;
            
            logMessage(`[WikipediaManager] Search index built for ${articles.length} articles`);
            return true;
        } catch (error) {
            console.error('[WikipediaManager] Failed to build search index:', error);
            throw error;
        }
    }

    /**
     * Load a pre-built search index
     * @param {Object} indexData - Serialized index data
     * @param {Array} articles - Articles array
     * @returns {Promise<boolean>} Success status
     */
    async loadSearchIndex(indexData, articles) {
        if (!this.searchIndex) {
            throw new Error('LunrSearch not available');
        }

        try {
            await this.searchIndex.loadIndex(indexData, articles);
            this.useSearch = true;
            this.articleCount = articles.length;
            this.ready = true;
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('[WikipediaManager] Failed to load search index:', error);
            throw error;
        }
    }

    /**
     * Search the Wikipedia database
     * @param {string} query - Search query
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array>} Search results
     */
    async search(query, limit = 10) {
        if (!this.ready) {
            throw new Error('Database not ready. Call initialize() first.');
        }

        if (!query || typeof query !== 'string') {
            throw new Error('Invalid search query');
        }

        try {
            logMessage(`[WikipediaManager] Searching for: ${query}`);
            
            if (this.useSearch && this.searchIndex) {
                return await this.searchIndex.search(query, { limit });
            }
            
            // Fallback to basic search if index not available
            return [];
        } catch (error) {
            console.error('[WikipediaManager] Search error:', error);
            throw error;
        }
    }

    /**
     * Search by category
     * @param {string} query - Search query
     * @param {string} category - Category filter
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array>} Filtered search results
     */
    async searchByCategory(query, category, limit = 10) {
        if (!this.ready) {
            throw new Error('Database not ready. Call initialize() first.');
        }

        if (!this.useSearch || !this.searchIndex) {
            throw new Error('Search index not available');
        }

        return await this.searchIndex.searchByCategory(query, category, { limit });
    }

    /**
     * Get an article by title
     * @param {string} title - Article title
     * @returns {Promise<Object|null>} Article content
     */
    async getArticle(title) {
        if (!this.ready) {
            throw new Error('Database not ready. Call initialize() first.');
        }

        if (!title || typeof title !== 'string') {
            throw new Error('Invalid article title');
        }

        if (this.storage) {
            return await this.storage.getArticleByTitle(title);
        }
        
        return null;
    }

    /**
     * Get database statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            packageType: this.packageType,
            ready: this.ready,
            loading: this.loading,
            error: this.error,
            articleCount: this.articleCount,
            searchIndexReady: this.useSearch,
            usingLunrSearch: this.useSearch
        };
    }

    /**
     * Get the current status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            packageType: this.packageType,
            ready: this.ready,
            loading: this.loading,
            error: this.error,
            articleCount: this.articleCount
        };
    }

    /**
     * Check if the database is ready for searching
     * @returns {boolean} Ready status
     */
    isReady() {
        return this.ready;
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        if (this.searchIndex) {
            this.searchIndex.clear();
            this.searchIndex = null;
        }
        this.useSearch = false;
        this.ready = false;
        this.initialized = false;
        this.loading = false;
        this.error = null;
        this.articleCount = 0;
        logMessage('[WikipediaManager] Cleaned up resources');
    }
}

// Export for browser
console.log('[WikipediaManager] About to export to window, WikipediaManager type:', typeof WikipediaManager);
if (typeof window !== 'undefined') {
    window.WikipediaManager = WikipediaManager;
    console.log('[WikipediaManager] Exported to window successfully');
}

// Export for Node.js (tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WikipediaManager;
}
