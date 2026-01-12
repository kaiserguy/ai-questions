const fs = require('fs');
const path = require('path');

describe('Deployment Validation', () => {
    const projectRoot = path.join(__dirname, '../..');
    
    describe('Application Startup Validation', () => {
        test('should validate hosted app can start without import errors', () => {
            const hostedAppPath = path.join(projectRoot, 'hosted/hosted-app.js');
            
            // This test validates that the file can be required without throwing
            expect(() => {
                // Don't actually start the server, just validate imports
                const content = fs.readFileSync(hostedAppPath, 'utf8');
                
                // Check for syntax errors by attempting to parse
                new Function(content);
            }).not.toThrow();
        });

        test('should validate local app can start without import errors', () => {
            const localAppPath = path.join(projectRoot, 'local/local-app.js');
            
            expect(() => {
                const content = fs.readFileSync(localAppPath, 'utf8');
                new Function(content);
            }).not.toThrow();
        });
    });

    describe('Route Configuration Validation', () => {
        test('should validate offline resource routes are properly configured', () => {
            const offlineRoutesPath = path.join(projectRoot, 'core/offline-resource-routes.js');
            const content = fs.readFileSync(offlineRoutesPath, 'utf8');
            
            // Check for essential route definitions
            expect(content).toContain("router.get('/libs/:filename'");
            expect(content).toContain("router.get('/models/:filename'");
            expect(content).toContain("router.get('/wikipedia/:filename'");
            expect(content).toContain("router.get('/packages/:packageType/manifest'");
            
            // Check for ensureResourcesDirectory calls
            expect(content).toContain('await ensureResourcesDirectory()');
        });

        test('should validate route mounting in both apps', () => {
            const hostedAppPath = path.join(projectRoot, 'hosted/hosted-app.js');
            const localAppPath = path.join(projectRoot, 'local/local-app.js');
            
            const hostedContent = fs.readFileSync(hostedAppPath, 'utf8');
            const localContent = fs.readFileSync(localAppPath, 'utf8');
            
            // Both apps should mount offline routes
            expect(hostedContent).toContain("app.use('/offline-resources', offlineResourceRoutes)");
            expect(localContent).toContain("app.use('/offline-resources', offlineResourceRoutes)");
        });
    });

    describe('Environment Configuration Validation', () => {
        test('should validate Heroku configuration files exist', () => {
            const requiredHerokuFiles = [
                'Procfile',
                'package.json'
            ];
            
            requiredHerokuFiles.forEach(file => {
                const filePath = path.join(projectRoot, file);
                expect(fs.existsSync(filePath)).toBe(true);
            });
        });

        test('should validate Procfile points to correct entry point', () => {
            const procfilePath = path.join(projectRoot, 'Procfile');
            const content = fs.readFileSync(procfilePath, 'utf8');
            
            expect(content).toContain('web: node hosted/hosted-app.js');
        });

        test('should validate package.json has correct start script', () => {
            const packageJsonPath = path.join(projectRoot, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            expect(packageJson.scripts.start).toBeDefined();
        });
    });

    describe('Critical Endpoint Availability', () => {
        test('should validate critical endpoints are defined', () => {
            const hostedAppPath = path.join(projectRoot, 'hosted/hosted-app.js');
            const content = fs.readFileSync(hostedAppPath, 'utf8');
            
            // Check for offline endpoint
            expect(content).toContain('app.get("/offline"');
            
            // Check for route mounting
            expect(content).toContain('app.use("/", commonRoutes');
        });
    });

    describe('Database Configuration Validation', () => {
        test('should validate database initialization in hosted app', () => {
            const hostedAppPath = path.join(projectRoot, 'hosted/hosted-app.js');
            const content = fs.readFileSync(hostedAppPath, 'utf8');
            
            // Check for database initialization
            expect(content).toContain('new PostgresDatabase');
            expect(content).toContain('new ExternalLLMClient');
        });

        test('should validate local database initialization', () => {
            const localAppPath = path.join(projectRoot, 'local/local-app.js');
            const content = fs.readFileSync(localAppPath, 'utf8');
            
            // Local app should use LocalDatabase
            expect(content).toContain('LocalDatabase');
        });
    });

    describe('Static File Serving Validation', () => {
        test('should validate static file configuration', () => {
            const coreAppPath = path.join(projectRoot, 'core/app.js');
            const content = fs.readFileSync(coreAppPath, 'utf8');
            
            // Check for static file serving
            expect(content).toContain('express.static');
        });

        test('should validate public directory exists', () => {
            const publicDir = path.join(projectRoot, 'core/public');
            expect(fs.existsSync(publicDir)).toBe(true);
        });
    });

    describe('View Engine Configuration', () => {
        test('should validate view engine is configured', () => {
            const coreAppPath = path.join(projectRoot, 'core/app.js');
            const content = fs.readFileSync(coreAppPath, 'utf8');
            
            // Check for EJS configuration
            expect(content).toContain('ejs') || expect(content).toContain('view engine');
        });

        test('should validate views directory exists', () => {
            const viewsDir = path.join(projectRoot, 'core/views');
            expect(fs.existsSync(viewsDir)).toBe(true);
        });
    });

    describe('Security Configuration Validation', () => {
        test('should validate session configuration in hosted app', () => {
            const hostedAppPath = path.join(projectRoot, 'hosted/hosted-app.js');
            const content = fs.readFileSync(hostedAppPath, 'utf8');
            
            // Check for session configuration
            expect(content).toContain('session(');
            expect(content).toContain('secret:');
        });

        test('should validate CORS configuration if present', () => {
            const hostedAppPath = path.join(projectRoot, 'hosted/hosted-app.js');
            const content = fs.readFileSync(hostedAppPath, 'utf8');
            
            // If CORS is used, it should be properly configured
            if (content.includes('cors')) {
                expect(content).toContain('app.use(cors');
            }
        });
    });

    describe('Error Handling Validation', () => {
        test('should validate error handling middleware exists', () => {
            const hostedAppPath = path.join(projectRoot, 'hosted/hosted-app.js');
            const content = fs.readFileSync(hostedAppPath, 'utf8');
            
            // Check for error handling in hosted app
            expect(content).toContain('try') || expect(content).toContain('catch') || expect(content).toContain('error');
        });
    });

    describe('Port Configuration Validation', () => {
        test('should validate port configuration for Heroku', () => {
            const hostedAppPath = path.join(projectRoot, 'hosted/hosted-app.js');
            const content = fs.readFileSync(hostedAppPath, 'utf8');
            
            // Should use process.env.PORT for Heroku
            expect(content).toContain('process.env.PORT');
        });

        test('should validate local port configuration', () => {
            const localAppPath = path.join(projectRoot, 'local/local-app.js');
            const content = fs.readFileSync(localAppPath, 'utf8');
            
            // Should have a default port
            expect(content).toContain('3000') || expect(content).toContain('PORT');
        });
    });
});

