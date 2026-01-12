/**
 * Unit tests for DownloadManager class
 * These tests would have caught the errors I made
 */

// Import the DownloadManager class
const DownloadManager = require('../../core/public/offline/download-manager.js');

describe('DownloadManager', () => {
  let downloadManager;
  let mockProgressElement;
  let mockResourceElements;

  beforeEach(() => {
    // Set up DOM mocks
    mockProgressElement = createMockElement('progressText');
    mockResourceElements = {
      aiModel: createMockElement('aiModel'),
      wikipedia: createMockElement('wikipedia'),
      libraries: createMockElement('libraries')
    };

    // Mock document.getElementById to return our mock elements
    document.getElementById = jest.fn((id) => {
      if (id === 'progressText') return mockProgressElement;
      return mockResourceElements[id] || null;
    });
  });

  describe('Constructor', () => {
    test('should require packageType parameter', () => {
      // This test would have caught my error!
      expect(() => new DownloadManager()).toThrow();
      expect(() => new DownloadManager(undefined)).toThrow();
      expect(() => new DownloadManager(null)).toThrow();
    });

    test('should accept valid package types', () => {
      expect(() => new DownloadManager('minimal')).not.toThrow();
      expect(() => new DownloadManager('standard')).not.toThrow();
      expect(() => new DownloadManager('full')).not.toThrow();
    });

    test('should throw error for invalid package types', () => {
      expect(() => new DownloadManager('invalid')).toThrow();
      expect(() => new DownloadManager('')).toThrow();
      expect(() => new DownloadManager(123)).toThrow();
    });

    test('should initialize with correct package configuration', () => {
      const manager = new DownloadManager('minimal');
      expect(manager.packageType).toBe('minimal');
      expect(manager.packages.minimal).toBeDefined();
      expect(manager.packages.minimal.aiModel).toBeDefined();
      expect(manager.packages.minimal.aiModel.name).toBeDefined();
      expect(manager.packages.minimal.aiModel.size).toBeDefined();
    });

    test('should initialize resources with pending status', () => {
      const manager = new DownloadManager('minimal');
      expect(manager.resources.aiModel.status).toBe('pending');
      expect(manager.resources.wikipedia.status).toBe('pending');
      expect(manager.resources.libraries.status).toBe('pending');
    });
  });

  describe('Package Configuration Validation', () => {
    test('all package types should have required aiModel properties', () => {
      const packageTypes = ['minimal', 'standard', 'full'];
      
      packageTypes.forEach(type => {
        const manager = new DownloadManager(type);
        const aiModel = manager.packages[type].aiModel;
        
        expect(aiModel).toBeDefined();
        expect(aiModel.name).toBeDefined();
        expect(aiModel.size).toBeDefined();
        expect(typeof aiModel.name).toBe('string');
        expect(typeof aiModel.size).toBe('string');
      });
    });

    test('all package types should have required wikipedia properties', () => {
      const packageTypes = ['minimal', 'standard', 'full'];
      
      packageTypes.forEach(type => {
        const manager = new DownloadManager(type);
        const wikipedia = manager.packages[type].wikipedia;
        
        expect(wikipedia).toBeDefined();
        expect(wikipedia.name).toBeDefined();
        expect(wikipedia.size).toBeDefined();
      });
    });

    test('package configurations should be consistent', () => {
      const manager = new DownloadManager('minimal');
      
      // Check that all required properties exist
      expect(manager.packages.minimal.name).toBeDefined();
      expect(manager.packages.minimal.totalSize).toBeDefined();
      expect(manager.packages.standard.name).toBeDefined();
      expect(manager.packages.full.name).toBeDefined();
    });
  });

  describe('Event Handlers', () => {
    test('should set event handlers correctly', () => {
      const manager = new DownloadManager('minimal');
      const handlers = {
        onProgressUpdate: jest.fn(),
        onResourceUpdate: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      };

      manager.setEventHandlers(handlers);

      expect(manager.onProgressUpdate).toBe(handlers.onProgressUpdate);
      expect(manager.onResourceUpdate).toBe(handlers.onResourceUpdate);
      expect(manager.onComplete).toBe(handlers.onComplete);
      expect(manager.onError).toBe(handlers.onError);
    });

    test('should handle missing event handlers gracefully', () => {
      const manager = new DownloadManager('minimal');
      
      expect(() => manager.setEventHandlers({})).not.toThrow();
      expect(() => manager.setEventHandlers(null)).not.toThrow();
      expect(() => manager.setEventHandlers(undefined)).not.toThrow();
    });
  });

  describe('Resource Management', () => {
    test('should update resource status correctly', () => {
      const manager = new DownloadManager('minimal');
      const mockHandler = jest.fn();
      manager.setEventHandlers({ onResourceUpdate: mockHandler });

      manager.updateResource('aiModel', 'downloading', 50);

      expect(manager.resources.aiModel.status).toBe('downloading');
      expect(manager.resources.aiModel.progress).toBe(50);
      expect(mockHandler).toHaveBeenCalledWith('aiModel', 'downloading', 50);
    });

    test('should validate resource names', () => {
      const manager = new DownloadManager('minimal');
      
      expect(() => manager.updateResource('invalidResource', 'downloading', 0)).toThrow();
      expect(() => manager.updateResource('', 'downloading', 0)).toThrow();
      expect(() => manager.updateResource(null, 'downloading', 0)).toThrow();
    });

    test('should validate resource status values', () => {
      const manager = new DownloadManager('minimal');
      
      const validStatuses = ['pending', 'downloading', 'loaded', 'error'];
      validStatuses.forEach(status => {
        expect(() => manager.updateResource('aiModel', status, 0)).not.toThrow();
      });

      expect(() => manager.updateResource('aiModel', 'invalid', 0)).toThrow();
    });

    test('should validate progress values', () => {
      const manager = new DownloadManager('minimal');
      
      expect(() => manager.updateResource('aiModel', 'downloading', -1)).toThrow();
      expect(() => manager.updateResource('aiModel', 'downloading', 101)).toThrow();
      expect(() => manager.updateResource('aiModel', 'downloading', 'invalid')).toThrow();
      
      // Valid progress values
      expect(() => manager.updateResource('aiModel', 'downloading', 0)).not.toThrow();
      expect(() => manager.updateResource('aiModel', 'downloading', 50)).not.toThrow();
      expect(() => manager.updateResource('aiModel', 'downloading', 100)).not.toThrow();
    });
  });

  describe('Download Process', () => {
    test('should not start download without package type', () => {
      // This would catch the error where packageType is undefined
      const manager = new DownloadManager('minimal');
      manager.packageType = undefined;
      
      expect(async () => await manager.downloadAIModel()).rejects.toThrow();
    });

    test('should handle fetch errors gracefully', async () => {
      const manager = new DownloadManager('minimal');
      const mockErrorHandler = jest.fn();
      manager.setEventHandlers({ onError: mockErrorHandler });

      // Mock fetch to fail
      mockFetchError(404, 'Not Found');

      await expect(manager.checkPackageAvailability()).rejects.toThrow();
      expect(mockErrorHandler).toHaveBeenCalled();
    });

    test('should validate API responses', async () => {
      const manager = new DownloadManager('minimal');

      // Mock successful but invalid response
      mockFetchSuccess({ invalid: 'response' });

      await expect(manager.checkPackageAvailability()).rejects.toThrow();
    });

    test('should abort download when requested', () => {
      const manager = new DownloadManager('minimal');
      
      manager.abort();
      expect(manager.aborted).toBe(true);
      
      // Should not proceed with download when aborted
      expect(manager.downloadAIModel()).resolves.toBeUndefined();
    });
  });

  describe('Progress Calculation', () => {
    test('should calculate overall progress correctly', () => {
      const manager = new DownloadManager('minimal');
      
      // Set individual progress values
      manager.resources.libraries.progress = 100;
      manager.resources.aiModel.progress = 50;
      manager.resources.wikipedia.progress = 0;
      
      const overallProgress = manager.calculateOverallProgress();
      
      // Should be weighted average based on component weights
      expect(overallProgress).toBeGreaterThan(0);
      expect(overallProgress).toBeLessThan(100);
    });

    test('should handle edge cases in progress calculation', () => {
      const manager = new DownloadManager('minimal');
      
      // All at 0%
      const zeroProgress = manager.calculateOverallProgress();
      expect(zeroProgress).toBe(0);
      
      // All at 100%
      manager.resources.libraries.progress = 100;
      manager.resources.aiModel.progress = 100;
      manager.resources.wikipedia.progress = 100;
      
      const fullProgress = manager.calculateOverallProgress();
      expect(fullProgress).toBe(100);
    });
  });

  describe('Resource Name Resolution', () => {
    test('should return correct resource names for display', () => {
      const manager = new DownloadManager('minimal');
      
      expect(manager.getResourceName('aiModel')).toBe(manager.packages.minimal.aiModel.name);
      expect(manager.getResourceName('wikipedia')).toBe('Wikipedia Database');
      expect(manager.getResourceName('libraries')).toBe('Core Libraries');
    });

    test('should handle invalid resource names', () => {
      const manager = new DownloadManager('minimal');
      
      expect(manager.getResourceName('invalid')).toBe('Unknown Resource');
      expect(manager.getResourceName('')).toBe('Unknown Resource');
      expect(manager.getResourceName(null)).toBe('Unknown Resource');
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors during download', async () => {
      const manager = new DownloadManager('minimal');
      const mockErrorHandler = jest.fn();
      manager.setEventHandlers({ onError: mockErrorHandler });

      // Mock network error for all fetch calls in this test
      global.fetch.mockRejectedValue(new Error('Network Error'));

      await expect(manager.downloadLibraries()).rejects.toThrow();
      expect(mockErrorHandler).toHaveBeenCalled();
      expect(mockErrorHandler.mock.calls[0][0]).toContain('Network Error');
    });

    test('should handle malformed API responses', async () => {
      const manager = new DownloadManager('minimal');
      
      // Mock response with invalid JSON
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(manager.checkPackageAvailability()).rejects.toThrow();
    });

    test('should handle missing DOM elements gracefully', () => {
      const manager = new DownloadManager('minimal');
      
      // Mock getElementById to return null
      document.getElementById = jest.fn(() => null);
      
      // Should not throw when updating progress with missing elements
      expect(() => manager.updateProgress('Test message')).not.toThrow();
    });
  });

  describe('Storage Space Validation', () => {
    test('should check storage space before download', async () => {
      const manager = new DownloadManager('minimal');
      
      // Mock navigator.storage.estimate
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          quota: 1000 * 1024 * 1024, // 1GB
          usage: 100 * 1024 * 1024    // 100MB used
        })
      };

      const result = await manager.checkStorageSpace();
      
      expect(result).toHaveProperty('sufficient');
      expect(result).toHaveProperty('message');
      expect(result.sufficient).toBe(true);
    });

    test('should return insufficient storage when space is low', async () => {
      const manager = new DownloadManager('standard');
      
      // Mock insufficient storage
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          quota: 500 * 1024 * 1024,   // 500MB total
          usage: 100 * 1024 * 1024    // 100MB used, only 400MB available
        })
      };

      const result = await manager.checkStorageSpace();
      
      expect(result.sufficient).toBe(false);
      expect(result.message).toContain('Insufficient storage space');
    });

    test('should handle missing Storage API gracefully', async () => {
      const manager = new DownloadManager('minimal');
      
      // Remove storage API
      delete global.navigator.storage;

      const result = await manager.checkStorageSpace();
      
      expect(result.sufficient).toBe(true);
      expect(result.message).toContain('Storage check not available');
    });

    test('should calculate correct package sizes in bytes', () => {
      const minimalManager = new DownloadManager('minimal');
      const standardManager = new DownloadManager('standard');
      const fullManager = new DownloadManager('full');

      expect(minimalManager.getPackageSizeInBytes()).toBe(175 * 1024 * 1024);
      expect(standardManager.getPackageSizeInBytes()).toBe(555 * 1024 * 1024);
      expect(fullManager.getPackageSizeInBytes()).toBe(1705 * 1024 * 1024);
    });

    test('should calculate package sizes using static method', () => {
      expect(DownloadManager.getPackageSizeInBytesStatic('minimal')).toBe(175 * 1024 * 1024);
      expect(DownloadManager.getPackageSizeInBytesStatic('standard')).toBe(555 * 1024 * 1024);
      expect(DownloadManager.getPackageSizeInBytesStatic('full')).toBe(1705 * 1024 * 1024);
    });

    test('should use class constant for library size', () => {
      expect(DownloadManager.LIBRARIES_SIZE_MB).toBe(5);
    });

    test('should add 20% buffer to storage requirement', async () => {
      const manager = new DownloadManager('minimal');
      const requiredBytes = manager.getPackageSizeInBytes();
      const requiredWithBuffer = requiredBytes * 1.2;
      
      // Create a scenario where available space is just above required but below buffered requirement
      const smallMargin = 1024; // 1KB margin - above required but definitely below 20% buffer
      
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          quota: 1000 * 1024 * 1024,
          usage: 1000 * 1024 * 1024 - requiredBytes - smallMargin
        })
      };

      const result = await manager.checkStorageSpace();
      
      // Should fail because available (requiredBytes + smallMargin) < requiredWithBuffer (requiredBytes * 1.2)
      expect(result.sufficient).toBe(false);
    });

    test('should handle storage estimation errors', async () => {
      const manager = new DownloadManager('minimal');
      
      global.navigator.storage = {
        estimate: jest.fn().mockRejectedValue(new Error('Storage error'))
      };

      const result = await manager.checkStorageSpace();
      
      // Should allow download to proceed on error
      expect(result.sufficient).toBe(true);
      expect(result.message).toContain('Unable to verify storage space');
    });

    test('should prevent download when storage check fails', async () => {
      const manager = new DownloadManager('full');
      
      // Mock insufficient storage
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          quota: 1000 * 1024 * 1024,  // 1GB total
          usage: 900 * 1024 * 1024    // 900MB used
        })
      };

      // Mock the error handler
      const mockErrorHandler = jest.fn();
      manager.setEventHandlers({
        onError: mockErrorHandler
      });

      // Try to start download
      await manager.startDownload();

      // Should have called error handler with storage error
      expect(mockErrorHandler).toHaveBeenCalled();
      expect(mockErrorHandler.mock.calls[0][0]).toContain('Insufficient storage space');
    });
  });
});

