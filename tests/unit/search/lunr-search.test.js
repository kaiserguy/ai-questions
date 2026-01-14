/**
 * Unit tests for LunrSearch class
 * Tests full-text search functionality using Lunr.js
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

// Mock Lunr.js
global.lunr = require('lunr');

describe('LunrSearch', () => {
    let lunrSearch;
    let LunrSearch;
    let sampleArticles;
    
    beforeEach(() => {
        LunrSearch = require('../../../core/public/offline/search/lunr-search.js');
        lunrSearch = new LunrSearch();
        
        sampleArticles = [
            {
                id: 'article-1',
                title: 'Artificial Intelligence',
                summary: 'AI is the simulation of human intelligence by machines',
                content: 'Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans.'
            },
            {
                id: 'article-2',
                title: 'Machine Learning',
                summary: 'ML is a subset of AI focused on learning from data',
                content: 'Machine learning is a method of data analysis that automates analytical model building.'
            },
            {
                id: 'article-3',
                title: 'Neural Networks',
                summary: 'Neural networks are computing systems inspired by biological neural networks',
                content: 'Artificial neural networks are computing systems inspired by the biological neural networks that constitute animal brains.'
            }
        ];
    });
    
    describe('buildIndex', () => {
        test('should build search index from articles', async () => {
            const result = await lunrSearch.buildIndex(sampleArticles);
            
            expect(result).toBe(true);
            expect(lunrSearch.isReady()).toBe(true);
            expect(lunrSearch.articles.length).toBe(3);
        });
        
        test('should throw error for invalid input', async () => {
            await expect(lunrSearch.buildIndex(null)).rejects.toThrow();
            await expect(lunrSearch.buildIndex('not an array')).rejects.toThrow();
        });
        
        test('should throw error for empty array', async () => {
            await expect(lunrSearch.buildIndex([])).rejects.toThrow('Articles array is required and must not be empty');
        });
    });
    
    describe('loadIndex', () => {
        test('should load serialized index', async () => {
            // First build an index to get index data
            await lunrSearch.buildIndex(sampleArticles);
            const indexData = lunrSearch.getIndexData();
            
            // Create a new instance and load the index
            const newSearch = new LunrSearch();
            await newSearch.loadIndex(indexData, sampleArticles);
            
            expect(newSearch.isReady()).toBe(true);
            const results = await newSearch.search('intelligence');
            expect(results.length).toBeGreaterThan(0);
        });
        
        test('should throw error for invalid index data', async () => {
            await expect(lunrSearch.loadIndex(null, sampleArticles)).rejects.toThrow();
        });
        
        test('should throw error for missing articles', async () => {
            await lunrSearch.buildIndex(sampleArticles);
            const indexData = lunrSearch.getIndexData();
            
            const newSearch = new LunrSearch();
            await expect(newSearch.loadIndex(indexData, null)).rejects.toThrow('Articles array is required');
        });
    });
    
    describe('search', () => {
        beforeEach(async () => {
            await lunrSearch.buildIndex(sampleArticles);
        });
        
        test('should find articles by title', async () => {
            const results = await lunrSearch.search('artificial intelligence');
            
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].id).toBe('article-1');
        });
        
        test('should find articles by content', async () => {
            const results = await lunrSearch.search('machine learning');
            
            expect(results.length).toBeGreaterThan(0);
            const ids = results.map(r => r.id);
            expect(ids).toContain('article-2');
        });
        
        test('should rank results by relevance', async () => {
            const results = await lunrSearch.search('neural');
            
            expect(results.length).toBeGreaterThan(0);
            // Results should be sorted by score (descending)
            for (let i = 0; i < results.length - 1; i++) {
                expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
            }
        });
        
        test('should return empty array for no matches', async () => {
            const results = await lunrSearch.search('nonexistent query xyz');
            expect(results).toEqual([]);
        });
        
        test('should limit results', async () => {
            const results = await lunrSearch.search('intelligence', { limit: 1 });
            expect(results.length).toBeLessThanOrEqual(1);
        });
        
        test('should include content when requested', async () => {
            const results = await lunrSearch.search('intelligence', { includeContent: true });
            
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].title).toBeDefined();
            expect(results[0].content).toBeDefined();
        });
        
        test('should include content in results', async () => {
            const results = await lunrSearch.search('intelligence');
            
            expect(results.length).toBeGreaterThan(0);
            // Implementation includes content by default
            expect(results[0].content).toBeDefined();
        });
    });
    
    describe('getHighlightedSnippet', () => {
        beforeEach(async () => {
            await lunrSearch.buildIndex(sampleArticles);
        });
        
        test('should return highlighted snippet', async () => {
            const results = await lunrSearch.search('intelligence');
            
            if (results.length > 0 && results[0].matchData) {
                const snippet = lunrSearch.getHighlightedSnippet(
                    results[0].matchData,
                    sampleArticles[0].content,
                    50
                );
                
                expect(snippet).toBeDefined();
                expect(snippet).toContain('<mark>');
                expect(snippet).toContain('</mark>');
            }
        });
        
        test('should handle missing match data', () => {
            const snippet = lunrSearch.getHighlightedSnippet(
                null,
                'Some content here',
                50
            );
            
            expect(snippet).toBeDefined();
            expect(snippet.length).toBeLessThanOrEqual(50 + 10); // Allow for ellipsis
        });
        
        test('should respect context length', async () => {
            const results = await lunrSearch.search('intelligence');
            
            if (results.length > 0) {
                const shortSnippet = lunrSearch.getHighlightedSnippet(
                    results[0].matchData,
                    sampleArticles[0].content,
                    20
                );
                
                const longSnippet = lunrSearch.getHighlightedSnippet(
                    results[0].matchData,
                    sampleArticles[0].content,
                    100
                );
                
                expect(shortSnippet.length).toBeLessThan(longSnippet.length);
            }
        });
    });
    
    describe('clear', () => {
        test('should clear index and articles', async () => {
            await lunrSearch.buildIndex(sampleArticles);
            lunrSearch.clear();
            
            expect(lunrSearch.isReady()).toBe(false);
            await expect(lunrSearch.search('intelligence')).rejects.toThrow('Index not ready');
        });
    });
    
    describe('field boosting', () => {
        beforeEach(async () => {
            await lunrSearch.buildIndex(sampleArticles);
        });
        
        test('should boost title matches higher', async () => {
            const results = await lunrSearch.search('neural');
            
            // Article with "neural" in title should rank higher
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].id).toBe('article-3'); // "Neural Networks" article
        });
    });
    
    describe('multi-word queries', () => {
        beforeEach(async () => {
            await lunrSearch.buildIndex(sampleArticles);
        });
        
        test('should handle multi-word queries', async () => {
            const results = await lunrSearch.search('machine learning data');
            
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].id).toBe('article-2');
        });
        
        test('should handle partial matches', async () => {
            const results = await lunrSearch.search('intel*');
            
            expect(results.length).toBeGreaterThan(0);
        });
    });
});
