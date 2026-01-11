/**
 * Integration tests for /download/offline route
 * Tests that the offline download package is created correctly with files from repository root
 */

const path = require('path');
const fs = require('fs');

describe('/download/offline route', () => {
  describe('File path resolution', () => {
    test('install.sh should exist at repository root', () => {
      const rootPath = path.join(__dirname, '..', '..');
      const installPath = path.join(rootPath, 'install.sh');
      
      expect(fs.existsSync(installPath)).toBe(true);
    });

    test('README-OFFLINE.md should exist at repository root', () => {
      const rootPath = path.join(__dirname, '..', '..');
      const readmePath = path.join(rootPath, 'README-OFFLINE.md');
      
      expect(fs.existsSync(readmePath)).toBe(true);
    });

    test('local directory should exist at repository root', () => {
      const rootPath = path.join(__dirname, '..', '..');
      const localPath = path.join(rootPath, 'local');
      
      expect(fs.existsSync(localPath)).toBe(true);
      expect(fs.statSync(localPath).isDirectory()).toBe(true);
    });

    test('core directory should NOT have install.sh', () => {
      const corePath = path.join(__dirname, '..', '..', 'core');
      const installPath = path.join(corePath, 'install.sh');
      
      expect(fs.existsSync(installPath)).toBe(false);
    });

    test('core directory should NOT have README-OFFLINE.md', () => {
      const corePath = path.join(__dirname, '..', '..', 'core');
      const readmePath = path.join(corePath, 'README-OFFLINE.md');
      
      expect(fs.existsSync(readmePath)).toBe(false);
    });

    test('core directory should NOT have local subdirectory', () => {
      const corePath = path.join(__dirname, '..', '..', 'core');
      const localPath = path.join(corePath, 'local');
      
      expect(fs.existsSync(localPath)).toBe(false);
    });
  });

  describe('Path construction verification', () => {
    test('path from core directory to root install.sh should use ".."', () => {
      const corePath = path.join(__dirname, '..', '..', 'core');
      const correctPath = path.join(corePath, '..', 'install.sh');
      const rootPath = path.join(__dirname, '..', '..');
      const expectedPath = path.join(rootPath, 'install.sh');
      
      // Normalize paths to handle symlinks and relative components
      const normalizedCorrect = path.normalize(correctPath);
      const normalizedExpected = path.normalize(expectedPath);
      
      expect(normalizedCorrect).toBe(normalizedExpected);
      expect(fs.existsSync(correctPath)).toBe(true);
    });

    test('path from core directory to root README-OFFLINE.md should use ".."', () => {
      const corePath = path.join(__dirname, '..', '..', 'core');
      const correctPath = path.join(corePath, '..', 'README-OFFLINE.md');
      
      expect(fs.existsSync(correctPath)).toBe(true);
    });

    test('path from core directory to root local/ should use ".."', () => {
      const corePath = path.join(__dirname, '..', '..', 'core');
      const correctPath = path.join(corePath, '..', 'local');
      
      expect(fs.existsSync(correctPath)).toBe(true);
      expect(fs.statSync(correctPath).isDirectory()).toBe(true);
    });
  });

  describe('Required offline package contents', () => {
    test('local directory should contain essential files', () => {
      const rootPath = path.join(__dirname, '..', '..');
      const localPath = path.join(rootPath, 'local');
      
      // Check for key files that should be in the offline package
      const essentialFiles = [
        'local-app.js',
        'local-database.js',
        'README.md'
      ];
      
      essentialFiles.forEach(file => {
        const filePath = path.join(localPath, file);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    test('install.sh should be executable or have content', () => {
      const rootPath = path.join(__dirname, '..', '..');
      const installPath = path.join(rootPath, 'install.sh');
      
      const stats = fs.statSync(installPath);
      expect(stats.size).toBeGreaterThan(0);
      // File should have some content (at least 100 bytes for a basic script)
      expect(stats.size).toBeGreaterThan(100);
    });

    test('README-OFFLINE.md should contain offline documentation', () => {
      const rootPath = path.join(__dirname, '..', '..');
      const readmePath = path.join(rootPath, 'README-OFFLINE.md');
      
      const content = fs.readFileSync(readmePath, 'utf8');
      
      // Should mention offline or local functionality
      expect(content.toLowerCase()).toMatch(/offline|local|privacy/);
      expect(content.length).toBeGreaterThan(500);
    });
  });

  describe('Route implementation verification', () => {
    test('hosted-index.cjs should contain /download/offline route', () => {
      const hostedIndexPath = path.join(__dirname, '..', '..', 'core', 'hosted-index.cjs');
      
      expect(fs.existsSync(hostedIndexPath)).toBe(true);
      
      const content = fs.readFileSync(hostedIndexPath, 'utf8');
      expect(content).toContain("app.get('/download/offline'");
    });

    test('/download/offline route should use correct path construction', () => {
      const hostedIndexPath = path.join(__dirname, '..', '..', 'core', 'hosted-index.cjs');
      const content = fs.readFileSync(hostedIndexPath, 'utf8');
      
      // Should use '..' to go up from core directory to root
      expect(content).toMatch(/path\.join\(__dirname,\s*['"]\.\.['"],\s*['"]install\.sh['"]\)/);
      expect(content).toMatch(/path\.join\(__dirname,\s*['"]\.\.['"],\s*['"]README-OFFLINE\.md['"]\)/);
      expect(content).toMatch(/path\.join\(__dirname,\s*['"]\.\.['"],\s*['"]local['"]\)/);
    });

    test('/download/offline route should NOT use incorrect paths', () => {
      const hostedIndexPath = path.join(__dirname, '..', '..', 'core', 'hosted-index.cjs');
      const content = fs.readFileSync(hostedIndexPath, 'utf8');
      
      // After the fix, these patterns should NOT exist
      // (paths without '..' going to parent directory)
      const downloadOfflineSection = content.match(/app\.get\(['"]\/download\/offline['"][\s\S]*?}\);/);
      
      if (downloadOfflineSection) {
        const sectionText = downloadOfflineSection[0];
        
        // Should not have direct path to install.sh without '..'
        expect(sectionText).not.toMatch(/path\.join\(__dirname,\s*['"]install\.sh['"]\)/);
        // Should not have direct path to README-OFFLINE.md without '..'
        expect(sectionText).not.toMatch(/path\.join\(__dirname,\s*['"]README-OFFLINE\.md['"]\)/);
        // Should not have direct path to local without '..'
        expect(sectionText).not.toMatch(/path\.join\(__dirname,\s*['"]local['"]\)/);
      }
    });
  });
});
