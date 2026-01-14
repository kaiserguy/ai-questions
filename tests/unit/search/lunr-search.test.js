/**
 * Unit tests for LunrSearch class
 * Tests full-text search functionality using Lunr.js
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

// Mock Lunr.js
global.lunr = require('lunr');

describe('LunrSearch', () => {
    let lunrSearch;
    let sampleArticles;
    
    beforeEach(() => {
        const LunrSearch = require('../../../core/public/offline/search/lunr-search.js');
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
        test('should build search index from articles', () => {
            const indexData = lunrSearch.buildIndex(sampleArticles);
            
            expect(indexData).toBeDefined();
            expect(indexData.index).toBeDefined();
            expect(indexData.articles).toBeDefined();
            expect(Object.keys(indexData.articles).length).toBe(3);
        });
        
        test('should throw error for invalid input', () => {
            expect(() => lunrSearch.buildIndex(null)).toThrow();
            expect(() => lunrSearch.buildIndex('not an array')).toThrow();
        });
        
        test('should handle empty array', () => {
            const indexData = lunrSearch.buildIndex([]);
            expect(indexData.articles).toEqual({});
        });
    });
    
    describe('loadIndex', () => {
        test('should load serialized index', () => {
            const indexData = lunrSearch.buildIndex(sampleArticles);
            
            const LunrSearchClass = require('../../../core/public/offline/search/lunr-search.js');
            const newSearch = new LunrSearchClass();
            newSearch.loadIndex(indexData);
            
            const results = newSearch.search('intelligence');
            expect(results.length).toBeGreaterThan(0);
        });
        
        test('should throw error for invalid index data', () => {
            expect(() => lunrSearch.loadIndex(null)).toThrow();
            expect(() => lunrSearch.loadIndex({})).toThrow();
        });
    });
    
    describe('search', () => {
        beforeEach(() => {
            lunrSearch.buildIndex(sampleArticles);
        });
        
        test('should find articles by title', () => {
            const results = lunrSearch.search('artificial intelligence');
            
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].id).toBe('article-1');
        });
        
        test('should find articles by content', () => {
            const results = lunrSearch.search('machine learning');
            
            expect(results.length).toBeGreaterThan(0);
            const ids = results.map(r => r.id);
            expect(ids).toContain('article-2');
        });
        
        test('should rank results by relevance', () => {
            const results = lunrSearch.search('neural');
            
            expect(results.length).toBeGreaterThan(0);
            // Results should be sorted by score (descending)
            for (let i = 0; i < results.length - 1; i++) {
                expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
            }
        });
        
        test('should return empty array for no matches', () => {
            const results = lunrSearch.search('nonexistent query xyz');
            expect(results).toEqual([]);
        });
        
        test('should limit results', () => {
            const results = lunrSearch.search('intelligence', { limit: 1 });
            expect(results.length).toBeLessThanOrEqual(1);
        });
        
        test('should include content when requested', () => {
            const results = lunrSearch.search('intelligence', { includeContent: true });
            
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].title).toBeDefined();
            expect(results[0].content).toBeDefined();
        });
        
        test('should not include content by default', () => {
            const results = lunrSearch.search('intelligence');
            
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].content).toBeUndefined();
        });
    });
    
    describe('getHighlightedSnippet', () => {
        beforeEach(() => {
            lunrSearch.buildIndex(sampleArticles);
        });
        
        test('should return highlighted snippet', () => {
            const results = lunrSearch.search('intelligence');
            
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
        
        test('should respect context length', () => {
            const results = lunrSearch.search('intelligence');
            
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
        test('should clear index and articles', () => {
            lunrSearch.buildIndex(sampleArticles);
            lunrSearch.clear();
            
            const results = lunrSearch.search('intelligence');
            expect(results).toEqual([]);
        });
    });
    
    describe('field boosting', () => {
        beforeEach(() => {
            lunrSearch.buildIndex(sampleArticles);
        });
        
        test('should boost title matches higher', () => {
            const results = lunrSearch.search('neural');
            
            // Article with "neural" in title should rank higher
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].id).toBe('article-3'); // "Neural Networks" article
        });
    });
    
    describe('multi-word queries', () => {
        beforeEach(() => {
            lunrSearch.buildIndex(sampleArticles);
        });
        
        test('should handle multi-word queries', () => {
            const results = lunrSearch.search('machine learning data');
            
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].id).toBe('article-2');
        });
        
        test('should handle partial matches', () => {
            const results = lunrSearch.search('intel*');
            
            expect(results.length).toBeGreaterThan(0);
        });
    });
});
