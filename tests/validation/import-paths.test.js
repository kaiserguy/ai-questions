const fs = require('fs');
const path = require('path');

describe('Import Path Validation', () => {
    const projectRoot = path.join(__dirname, '../..');
    
    describe('Hosted App Import Paths', () => {
        test('should have correct import paths in hosted-app.js', () => {
            const hostedAppPath = path.join(projectRoot, 'hosted/hosted-app.js');
            const content = fs.readFileSync(hostedAppPath, 'utf8');
            
            // Check for correct relative imports from hosted/ to core/
            expect(content).toContain('require("../core/offline-package-routes")');
            expect(content).toContain('require("../core/app")');
            expect(content).toContain('require("../core/pg-db")');
            expect(content).toContain('require("../core/external-llm-client")');
            expect(content).toContain('require("../core/routes")');
            expect(content).toContain('require("../core/offline-resource-routes")');
            
            // Check for incorrect imports that would cause failures
            expect(content).not.toContain('require("./core/');
            expect(content).not.toContain('require("core/');
        });

        test('should verify all imported files exist', () => {
            const hostedAppPath = path.join(projectRoot, 'hosted/hosted-app.js');
            const content = fs.readFileSync(hostedAppPath, 'utf8');
            
            // Extract require statements
            const requireRegex = /require\(["']([^"']+)["']\)/g;
            const matches = [...content.matchAll(requireRegex)];
            
            matches.forEach(match => {
                const importPath = match[1];
                
                // Skip node_modules imports
                if (!importPath.startsWith('.')) return;
                
                const resolvedPath = path.resolve(path.dirname(hostedAppPath), importPath);
                const jsPath = resolvedPath.endsWith('.js') ? resolvedPath : `${resolvedPath}.js`;
                
                expect(fs.existsSync(jsPath)).toBe(true);
            });
        });
    });

    describe('Local App Import Paths', () => {
        test('should have correct import paths in local-app.js', () => {
            const localAppPath = path.join(projectRoot, 'local/local-app.js');
            const content = fs.readFileSync(localAppPath, 'utf8');
            
            // Check for correct relative imports from local/ to core/
            expect(content).toContain('require("../core/');
            
            // Check for incorrect imports
            expect(content).not.toContain('require("./core/');
            expect(content).not.toContain('require("core/');
        });

        test('should verify all imported files exist in local app', () => {
            const localAppPath = path.join(projectRoot, 'local/local-app.js');
            const content = fs.readFileSync(localAppPath, 'utf8');
            
            // Extract require statements
            const requireRegex = /require\(["']([^"']+)["']\)/g;
            const matches = [...content.matchAll(requireRegex)];
            
            matches.forEach(match => {
                const importPath = match[1];
                
                // Skip node_modules imports
                if (!importPath.startsWith('.')) return;
                
                const resolvedPath = path.resolve(path.dirname(localAppPath), importPath);
                const jsPath = resolvedPath.endsWith('.js') ? resolvedPath : `${resolvedPath}.js`;
                
                expect(fs.existsSync(jsPath)).toBe(true);
            });
        });
    });

    describe('Core Module Import Paths', () => {
        test('should have consistent import paths in core modules', () => {
            const coreDir = path.join(projectRoot, 'core');
            const coreFiles = fs.readdirSync(coreDir).filter(file => file.endsWith('.js'));
            
            coreFiles.forEach(file => {
                const filePath = path.join(coreDir, file);
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Extract require statements for relative imports
                const requireRegex = /require\(["'](\.[^"']+)["']\)/g;
                const matches = [...content.matchAll(requireRegex)];
                
                matches.forEach(match => {
                    const importPath = match[1];
                    const resolvedPath = path.resolve(path.dirname(filePath), importPath);
                    const jsPath = resolvedPath.endsWith('.js') ? resolvedPath : `${resolvedPath}.js`;
                    
                    expect(fs.existsSync(jsPath)).toBe(true);
                });
            });
        });
    });

    describe('Route Mounting Validation', () => {
        test('should verify offline resource routes are properly mounted in hosted app', () => {
            const hostedAppPath = path.join(projectRoot, 'hosted/hosted-app.js');
            const content = fs.readFileSync(hostedAppPath, 'utf8');
            
            // Check that offline resource routes are imported and mounted
            expect(content).toContain('require("../core/offline-resource-routes")');
            expect(content).toContain("app.use('/offline-resources', offlineResourceRoutes)");
        });

        test('should verify offline resource routes are properly mounted in local app', () => {
            const localAppPath = path.join(projectRoot, 'local/local-app.js');
            const content = fs.readFileSync(localAppPath, 'utf8');
            
            // Check that offline resource routes are imported and mounted
            // Local app uses a different import pattern
            expect(content).toContain("require('../core/offline-resource-routes')");
            expect(content).toContain("app.use('/offline-resources', offlineResourceRoutes)");
        });
    });

    describe('Package.json Dependencies', () => {
        test('should have all required dependencies in package.json', () => {
            const packageJsonPath = path.join(projectRoot, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // Check for essential dependencies
            const requiredDeps = [
                'express',
                'express-session',
                'pg',
                'passport',
                'passport-google-oauth20'
            ];
            
            requiredDeps.forEach(dep => {
                expect(packageJson.dependencies[dep]).toBeDefined();
            });
        });

        test('should have test dependencies in package.json', () => {
            const packageJsonPath = path.join(projectRoot, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // Check for test dependencies
            const testDeps = ['jest', 'supertest'];
            
            testDeps.forEach(dep => {
                expect(
                    packageJson.dependencies[dep] || packageJson.devDependencies[dep]
                ).toBeDefined();
            });
        });
    });

    describe('File Structure Validation', () => {
        test('should have required core files', () => {
            const requiredCoreFiles = [
                'app.js',
                'routes.js',
                'offline-resource-routes.js',
                'offline-package-routes.js',
                'pg-db.js',
                'external-llm-client.js'
            ];
            
            requiredCoreFiles.forEach(file => {
                const filePath = path.join(projectRoot, 'core', file);
                expect(fs.existsSync(filePath)).toBe(true);
            });
        });

        test('should have required app entry points', () => {
            const requiredAppFiles = [
                'hosted/hosted-app.js',
                'local/local-app.js'
            ];
            
            requiredAppFiles.forEach(file => {
                const filePath = path.join(projectRoot, file);
                expect(fs.existsSync(filePath)).toBe(true);
            });
        });

        test('should have required view files', () => {
            const requiredViewFiles = [
                'core/views/offline.ejs',
                'core/views/local-index.ejs'
            ];
            
            requiredViewFiles.forEach(file => {
                const filePath = path.join(projectRoot, file);
                expect(fs.existsSync(filePath)).toBe(true);
            });
        });
    });
});

