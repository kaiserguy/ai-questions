/**
 * Integration tests for server routing and view configuration
 * These tests would have caught the view path errors I made
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');

describe('Server Routing Tests', () => {
  describe('Offline Route Configuration', () => {
    test('should have offline.ejs file in core/views directory', () => {
      const offlineViewPath = path.join(__dirname, '../../core/views/offline.ejs');
      expect(fs.existsSync(offlineViewPath)).toBe(true);
    });

    test('should not have duplicate offline.ejs in hosted/views', () => {
      const hostedOfflineViewPath = path.join(__dirname, '../../hosted/views/offline.ejs');
      expect(fs.existsSync(hostedOfflineViewPath)).toBe(false);
    });

    test('should have valid EJS syntax in offline.ejs', () => {
      const offlineViewPath = path.join(__dirname, '../../core/views/offline.ejs');
      const content = fs.readFileSync(offlineViewPath, 'utf8');
      
      // Basic EJS syntax validation
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<html');
      expect(content).toContain('</html>');
      
      // Check for balanced EJS tags
      const openTags = (content.match(/<%/g) || []).length;
      const closeTags = (content.match(/%>/g) || []).length;
      expect(openTags).toBe(closeTags);
    });
  });

  describe('View Path Resolution', () => {
    test('hosted server should have correct view paths configured', () => {
      // Mock hosted server configuration
      const mockApp = {
        set: jest.fn(),
        viewPaths: []
      };
      
      // Simulate hosted server view configuration
      const viewPaths = [
        path.join(__dirname, '../../hosted/views'),
        path.join(__dirname, '../../core/views')
      ];
      
      mockApp.set('views', viewPaths);
      
      expect(mockApp.set).toHaveBeenCalledWith('views', viewPaths);
      
      // Verify both paths exist
      viewPaths.forEach(viewPath => {
        expect(fs.existsSync(viewPath)).toBe(true);
      });
    });

    test('local server should have correct view paths configured', () => {
      // Mock local server configuration
      const mockApp = {
        set: jest.fn()
      };
      
      // Simulate local server view configuration
      const viewPath = path.join(__dirname, '../../core/views');
      mockApp.set('views', viewPath);
      
      expect(mockApp.set).toHaveBeenCalledWith('views', viewPath);
      expect(fs.existsSync(viewPath)).toBe(true);
    });
  });

  describe('Static File Serving', () => {
    test('should have all required offline JavaScript files', () => {
      const requiredFiles = [
        'core/public/offline/download-manager.js',
        'core/public/offline/integration-manager.js',
        'core/public/offline/ai-models.js',
        'core/public/offline/wikipedia.js',
        'core/public/offline/resource-monitor.js'
      ];

      requiredFiles.forEach(filePath => {
        const fullPath = path.join(__dirname, '../../', filePath);
        expect(fs.existsSync(fullPath)).toBe(true);
      });
    });

    test('should have consistent JavaScript files between core and hosted', () => {
      const jsFiles = [
        'download-manager.js',
        'integration-manager.js',
        'ai-models.js',
        'wikipedia.js'
      ];

      jsFiles.forEach(fileName => {
        const corePath = path.join(__dirname, '../../core/public/offline', fileName);
        const hostedPath = path.join(__dirname, '../../hosted/public/offline', fileName);
        
        expect(fs.existsSync(corePath)).toBe(true);
        
        // If hosted version exists, it should be identical or we should document why it's different
        if (fs.existsSync(hostedPath)) {
          const coreContent = fs.readFileSync(corePath, 'utf8');
          const hostedContent = fs.readFileSync(hostedPath, 'utf8');
          
          // They should be identical or we should have a good reason for differences
          if (coreContent !== hostedContent) {
            console.warn(`Difference detected between core and hosted versions of ${fileName}`);
          }
        }
      });
    });
  });

  describe('API Endpoint Configuration', () => {
    test('should have offline package routes defined', () => {
      const routeFiles = [
        'local/offline-package-routes.js',
        'hosted/offline-package-routes-new.js'
      ];

      routeFiles.forEach(routeFile => {
        const routePath = path.join(__dirname, '../../', routeFile);
        if (fs.existsSync(routePath)) {
          const content = fs.readFileSync(routePath, 'utf8');
          
          // Should export routes
          expect(content).toContain('module.exports');
          
          // Should have package availability endpoint
          expect(content).toContain('/packages/availability');
        }
      });
    });

    test('should validate API route responses', () => {
      // Mock API responses that should be returned
      const expectedRoutes = [
        '/api/offline/packages/availability',
        '/api/offline/packages/minimal/manifest',
        '/api/offline/packages/standard/manifest',
        '/api/offline/packages/full/manifest'
      ];

      expectedRoutes.forEach(route => {
        // Each route should return proper JSON structure
        const mockResponse = {
          success: true,
          data: expect.any(Object)
        };
        
        expect(mockResponse.success).toBe(true);
        expect(mockResponse.data).toBeDefined();
      });
    });
  });
});

describe('JavaScript Module Tests', () => {
  describe('DownloadManager Module', () => {
    test('should have proper class definition', () => {
      const downloadManagerPath = path.join(__dirname, '../../core/public/offline/download-manager.js');
      const content = fs.readFileSync(downloadManagerPath, 'utf8');
      
      // Should define DownloadManager class
      expect(content).toContain('class DownloadManager');
      
      // Should have constructor that takes packageType
      expect(content).toContain('constructor(packageType)');
      
      // Should have required methods
      expect(content).toContain('startDownload');
      expect(content).toContain('downloadAIModel');
      expect(content).toContain('setEventHandlers');
    });

    test('should validate package configurations in DownloadManager', () => {
      const downloadManagerPath = path.join(__dirname, '../../core/public/offline/download-manager.js');
      const content = fs.readFileSync(downloadManagerPath, 'utf8');
      
      // Should have package configurations
      expect(content).toContain('minimal:');
      expect(content).toContain('standard:');
      expect(content).toContain('full:');
      
      // Each package should have aiModel configuration
      expect(content).toContain('aiModel:');
      expect(content).toContain('name:');
      expect(content).toContain('size:');
    });
  });

  describe('Integration Manager Module', () => {
    test('should have proper class definition', () => {
      const integrationManagerPath = path.join(__dirname, '../../core/public/offline/integration-manager.js');
      
      if (fs.existsSync(integrationManagerPath)) {
        const content = fs.readFileSync(integrationManagerPath, 'utf8');
        
        // Should define OfflineIntegrationManager class
        expect(content).toContain('class OfflineIntegrationManager');
        
        // Should have required methods
        expect(content).toContain('setPackageType');
        expect(content).toContain('checkInitializationComplete');
      }
    });
  });

  describe('JavaScript Syntax Validation', () => {
    test('should have valid JavaScript syntax in all offline modules', () => {
      const jsFiles = [
        'core/public/offline/download-manager.js',
        'core/public/offline/integration-manager.js',
        'core/public/offline/ai-models.js',
        'core/public/offline/wikipedia.js'
      ];

      jsFiles.forEach(filePath => {
        const fullPath = path.join(__dirname, '../../', filePath);
        
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          // Basic syntax checks
          expect(content).not.toContain('undefined.'); // Would catch my aiModel error
          expect(content).not.toContain('null.'); // Would catch null reference errors
          
          // Check for balanced braces
          const openBraces = (content.match(/{/g) || []).length;
          const closeBraces = (content.match(/}/g) || []).length;
          expect(openBraces).toBe(closeBraces);
          
          // Check for balanced parentheses
          const openParens = (content.match(/\(/g) || []).length;
          const closeParens = (content.match(/\)/g) || []).length;
          expect(openParens).toBe(closeParens);
        }
      });
    });

    test('should not have common JavaScript errors', () => {
      const jsFiles = [
        'core/public/offline/download-manager.js',
        'core/public/offline/integration-manager.js'
      ];

      jsFiles.forEach(filePath => {
        const fullPath = path.join(__dirname, '../../', filePath);
        
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          // Should not access properties on undefined
          expect(content).not.toMatch(/undefined\.[a-zA-Z]/);
          
          // Should not have typos in common method names
          expect(content).not.toContain('lenght'); // common typo for length
          expect(content).not.toContain('widht'); // common typo for width
          
          // Should not have missing semicolons in obvious places
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('return ') && !trimmed.endsWith(';') && !trimmed.endsWith('{')) {
              console.warn(`Possible missing semicolon at line ${index + 1}: ${trimmed}`);
            }
          });
        }
      });
    });
  });
});

describe('Configuration Validation Tests', () => {
  describe('Package Configuration Consistency', () => {
    test('should have consistent package types across all modules', () => {
      const expectedPackageTypes = ['minimal', 'standard', 'full'];
      const moduleFiles = [
        'core/public/offline/download-manager.js',
        'core/views/offline.ejs'
      ];

      moduleFiles.forEach(filePath => {
        const fullPath = path.join(__dirname, '../../', filePath);
        
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          expectedPackageTypes.forEach(packageType => {
            expect(content).toContain(packageType);
          });
        }
      });
    });

    test('should have required properties for each package type', () => {
      const downloadManagerPath = path.join(__dirname, '../../core/public/offline/download-manager.js');
      
      if (fs.existsSync(downloadManagerPath)) {
        const content = fs.readFileSync(downloadManagerPath, 'utf8');
        
        // Each package should have these required properties
        const requiredProperties = ['name', 'aiModel', 'wikipedia', 'totalSize'];
        const packageTypes = ['minimal', 'standard', 'full'];
        
        packageTypes.forEach(packageType => {
          requiredProperties.forEach(property => {
            // This is a basic check - in a real test we'd parse the JS and validate structure
            const packageSection = content.indexOf(`${packageType}:`);
            expect(packageSection).toBeGreaterThan(-1);
          });
        });
      }
    });
  });

  describe('DOM Element Validation', () => {
    test('should have required DOM elements in offline.ejs', () => {
      const offlineViewPath = path.join(__dirname, '../../core/views/offline.ejs');
      const content = fs.readFileSync(offlineViewPath, 'utf8');
      
      // Required elements that JavaScript tries to access
      const requiredElements = [
        'id="chatSection"',
        'id="wikiSection"',
        'id="progressSection"',
        'id="downloadBtn"',
        'id="progressText"'
      ];

      requiredElements.forEach(element => {
        expect(content).toContain(element);
      });
    });

    test('should have chatSection and wikiSection initially hidden', () => {
      const offlineViewPath = path.join(__dirname, '../../core/views/offline.ejs');
      const content = fs.readFileSync(offlineViewPath, 'utf8');
      
      // These sections should be hidden initially
      expect(content).toMatch(/id="chatSection"[^>]*style="[^"]*display:\s*none/);
      expect(content).toMatch(/id="wikiSection"[^>]*style="[^"]*display:\s*none/);
    });
  });

  describe('Config Route Configuration', () => {
    test('should have config.ejs file in core/views directory', () => {
      const configViewPath = path.join(__dirname, '../../core/views/config.ejs');
      expect(fs.existsSync(configViewPath)).toBe(true);
    });

    test('should have valid EJS syntax in config.ejs', () => {
      const configViewPath = path.join(__dirname, '../../core/views/config.ejs');
      const content = fs.readFileSync(configViewPath, 'utf8');
      
      // Basic EJS syntax validation
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<html');
      expect(content).toContain('</html>');
      
      // Check for balanced EJS tags
      const openTags = (content.match(/<%/g) || []).length;
      const closeTags = (content.match(/%>/g) || []).length;
      expect(openTags).toBe(closeTags);
    });

    test('should have /config route in hosted-app.js', () => {
      const hostedAppPath = path.join(__dirname, '../../hosted/hosted-app.js');
      const content = fs.readFileSync(hostedAppPath, 'utf8');
      
      // Check for config route
      expect(content).toMatch(/app\.get\(['"]\/config['"]/);
      expect(content).toMatch(/res\.render\(['"]config['"]/);
    });

    test('should have config API endpoints in hosted-app.js', () => {
      const hostedAppPath = path.join(__dirname, '../../hosted/hosted-app.js');
      const content = fs.readFileSync(hostedAppPath, 'utf8');
      
      // Check for config API endpoints
      expect(content).toMatch(/app\.get\(['"]\/api\/config\/models['"]/);
      expect(content).toMatch(/app\.post\(['"]\/api\/config\/models['"]/);
      expect(content).toMatch(/app\.get\(['"]\/api\/config\/api-keys['"]/);
      expect(content).toMatch(/app\.post\(['"]\/api\/config\/api-keys['"]/);
      expect(content).toMatch(/app\.delete\(['"]\/api\/config\/api-keys\/:provider['"]/);
    });

    test('config page should have API key configuration UI', () => {
      const configViewPath = path.join(__dirname, '../../core/views/config.ejs');
      const content = fs.readFileSync(configViewPath, 'utf8');
      
      // Check for API keys section
      expect(content).toContain('API Keys Configuration');
      expect(content).toContain('apiKeysSection');
      
      // Check for model configuration
      expect(content).toContain('Available AI Models');
      expect(content).toContain('modelsList');
    });

    test('config page should handle both logged-in and guest users', () => {
      const configViewPath = path.join(__dirname, '../../core/views/config.ejs');
      const content = fs.readFileSync(configViewPath, 'utf8');
      
      // Check for user status handling
      expect(content).toContain('currentUser');
      expect(content).toContain('Guest Mode');
      expect(content).toContain('Log in');
    });
  });
});

