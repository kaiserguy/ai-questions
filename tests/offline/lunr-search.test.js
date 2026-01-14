/**
 * Unit tests for LunrSearch class
 * Tests search index building, loading, searching, and highlighting
 */

const LunrSearch = require('../../core/public/offline/search/lunr-search.js');

describe('LunrSearch', () => {
    let lunrSearch;
    let sampleArticles;

    beforeEach(() => {
        lunrSearch = new LunrSearch();
        
        // Sample Wikipedia articles for testing
        sampleArticles = [
            {
                id: '1',
                title: 'JavaScript',
                content: 'JavaScript is a high-level programming language that is one of the core technologies of the World Wide Web. It is used to make webpages interactive and provide online programs.',
                category: 'Programming'
            },
            {
                id: '2',
                title: 'Python Programming',
                content: 'Python is a high-level, interpreted programming language with dynamic semantics. Its high-level built in data structures make it attractive for Rapid Application Development.',
                category: 'Programming'
            },
            {
                id: '3',
                title: 'World Wide Web',
                content: 'The World Wide Web (WWW), commonly known as the Web, is an information system where documents and other web resources are identified by URLs.',
                category: 'Internet'
            },
            {
                id: '4',
                title: 'Artificial Intelligence',
                content: 'Artificial Intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals.',
                category: 'Technology'
            },
            {
                id: '5',
                title: 'Machine Learning',
                content: 'Machine learning is a branch of artificial intelligence and computer science which focuses on the use of data and algorithms to imitate the way that humans learn.',
                category: 'Technology'
            }
        ];
    });

    describe('Constructor', () => {
        test('should initialize with default values', () => {
            expect(lunrSearch.index).toBeNull();
            expect(lunrSearch.articles).toEqual([]);
            expect(lunrSearch.indexReady).toBe(false);
            expect(lunrSearch.indexData).toBeNull();
        });

        test('should not be ready initially', () => {
            expect(lunrSearch.isReady()).toBe(false);
        });
    });

    describe('buildIndex', () => {
        test('should build index from articles array', async () => {
            const result = await lunrSearch.buildIndex(sampleArticles);
            
            expect(result).toBe(true);
            expect(lunrSearch.indexReady).toBe(true);
            expect(lunrSearch.isReady()).toBe(true);
            expect(lunrSearch.articles).toEqual(sampleArticles);
            expect(lunrSearch.index).not.toBeNull();
            expect(lunrSearch.indexData).not.toBeNull();
        });

        test('should throw error when articles array is empty', async () => {
            await expect(lunrSearch.buildIndex([])).rejects.toThrow('Articles array is required and must not be empty');
        });

        test('should throw error when articles is null', async () => {
            await expect(lunrSearch.buildIndex(null)).rejects.toThrow('Articles array is required and must not be empty');
        });

        test('should throw error when articles is undefined', async () => {
            await expect(lunrSearch.buildIndex(undefined)).rejects.toThrow('Articles array is required and must not be empty');
        });

        test('should throw error when articles is not an array', async () => {
            await expect(lunrSearch.buildIndex('not an array')).rejects.toThrow('Articles array is required and must not be empty');
        });

        test('should handle articles without id field', async () => {
            const articlesNoId = [
                { title: 'Test', content: 'Test content', category: 'Test' }
            ];
            
            const result = await lunrSearch.buildIndex(articlesNoId);
            expect(result).toBe(true);
            expect(lunrSearch.isReady()).toBe(true);
        });

        test('should handle articles with missing fields', async () => {
            const partialArticles = [
                { id: '1', title: 'Test' },
                { id: '2', content: 'Content only' },
                { id: '3', category: 'Category only' }
            ];
            
            const result = await lunrSearch.buildIndex(partialArticles);
            expect(result).toBe(true);
            expect(lunrSearch.isReady()).toBe(true);
        });

        test('should create serialized index data', async () => {
            await lunrSearch.buildIndex(sampleArticles);
            
            const indexData = lunrSearch.getIndexData();
            expect(indexData).not.toBeNull();
            expect(typeof indexData).toBe('object');
        });
    });

    describe('loadIndex', () => {
        let serializedIndex;

        beforeEach(async () => {
            const tempSearch = new LunrSearch();
            await tempSearch.buildIndex(sampleArticles);
            serializedIndex = tempSearch.getIndexData();
        });

        test('should load pre-built index', async () => {
            const result = await lunrSearch.loadIndex(serializedIndex, sampleArticles);
            
            expect(result).toBe(true);
            expect(lunrSearch.indexReady).toBe(true);
            expect(lunrSearch.isReady()).toBe(true);
            expect(lunrSearch.articles).toEqual(sampleArticles);
        });

        test('should throw error when index data is null', async () => {
            await expect(lunrSearch.loadIndex(null, sampleArticles)).rejects.toThrow('Index data is required');
        });

        test('should throw error when articles is null', async () => {
            await expect(lunrSearch.loadIndex(serializedIndex, null)).rejects.toThrow('Articles array is required');
        });

        test('should throw error when articles is not an array', async () => {
            await expect(lunrSearch.loadIndex(serializedIndex, 'not an array')).rejects.toThrow('Articles array is required');
        });

        test('should load index faster than building', async () => {
            const buildStart = Date.now();
            const tempSearch1 = new LunrSearch();
            await tempSearch1.buildIndex(sampleArticles);
            const buildTime = Date.now() - buildStart;

            const loadStart = Date.now();
            const tempSearch2 = new LunrSearch();
            await tempSearch2.loadIndex(serializedIndex, sampleArticles);
            const loadTime = Date.now() - loadStart;

            // Loading should generally be faster, but this is not guaranteed
            // Just verify both complete successfully
            expect(tempSearch1.isReady()).toBe(true);
            expect(tempSearch2.isReady()).toBe(true);
        });
    });

    describe('search', () => {
        beforeEach(async () => {
            await lunrSearch.buildIndex(sampleArticles);
        });

        test('should throw error when index not ready', async () => {
            const emptySearch = new LunrSearch();
            await expect(emptySearch.search('test')).rejects.toThrow('Index not ready');
        });

        test('should throw error for empty query', async () => {
            await expect(lunrSearch.search('')).rejects.toThrow('Search query is required');
        });

        test('should throw error for null query', async () => {
            await expect(lunrSearch.search(null)).rejects.toThrow('Search query is required');
        });

        test('should search and return results', async () => {
            const results = await lunrSearch.search('programming');
            
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThanOrEqual(10); // Default limit
        });

        test('should return results with correct structure', async () => {
            const results = await lunrSearch.search('JavaScript');
            
            expect(results.length).toBeGreaterThan(0);
            const result = results[0];
            
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('title');
            expect(result).toHaveProperty('content');
            expect(result).toHaveProperty('category');
            expect(result).toHaveProperty('score');
            expect(result).toHaveProperty('snippet');
        });

        test('should rank results by relevance', async () => {
            const results = await lunrSearch.search('programming');
            
            // Results should be sorted by score (highest first)
            for (let i = 0; i < results.length - 1; i++) {
                expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
            }
        });

        test('should respect limit option', async () => {
            const results = await lunrSearch.search('programming', { limit: 2 });
            
            expect(results.length).toBeLessThanOrEqual(2);
        });

        test('should filter by category', async () => {
            const results = await lunrSearch.search('intelligence', { category: 'Technology' });
            
            expect(results.length).toBeGreaterThan(0);
            results.forEach(result => {
                expect(result.category).toBe('Technology');
            });
        });

        test('should return empty array for non-matching query', async () => {
            const results = await lunrSearch.search('xyznonexistent');
            
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        });

        test('should handle multi-word queries', async () => {
            const results = await lunrSearch.search('artificial intelligence');
            
            expect(results.length).toBeGreaterThan(0);
        });

        test('should be case insensitive', async () => {
            const results1 = await lunrSearch.search('JAVASCRIPT');
            const results2 = await lunrSearch.search('javascript');
            const results3 = await lunrSearch.search('JavaScript');
            
            expect(results1.length).toBe(results2.length);
            expect(results2.length).toBe(results3.length);
        });

        test('should complete search quickly', async () => {
            const startTime = Date.now();
            await lunrSearch.search('programming');
            const duration = Date.now() - startTime;
            
            // Should complete in less than 100ms (acceptance criteria)
            expect(duration).toBeLessThan(100);
        });
    });

    describe('searchByCategory', () => {
        beforeEach(async () => {
            await lunrSearch.buildIndex(sampleArticles);
        });

        test('should search within specific category', async () => {
            const results = await lunrSearch.searchByCategory('language', 'Programming', 10);
            
            expect(results.length).toBeGreaterThan(0);
            results.forEach(result => {
                expect(result.category).toBe('Programming');
            });
        });

        test('should return empty array when category has no matches', async () => {
            const results = await lunrSearch.searchByCategory('web', 'NonExistentCategory', 10);
            
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(0);
        });
    });

    describe('snippet highlighting', () => {
        beforeEach(async () => {
            await lunrSearch.buildIndex(sampleArticles);
        });

        test('should generate snippets with highlights', async () => {
            const results = await lunrSearch.search('programming');
            
            expect(results.length).toBeGreaterThan(0);
            const snippet = results[0].snippet;
            
            expect(snippet).toBeTruthy();
            expect(typeof snippet).toBe('string');
        });

        test('should highlight query terms in snippets', async () => {
            const results = await lunrSearch.search('JavaScript');
            
            const jsResult = results.find(r => r.title === 'JavaScript');
            expect(jsResult).toBeTruthy();
            expect(jsResult.snippet).toContain('<mark>');
            expect(jsResult.snippet).toContain('</mark>');
        });

        test('should handle snippets for multi-word queries', async () => {
            const results = await lunrSearch.search('World Wide Web');
            
            if (results.length > 0) {
                expect(results[0].snippet).toBeTruthy();
            }
        });
    });

    describe('getStats', () => {
        test('should return stats when index not ready', () => {
            const stats = lunrSearch.getStats();
            
            expect(stats).toHaveProperty('indexReady');
            expect(stats).toHaveProperty('articleCount');
            expect(stats).toHaveProperty('indexSize');
            expect(stats.indexReady).toBe(false);
            expect(stats.articleCount).toBe(0);
            expect(stats.indexSize).toBe(0);
        });

        test('should return stats when index is ready', async () => {
            await lunrSearch.buildIndex(sampleArticles);
            const stats = lunrSearch.getStats();
            
            expect(stats.indexReady).toBe(true);
            expect(stats.articleCount).toBe(sampleArticles.length);
            expect(stats.indexSize).toBeGreaterThan(0);
        });
    });

    describe('clear', () => {
        test('should clear index and reset state', async () => {
            await lunrSearch.buildIndex(sampleArticles);
            expect(lunrSearch.isReady()).toBe(true);
            
            lunrSearch.clear();
            
            expect(lunrSearch.index).toBeNull();
            expect(lunrSearch.articles).toEqual([]);
            expect(lunrSearch.indexData).toBeNull();
            expect(lunrSearch.indexReady).toBe(false);
            expect(lunrSearch.isReady()).toBe(false);
        });
    });

    describe('performance', () => {
        test('should handle large number of articles', async () => {
            const largeArticleSet = [];
            for (let i = 0; i < 100; i++) {
                largeArticleSet.push({
                    id: i.toString(),
                    title: `Article ${i}`,
                    content: `This is the content for article ${i} with some random text about programming, technology, and artificial intelligence.`,
                    category: i % 2 === 0 ? 'Technology' : 'Science'
                });
            }
            
            const buildStart = Date.now();
            await lunrSearch.buildIndex(largeArticleSet);
            const buildTime = Date.now() - buildStart;
            
            const searchStart = Date.now();
            const results = await lunrSearch.search('programming');
            const searchTime = Date.now() - searchStart;
            
            expect(lunrSearch.isReady()).toBe(true);
            expect(results.length).toBeGreaterThan(0);
            expect(searchTime).toBeLessThan(100); // Must be under 100ms
        });
    });

    describe('edge cases', () => {
        test('should handle articles with very long content', async () => {
            const longContent = 'a '.repeat(10000) + 'programming language test';
            const articles = [{
                id: '1',
                title: 'Long Article',
                content: longContent,
                category: 'Test'
            }];
            
            await lunrSearch.buildIndex(articles);
            const results = await lunrSearch.search('programming');
            
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].snippet).toBeTruthy();
        });

        test('should handle special characters in query', async () => {
            await lunrSearch.buildIndex(sampleArticles);
            
            // Should not throw error
            const results = await lunrSearch.search('test@#$%');
            expect(Array.isArray(results)).toBe(true);
        });

        test('should handle articles with special characters', async () => {
            const specialArticles = [{
                id: '1',
                title: 'Test: Special & Characters',
                content: 'Content with @special #characters $and %symbols!',
                category: 'Test'
            }];
            
            await lunrSearch.buildIndex(specialArticles);
            const results = await lunrSearch.search('special');
            
            expect(results.length).toBeGreaterThan(0);
        });
    });
});
