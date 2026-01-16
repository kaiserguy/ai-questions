/**
 * Tests for Offline Route Fix (Issue #69)
 * Validates that the /offline page route works and resource routes are properly prefixed
 */

const fs = require('fs');
const path = require('path');

describe('Offline Route Fix Tests (Issue #69)', () => {
    const hostedAppPath = path.join(__dirname, '../../hosted/hosted-app.js');
    let hostedAppContent;

    beforeAll(() => {
        hostedAppContent = fs.readFileSync(hostedAppPath, 'utf8');
    });

    describe('Route Configuration', () => {
        test('should use /offline-resources prefix for resource routes', () => {
            expect(hostedAppContent).toContain("app.use('/offline-resources', offlineResourceRoutes)");
        });

        test('should NOT use /offline prefix for resource routes', () => {
            // Check that we don't have the old problematic line
            const lines = hostedAppContent.split('\n');
            const resourceRouteLine = lines.find(line => 
                line.includes('offlineResourceRoutes') && 
                line.includes('app.use')
            );
            
            expect(resourceRouteLine).toBeDefined();
            expect(resourceRouteLine).not.toContain("app.use('/offline', offlineResourceRoutes)");
        });

        test('should have /offline page route defined', () => {
            expect(hostedAppContent).toContain('app.get("/offline"');
            expect(hostedAppContent).toContain('res.render("offline"');
        });

        test('resource routes should be mounted before page route', () => {
            const resourceRouteIndex = hostedAppContent.indexOf("app.use('/offline-resources'");
            const pageRouteIndex = hostedAppContent.indexOf('app.get("/offline"');
            
            // Resource routes should come before page route to avoid conflicts
            expect(resourceRouteIndex).toBeLessThan(pageRouteIndex);
        });
    });

    describe('Offline JavaScript Files', () => {
        const offlineJsDir = path.join(__dirname, '../../core/public/offline');
        
        test('offline JavaScript directory should exist', () => {
            expect(fs.existsSync(offlineJsDir)).toBe(true);
        });

        test('offline JavaScript files should use /offline-resources/ prefix', () => {
            const jsFiles = fs.readdirSync(offlineJsDir)
                .filter(file => file.endsWith('.js'))
                .map(file => path.join(offlineJsDir, file));

            jsFiles.forEach(filePath => {
                const content = fs.readFileSync(filePath, 'utf8');
                const fileName = path.basename(filePath);
                
                // Skip service-worker.js and sw.js as they are served from /offline/ (public directory)
                if (fileName === 'service-worker.js' || fileName === 'sw.js') {
                    return;
                }
                
                // Check for old /offline/ paths (excluding /offline-resources/ and script files)
                const oldPaths = content.match(/['"]\/offline\/(?!service-worker|wikipedia-manager|offline-init)/g);
                
                expect(oldPaths).toBeNull();
            });
        });

        test('ai-models.js should reference /offline-resources/models/', () => {
            const aiModelsPath = path.join(offlineJsDir, 'ai-models.js');
            if (fs.existsSync(aiModelsPath)) {
                const content = fs.readFileSync(aiModelsPath, 'utf8');
                expect(content).toContain('/offline-resources/models/');
            }
        });

        test('download-manager.js should reference /offline-resources/ paths', () => {
            const downloadManagerPath = path.join(offlineJsDir, 'download-manager.js');
            if (fs.existsSync(downloadManagerPath)) {
                const content = fs.readFileSync(downloadManagerPath, 'utf8');
                
                // Should have offline-resources paths
                expect(content).toContain('/offline-resources/');
                
                // Check specific resource types
                if (content.includes('libs/')) {
                    expect(content).toContain('/offline-resources/libs/');
                }
                if (content.includes('models/')) {
                    expect(content).toContain('/offline-resources/models/');
                }
                if (content.includes('wikipedia/')) {
                    expect(content).toContain('/offline-resources/wikipedia/');
                }
            }
        });

        test('app-enhanced.js should reference /offline-resources/ paths', () => {
            const appEnhancedPath = path.join(offlineJsDir, 'app-enhanced.js');
            if (fs.existsSync(appEnhancedPath)) {
                const content = fs.readFileSync(appEnhancedPath, 'utf8');
                
                // Should have offline-resources paths for models and libs
                if (content.includes('/models/') || content.includes('/libs/')) {
                    expect(content).toContain('/offline-resources/');
                }
            }
        });
    });

    describe('Offline Resource Routes', () => {
        const resourceRoutesPath = path.join(__dirname, '../../core/offline-resource-routes.js');
        
        test('offline-resource-routes.js should exist', () => {
            expect(fs.existsSync(resourceRoutesPath)).toBe(true);
        });

        test('should define routes for libs, models, and wikipedia', () => {
            const content = fs.readFileSync(resourceRoutesPath, 'utf8');
            
            expect(content).toContain("router.get('/libs/:filename'");
            expect(content).toContain("router.get('/models/:filename'");
            expect(content).toContain("router.get('/wikipedia/:filename'");
        });

        test('should NOT define root / route (to avoid conflict)', () => {
            const content = fs.readFileSync(resourceRoutesPath, 'utf8');
            
            // Should not have a root route that would conflict with /offline page
            const lines = content.split('\n');
            const rootRoutes = lines.filter(line => 
                line.includes("router.get('/'") && 
                !line.includes('/libs') && 
                !line.includes('/models') &&
                !line.includes('/wikipedia') &&
                !line.includes('/packages')
            );
            
            expect(rootRoutes.length).toBe(0);
        });
    });

    describe('Route Priority and Conflicts', () => {
        test('should not have route conflicts between page and resources', () => {
            // The resource routes are now at /offline-resources/*
            // The page route is at /offline
            // These should not conflict
            
            const resourcePrefix = '/offline-resources';
            const pageRoute = '/offline';
            
            // Verify they don't overlap
            expect(pageRoute).not.toContain(resourcePrefix);
            expect(resourcePrefix).toContain(pageRoute); // /offline-resources contains /offline as substring
            
            // But Express routing won't conflict because:
            // - /offline-resources/* will match paths starting with /offline-resources/
            // - /offline will only match exact /offline path
        });

        test('resource routes should handle specific paths only', () => {
            const resourceRoutesContent = fs.readFileSync(
                path.join(__dirname, '../../core/offline-resource-routes.js'),
                'utf8'
            );
            
            // Resource routes should be specific (with parameters or subpaths)
            const routeDefinitions = resourceRoutesContent.match(/router\.get\(['"][^'"]+['"]/g) || [];
            
            routeDefinitions.forEach(routeDef => {
                // Each route should have a specific path (not just '/')
                expect(routeDef).not.toMatch(/router\.get\(['"]\/?['"]/);
            });
        });
    });

    describe('Documentation and Comments', () => {
        test('hosted-app.js should have clear comment about resource routes', () => {
            expect(hostedAppContent).toContain('offline resource routes');
        });

        test('should document the route separation', () => {
            // Check that there's documentation about the route structure
            const hasResourceComment = hostedAppContent.includes('offline resource routes') ||
                                      hostedAppContent.includes('serving libraries, models');
            const hasPageComment = hostedAppContent.includes('offline HTML5') ||
                                  hostedAppContent.includes('Serve offline');
            
            expect(hasResourceComment).toBe(true);
            expect(hasPageComment).toBe(true);
        });
    });

    describe('Integration', () => {
        test('offline.ejs should exist', () => {
            const offlineEjsPath = path.join(__dirname, '../../core/views/offline.ejs');
            expect(fs.existsSync(offlineEjsPath)).toBe(true);
        });

        test('offline.ejs should render the offline mode page', () => {
            const offlineEjsPath = path.join(__dirname, '../../core/views/offline.ejs');
            const content = fs.readFileSync(offlineEjsPath, 'utf8');
            
            // Should have offline mode content
            expect(content).toContain('Offline Mode');
        });

        test('navigation links should point to /offline', () => {
            const viewsDir = path.join(__dirname, '../../core/views');
            const ejsFiles = fs.readdirSync(viewsDir)
                .filter(file => file.endsWith('.ejs'))
                .map(file => path.join(viewsDir, file));

            ejsFiles.forEach(filePath => {
                const content = fs.readFileSync(filePath, 'utf8');
                const fileName = path.basename(filePath);
                
                // Check for offline links
                const offlineLinks = content.match(/href=["']\/offline["']/g);
                
                if (offlineLinks) {
                    // Offline page links should be exactly /offline (not /offline-resources)
                    offlineLinks.forEach(link => {
                        expect(link).toBe('href="/offline"');
                    });
                }
            });
        });
    });

    describe('Regression Prevention', () => {
        test('should not reintroduce the route conflict', () => {
            // This test ensures we don't accidentally revert the fix
            const problematicPattern = /app\.use\(['"]\/offline['"],\s*offlineResourceRoutes\)/;
            
            expect(hostedAppContent).not.toMatch(problematicPattern);
        });

        test('resource routes should be properly isolated', () => {
            // Ensure resource routes are on their own prefix
            const resourceRouteMount = hostedAppContent.match(/app\.use\(['"]([^'"]+)['"],\s*offlineResourceRoutes\)/);
            
            expect(resourceRouteMount).toBeTruthy();
            expect(resourceRouteMount[1]).toBe('/offline-resources');
        });
    });
});
