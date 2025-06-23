const express = require('express');
const path = require('path');

describe('Offline Resource Routes', () => {
    describe('Route Module', () => {
        test('should load offline resource routes module', () => {
            const offlineResourceRoutes = require('../../core/offline-resource-routes');
            expect(offlineResourceRoutes).toBeDefined();
            expect(typeof offlineResourceRoutes).toBe('function');
        });
    });

    describe('Route Paths', () => {
        test('should have expected route patterns', () => {
            // Test that the module exports a router function
            const offlineResourceRoutes = require('../../core/offline-resource-routes');
            expect(typeof offlineResourceRoutes).toBe('function');
        });
    });

    describe('File Structure', () => {
        test('should have offline resource routes file', () => {
            const fs = require('fs');
            const routesPath = path.join(__dirname, '../../core/offline-resource-routes.js');
            expect(fs.existsSync(routesPath)).toBe(true);
        });

        test('should have proper module exports', () => {
            const offlineResourceRoutes = require('../../core/offline-resource-routes');
            expect(offlineResourceRoutes).toBeDefined();
            expect(typeof offlineResourceRoutes).toBe('function');
        });
    });

    describe('Route Configuration', () => {
        test('should export a function that can be used as middleware', () => {
            const offlineResourceRoutes = require('../../core/offline-resource-routes');
            expect(typeof offlineResourceRoutes).toBe('function');
            
            // Should be able to create an express app and use the routes
            const app = express();
            expect(() => {
                app.use('/offline', offlineResourceRoutes);
            }).not.toThrow();
        });
    });
});

