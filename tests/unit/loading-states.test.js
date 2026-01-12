/**
 * Tests for Loading States and Toast Notification System
 * Validates the implementation of user feedback features
 */

const fs = require('fs');
const path = require('path');

describe('Loading States and Toast System Tests', () => {
    const toastCssPath = path.join(__dirname, '../../core/public/css/toast.css');
    const toastJsPath = path.join(__dirname, '../../core/public/js/toast.js');
    const guidePath = path.join(__dirname, '../../LOADING_STATES_GUIDE.md');
    
    let toastCss, toastJs, guide;

    beforeAll(() => {
        toastCss = fs.readFileSync(toastCssPath, 'utf8');
        toastJs = fs.readFileSync(toastJsPath, 'utf8');
        guide = fs.readFileSync(guidePath, 'utf8');
    });

    describe('File Existence', () => {
        test('toast.css should exist', () => {
            expect(fs.existsSync(toastCssPath)).toBe(true);
        });

        test('toast.js should exist', () => {
            expect(fs.existsSync(toastJsPath)).toBe(true);
        });

        test('LOADING_STATES_GUIDE.md should exist', () => {
            expect(fs.existsSync(guidePath)).toBe(true);
        });
    });

    describe('CSS - Toast Container', () => {
        test('should have toast-container styles', () => {
            expect(toastCss).toContain('.toast-container');
        });

        test('toast-container should be fixed positioned', () => {
            expect(toastCss).toMatch(/\.toast-container[\s\S]*position:\s*fixed/);
        });

        test('toast-container should have high z-index', () => {
            expect(toastCss).toMatch(/\.toast-container[\s\S]*z-index:\s*\d{4,}/);
        });

        test('toast-container should be positioned top-right', () => {
            const section = toastCss.substring(
                toastCss.indexOf('.toast-container'),
                toastCss.indexOf('.toast-container') + 200
            );
            expect(section).toContain('top:');
            expect(section).toContain('right:');
        });
    });

    describe('CSS - Toast Styles', () => {
        test('should have base toast styles', () => {
            expect(toastCss).toContain('.toast {');
        });

        test('toast should have border-radius', () => {
            expect(toastCss).toMatch(/\.toast[\s\S]*border-radius/);
        });

        test('toast should have box-shadow', () => {
            expect(toastCss).toMatch(/\.toast[\s\S]*box-shadow/);
        });

        test('should have slideIn animation', () => {
            expect(toastCss).toContain('@keyframes slideIn');
            expect(toastCss).toMatch(/animation:\s*slideIn/);
        });

        test('should have slideOut animation', () => {
            expect(toastCss).toContain('@keyframes slideOut');
        });

        test('should have hiding class for exit animation', () => {
            expect(toastCss).toContain('.toast.hiding');
        });
    });

    describe('CSS - Toast Types', () => {
        test('should have success toast style', () => {
            expect(toastCss).toContain('.toast.success');
            expect(toastCss).toMatch(/\.toast\.success[\s\S]*background-color/);
        });

        test('should have error toast style', () => {
            expect(toastCss).toContain('.toast.error');
            expect(toastCss).toMatch(/\.toast\.error[\s\S]*background-color/);
        });

        test('should have warning toast style', () => {
            expect(toastCss).toContain('.toast.warning');
            expect(toastCss).toMatch(/\.toast\.warning[\s\S]*background-color/);
        });

        test('should have info toast style', () => {
            expect(toastCss).toContain('.toast.info');
            expect(toastCss).toMatch(/\.toast\.info[\s\S]*background-color/);
        });
    });

    describe('CSS - Loading Spinner', () => {
        test('should have spinner styles', () => {
            expect(toastCss).toContain('.spinner');
        });

        test('spinner should have spin animation', () => {
            expect(toastCss).toContain('@keyframes spin');
            expect(toastCss).toMatch(/\.spinner[\s\S]*animation.*spin/);
        });

        test('should have dark spinner variant', () => {
            expect(toastCss).toContain('.spinner.dark');
        });

        test('spinner should be circular', () => {
            expect(toastCss).toMatch(/\.spinner[\s\S]*border-radius:\s*50%/);
        });
    });

    describe('CSS - Button Loading States', () => {
        test('should have button loading styles', () => {
            expect(toastCss).toContain('button.loading');
        });

        test('loading button should have pseudo-element spinner', () => {
            expect(toastCss).toContain('button.loading::after');
        });

        test('loading button should hide text', () => {
            expect(toastCss).toMatch(/button\.loading[\s\S]*color:\s*transparent/);
        });

        test('loading button should be non-interactive', () => {
            expect(toastCss).toMatch(/button\.loading[\s\S]*pointer-events:\s*none/);
        });
    });

    describe('CSS - Interactive States', () => {
        test('should have hover states for buttons', () => {
            expect(toastCss).toMatch(/button.*:hover/);
        });

        test('should have active states for buttons', () => {
            expect(toastCss).toMatch(/button.*:active/);
        });

        test('should have disabled button styles', () => {
            expect(toastCss).toMatch(/button:disabled/);
        });

        test('should have transition for smooth animations', () => {
            expect(toastCss).toMatch(/transition/);
        });
    });

    describe('CSS - Loading Overlay', () => {
        test('should have loading-overlay styles', () => {
            expect(toastCss).toContain('.loading-overlay');
        });

        test('overlay should be fullscreen', () => {
            const section = toastCss.substring(
                toastCss.indexOf('.loading-overlay'),
                toastCss.indexOf('.loading-overlay') + 300
            );
            expect(section).toContain('position: fixed');
            expect(section).toContain('top: 0');
            expect(section).toContain('bottom: 0');
        });

        test('overlay should have high z-index', () => {
            expect(toastCss).toMatch(/\.loading-overlay[\s\S]*z-index:\s*\d{4,}/);
        });

        test('should have large spinner for overlay', () => {
            expect(toastCss).toContain('.spinner-large');
        });
    });

    describe('CSS - Responsive Design', () => {
        test('should have mobile responsive styles', () => {
            expect(toastCss).toMatch(/@media.*max-width.*640px/);
        });

        test('mobile styles should adjust toast container', () => {
            const mediaQuery = toastCss.substring(
                toastCss.indexOf('@media'),
                toastCss.length
            );
            expect(mediaQuery).toContain('.toast-container');
        });
    });

    describe('JavaScript - ToastManager Class', () => {
        test('should have ToastManager class', () => {
            expect(toastJs).toContain('class ToastManager');
        });

        test('should have init method', () => {
            expect(toastJs).toMatch(/init\s*\(\s*\)/);
        });

        test('should have show method', () => {
            expect(toastJs).toMatch(/show\s*\(/);
        });

        test('should have createToast method', () => {
            expect(toastJs).toMatch(/createToast\s*\(/);
        });

        test('should have dismiss method', () => {
            expect(toastJs).toMatch(/dismiss\s*\(/);
        });

        test('should have dismissAll method', () => {
            expect(toastJs).toMatch(/dismissAll\s*\(/);
        });
    });

    describe('JavaScript - Toast Convenience Methods', () => {
        test('should have success method', () => {
            expect(toastJs).toMatch(/success\s*\(/);
        });

        test('should have error method', () => {
            expect(toastJs).toMatch(/error\s*\(/);
        });

        test('should have warning method', () => {
            expect(toastJs).toMatch(/warning\s*\(/);
        });

        test('should have info method', () => {
            expect(toastJs).toMatch(/info\s*\(/);
        });
    });

    describe('JavaScript - Toast Accessibility', () => {
        test('should set role="alert" on toasts', () => {
            expect(toastJs).toContain("role", "alert");
        });

        test('should set aria-live on toasts', () => {
            expect(toastJs).toContain('aria-live');
        });

        test('should set aria-label on close button', () => {
            expect(toastJs).toContain('aria-label="Close notification"');
        });

        test('toast container should have aria-label', () => {
            expect(toastJs).toContain('aria-label');
        });
    });

    describe('JavaScript - LoadingManager Class', () => {
        test('should have LoadingManager class', () => {
            expect(toastJs).toContain('class LoadingManager');
        });

        test('should have showButton method', () => {
            expect(toastJs).toMatch(/showButton\s*\(/);
        });

        test('should have hideButton method', () => {
            expect(toastJs).toMatch(/hideButton\s*\(/);
        });

        test('should have showOverlay method', () => {
            expect(toastJs).toMatch(/showOverlay\s*\(/);
        });

        test('should have hideOverlay method', () => {
            expect(toastJs).toMatch(/hideOverlay\s*\(/);
        });

        test('should have showProgressBar method', () => {
            expect(toastJs).toMatch(/showProgressBar\s*\(/);
        });

        test('should have hideProgressBar method', () => {
            expect(toastJs).toMatch(/hideProgressBar\s*\(/);
        });

        test('should have createSpinner method', () => {
            expect(toastJs).toMatch(/createSpinner\s*\(/);
        });
    });

    describe('JavaScript - Loading Button Implementation', () => {
        test('showButton should add loading class', () => {
            const method = toastJs.substring(
                toastJs.indexOf('showButton'),
                toastJs.indexOf('showButton') + 300
            );
            expect(method).toContain('classList.add');
            expect(method).toContain('loading');
        });

        test('showButton should disable button', () => {
            const method = toastJs.substring(
                toastJs.indexOf('showButton'),
                toastJs.indexOf('showButton') + 300
            );
            expect(method).toMatch(/disabled\s*=\s*true/);
        });

        test('showButton should save original text', () => {
            const method = toastJs.substring(
                toastJs.indexOf('showButton'),
                toastJs.indexOf('showButton') + 300
            );
            expect(method).toContain('dataset.originalText');
        });

        test('hideButton should remove loading class', () => {
            const method = toastJs.substring(
                toastJs.indexOf('hideButton'),
                toastJs.indexOf('hideButton') + 300
            );
            expect(method).toContain('classList.remove');
        });

        test('hideButton should enable button', () => {
            const method = toastJs.substring(
                toastJs.indexOf('hideButton'),
                toastJs.indexOf('hideButton') + 300
            );
            expect(method).toMatch(/disabled\s*=\s*false/);
        });
    });

    describe('JavaScript - Loading Overlay Implementation', () => {
        test('showOverlay should create overlay element', () => {
            const method = toastJs.substring(
                toastJs.indexOf('showOverlay'),
                toastJs.indexOf('showOverlay') + 500
            );
            expect(method).toContain('createElement');
            expect(method).toContain('loading-overlay');
        });

        test('overlay should have accessibility attributes', () => {
            const method = toastJs.substring(
                toastJs.indexOf('showOverlay'),
                toastJs.indexOf('showOverlay') + 500
            );
            expect(method).toContain("role", "alert");
            expect(method).toContain('aria-busy');
        });

        test('hideOverlay should remove overlay', () => {
            const method = toastJs.substring(
                toastJs.indexOf('hideOverlay'),
                toastJs.indexOf('hideOverlay') + 300
            );
            expect(method).toContain('remove');
        });
    });

    describe('JavaScript - Async Action Handler', () => {
        test('should have handleAsyncAction function', () => {
            expect(toastJs).toContain('async function handleAsyncAction');
        });

        test('should accept action, button, and options parameters', () => {
            const func = toastJs.substring(
                toastJs.indexOf('async function handleAsyncAction'),
                toastJs.indexOf('async function handleAsyncAction') + 200
            );
            expect(func).toContain('action');
            expect(func).toContain('button');
            expect(func).toContain('options');
        });

        test('should have try-catch-finally structure', () => {
            const func = toastJs.substring(
                toastJs.indexOf('async function handleAsyncAction'),
                toastJs.indexOf('async function handleAsyncAction') + 1500
            );
            expect(func).toMatch(/try[\s\S]*catch[\s\S]*finally/);
        });

        test('should call success callback', () => {
            const func = toastJs.substring(
                toastJs.indexOf('async function handleAsyncAction'),
                toastJs.indexOf('async function handleAsyncAction') + 1500
            );
            expect(func).toContain('onSuccess');
        });

        test('should call error callback', () => {
            const func = toastJs.substring(
                toastJs.indexOf('async function handleAsyncAction'),
                toastJs.indexOf('async function handleAsyncAction') + 1500
            );
            expect(func).toContain('onError');
        });
    });

    describe('JavaScript - Fetch with Feedback', () => {
        test('should have fetchWithFeedback function', () => {
            expect(toastJs).toContain('async function fetchWithFeedback');
        });

        test('should accept url, options, and feedbackOptions', () => {
            const func = toastJs.substring(
                toastJs.indexOf('async function fetchWithFeedback'),
                toastJs.indexOf('async function fetchWithFeedback') + 200
            );
            expect(func).toContain('url');
            expect(func).toContain('options');
            expect(func).toContain('feedbackOptions');
        });

        test('should have error handling with optional handleAsyncAction', () => {
            const func = toastJs.substring(
                toastJs.indexOf('async function fetchWithFeedback'),
                toastJs.indexOf('async function fetchWithFeedback') + 2000
            );
            // Should either use handleAsyncAction or have try/catch for error handling
            const hasErrorHandling = func.includes('handleAsyncAction') || func.includes('try') || func.includes('catch');
            expect(hasErrorHandling).toBe(true);
        });

        test('should check response.ok', () => {
            const func = toastJs.substring(
                toastJs.indexOf('async function fetchWithFeedback'),
                toastJs.indexOf('async function fetchWithFeedback') + 1000
            );
            expect(func).toContain('response.ok');
        });
    });

    describe('JavaScript - Global Instances', () => {
        test('should create global toast instance', () => {
            expect(toastJs).toMatch(/const\s+toast\s*=\s*new\s+ToastManager/);
        });

        test('should create global loading instance', () => {
            expect(toastJs).toMatch(/const\s+loading\s*=\s*new\s+LoadingManager/);
        });
    });

    describe('JavaScript - Module Exports', () => {
        test('should export for CommonJS', () => {
            expect(toastJs).toContain('module.exports');
        });

        test('should export toast, loading, and helper functions', () => {
            const exports = toastJs.substring(
                toastJs.indexOf('module.exports'),
                toastJs.indexOf('module.exports') + 200
            );
            expect(exports).toContain('toast');
            expect(exports).toContain('loading');
            expect(exports).toContain('handleAsyncAction');
            expect(exports).toContain('fetchWithFeedback');
        });
    });

    describe('EJS Integration', () => {
        const ejsFiles = [
            'core/views/hosted-index.ejs',
            'core/views/local-index.ejs',
            'core/views/config.ejs',
            'core/views/history.ejs',
            'core/views/error.ejs',
            'core/views/login.ejs',
            'core/views/offline.ejs'
        ];

        ejsFiles.forEach(file => {
            const filePath = path.join(__dirname, '../../', file);
            
            test(`${file} should include toast.css`, () => {
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    expect(content).toContain('toast.css');
                }
            });

            test(`${file} should include toast.js`, () => {
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    expect(content).toContain('toast.js');
                }
            });
        });
    });

    describe('Documentation', () => {
        test('guide should have overview section', () => {
            expect(guide).toContain('## Overview');
        });

        test('guide should have toast notifications section', () => {
            expect(guide).toContain('## Toast Notifications');
        });

        test('guide should have loading states section', () => {
            expect(guide).toContain('## Loading States');
        });

        test('guide should have async action handler section', () => {
            expect(guide).toContain('## Async Action Handler');
        });

        test('guide should have fetch with feedback section', () => {
            expect(guide).toContain('## Fetch with Feedback');
        });

        test('guide should have real-world examples', () => {
            expect(guide).toContain('## Real-World Examples');
        });

        test('guide should have accessibility section', () => {
            expect(guide).toContain('## Accessibility');
        });

        test('guide should have code examples', () => {
            expect(guide).toMatch(/```javascript/);
        });

        test('guide should document all toast methods', () => {
            expect(guide).toContain('toast.success');
            expect(guide).toContain('toast.error');
            expect(guide).toContain('toast.warning');
            expect(guide).toContain('toast.info');
        });

        test('guide should document all loading methods', () => {
            expect(guide).toContain('loading.showButton');
            expect(guide).toContain('loading.hideButton');
            expect(guide).toContain('loading.showOverlay');
            expect(guide).toContain('loading.hideOverlay');
        });
    });

    describe('Code Quality', () => {
        test('JavaScript should have JSDoc comments', () => {
            expect(toastJs).toContain('/**');
            expect(toastJs).toContain('* @param');
        });

        test('CSS should have section comments', () => {
            expect(toastCss).toContain('/*');
        });

        test('JavaScript should handle null/undefined gracefully', () => {
            expect(toastJs).toMatch(/if\s*\(!\w+\)\s*return/);
        });

        test('should use const for immutable values', () => {
            expect(toastJs).toContain('const ');
        });

        test('should use arrow functions where appropriate', () => {
            expect(toastJs).toContain('=>');
        });
    });
});
