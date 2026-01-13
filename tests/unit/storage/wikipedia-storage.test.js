/**
 * Unit tests for WikipediaStorage class
 * Tests Wikipedia article storage, retrieval, and search index management
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock IndexedDB for Node.js environment
const fakeIndexedDB = require('fake-indexeddb');
global.indexedDB = fakeIndexedDB.default || fakeIndexedDB;
global.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

// Polyfill structuredClone for Node.js < 17
if (typeof global.structuredClone === 'undefined') {
    const { Blob } = require('node:buffer');
    
    global.structuredClone = (obj) => {
        // Handle null and undefined
        if (obj === null || obj === undefined) {
            return obj;
        }
        
        // Handle primitives
        if (typeof obj !== 'object') {
            return obj;
        }
        
        // Handle Blob
        if (obj instanceof Blob) {
            return new Blob([obj], { type: obj.type });
        }
        
        // Handle Array
        if (Array.isArray(obj)) {
            return obj.map(item => global.structuredClone(item));
        }
        
        // Handle Date
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        // Handle plain objects
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = global.structuredClone(obj[key]);
            }
        }
        return cloned;
    };
}

// Load IndexedDBManager base class first
require('../../../core/public/offline/storage/indexeddb-manager');

describe('WikipediaStorage', () => {
    let wikipediaStorage;
    
    beforeEach(async () => {
        const { WikipediaStorage } = require('../../../core/public/offline/storage/wikipedia-storage.js');
        wikipediaStorage = new WikipediaStorage();
        await wikipediaStorage.initialize();
    });
    
    afterEach(async () => {
        if (wikipediaStorage) {
            await wikipediaStorage.clearAll();
        }
    });
    
    describe('storeArticle', () => {
        test('should store an article successfully', async () => {
            const article = {
                id: 'article-1',
                title: 'Test Article',
                summary: 'This is a test',
                content: 'Full content here',
                url: 'https://en.wikipedia.org/wiki/Test',
                categories: ['Test', 'Example'],
                lastModified: '2024-01-01'
            };
            
            await wikipediaStorage.storeArticle(article);
            const retrieved = await wikipediaStorage.getArticle('article-1');
            
            expect(retrieved).toMatchObject(article);
        });
        
        test('should throw error for invalid article', async () => {
            await expect(
                wikipediaStorage.storeArticle(null)
            ).rejects.toThrow();
            
            await expect(
                wikipediaStorage.storeArticle({ title: 'No ID' })
            ).rejects.toThrow();
        });
    });
    
    describe('storeArticlesBatch', () => {
        test('should store multiple articles with progress', async () => {
            const articles = Array.from({ length: 100 }, (_, i) => ({
                id: `article-${i}`,
                title: `Article ${i}`,
                summary: `Summary ${i}`,
                content: `Content ${i}`,
                url: `https://example.com/${i}`,
                categories: ['Test'],
                lastModified: '2024-01-01'
            }));
            
            const progressUpdates = [];
            await wikipediaStorage.storeArticlesBatch(articles, (progress) => {
                progressUpdates.push(progress);
            });
            
            expect(progressUpdates.length).toBeGreaterThan(0);
            expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
            
            const count = await wikipediaStorage.getArticleCount();
            expect(count).toBe(100);
        });
        
        test('should handle empty array', async () => {
            await wikipediaStorage.storeArticlesBatch([]);
            const count = await wikipediaStorage.getArticleCount();
            expect(count).toBe(0);
        });
    });
    
    describe('getArticle', () => {
        test('should retrieve article by ID', async () => {
            const article = {
                id: 'test-id',
                title: 'Test',
                summary: 'Summary',
                content: 'Content',
                url: 'https://example.com',
                categories: [],
                lastModified: '2024-01-01'
            };
            
            await wikipediaStorage.storeArticle(article);
            const retrieved = await wikipediaStorage.getArticle('test-id');
            
            expect(retrieved).toMatchObject(article);
        });
        
        test('should return null for non-existent article', async () => {
            const retrieved = await wikipediaStorage.getArticle('nonexistent');
            expect(retrieved).toBeNull();
        });
    });
    
    describe('getArticleByTitle', () => {
        test('should retrieve article by title', async () => {
            const article = {
                id: 'article-1',
                title: 'Unique Title',
                summary: 'Summary',
                content: 'Content',
                url: 'https://example.com',
                categories: [],
                lastModified: '2024-01-01'
            };
            
            await wikipediaStorage.storeArticle(article);
            const retrieved = await wikipediaStorage.getArticleByTitle('Unique Title');
            
            expect(retrieved).toMatchObject(article);
        });
        
        test('should return null for non-existent title', async () => {
            const retrieved = await wikipediaStorage.getArticleByTitle('Nonexistent Title');
            expect(retrieved).toBeNull();
        });
    });
    
    describe('getArticlesByCategory', () => {
        test('should retrieve articles by category', async () => {
            const articles = [
                {
                    id: 'article-1',
                    title: 'Article 1',
                    summary: 'Summary 1',
                    content: 'Content 1',
                    url: 'https://example.com/1',
                    categories: ['Science', 'Physics'],
                    lastModified: '2024-01-01'
                },
                {
                    id: 'article-2',
                    title: 'Article 2',
                    summary: 'Summary 2',
                    content: 'Content 2',
                    url: 'https://example.com/2',
                    categories: ['Science', 'Chemistry'],
                    lastModified: '2024-01-01'
                },
                {
                    id: 'article-3',
                    title: 'Article 3',
                    summary: 'Summary 3',
                    content: 'Content 3',
                    url: 'https://example.com/3',
                    categories: ['History'],
                    lastModified: '2024-01-01'
                }
            ];
            
            for (const article of articles) {
                await wikipediaStorage.storeArticle(article);
            }
            
            const scienceArticles = await wikipediaStorage.getArticlesByCategory('Science');
            expect(scienceArticles.length).toBe(2);
        });
    });
    
    describe('storeSearchIndex', () => {
        test('should store search index data', async () => {
            const indexData = {
                version: '1.0',
                fields: ['title', 'content'],
                index: { /* serialized Lunr index */ }
            };
            
            await wikipediaStorage.storeSearchIndex(indexData);
            const retrieved = await wikipediaStorage.getSearchIndex();
            
            expect(retrieved).toMatchObject(indexData);
        });
    });
    
    describe('getSearchIndex', () => {
        test('should retrieve stored search index', async () => {
            const indexData = { version: '1.0', index: {} };
            
            await wikipediaStorage.storeSearchIndex(indexData);
            const retrieved = await wikipediaStorage.getSearchIndex();
            
            expect(retrieved.version).toBe('1.0');
        });
        
        test('should return null when no index stored', async () => {
            const retrieved = await wikipediaStorage.getSearchIndex();
            expect(retrieved).toBeNull();
        });
    });
    
    describe('storeMetadata', () => {
        test('should store package metadata', async () => {
            const metadata = {
                version: '1.0',
                package: 'standard',
                articleCount: 5000,
                created: '2024-01-01',
                size: 50000000
            };
            
            await wikipediaStorage.storeMetadata(metadata);
            const retrieved = await wikipediaStorage.getMetadata();
            
            expect(retrieved).toMatchObject(metadata);
        });
    });
    
    describe('getArticleCount', () => {
        test('should return correct article count', async () => {
            const articles = Array.from({ length: 10 }, (_, i) => ({
                id: `article-${i}`,
                title: `Article ${i}`,
                summary: `Summary ${i}`,
                content: `Content ${i}`,
                url: `https://example.com/${i}`,
                categories: [],
                lastModified: '2024-01-01'
            }));
            
            for (const article of articles) {
                await wikipediaStorage.storeArticle(article);
            }
            
            const count = await wikipediaStorage.getArticleCount();
            expect(count).toBe(10);
        });
        
        test('should return 0 for empty database', async () => {
            const count = await wikipediaStorage.getArticleCount();
            expect(count).toBe(0);
        });
    });
    
    describe('clearAll', () => {
        test('should clear all data', async () => {
            // Store some data
            await wikipediaStorage.storeArticle({
                id: 'article-1',
                title: 'Test',
                summary: 'Summary',
                content: 'Content',
                url: 'https://example.com',
                categories: [],
                lastModified: '2024-01-01'
            });
            await wikipediaStorage.storeSearchIndex({ version: '1.0' });
            await wikipediaStorage.storeMetadata({ version: '1.0' });
            
            // Clear all
            await wikipediaStorage.clearAll();
            
            // Verify everything is cleared
            const count = await wikipediaStorage.getArticleCount();
            const index = await wikipediaStorage.getSearchIndex();
            const metadata = await wikipediaStorage.getMetadata();
            
            expect(count).toBe(0);
            expect(index).toBeNull();
            expect(metadata).toBeNull();
        });
    });
});
