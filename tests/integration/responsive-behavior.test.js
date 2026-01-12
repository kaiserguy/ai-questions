/**
 * Responsive Behavior Integration Tests
 * 
 * Tests the actual responsive behavior of the application at different screen sizes
 * using a headless browser to ensure layouts adapt correctly.
 */

const puppeteer = require('puppeteer');

describe('Responsive Behavior Integration Tests', () => {
  let browser;
  let page;
  const baseURL = process.env.TEST_URL || 'http://localhost:3000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Mobile Layout (375px)', () => {
    beforeEach(async () => {
      await page.setViewport({ width: 375, height: 667 });
    });

    test('should not have horizontal scrollbar', async () => {
      await page.goto(`${baseURL}/offline`, { waitUntil: 'networkidle0', timeout: 10000 });
      
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowInnerWidth = await page.evaluate(() => window.innerWidth);
      
      // Allow 1px tolerance for rounding
      expect(bodyScrollWidth).toBeLessThanOrEqual(windowInnerWidth + 1);
    });

    test('should have readable text size', async () => {
      await page.goto(`${baseURL}/offline`, { waitUntil: 'networkidle0', timeout: 10000 });
      
      const fontSize = await page.evaluate(() => {
        const body = document.body;
        return parseInt(window.getComputedStyle(body).fontSize);
      });
      
      // Minimum 15px for readability
      expect(fontSize).toBeGreaterThanOrEqual(15);
    });

    test('should have touch-friendly buttons', async () => {
      await page.goto(`${baseURL}/offline`, { waitUntil: 'networkidle0', timeout: 10000 });
      
      const buttons = await page.$$('button');
      
      for (const button of buttons) {
        const box = await button.boundingBox();
        if (box) {
          // Minimum 44x44px for touch targets (WCAG guideline)
          expect(box.height).toBeGreaterThanOrEqual(42); // Allow small tolerance
          expect(box.width).toBeGreaterThanOrEqual(42);
        }
      }
    });
  });

  describe('Tablet Layout (768px)', () => {
    beforeEach(async () => {
      await page.setViewport({ width: 768, height: 1024 });
    });

    test('should not have horizontal scrollbar', async () => {
      await page.goto(`${baseURL}/offline`, { waitUntil: 'networkidle0', timeout: 10000 });
      
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowInnerWidth = await page.evaluate(() => window.innerWidth);
      
      expect(bodyScrollWidth).toBeLessThanOrEqual(windowInnerWidth + 1);
    });

    test('should display cards in grid layout', async () => {
      await page.goto(`${baseURL}/offline`, { waitUntil: 'networkidle0', timeout: 10000 });
      
      const gridDisplay = await page.evaluate(() => {
        const downloadOptions = document.querySelector('.download-options');
        if (!downloadOptions) return null;
        return window.getComputedStyle(downloadOptions).display;
      });
      
      // Should use grid layout
      expect(gridDisplay).toBe('grid');
    });
  });

  describe('Small Mobile Layout (320px)', () => {
    beforeEach(async () => {
      await page.setViewport({ width: 320, height: 568 });
    });

    test('should not have horizontal scrollbar on smallest screen', async () => {
      await page.goto(`${baseURL}/offline`, { waitUntil: 'networkidle0', timeout: 10000 });
      
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowInnerWidth = await page.evaluate(() => window.innerWidth);
      
      expect(bodyScrollWidth).toBeLessThanOrEqual(windowInnerWidth + 1);
    });

    test('should have adequate padding', async () => {
      await page.goto(`${baseURL}/offline`, { waitUntil: 'networkidle0', timeout: 10000 });
      
      const containerPadding = await page.evaluate(() => {
        const container = document.querySelector('.container');
        if (!container) return null;
        const style = window.getComputedStyle(container);
        return parseInt(style.paddingLeft) + parseInt(style.paddingRight);
      });
      
      // Should have some padding even on small screens
      expect(containerPadding).toBeGreaterThanOrEqual(16);
    });
  });

  describe('Desktop Layout (1920px)', () => {
    beforeEach(async () => {
      await page.setViewport({ width: 1920, height: 1080 });
    });

    test('should have max-width container', async () => {
      await page.goto(`${baseURL}/offline`, { waitUntil: 'networkidle0', timeout: 10000 });
      
      const containerWidth = await page.evaluate(() => {
        const container = document.querySelector('.container');
        if (!container) return null;
        return container.offsetWidth;
      });
      
      // Container should not span full width on large screens
      expect(containerWidth).toBeLessThan(1600);
    });
  });

  describe('Viewport Meta Tag', () => {
    test('should have proper viewport meta tag', async () => {
      await page.goto(`${baseURL}/offline`, { waitUntil: 'networkidle0', timeout: 10000 });
      
      const viewportContent = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });
      
      expect(viewportContent).toContain('width=device-width');
      expect(viewportContent).toContain('initial-scale=1');
    });
  });

  describe('Form Input Zoom Prevention (iOS)', () => {
    test('should have minimum 16px font size on inputs', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`${baseURL}/offline`, { waitUntil: 'networkidle0', timeout: 10000 });
      
      // Check input font sizes
      const inputFontSizes = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
        return inputs.map(input => {
          const fontSize = window.getComputedStyle(input).fontSize;
          return parseInt(fontSize);
        });
      });
      
      // All inputs should have at least 16px to prevent iOS zoom
      inputFontSizes.forEach(size => {
        expect(size).toBeGreaterThanOrEqual(16);
      });
    });
  });
});
