/**
 * Enhanced unit tests for WikipediaManager
 * Tests for sql.js, lunr.js integration, lazy loading, memory management, and integrity verification
 */

const WikipediaManager = require('../../core/public/offline/wikipedia-manager');

describe('WikipediaManager - Enhanced Features', () => {
  let manager;

  beforeEach(() => {
    manager = new WikipediaManager('minimal');
  });

  afterEach(async () => {
    if (manager) {
      await manager.cleanup();
    }
  });

  describe('Configuration and Initialization', () => {
    test('should initialize with proper configuration', () => {
      expect(manager.config).toBeDefined();
      expect(manager.config.dbName).toBe('OfflineWikipedia');
      expect(manager.config.searchTimeout).toBe(200);
      expect(manager.config.maxMemoryMB).toBe(100);
    });

    test('should have version tracking', () => {
      expect(manager.version).toBeDefined();
      expect(typeof manager.version).toBe('string');
    });

    test('should initialize memory management properties', () => {
      expect(manager.memoryUsage).toBe(0);
      expect(manager.cacheWarning).toBe(false);
    });

    test('should initialize search components as null', () => {
      expect(manager.sqlDB).toBeNull();
      expect(manager.searchIndex).toBeNull();
    });
  });

  describe('Database Loading', () => {
    test('should handle IndexedDB unavailability gracefully', async () => {
      // In Node.js environment, IndexedDB is undefined
      await manager.initialize();
      
      expect(manager.isReady()).toBe(true);
      expect(manager.database).toBeDefined();
      expect(manager.database.type).toBe('minimal');
    });

    test('should set article count based on package type', async () => {
      await manager.initialize();
      
      expect(manager.articleCount).toBe(1000); // minimal package
    });

    test('should set lastUpdated timestamp', async () => {
      await manager.initialize();
      
      expect(manager.lastUpdated).toBeDefined();
      expect(new Date(manager.lastUpdated)).toBeInstanceOf(Date);
    });

    test('should handle different package types correctly', async () => {
      const packages = [
        { type: 'minimal', count: 1000 },
        { type: 'standard', count: 10000 },
        { type: 'full', count: 100000 }
      ];

      for (const pkg of packages) {
        const mgr = new WikipediaManager(pkg.type);
        await mgr.initialize();
        
        expect(mgr.articleCount).toBe(pkg.count);
        expect(mgr.database.type).toBe(pkg.type);
        
        await mgr.cleanup();
      }
    }, 15000); // Increased timeout for multiple initializations
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should perform fallback search when lunr is not available', async () => {
      const results = await manager.search('test query', 5);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(5);
      expect(results.length).toBeGreaterThan(0);
    });

    test('should return results with required fields', async () => {
      const results = await manager.search('test', 1);
      
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('snippet');
      expect(results[0]).toHaveProperty('url');
    });

    test('should respect limit parameter', async () => {
      const results = await manager.search('query', 2);
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should throw error if database not ready', async () => {
      const uninitialized = new WikipediaManager('minimal');
      
      await expect(uninitialized.search('query')).rejects.toThrow('Database not ready');
    });

    test('should validate search query', async () => {
      await expect(manager.search('')).rejects.toThrow('Invalid search query');
      await expect(manager.search(null)).rejects.toThrow('Invalid search query');
      await expect(manager.search(123)).rejects.toThrow('Invalid search query');
    });

    test('should handle search with custom database search method', async () => {
      // Mock database with custom search
      manager.database.search = jest.fn().mockResolvedValue([
        { title: 'Custom Result', snippet: 'Custom snippet', url: 'http://example.com' }
      ]);

      const results = await manager.search('test');
      
      expect(manager.database.search).toHaveBeenCalledWith('test', 10);
      expect(results[0].title).toBe('Custom Result');
    });
  });

  describe('Article Retrieval', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should retrieve article by title', async () => {
      const article = await manager.getArticle('Test Article');
      
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('content');
      expect(article).toHaveProperty('timestamp');
    });

    test('should throw error if database not ready', async () => {
      const uninitialized = new WikipediaManager('minimal');
      
      await expect(uninitialized.getArticle('Test')).rejects.toThrow('Database not ready');
    });

    test('should validate article title', async () => {
      await expect(manager.getArticle('')).rejects.toThrow('Invalid article title');
      await expect(manager.getArticle(null)).rejects.toThrow('Invalid article title');
      await expect(manager.getArticle(123)).rejects.toThrow('Invalid article title');
    });
  });

  describe('Statistics and Status', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should provide comprehensive statistics', () => {
      const stats = manager.getStats();
      
      expect(stats).toHaveProperty('packageType');
      expect(stats).toHaveProperty('ready');
      expect(stats).toHaveProperty('articleCount');
      expect(stats).toHaveProperty('version');
      expect(stats).toHaveProperty('lastUpdated');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('cacheWarning');
      expect(stats).toHaveProperty('searchIndexActive');
      expect(stats).toHaveProperty('sqlDBActive');
    });

    test('should track memory usage', () => {
      const stats = manager.getStats();
      
      expect(stats.memoryUsage).toContain('MB');
      expect(parseFloat(stats.memoryUsage)).toBeGreaterThanOrEqual(0);
    });

    test('should indicate search index status', () => {
      const stats = manager.getStats();
      
      expect(typeof stats.searchIndexActive).toBe('boolean');
      expect(typeof stats.sqlDBActive).toBe('boolean');
    });

    test('should provide status information', () => {
      const status = manager.getStatus();
      
      expect(status).toHaveProperty('packageType');
      expect(status).toHaveProperty('ready');
      expect(status).toHaveProperty('loading');
      expect(status).toHaveProperty('error');
      expect(status).toHaveProperty('articleCount');
      expect(status).toHaveProperty('database');
    });

    test('should include database information in status', () => {
      const status = manager.getStatus();
      
      expect(status.database).toBeDefined();
      expect(status.database.type).toBe('minimal');
      expect(status.database.loaded).toBe(true);
    });
  });

  describe('Memory Management', () => {
    test('should calculate memory usage after initialization', async () => {
      await manager.initialize();
      
      expect(manager.memoryUsage).toBeGreaterThan(0);
    });

    test('should emit warning for high memory usage', async () => {
      // Force high memory usage by mocking a large database
      manager.config.maxMemoryMB = 0.001; // Set very low threshold
      
      await manager.initialize();
      
      // Add large data to force memory warning
      manager.database.articles = Array(1000).fill({
        id: 1,
        title: 'Test Article with a longer title to increase size',
        content: 'Lorem ipsum dolor sit amet'.repeat(100),
        summary: 'Test summary'
      });
      
      // Manually trigger memory check after adding data
      manager._checkMemoryPressure();
      
      const stats = manager.getStats();
      expect(manager.cacheWarning).toBe(true);
    });

    test('should reset memory tracking on cleanup', async () => {
      await manager.initialize();
      await manager.cleanup();
      
      expect(manager.memoryUsage).toBe(0);
      expect(manager.cacheWarning).toBe(false);
    });
  });

  describe('Lazy Loading', () => {
    test('should not load database until initialize is called', () => {
      const mgr = new WikipediaManager('minimal');
      
      expect(mgr.database).toBeNull();
      expect(mgr.ready).toBe(false);
    });

    test('should load database on first initialize call', async () => {
      await manager.initialize();
      
      expect(manager.database).not.toBeNull();
      expect(manager.ready).toBe(true);
    });

    test('should not reload if already initialized', async () => {
      await manager.initialize();
      const firstDatabase = manager.database;
      
      const result = await manager.initialize();
      
      expect(result).toBe(true);
      expect(manager.database).toBe(firstDatabase);
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors gracefully', async () => {
      const mgr = new WikipediaManager('minimal');
      mgr.packageType = null; // Force error
      
      await expect(mgr.initialize()).rejects.toThrow('Cannot initialize without package type');
      expect(mgr.isReady()).toBe(false);
      expect(mgr.error).toBeDefined();
    });

    test('should set error property on failure', async () => {
      const mgr = new WikipediaManager('minimal');
      mgr.packageType = undefined;
      
      try {
        await mgr.initialize();
      } catch (e) {
        // Expected to throw
      }
      
      expect(mgr.error).toBeDefined();
    });

    test('should clear error on successful initialization', async () => {
      manager.error = 'Previous error';
      
      await manager.initialize();
      
      expect(manager.error).toBeNull();
    });

    test('should handle search errors', async () => {
      await manager.initialize();
      
      // Force search error by corrupting database
      manager.database = null;
      manager.ready = true; // Trick isReady() check
      
      await expect(manager.search('test')).rejects.toThrow();
    });
  });

  describe('Database Migration', () => {
    test('should have version information', () => {
      expect(manager.version).toBeDefined();
      expect(typeof manager.version).toBe('string');
    });

    test('should check for migration need', async () => {
      const needsMigration = await manager.checkMigration();
      
      expect(typeof needsMigration).toBe('boolean');
    });
  });

  describe('Cache Management', () => {
    test('should have clearCache method', () => {
      expect(typeof manager.clearCache).toBe('function');
    });

    test('should handle cache clearing when IndexedDB unavailable', async () => {
      const result = await manager.clearCache();
      
      expect(typeof result).toBe('boolean');
    });

    test('should have saveToCache method', () => {
      expect(typeof manager.saveToCache).toBe('function');
    });

    test('should handle saving to cache when IndexedDB unavailable', async () => {
      const result = await manager.saveToCache({ test: 'data' });
      
      expect(typeof result).toBe('boolean');
    }, 10000); // Increased timeout to handle IndexedDB operations
  });

  describe('Database Download and Decompression', () => {
    test('should have downloadDatabase method', () => {
      expect(typeof manager.downloadDatabase).toBe('function');
    });

    test('should have decompressDatabase method', () => {
      expect(typeof manager.decompressDatabase).toBe('function');
    });

    test('should handle download errors gracefully', async () => {
      // Mock fetch to simulate error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      await expect(manager.downloadDatabase()).rejects.toThrow('Database download failed');
    });

    test('should handle decompression when DecompressionStream unavailable', async () => {
      const testData = new ArrayBuffer(10);
      
      const result = await manager.decompressDatabase(testData);
      
      expect(result).toBe(testData); // Should return as-is when unavailable
    });
  });

  describe('Cleanup', () => {
    test('should clear all properties on cleanup', async () => {
      await manager.initialize();
      await manager.cleanup();
      
      expect(manager.database).toBeNull();
      expect(manager.sqlDB).toBeNull();
      expect(manager.searchIndex).toBeNull();
      expect(manager.ready).toBe(false);
      expect(manager.initialized).toBe(false);
      expect(manager.loading).toBe(false);
      expect(manager.error).toBeNull();
      expect(manager.articleCount).toBe(0);
    });

    test('should allow re-initialization after cleanup', async () => {
      await manager.initialize();
      await manager.cleanup();
      await manager.initialize();
      
      expect(manager.isReady()).toBe(true);
    }, 10000); // Increased timeout for multiple initializations
  });

  describe('Package Type Validation', () => {
    test('should accept valid package types', () => {
      const validTypes = ['minimal', 'standard', 'full'];
      
      validTypes.forEach(type => {
        expect(() => new WikipediaManager(type)).not.toThrow();
      });
    });

    test('should reject invalid package types', () => {
      const invalidTypes = ['invalid', 'custom', 123, {}, []];
      
      invalidTypes.forEach(type => {
        expect(() => new WikipediaManager(type)).toThrow();
      });
    });

    test('should reject null, undefined, and empty string', () => {
      expect(() => new WikipediaManager(null)).toThrow('Package type is required');
      expect(() => new WikipediaManager(undefined)).toThrow('Package type is required');
      expect(() => new WikipediaManager('')).toThrow('Package type is required');
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent search requests', async () => {
      await manager.initialize();
      
      const searches = [
        manager.search('test1'),
        manager.search('test2'),
        manager.search('test3')
      ];
      
      const results = await Promise.all(searches);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });

    test('should prevent concurrent initialization', async () => {
      const init1 = manager.initialize();
      const init2 = manager.initialize();
      
      const [result1, result2] = await Promise.all([init1, init2]);
      
      expect(result1).toBe(true);
      expect(result2).toBe(false); // Second call should return false (already loading)
    });
  });
});
