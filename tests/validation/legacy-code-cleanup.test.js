const fs = require('fs');
const path = require('path');

describe('Legacy Code Cleanup Tests (Issue #36)', () => {
    describe('File Removal', () => {
        test('core/hosted-index.cjs should not exist', () => {
            const legacyPath = path.join(__dirname, '../../core/hosted-index.cjs');
            expect(fs.existsSync(legacyPath)).toBe(false);
        });

        test('archived file should exist in archive directory', () => {
            const archivedPath = path.join(__dirname, '../../archive/legacy-code/hosted-index.cjs.legacy');
            expect(fs.existsSync(archivedPath)).toBe(true);
        });

        test('archived file should have warning header', () => {
            const archivedPath = path.join(__dirname, '../../archive/legacy-code/hosted-index.cjs.legacy');
            const content = fs.readFileSync(archivedPath, 'utf8');
            expect(content).toContain('⚠️ LEGACY CODE - DO NOT USE ⚠️');
            expect(content).toContain('DO NOT USE THIS FILE IN PRODUCTION');
        });

        test('archived file should mention it was replaced by hosted/hosted-app.js', () => {
            const archivedPath = path.join(__dirname, '../../archive/legacy-code/hosted-index.cjs.legacy');
            const content = fs.readFileSync(archivedPath, 'utf8');
            expect(content).toContain('replaced by hosted/hosted-app.js');
        });

        test('archived file should reference Issue #32', () => {
            const archivedPath = path.join(__dirname, '../../archive/legacy-code/hosted-index.cjs.legacy');
            const content = fs.readFileSync(archivedPath, 'utf8');
            expect(content).toContain('Issue #32');
        });
    });

    describe('Documentation Updates', () => {
        test('CONTRIBUTING.md should reference hosted/hosted-app.js', () => {
            const contributingPath = path.join(__dirname, '../../CONTRIBUTING.md');
            const content = fs.readFileSync(contributingPath, 'utf8');
            expect(content).toContain('hosted/hosted-app.js');
        });

        test('CONTRIBUTING.md should not reference core/hosted-index.cjs', () => {
            const contributingPath = path.join(__dirname, '../../CONTRIBUTING.md');
            const content = fs.readFileSync(contributingPath, 'utf8');
            expect(content).not.toContain('node core/hosted-index.cjs');
        });

        test('CONTRIBUTING.md should have architecture section', () => {
            const contributingPath = path.join(__dirname, '../../CONTRIBUTING.md');
            const content = fs.readFileSync(contributingPath, 'utf8');
            expect(content).toContain('Architecture');
            expect(content).toContain('Entry Points');
            expect(content).toContain('Core Modules');
        });

        test('CONTRIBUTING.md should document archived code', () => {
            const contributingPath = path.join(__dirname, '../../CONTRIBUTING.md');
            const content = fs.readFileSync(contributingPath, 'utf8');
            expect(content).toContain('archive/legacy-code');
            expect(content).toContain('Do not use files in this directory');
        });

        test('README.md should document correct entry points', () => {
            const readmePath = path.join(__dirname, '../../README.md');
            const content = fs.readFileSync(readmePath, 'utf8');
            expect(content).toContain('hosted/hosted-app.js');
        });

        test('README.md should mention legacy file is archived', () => {
            const readmePath = path.join(__dirname, '../../README.md');
            const content = fs.readFileSync(readmePath, 'utf8');
            expect(content).toContain('core/hosted-index.cjs');
            expect(content).toContain('archived');
        });

        test('Procfile should use hosted/hosted-app.js', () => {
            const procfilePath = path.join(__dirname, '../../Procfile');
            const content = fs.readFileSync(procfilePath, 'utf8');
            expect(content).toContain('hosted/hosted-app.js');
            expect(content).not.toContain('hosted-index.cjs');
        });
    });

    describe('No Active References', () => {
        test('no active code in core/ should import hosted-index.cjs', () => {
            const coreDir = path.join(__dirname, '../../core');
            if (!fs.existsSync(coreDir)) {
                return; // Skip if directory doesn't exist
            }

            const files = fs.readdirSync(coreDir)
                .filter(f => (f.endsWith('.js') || f.endsWith('.cjs')) && !f.endsWith('.test.js') && !f.endsWith('.test.cjs'))
                .map(f => path.join(coreDir, f));

            files.forEach(file => {
                if (fs.statSync(file).isFile()) {
                    const content = fs.readFileSync(file, 'utf8');
                    expect(content).not.toMatch(/require\(['"].*hosted-index\.cjs['"]\)/);
                    expect(content).not.toMatch(/import.*hosted-index\.cjs/);
                }
            });
        });

        test('no active code in hosted/ should import hosted-index.cjs', () => {
            const hostedDir = path.join(__dirname, '../../hosted');
            if (!fs.existsSync(hostedDir)) {
                return; // Skip if directory doesn't exist
            }

            const files = fs.readdirSync(hostedDir)
                .filter(f => (f.endsWith('.js') || f.endsWith('.cjs')) && !f.endsWith('.test.js') && !f.endsWith('.test.cjs'))
                .map(f => path.join(hostedDir, f));

            files.forEach(file => {
                if (fs.statSync(file).isFile()) {
                    const content = fs.readFileSync(file, 'utf8');
                    expect(content).not.toMatch(/require\(['"].*hosted-index\.cjs['"]\)/);
                    expect(content).not.toMatch(/import.*hosted-index\.cjs/);
                }
            });
        });

        test('no active code in local/ should import hosted-index.cjs', () => {
            const localDir = path.join(__dirname, '../../local');
            if (!fs.existsSync(localDir)) {
                return; // Skip if directory doesn't exist
            }

            const files = fs.readdirSync(localDir)
                .filter(f => (f.endsWith('.js') || f.endsWith('.cjs')) && !f.endsWith('.test.js') && !f.endsWith('.test.cjs'))
                .map(f => path.join(localDir, f));

            files.forEach(file => {
                if (fs.statSync(file).isFile()) {
                    const content = fs.readFileSync(file, 'utf8');
                    expect(content).not.toMatch(/require\(['"].*hosted-index\.cjs['"]\)/);
                    expect(content).not.toMatch(/import.*hosted-index\.cjs/);
                }
            });
        });

        test('package.json should not reference hosted-index.cjs', () => {
            const packagePath = path.join(__dirname, '../../package.json');
            const content = fs.readFileSync(packagePath, 'utf8');
            expect(content).not.toContain('hosted-index.cjs');
        });
    });

    describe('Archive Structure', () => {
        test('archive directory should exist', () => {
            const archivePath = path.join(__dirname, '../../archive');
            expect(fs.existsSync(archivePath)).toBe(true);
        });

        test('archive/legacy-code directory should exist', () => {
            const archivePath = path.join(__dirname, '../../archive/legacy-code');
            expect(fs.existsSync(archivePath)).toBe(true);
        });

        test('archive README should exist', () => {
            const readmePath = path.join(__dirname, '../../archive/README.md');
            expect(fs.existsSync(readmePath)).toBe(true);
        });

        test('archive README should document policy', () => {
            const readmePath = path.join(__dirname, '../../archive/README.md');
            const content = fs.readFileSync(readmePath, 'utf8');
            expect(content).toContain('Do not use this file');
            expect(content).toContain('Issue #32');
        });

        test('archive README should list the legacy file', () => {
            const readmePath = path.join(__dirname, '../../archive/README.md');
            const content = fs.readFileSync(readmePath, 'utf8');
            expect(content).toContain('hosted-index.cjs.legacy');
        });

        test('ANALYTICS_ROUTES_REFERENCE.md should exist', () => {
            const refPath = path.join(__dirname, '../../ANALYTICS_ROUTES_REFERENCE.md');
            expect(fs.existsSync(refPath)).toBe(true);
        });

        test('ANALYTICS_ROUTES_REFERENCE.md should document analytics endpoints', () => {
            const refPath = path.join(__dirname, '../../ANALYTICS_ROUTES_REFERENCE.md');
            const content = fs.readFileSync(refPath, 'utf8');
            expect(content).toContain('/api/analytics/question/:id');
            expect(content).toContain('/api/analytics/model-comparison/:id');
            expect(content).toContain('/api/analytics/trend-analysis/:id');
            expect(content).toContain('/api/analytics/dashboard');
            expect(content).toContain('/api/analytics/export-csv/:id');
        });

        test('ANALYTICS_ROUTES_REFERENCE.md should reference Issue #32', () => {
            const refPath = path.join(__dirname, '../../ANALYTICS_ROUTES_REFERENCE.md');
            const content = fs.readFileSync(refPath, 'utf8');
            expect(content).toContain('Issue #32');
        });
    });
});
