/**
 * Responsive Design Tests
 * 
 * Tests to ensure the application works correctly across different screen sizes
 * and devices, meeting accessibility and usability standards for mobile devices.
 */

describe('Responsive Design', () => {
  describe('Viewport Configuration', () => {
    test('should have viewport meta tag in all pages', () => {
      const pages = [
        'hosted-index.ejs',
        'local-index.ejs',
        'offline.ejs',
        'history.ejs',
        'login.ejs',
        'config.ejs',
        'error.ejs'
      ];
      
      const fs = require('fs');
      const path = require('path');
      
      pages.forEach(page => {
        const filePath = path.join(__dirname, '../../core/views', page);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          expect(content).toContain('viewport');
          expect(content).toContain('width=device-width');
          expect(content).toContain('initial-scale=1');
        }
      });
    });
  });

  describe('CSS Responsive Breakpoints', () => {
    test('should have mobile-first responsive styles', () => {
      const fs = require('fs');
      const path = require('path');
      const cssPath = path.join(__dirname, '../../core/public/css/styles.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      
      // Check for mobile breakpoints
      expect(css).toContain('@media (max-width: 480px)');
      expect(css).toContain('@media (max-width: 768px)');
      expect(css).toContain('@media (min-width: 768px) and (max-width: 1024px)');
    });
    
    test('should have touch-friendly tap targets defined', () => {
      const fs = require('fs');
      const path = require('path');
      const cssPath = path.join(__dirname, '../../core/public/css/styles.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      
      // Check for minimum tap target sizes (44x44px)
      expect(css).toContain('min-height: 44px');
      expect(css).toContain('min-width: 44px');
    });
  });

  describe('Layout Flexibility', () => {
    test('should have flexible container widths', () => {
      const fs = require('fs');
      const path = require('path');
      const cssPath = path.join(__dirname, '../../core/public/css/styles.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      
      // Check for flexible layout
      expect(css).toContain('max-width: 100%');
    });
    
    test('should use responsive typography', () => {
      const fs = require('fs');
      const path = require('path');
      const cssPath = path.join(__dirname, '../../core/public/css/styles.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      
      // Check for responsive font sizes
      expect(css).toMatch(/font-size:\s*(16px|1rem|1em)/);
    });
  });

  describe('Accessibility Features', () => {
    test('should support reduced motion preferences', () => {
      const fs = require('fs');
      const path = require('path');
      const cssPath = path.join(__dirname, '../../core/public/css/styles.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      
      // Check for prefers-reduced-motion support
      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    });
    
    test('should support high contrast mode', () => {
      const fs = require('fs');
      const path = require('path');
      const cssPath = path.join(__dirname, '../../core/public/css/styles.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      
      // Check for high contrast support
      expect(css).toContain('@media (prefers-contrast: high)');
    });
  });

  describe('Grid and Flexbox Usage', () => {
    test('should use flexbox for responsive layouts', () => {
      const fs = require('fs');
      const path = require('path');
      const cssPath = path.join(__dirname, '../../core/public/css/styles.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      
      expect(css).toContain('display: flex');
      expect(css).toContain('flex-direction: column');
    });
    
    test('should use grid for card layouts', () => {
      const fs = require('fs');
      const path = require('path');
      const cssPath = path.join(__dirname, '../../core/public/css/styles.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      
      expect(css).toContain('display: grid');
      expect(css).toContain('grid-template-columns');
    });
  });

  describe('Mobile Navigation', () => {
    test('should hide navigation text on small screens', () => {
      const fs = require('fs');
      const path = require('path');
      const cssPath = path.join(__dirname, '../../core/public/css/styles.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      
      // Check that .nav-text display: none exists within a @media (max-width: 768px) block
      // Split by @media queries
      const mediaQueries = css.split(/@media/);
      let found = false;
      
      for (const block of mediaQueries) {
        if (block.includes('max-width: 768px')) {
          // Check if this block contains both .nav-text and display: none
          if (block.includes('.nav-text') && block.includes('display: none')) {
            found = true;
            break;
          }
        }
      }
      
      expect(found).toBe(true);
    });
  });

  describe('Form Elements', () => {
    test('should prevent iOS zoom on input focus', () => {
      const fs = require('fs');
      const path = require('path');
      const cssPath = path.join(__dirname, '../../core/public/css/styles.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      
      // Input font size should be at least 16px to prevent zoom
      // Check if there's a rule for input with font-size: 16px
      const lines = css.split('\n');
      let inMobileBreakpoint = false;
      let foundInputRule = false;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('@media (max-width: 480px)')) {
          inMobileBreakpoint = true;
        }
        if (inMobileBreakpoint && (lines[i].includes('input,') || lines[i].includes('input '))) {
          // Check next few lines for font-size: 16px
          for (let j = i; j < i + 10 && j < lines.length; j++) {
            if (lines[j].includes('font-size: 16px')) {
              foundInputRule = true;
              break;
            }
          }
        }
      }
      
      expect(foundInputRule).toBe(true);
    });
  });
});
