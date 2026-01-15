/**
 * Security and edge case tests for the service worker build script
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Service Worker Build Script - Security & Edge Cases', () => {
    const scriptPath = path.join(__dirname, '../../scripts/build-service-worker.js');
    const templatePath = path.join(__dirname, '../../core/public/service-worker.template.js');
    const outputPath = path.join(__dirname, '../../core/public/service-worker.js');
    
    let originalServiceWorker;
    
    beforeAll(() => {
        // Save original service worker if it exists
        if (fs.existsSync(outputPath)) {
            originalServiceWorker = fs.readFileSync(outputPath, 'utf8');
        }
        
        // Run the build script to ensure we have a fresh copy
        execSync(`node ${scriptPath}`, { encoding: 'utf8' });
    });
    
    afterAll(() => {
        // Restore original service worker
        if (originalServiceWorker) {
            fs.writeFileSync(outputPath, originalServiceWorker);
        }
    });
    
    describe('Security Features', () => {
        test('generated service worker has HTTPS/secure context check', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/isSecureContext|https:|protocol.*===.*'https:'/);
        });
        
        test('generated service worker validates response types', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toContain("response.type !== 'basic'");
        });
        
        test('generated service worker validates response status', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/response\.status.*200/);
        });
        
        test('generated service worker skips cross-origin requests', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toContain('startsWith(self.location.origin)');
        });
        
        test('generated service worker only caches GET requests', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/request\.method.*GET/);
        });
        
        test('generated service worker validates content types', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toContain('content-type');
        });
        
        test('generated service worker checks for credentials in URL', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/token|key|password/);
        });
        
        test('generated service worker validates message sources', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/typeof.*event\.data\.type.*string/);
        });
        
        test('generated service worker has error handling for cache operations', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/catch.*error/);
        });
        
        test('generated service worker sets proper status codes for errors', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/status.*(?:408|503)/);
        });
    });
    
    describe('Edge Case Handling', () => {
        test('build script handles missing git gracefully', () => {
            // This test verifies the fallback mechanism exists
            const script = fs.readFileSync(scriptPath, 'utf8');
            expect(script).toMatch(/catch.*error/);
            // Check for timestamp fallback pattern (build-${Date.now()})
            expect(script).toMatch(/build-.*Date\.now\(\)/);
        });
        
        test('build script has permission error handling', () => {
            const script = fs.readFileSync(scriptPath, 'utf8');
            expect(script).toContain('EACCES');
        });
        
        test('build script has disk space error handling', () => {
            const script = fs.readFileSync(scriptPath, 'utf8');
            expect(script).toContain('ENOSPC');
        });
        
        test('build script suppresses stderr for git commands', () => {
            const script = fs.readFileSync(scriptPath, 'utf8');
            expect(script).toMatch(/stdio.*pipe/);
        });
        
        test('generated service worker version is unique', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            const versionMatch = generated.match(/ai-questions-cache-([a-f0-9]+-\d+)/);
            
            expect(versionMatch).toBeTruthy();
            expect(versionMatch[1]).toMatch(/^[a-f0-9]+-\d+$/);
            
            // Version should have timestamp component - check it's within last year
            const timestamp = parseInt(versionMatch[1].split('-')[1]);
            const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
            expect(timestamp).toBeGreaterThan(oneYearAgo);
        });
        
        test('generated service worker handles network errors', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/catch.*=>\s*\{/);
            expect(generated).toContain('Network error');
        });
        
        test('generated service worker handles missing ports in messages', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/event\.ports.*\[0\]/);
        });
    });
    
    describe('Cache Invalidation Logic', () => {
        test('generated service worker deletes old caches on activate', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toContain('caches.delete');
            expect(generated).toMatch(/cacheName.*!==.*CACHE_NAME/);
        });
        
        test('generated service worker filters caches by prefix', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toContain("cacheName.startsWith('ai-questions-cache-')");
        });
        
        test('generated service worker uses Promise.all for cache cleanup', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toContain('Promise.all');
        });
    });
    
    describe('Service Worker Lifecycle', () => {
        test('generated service worker calls skipWaiting on install', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/addEventListener\('install'.*skipWaiting/s);
        });
        
        test('generated service worker calls clients.claim on activate', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/addEventListener\('activate'.*clients\.claim/s);
        });
        
        test('generated service worker has proper event.waitUntil usage', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/event\.waitUntil/);
        });
    });
    
    describe('Caching Strategy', () => {
        test('generated service worker uses network-first for navigation', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/request\.mode.*navigate/);
            expect(generated).toMatch(/fetch\(event\.request\)/);
        });
        
        test('generated service worker uses network-first for API requests', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/request\.url.*\/api\//);
        });
        
        test('generated service worker uses cache-first with background update for assets', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            expect(generated).toMatch(/caches\.match.*then.*cachedResponse/s);
        });
        
        test('generated service worker updates cache in background for static assets', () => {
            const generated = fs.readFileSync(outputPath, 'utf8');
            // Should fetch fresh version in background
            expect(generated).toMatch(/cachedResponse[\s\S]*fetch\(event\.request\)/);
        });
    });
});
