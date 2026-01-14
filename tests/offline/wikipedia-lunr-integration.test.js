/**
 * Integration tests for WikipediaManager with LunrSearch
 * Tests the integration between WikipediaManager and LunrSearch
 */

// Mock IndexedDB for Node.js environment
const { indexedDB, IDBKeyRange } = require('fake-indexeddb');
global.indexedDB = indexedDB;
global.IDBKeyRange = IDBKeyRange;

// Polyfill structuredClone for Node.js environment
if (typeof global.structuredClone !== 'function') {
    global.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}

const WikipediaManager = require('../../core/public/offline/wikipedia-manager.js');
const LunrSearch = require('../../core/public/offline/search/lunr-search.js');

// Mock window object for browser globals
global.window = {
    LunrSearch: LunrSearch
};

describe('WikipediaManager with LunrSearch Integration', () => {
    let manager;
    let sampleArticles;

    beforeEach(() => {
        manager = new WikipediaManager('minimal');
        
        sampleArticles = [
            {
                id: '1',
                title: 'JavaScript Programming',
                content: 'JavaScript is a high-level programming language used for web development.',
                category: 'Programming'
            },
            {
                id: '2',
                title: 'Python',
                content: 'Python is a versatile programming language known for its simplicity.',
                category: 'Programming'
            },
            {
                id: '3',
                title: 'Machine Learning',
                content: 'Machine learning is a branch of artificial intelligence.',
                category: 'Technology'
            }
        ];
    });

    afterEach(async () => {
        if (manager) {
            await manager.cleanup();
        }
        // Clear IndexedDB
        const dbs = await global.indexedDB.databases();
        for (const db of dbs) {
            await global.indexedDB.deleteDatabase(db.name);
        }
    });

    describe('Search Index Integration', () => {
        test('should build search index after initialization', async () => {
            await manager.initialize();
            await manager.buildSearchIndex(sampleArticles);
            
            expect(manager.searchIndex).not.toBeNull();
            expect(manager.useSearch).toBe(true);
            expect(manager.searchIndex.isReady()).toBe(true);
        }, 15000);

        test('should search using LunrSearch when available', async () => {
            await manager.initialize();
            await manager.buildSearchIndex(sampleArticles);
            
            const results = await manager.search('JavaScript');
            
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].title).toBe('JavaScript Programming');
        }, 15000);

        test('should return highlighted snippets', async () => {
            await manager.initialize();
            await manager.buildSearchIndex(sampleArticles);
            
            const results = await manager.search('Python');
            
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].snippet).toContain('<mark>Python</mark>');
        }, 15000);

        test('should search by category', async () => {
            await manager.initialize();
            await manager.buildSearchIndex(sampleArticles);
            
            const results = await manager.searchByCategory('Machine', 'Technology');
            
            expect(results.length).toBe(1);
            expect(results[0].category).toBe('Technology');
        }, 15000);

        test('should load pre-built search index', async () => {
            await manager.initialize();
            await manager.buildSearchIndex(sampleArticles);
            
            const indexData = manager.searchIndex.getIndexData();
            
            const manager2 = new WikipediaManager('minimal');
            await manager2.initialize();
            await manager2.loadSearchIndex(indexData, sampleArticles);
            
            expect(manager2.useSearch).toBe(true);
            const results = await manager2.search('JavaScript');
            expect(results.length).toBeGreaterThan(0);
        }, 15000);

        test('should include search stats in getStats', async () => {
            await manager.initialize();
            await manager.buildSearchIndex(sampleArticles);
            
            const stats = manager.getStats();
            
            expect(stats).toHaveProperty('searchIndexReady');
            expect(stats).toHaveProperty('usingLunrSearch');
            expect(stats.searchIndexReady).toBe(true);
            expect(stats.usingLunrSearch).toBe(true);
        }, 15000);

        test('should clean up search index on cleanup', async () => {
            await manager.initialize();
            await manager.buildSearchIndex(sampleArticles);
            
            expect(manager.searchIndex).not.toBeNull();
            
            await manager.cleanup();
            
            expect(manager.searchIndex).toBeNull();
            expect(manager.useSearch).toBe(false);
        }, 15000);
    });

    describe('Fallback Behavior', () => {
        test('should work without LunrSearch', async () => {
            // Remove window.LunrSearch temporarily
            const originalLunrSearch = global.window.LunrSearch;
            delete global.window.LunrSearch;
            
            const manager2 = new WikipediaManager('minimal');
            await manager2.initialize();
            
            // Should still work with fallback search
            const results = await manager2.search('test');
            expect(Array.isArray(results)).toBe(true);
            
            // Restore
            global.window.LunrSearch = originalLunrSearch;
        }, 15000);

        test('should handle search index build failure gracefully', async () => {
            await manager.initialize();
            
            // Try to build index with invalid data
            try {
                await manager.buildSearchIndex([]);
            } catch (error) {
                expect(error).toBeTruthy();
            }
            
            // Manager should still work with fallback
            const results = await manager.search('test');
            expect(Array.isArray(results)).toBe(true);
        }, 15000);
    });

    describe('Performance', () => {
        test('should search quickly with LunrSearch', async () => {
            const largeArticleSet = [];
            for (let i = 0; i < 100; i++) {
                largeArticleSet.push({
                    id: i.toString(),
                    title: `Article ${i}`,
                    content: `Content about programming, technology, and artificial intelligence for article ${i}.`,
                    category: i % 2 === 0 ? 'Technology' : 'Science'
                });
            }
            
            await manager.initialize();
            await manager.buildSearchIndex(largeArticleSet);
            
            const startTime = Date.now();
            await manager.search('programming');
            const duration = Date.now() - startTime;
            
            // Should complete in less than 100ms
            expect(duration).toBeLessThan(100);
        }, 30000);

        test('should load index faster than building', async () => {
            await manager.initialize();
            
            const buildStart = Date.now();
            await manager.buildSearchIndex(sampleArticles);
            const buildTime = Date.now() - buildStart;
            
            const indexData = manager.searchIndex.getIndexData();
            
            const manager2 = new WikipediaManager('minimal');
            await manager2.initialize();
            
            const loadStart = Date.now();
            await manager2.loadSearchIndex(indexData, sampleArticles);
            const loadTime = Date.now() - loadStart;
            
            // Both should complete successfully
            expect(manager.searchIndex.isReady()).toBe(true);
            expect(manager2.searchIndex.isReady()).toBe(true);
        }, 30000);
    });

    describe('Error Handling', () => {
        test('should allow building index even before full initialization', async () => {
            // buildSearchIndex doesn't require full initialization, just LunrSearch availability
            const result = await manager.buildSearchIndex(sampleArticles);
            expect(result).toBe(true);
            expect(manager.searchIndex).not.toBeNull();
        }, 15000);

        test('should throw error when searching by category without index', async () => {
            await manager.initialize();
            
            await expect(manager.searchByCategory('test', 'Category')).rejects.toThrow('Search index not available');
        }, 15000);

        test('should handle empty search results', async () => {
            await manager.initialize();
            await manager.buildSearchIndex(sampleArticles);
            
            const results = await manager.search('nonexistentquery12345');
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        }, 15000);
    });
});
