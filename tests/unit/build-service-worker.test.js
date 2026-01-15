/**
 * Tests for the service worker build script
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Service Worker Build Script', () => {
    const scriptPath = path.join(__dirname, '../../scripts/build-service-worker.js');
    const templatePath = path.join(__dirname, '../../core/public/service-worker.template.js');
    const outputPath = path.join(__dirname, '../../core/public/service-worker.js');
    
    let originalServiceWorker;
    
    beforeAll(() => {
        // Save original service worker if it exists
        if (fs.existsSync(outputPath)) {
            originalServiceWorker = fs.readFileSync(outputPath, 'utf8');
        }
    });
    
    afterAll(() => {
        // Restore original service worker
        if (originalServiceWorker) {
            fs.writeFileSync(outputPath, originalServiceWorker);
        }
    });
    
    test('build script exists', () => {
        expect(fs.existsSync(scriptPath)).toBe(true);
    });
    
    test('template file exists', () => {
        expect(fs.existsSync(templatePath)).toBe(true);
    });
    
    test('template contains VERSION placeholder', () => {
        const template = fs.readFileSync(templatePath, 'utf8');
        expect(template).toContain('{{VERSION}}');
    });
    
    test('build script runs successfully', () => {
        const result = execSync(`node ${scriptPath}`, { encoding: 'utf8' });
        expect(result).toContain('Service worker built successfully');
    });
    
    test('generated service worker has version in cache name', () => {
        // Run the build script first
        execSync(`node ${scriptPath}`, { encoding: 'utf8' });
        
        const generated = fs.readFileSync(outputPath, 'utf8');
        
        // Should have a cache name with version
        expect(generated).toMatch(/const CACHE_NAME = 'ai-questions-cache-[a-f0-9]+-\d+'/);
    });
    
    test('generated service worker has auto-generated header', () => {
        const generated = fs.readFileSync(outputPath, 'utf8');
        
        expect(generated).toContain('AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY');
        expect(generated).toContain('Build Info:');
        expect(generated).toContain('Version:');
        expect(generated).toContain('Branch:');
        expect(generated).toContain('Built:');
    });
    
    test('generated service worker does not contain template placeholders', () => {
        const generated = fs.readFileSync(outputPath, 'utf8');
        
        expect(generated).not.toContain('{{VERSION}}');
        expect(generated).not.toContain('{{BRANCH}}');
        expect(generated).not.toContain('{{BUILD_DATE}}');
    });
    
    test('generated service worker has skipWaiting on install', () => {
        const generated = fs.readFileSync(outputPath, 'utf8');
        
        expect(generated).toContain('self.skipWaiting()');
    });
    
    test('generated service worker has clients.claim on activate', () => {
        const generated = fs.readFileSync(outputPath, 'utf8');
        
        expect(generated).toContain('self.clients.claim()');
    });
    
    test('generated service worker supports GET_VERSION message', () => {
        const generated = fs.readFileSync(outputPath, 'utf8');
        
        expect(generated).toContain("event.data.type === 'GET_VERSION'");
    });
    
    test('generated service worker supports CLEAR_CACHE message', () => {
        const generated = fs.readFileSync(outputPath, 'utf8');
        
        expect(generated).toContain("event.data.type === 'CLEAR_CACHE'");
    });
    
    test('running build twice produces different versions (due to timestamp)', async () => {
        // Run first build
        execSync(`node ${scriptPath}`, { encoding: 'utf8' });
        const first = fs.readFileSync(outputPath, 'utf8');
        const firstMatch = first.match(/ai-questions-cache-([a-f0-9]+-\d+)/);
        
        // Wait a bit to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Run second build
        execSync(`node ${scriptPath}`, { encoding: 'utf8' });
        const second = fs.readFileSync(outputPath, 'utf8');
        const secondMatch = second.match(/ai-questions-cache-([a-f0-9]+-\d+)/);
        
        // Versions should be different (different timestamps)
        expect(firstMatch[1]).not.toBe(secondMatch[1]);
    });
});
