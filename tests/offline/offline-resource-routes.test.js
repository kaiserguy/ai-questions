const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const offlineResourceRoutes = require('../../core/offline-resource-routes');

describe('Offline Resource Routes', () => {
    let app;
    
    beforeEach(() => {
        app = express();
        app.use('/offline', offlineResourceRoutes);
    });

    describe('Libraries Endpoint', () => {
        test('should serve transformers.js with correct headers', async () => {
            const response = await request(app)
                .get('/offline/libs/transformers.js')
                .expect(200);
            
            expect(response.headers['content-type']).toBe('application/javascript');
            expect(response.headers['cache-control']).toBe('max-age=31536000');
            expect(response.headers['content-length']).toBeDefined();
        });

        test('should serve sql-wasm.js with correct headers', async () => {
            const response = await request(app)
                .get('/offline/libs/sql-wasm.js')
                .expect(200);
            
            expect(response.headers['content-type']).toBe('application/javascript');
            expect(response.headers['cache-control']).toBe('max-age=31536000');
            expect(response.headers['content-length']).toBeDefined();
        });

        test('should return 404 for unknown library', async () => {
            await request(app)
                .get('/offline/libs/unknown-library.js')
                .expect(404);
        });
    });

    describe('AI Models Endpoint', () => {
        test('should serve TinyBERT model with correct headers', async () => {
            const response = await request(app)
                .get('/offline/models/tinybert-uncased.bin')
                .expect(200);
            
            expect(response.headers['content-type']).toBe('application/octet-stream');
            expect(response.headers['cache-control']).toBe('max-age=31536000');
            expect(response.headers['content-length']).toBe('157286400'); // 150MB
        });

        test('should serve Phi-3 Mini model with correct headers', async () => {
            const response = await request(app)
                .get('/offline/models/phi-3-mini-4k-instruct.bin')
                .expect(200);
            
            expect(response.headers['content-type']).toBe('application/octet-stream');
            expect(response.headers['cache-control']).toBe('max-age=31536000');
            expect(response.headers['content-length']).toBe('524288000'); // 500MB
        });

        test('should return 404 for unknown model', async () => {
            await request(app)
                .get('/offline/models/unknown-model.bin')
                .expect(404);
        });

        test('should handle HEAD requests for models', async () => {
            const response = await request(app)
                .head('/offline/models/tinybert-uncased.bin')
                .expect(200);
            
            expect(response.headers['content-type']).toBe('application/octet-stream');
            expect(response.headers['content-length']).toBe('157286400');
        });
    });

    describe('Wikipedia Database Endpoint', () => {
        test('should serve Wikipedia subset database with correct headers', async () => {
            const response = await request(app)
                .get('/offline/wikipedia/wikipedia-subset-20mb.db')
                .expect(200);
            
            expect(response.headers['content-type']).toBe('application/x-sqlite3');
            expect(response.headers['cache-control']).toBe('max-age=31536000');
            expect(response.headers['content-length']).toBe('20971520'); // 20MB
        });

        test('should serve Simple Wikipedia database with correct headers', async () => {
            const response = await request(app)
                .get('/offline/wikipedia/simple-wikipedia-50mb.db')
                .expect(200);
            
            expect(response.headers['content-type']).toBe('application/x-sqlite3');
            expect(response.headers['cache-control']).toBe('max-age=31536000');
            expect(response.headers['content-length']).toBe('52428800'); // 50MB
        });

        test('should return 404 for unknown Wikipedia database', async () => {
            await request(app)
                .get('/offline/wikipedia/unknown-database.db')
                .expect(404);
        });

        test('should handle HEAD requests for Wikipedia databases', async () => {
            const response = await request(app)
                .head('/offline/wikipedia/wikipedia-subset-20mb.db')
                .expect(200);
            
            expect(response.headers['content-type']).toBe('application/x-sqlite3');
            expect(response.headers['content-length']).toBe('20971520');
        });
    });

    describe('Package Manifest Endpoint', () => {
        test('should return minimal package manifest', async () => {
            const response = await request(app)
                .get('/offline/packages/minimal/manifest')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.manifest.packageType).toBe('minimal');
            expect(response.body.manifest.totalSize).toBeDefined();
        });

        test('should return standard package manifest', async () => {
            const response = await request(app)
                .get('/offline/packages/standard/manifest')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.manifest.packageType).toBe('standard');
            expect(response.body.manifest.totalSize).toBeDefined();
        });

        test('should return 404 for unknown package type', async () => {
            await request(app)
                .get('/offline/packages/unknown/manifest')
                .expect(404);
        });
    });

    describe('Directory Creation', () => {
        test('should create offline resources directory structure', async () => {
            // This test verifies that ensureResourcesDirectory works
            const response = await request(app)
                .get('/offline/models/tinybert-uncased.bin')
                .expect(200);
            
            // If we get a 200 response, the directory structure was created successfully
            expect(response.status).toBe(200);
        });
    });

    describe('Error Handling', () => {
        test('should handle malformed requests gracefully', async () => {
            await request(app)
                .get('/offline/models/')
                .expect(404);
        });

        test('should handle requests with special characters', async () => {
            await request(app)
                .get('/offline/models/test%20file.bin')
                .expect(404);
        });
    });

    describe('Performance', () => {
        test('should respond to model requests within reasonable time', async () => {
            const startTime = Date.now();
            
            await request(app)
                .head('/offline/models/tinybert-uncased.bin')
                .expect(200);
            
            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
        });

        test('should respond to Wikipedia requests within reasonable time', async () => {
            const startTime = Date.now();
            
            await request(app)
                .head('/offline/wikipedia/wikipedia-subset-20mb.db')
                .expect(200);
            
            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
        });
    });
});

