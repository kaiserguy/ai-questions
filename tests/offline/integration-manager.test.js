/**
 * Unit tests for OfflineIntegrationManager and related components
 * These tests would have caught integration and initialization errors
 */

const OfflineIntegrationManager = require('../../core/public/offline/integration-manager');
const AIModelManager = require('../../core/public/offline/ai-model-manager');
const WikipediaManager = require('../../core/public/offline/wikipedia-manager');

describe('OfflineIntegrationManager', () => {
  let integrationManager;
  let mockDownloadManager;
  let mockAIModelManager;
  let mockWikipediaManager;

  beforeEach(() => {
    // Create mock managers
    mockDownloadManager = {
      setEventHandlers: jest.fn(),
      startDownload: jest.fn(),
      abort: jest.fn(),
      packageType: 'minimal'
    };

    mockAIModelManager = {
      initialize: jest.fn(),
      isReady: jest.fn(() => false),
      generateResponse: jest.fn()
    };

    mockWikipediaManager = {
      initialize: jest.fn(),
      isReady: jest.fn(() => false),
      search: jest.fn()
    };

    // Mock DOM elements
    createMockElement('chatSection', { style: { display: 'none' } });
    createMockElement('wikiSection', { style: { display: 'none' } });
    createMockElement('progressSection', { style: { display: 'block' } });
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with default values', () => {
      const manager = new OfflineIntegrationManager();
      
      expect(manager.packageType).toBeNull();
      expect(manager.downloadManager).toBeNull();
      expect(manager.aiModelManager).toBeNull();
      expect(manager.wikipediaManager).toBeNull();
      expect(manager.isInitialized).toBe(false);
    });

    test('should set package type correctly', () => {
      const manager = new OfflineIntegrationManager();
      
      manager.setPackageType('minimal');
      expect(manager.packageType).toBe('minimal');
      
      manager.setPackageType('standard');
      expect(manager.packageType).toBe('standard');
    });

    test('should validate package type', () => {
      const manager = new OfflineIntegrationManager();
      
      expect(() => manager.setPackageType('invalid')).toThrow();
      expect(() => manager.setPackageType('')).toThrow();
      expect(() => manager.setPackageType(null)).toThrow();
      expect(() => manager.setPackageType(undefined)).toThrow();
    });
  });

  describe('Component Initialization', () => {
    test('should initialize all components in correct order', async () => {
      const manager = new OfflineIntegrationManager();
      manager.setPackageType('minimal');
      
      // Inject mock managers
      manager.aiModelManager = mockAIModelManager;
      manager.wikipediaManager = mockWikipediaManager;
      
      // Mock successful initialization
      mockAIModelManager.initialize.mockResolvedValue(true);
      mockWikipediaManager.initialize.mockResolvedValue(true);
      
      await manager.initializeComponents();
      
      expect(mockAIModelManager.initialize).toHaveBeenCalled();
      expect(mockWikipediaManager.initialize).toHaveBeenCalled();
    });

    test('should handle component initialization failures', async () => {
      const manager = new OfflineIntegrationManager();
      manager.setPackageType('minimal');
      
      // Inject mock managers
      manager.aiModelManager = mockAIModelManager;
      manager.wikipediaManager = mockWikipediaManager;
      
      // Mock failed initialization
      mockAIModelManager.initialize.mockRejectedValue(new Error('AI Model failed'));
      
      await expect(manager.initializeComponents()).rejects.toThrow('AI Model failed');
    });

    test('should not initialize without package type', async () => {
      const manager = new OfflineIntegrationManager();
      
      await expect(manager.initializeComponents()).rejects.toThrow();
    });
  });

  describe('Readiness Checking', () => {
    test('should check all components are ready', () => {
      const manager = new OfflineIntegrationManager();
      manager.aiModelManager = mockAIModelManager;
      manager.wikipediaManager = mockWikipediaManager;
      
      // All components not ready
      mockAIModelManager.isReady.mockReturnValue(false);
      mockWikipediaManager.isReady.mockReturnValue(false);
      expect(manager.checkInitializationComplete()).toBe(false);
      
      // Only AI ready
      mockAIModelManager.isReady.mockReturnValue(true);
      mockWikipediaManager.isReady.mockReturnValue(false);
      expect(manager.checkInitializationComplete()).toBe(false);
      
      // All components ready
      mockAIModelManager.isReady.mockReturnValue(true);
      mockWikipediaManager.isReady.mockReturnValue(true);
      expect(manager.checkInitializationComplete()).toBe(true);
    });

    test('should handle missing components gracefully', () => {
      const manager = new OfflineIntegrationManager();
      
      // No components initialized
      expect(manager.checkInitializationComplete()).toBe(false);
      
      // Only one component
      manager.aiModelManager = mockAIModelManager;
      mockAIModelManager.isReady.mockReturnValue(true);
      expect(manager.checkInitializationComplete()).toBe(false);
    });
  });

  describe('UI State Management', () => {
    test('should show chat and wiki sections when initialization complete', () => {
      const manager = new OfflineIntegrationManager();
      const chatSection = createMockElement('chatSection');
      const wikiSection = createMockElement('wikiSection');
      const progressSection = createMockElement('progressSection');
      
      manager.showOfflineInterface();
      
      expect(chatSection.style.display).toBe('block');
      expect(wikiSection.style.display).toBe('block');
      expect(progressSection.style.display).toBe('none');
    });

    test('should handle missing DOM elements gracefully', () => {
      const manager = new OfflineIntegrationManager();
      
      // Mock getElementById to return null
      document.getElementById = jest.fn(() => null);
      
      expect(() => manager.showOfflineInterface()).not.toThrow();
    });

    test('should update progress display correctly', () => {
      const manager = new OfflineIntegrationManager();
      const progressElement = createMockElement('progressText');
      
      manager.updateProgress('Test message', 50);
      
      expect(progressElement.textContent).toContain('Test message');
      expect(progressElement.textContent).toContain('50%');
    });
  });

  describe('Error Handling', () => {
    test('should handle download errors gracefully', () => {
      const manager = new OfflineIntegrationManager();
      const mockErrorHandler = jest.fn();
      manager.onError = mockErrorHandler;
      
      const error = new Error('Download failed');
      manager.handleError(error);
      
      expect(mockErrorHandler).toHaveBeenCalledWith(error);
    });

    test('should display error messages to user', () => {
      const manager = new OfflineIntegrationManager();
      const errorElement = createMockElement('errorMessage');
      
      manager.displayError('Test error message');
      
      expect(errorElement.textContent).toBe('Test error message');
      expect(errorElement.style.display).toBe('block');
    });

    test('should handle component failures during initialization', async () => {
      const manager = new OfflineIntegrationManager();
      manager.setPackageType('minimal');
      
      // Inject mock managers
      manager.aiModelManager = mockAIModelManager;
      manager.wikipediaManager = mockWikipediaManager;
      
      // Mock component that fails to initialize
      mockAIModelManager.initialize.mockResolvedValue(true);
      mockWikipediaManager.initialize.mockRejectedValue(new Error('Wikipedia init failed'));
      
      const mockErrorHandler = jest.fn();
      manager.onError = mockErrorHandler;
      
      await expect(manager.initializeComponents()).rejects.toThrow();
      expect(mockErrorHandler).toHaveBeenCalled();
    });
  });
});

describe('AIModelManager', () => {
  let aiModelManager;

  beforeEach(() => {
    // Reset global mocks
    global.fetch.mockClear();
  });

  describe('Initialization', () => {
    test('should initialize with package type', () => {
      const manager = new AIModelManager('minimal');
      expect(manager.packageType).toBe('minimal');
      expect(manager.isReady()).toBe(false);
    });

    test('should require package type', () => {
      expect(() => new AIModelManager()).toThrow();
      expect(() => new AIModelManager(null)).toThrow();
      expect(() => new AIModelManager('')).toThrow();
    });

    test('should validate package type', () => {
      expect(() => new AIModelManager('invalid')).toThrow();
      expect(() => new AIModelManager('minimal')).not.toThrow();
      expect(() => new AIModelManager('standard')).not.toThrow();
      expect(() => new AIModelManager('full')).not.toThrow();
    });
  });

  describe('Model Loading', () => {
    beforeEach(() => {
      // Mock WebLLM in window
      global.window = global.window || {};
      global.window.webllm = {
        CreateMLCEngine: jest.fn().mockResolvedValue({
          chat: {
            completions: {
              create: jest.fn().mockResolvedValue({
                choices: [{ message: { content: 'test response' } }]
              })
            }
          },
          unload: jest.fn()
        })
      };
    });

    afterEach(() => {
      delete global.window.webllm;
    });

    test('should load model based on package type', async () => {
      const manager = new AIModelManager('minimal');
      
      await manager.loadModel();
      expect(manager.isReady()).toBe(true);
    });

    test('should handle model loading failures', async () => {
      const manager = new AIModelManager('minimal');
      
      // Simulate loading failure by setting invalid package type after construction
      manager.packageType = null;
      
      await expect(manager.loadModel()).rejects.toThrow('Package type must be set');
      expect(manager.isReady()).toBe(false);
    });

    test('should not load model multiple times', async () => {
      const manager = new AIModelManager('minimal');
      
      // First load should succeed
      await manager.loadModel();
      expect(manager.isReady()).toBe(true);
      
      // Second call should return early (already loaded)
      await manager.loadModel();
      
      // Model should still be ready
      expect(manager.isReady()).toBe(true);
    });
  });

  describe('Response Generation', () => {
    test('should generate responses when ready', async () => {
      const manager = new AIModelManager('minimal');
      manager.ready = true; // Mock ready state
      manager.model = {}; // isReady() checks this.model !== null
      
      const mockResponse = 'This is a test response';
      // Mock the WebLLM engine structure
      manager.engine = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: mockResponse } }]
            })
          }
        }
      };
      
      const response = await manager.generateResponse('Test question');
      expect(response).toBe(mockResponse);
    });

    test('should not generate responses when not ready', async () => {
      const manager = new AIModelManager('minimal');
      
      await expect(manager.generateResponse('Test question')).rejects.toThrow();
    });

    test('should handle generation errors', async () => {
      const manager = new AIModelManager('minimal');
      manager.ready = true;
      manager.model = {}; // isReady() checks this.model !== null
      // Mock the WebLLM engine structure with an error
      manager.engine = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('Generation failed'))
          }
        }
      };
      
      await expect(manager.generateResponse('Test question')).rejects.toThrow('Generation failed');
    });
  });
});

describe('WikipediaManager', () => {
  let wikipediaManager;

  beforeEach(() => {
    global.fetch.mockClear();
  });

  describe('Initialization', () => {
    test('should initialize with package type', () => {
      const manager = new WikipediaManager('minimal');
      expect(manager.packageType).toBe('minimal');
      expect(manager.isReady()).toBe(false);
    });

    test('should require package type', () => {
      expect(() => new WikipediaManager()).toThrow();
      expect(() => new WikipediaManager(null)).toThrow();
    });

    test('should validate package type', () => {
      expect(() => new WikipediaManager('invalid')).toThrow();
      expect(() => new WikipediaManager('minimal')).not.toThrow();
    });
  });

  describe('Database Loading', () => {
    test('should load database based on package type', async () => {
      const manager = new WikipediaManager('minimal');
      
      // Mock storage to avoid actual IndexedDB operations
      manager.storage = {
        initialize: jest.fn().mockResolvedValue(true),
        getArticleCount: jest.fn().mockResolvedValue(100),
        getSearchIndex: jest.fn().mockResolvedValue(null)
      };
      
      await manager.loadDatabase();
      expect(manager.isReady()).toBe(true);
    }, 15000);

    test('should handle database loading failures', async () => {
      const manager = new WikipediaManager('minimal');
      
      // Simulate loading failure by breaking the storage
      manager.storage = {
        initialize: jest.fn().mockRejectedValue(new Error('Storage initialization failed'))
      };
      
      await expect(manager.loadDatabase()).rejects.toThrow('Storage initialization failed');
      expect(manager.isReady()).toBe(false);
    }, 15000);

    test('should handle missing package configuration', async () => {
      const manager = new WikipediaManager('minimal');
      
      // Simulate storage error
      manager.storage = {
        initialize: jest.fn().mockRejectedValue(new Error('Configuration error'))
      };
      
      await expect(manager.loadDatabase()).rejects.toThrow();
    }, 15000);
  });

  describe('Search Functionality', () => {
    test('should search when database is ready', async () => {
      const manager = new WikipediaManager('minimal');
      manager.ready = true;
      manager.useSearch = true;
      manager.searchIndex = {
        search: jest.fn().mockReturnValue([{ title: 'Article 1' }, { title: 'Article 2' }])
      };
      
      const results = await manager.search('test query');
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Article 1');
    });

    test('should not search when database not ready', async () => {
      const manager = new WikipediaManager('minimal');
      
      await expect(manager.search('test query')).rejects.toThrow('Database not ready');
    });

    test('should handle search errors', async () => {
      const manager = new WikipediaManager('minimal');
      manager.ready = true;
      manager.useSearch = true;
      manager.searchIndex = {
        search: jest.fn().mockImplementation(() => { throw new Error('Search failed'); })
      };
      
      await expect(manager.search('test query')).rejects.toThrow('Search failed');
    });
  });
});

describe('Integration Tests', () => {
  let mockAIModelManager;
  let mockWikipediaManager;
  
  beforeEach(() => {
    // Create mock managers for integration tests
    mockAIModelManager = {
      initialize: jest.fn(),
      isReady: jest.fn(() => false),
      generateResponse: jest.fn()
    };

    mockWikipediaManager = {
      initialize: jest.fn(),
      isReady: jest.fn(() => false),
      search: jest.fn()
    };
  });
  
  describe('Complete Offline Flow', () => {
    test('should complete full offline initialization flow', async () => {
      const integrationManager = new OfflineIntegrationManager();
      integrationManager.setPackageType('minimal');
      
      // Inject mock managers
      integrationManager.aiModelManager = mockAIModelManager;
      integrationManager.wikipediaManager = mockWikipediaManager;
      
      // Mock all components to succeed
      mockAIModelManager.initialize.mockResolvedValue(true);
      mockWikipediaManager.initialize.mockResolvedValue(true);
      mockAIModelManager.isReady.mockReturnValue(true);
      mockWikipediaManager.isReady.mockReturnValue(true);
      
      await integrationManager.initializeComponents();
      
      expect(integrationManager.checkInitializationComplete()).toBe(true);
    });

    test('should handle partial initialization failures', async () => {
      const integrationManager = new OfflineIntegrationManager();
      integrationManager.setPackageType('minimal');
      
      // Inject mock managers
      integrationManager.aiModelManager = mockAIModelManager;
      integrationManager.wikipediaManager = mockWikipediaManager;
      
      // Mock AI to succeed, Wikipedia to fail
      mockAIModelManager.initialize.mockResolvedValue(true);
      mockWikipediaManager.initialize.mockRejectedValue(new Error('Wikipedia failed'));
      
      await expect(integrationManager.initializeComponents()).rejects.toThrow();
      expect(integrationManager.checkInitializationComplete()).toBe(false);
    });
  });

  describe('Error Recovery', () => {
    test('should allow retry after failure', async () => {
      const integrationManager = new OfflineIntegrationManager();
      integrationManager.setPackageType('minimal');
      
      // Inject mock managers
      integrationManager.aiModelManager = mockAIModelManager;
      integrationManager.wikipediaManager = mockWikipediaManager;
      
      // First attempt fails
      mockAIModelManager.initialize.mockRejectedValueOnce(new Error('First failure'));
      await expect(integrationManager.initializeComponents()).rejects.toThrow();
      
      // Second attempt succeeds
      mockAIModelManager.initialize.mockResolvedValue(true);
      mockWikipediaManager.initialize.mockResolvedValue(true);
      
      await expect(integrationManager.initializeComponents()).resolves.not.toThrow();
    });

    test('should clean up resources on failure', async () => {
      const integrationManager = new OfflineIntegrationManager();
      integrationManager.setPackageType('minimal');
      
      // Inject mock managers
      integrationManager.aiModelManager = mockAIModelManager;
      integrationManager.wikipediaManager = mockWikipediaManager;
      
      const mockCleanup = jest.fn();
      integrationManager.cleanup = mockCleanup;
      
      mockAIModelManager.initialize.mockRejectedValue(new Error('Initialization failed'));
      
      await expect(integrationManager.initializeComponents()).rejects.toThrow();
      expect(mockCleanup).toHaveBeenCalled();
    });
  });
});

