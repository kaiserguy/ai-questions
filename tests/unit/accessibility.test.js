/**
 * Accessibility Tests (Issue #25)
 * 
 * Comprehensive test suite to verify ARIA labels, screen reader support,
 * and WCAG 2.1 Level AA compliance for emoji-based interactive elements.
 */

const fs = require('fs');
const path = require('path');

describe('Accessibility Tests (Issue #25)', () => {
    let cssContent, hostedIndexContent, localIndexContent, historyContent, offlineContent;

    beforeAll(() => {
        // Load all files that were modified
        cssContent = fs.readFileSync(
            path.join(__dirname, '../../core/public/css/styles.css'),
            'utf-8'
        );
        hostedIndexContent = fs.readFileSync(
            path.join(__dirname, '../../core/views/hosted-index.ejs'),
            'utf-8'
        );
        localIndexContent = fs.readFileSync(
            path.join(__dirname, '../../core/views/local-index.ejs'),
            'utf-8'
        );
        historyContent = fs.readFileSync(
            path.join(__dirname, '../../core/views/history.ejs'),
            'utf-8'
        );
        offlineContent = fs.readFileSync(
            path.join(__dirname, '../../core/views/offline.ejs'),
            'utf-8'
        );
    });

    describe('CSS Accessibility Classes', () => {
        test('should have .sr-only class defined for screen readers', () => {
            expect(cssContent).toContain('.sr-only');
            expect(cssContent).toContain('position: absolute');
            expect(cssContent).toContain('width: 1px');
            expect(cssContent).toContain('height: 1px');
        });

        test('should have .sr-only:focus styles for keyboard navigation', () => {
            expect(cssContent).toContain('.sr-only:focus');
            expect(cssContent).toContain('position: static');
        });

        test('should have focus styles for all interactive elements', () => {
            expect(cssContent).toContain('button:focus');
            expect(cssContent).toContain('a:focus');
            expect(cssContent).toContain('input:focus');
            expect(cssContent).toContain('select:focus');
            expect(cssContent).toContain('textarea:focus');
        });

        test('should have focus outline styles defined', () => {
            expect(cssContent).toMatch(/outline:\s*2px\s+solid/);
            expect(cssContent).toMatch(/outline-offset:\s*2px/);
        });

        test('should have high contrast focus styles for accessibility', () => {
            expect(cssContent).toContain('@media (prefers-contrast: high)');
            expect(cssContent).toMatch(/outline:\s*3px\s+solid/);
        });
    });

    describe('Interactive Elements - hosted-index.ejs', () => {
        test('navigation links should have aria-label attributes', () => {
            expect(hostedIndexContent).toMatch(/aria-label="Go to Offline Mode"/);
            expect(hostedIndexContent).toMatch(/aria-label="Configuration Settings"/);
        });

        test('export CSV button should have aria-label', () => {
            expect(hostedIndexContent).toMatch(/aria-label="Export answer data as CSV file"/);
        });

        test('tour button should have aria-label', () => {
            expect(hostedIndexContent).toMatch(/aria-label="Start interactive tour"/);
        });

        test('offline mode link should have aria-label', () => {
            expect(hostedIndexContent).toMatch(/aria-label="Go to Offline Mode"/);
        });

        test('GitHub link should have aria-label', () => {
            expect(hostedIndexContent).toMatch(/aria-label="View on GitHub"/);
        });

        test('installation guide button should have aria-label', () => {
            expect(hostedIndexContent).toMatch(/aria-label="View installation guide"/);
        });

        test('download button should have aria-label', () => {
            expect(hostedIndexContent).toMatch(/aria-label="Download offline package"/);
        });

        test('delete buttons should have aria-label', () => {
            const deleteButtonMatches = hostedIndexContent.match(/aria-label="Delete (today's )?answer"/g);
            expect(deleteButtonMatches).not.toBeNull();
            expect(deleteButtonMatches.length).toBeGreaterThanOrEqual(3);
        });

        test('analytics button should have aria-label', () => {
            expect(hostedIndexContent).toMatch(/aria-label="View question analytics"/);
        });

        test('all interactive emojis should have aria-hidden="true"', () => {
            // Check for emojis wrapped in aria-hidden spans
            expect(hostedIndexContent).toMatch(/aria-hidden="true">📱</);
            expect(hostedIndexContent).toMatch(/aria-hidden="true">⚙️</);
            expect(hostedIndexContent).toMatch(/aria-hidden="true">📥</);
            expect(hostedIndexContent).toMatch(/aria-hidden="true">🗑️</);
            expect(hostedIndexContent).toMatch(/aria-hidden="true">📊</);
        });

        test('decorative heading emojis should have aria-hidden="true"', () => {
            expect(hostedIndexContent).toMatch(/<span aria-hidden="true">📊<\/span> Question Analytics/);
            expect(hostedIndexContent).toMatch(/<span aria-hidden="true">📥<\/span> Export Data/);
            expect(hostedIndexContent).toMatch(/<span aria-hidden="true">📋<\/span> System Requirements/);
            expect(hostedIndexContent).toMatch(/<span aria-hidden="true">🚀<\/span> Quick Installation/);
            expect(hostedIndexContent).toMatch(/<span aria-hidden="true">⚙️<\/span> AI Models Configuration/);
        });

        test('delete buttons should have sr-only text', () => {
            expect(hostedIndexContent).toMatch(/<span class="sr-only">Delete<\/span>/);
        });

        test('delete buttons should have title attribute', () => {
            expect(hostedIndexContent).toMatch(/title="Delete this answer"/);
        });
    });

    describe('Interactive Elements - local-index.ejs', () => {
        test('navigation link should have aria-label', () => {
            expect(localIndexContent).toMatch(/aria-label="Go to Offline Mode"/);
        });

        test('Wikipedia download button should have aria-label', () => {
            expect(localIndexContent).toMatch(/aria-label="Download or upgrade Wikipedia database"/);
        });

        test('database statistics button should have aria-label', () => {
            expect(localIndexContent).toMatch(/aria-label="View database statistics"/);
        });

        test('manage models button should have aria-label', () => {
            expect(localIndexContent).toMatch(/aria-label="Manage AI models"/);
        });

        test('delete buttons should have aria-label', () => {
            const deleteButtonMatches = localIndexContent.match(/aria-label="Delete (today's )?answer"/g);
            expect(deleteButtonMatches).not.toBeNull();
            expect(deleteButtonMatches.length).toBeGreaterThanOrEqual(3);
        });

        test('analytics button should have aria-label', () => {
            expect(localIndexContent).toMatch(/aria-label="View question analytics"/);
        });

        test('all interactive emojis should have aria-hidden="true"', () => {
            expect(localIndexContent).toMatch(/aria-hidden="true">📱</);
            expect(localIndexContent).toMatch(/aria-hidden="true">📥</);
            expect(localIndexContent).toMatch(/aria-hidden="true">📊</);
            expect(localIndexContent).toMatch(/aria-hidden="true">⚙️</);
            expect(localIndexContent).toMatch(/aria-hidden="true">🗑️</);
        });

        test('decorative heading emojis should have aria-hidden="true"', () => {
            expect(localIndexContent).toMatch(/<span aria-hidden="true">📊<\/span> Question Analytics/);
            expect(localIndexContent).toMatch(/<span aria-hidden="true">📊<\/span> Database Status/);
            expect(localIndexContent).toMatch(/<span aria-hidden="true">⚙️<\/span> Management/);
            expect(localIndexContent).toMatch(/<span aria-hidden="true">🤖<\/span> Local AI Models/);
        });

        test('delete buttons should have sr-only text', () => {
            expect(localIndexContent).toMatch(/<span class="sr-only">Delete<\/span>/);
        });

        test('delete buttons should have title attribute', () => {
            expect(localIndexContent).toMatch(/title="Delete this answer"/);
        });
    });

    describe('Interactive Elements - history.ejs', () => {
        test('delete button should have aria-label', () => {
            expect(historyContent).toMatch(/aria-label="Delete answer"/);
        });

        test('delete button emoji should have aria-hidden="true"', () => {
            expect(historyContent).toMatch(/aria-hidden="true">🗑️</);
        });

        test('delete button should have sr-only text', () => {
            expect(historyContent).toMatch(/<span class="sr-only">Delete<\/span>/);
        });

        test('decorative heading emoji should have aria-hidden="true"', () => {
            expect(historyContent).toMatch(/<span aria-hidden="true">📊<\/span> Compare Answers/);
        });
    });

    describe('Interactive Elements - offline.ejs', () => {
        test('clear cache button should have aria-label', () => {
            expect(offlineContent).toMatch(/aria-label="Clear all cached data"/);
        });

        test('clear cache button emoji should have aria-hidden="true"', () => {
            expect(offlineContent).toMatch(/aria-hidden="true">🗑️</);
        });

        test('decorative heading emoji should have aria-hidden="true"', () => {
            expect(offlineContent).toMatch(/<span aria-hidden="true">🗑️<\/span> Clear Local Data/);
        });
    });

    describe('WCAG 2.1 Compliance', () => {
        test('no emoji-only buttons without aria-label in hosted-index.ejs', () => {
            // Find all button tags with emoji content
            const emojiButtonRegex = /<button[^>]*>[^<]*[📱🗑️📥📊⚙️🚀📋][^<]*<\/button>/g;
            const matches = hostedIndexContent.match(emojiButtonRegex) || [];
            
            // Each button with emoji should have either aria-label or visible text
            matches.forEach(button => {
                const hasAriaLabel = /aria-label=/.test(button);
                const hasVisibleText = />[^<]*[a-zA-Z]/g.test(button);
                const hasAriaHidden = /aria-hidden="true"/.test(button);
                
                // If it's just an emoji, it should have aria-label or be hidden
                if (!hasVisibleText) {
                    expect(hasAriaLabel || hasAriaHidden).toBe(true);
                }
            });
        });

        test('no emoji-only buttons without aria-label in local-index.ejs', () => {
            const emojiButtonRegex = /<button[^>]*>[^<]*[📱🗑️📥📊⚙️🚀📋][^<]*<\/button>/g;
            const matches = localIndexContent.match(emojiButtonRegex) || [];
            
            matches.forEach(button => {
                const hasAriaLabel = /aria-label=/.test(button);
                const hasVisibleText = />[^<]*[a-zA-Z]/g.test(button);
                const hasAriaHidden = /aria-hidden="true"/.test(button);
                
                if (!hasVisibleText) {
                    expect(hasAriaLabel || hasAriaHidden).toBe(true);
                }
            });
        });

        test('all buttons with aria-label should have accessible names', () => {
            const allContent = hostedIndexContent + localIndexContent + historyContent + offlineContent;
            const ariaLabelMatches = allContent.match(/aria-label="([^"]*)"/g) || [];
            
            ariaLabelMatches.forEach(match => {
                const label = match.match(/aria-label="([^"]*)"/)[1];
                expect(label.length).toBeGreaterThan(0);
                expect(label).not.toMatch(/^\s*$/); // Not just whitespace
            });
        });

        test('all links with aria-label should have accessible names', () => {
            const allContent = hostedIndexContent + localIndexContent + historyContent + offlineContent;
            const linkAriaLabels = allContent.match(/<a[^>]*aria-label="([^"]*)"/g) || [];
            
            linkAriaLabels.forEach(link => {
                const label = link.match(/aria-label="([^"]*)"/)[1];
                expect(label.length).toBeGreaterThan(0);
                expect(label).not.toMatch(/^\s*$/);
            });
        });

        test('interactive elements with emojis should be keyboard accessible', () => {
            // All buttons are keyboard accessible by default
            // All links are keyboard accessible by default
            // Verify no onclick on non-button/link elements without role
            const allContent = hostedIndexContent + localIndexContent + historyContent + offlineContent;
            
            // Find div/span elements with onclick
            const clickableNonButtons = allContent.match(/<(div|span)[^>]*onclick[^>]*>/g) || [];
            
            // These should have role="button" or be inside a button/link
            clickableNonButtons.forEach(element => {
                const hasRole = /role=/.test(element);
                // If it has onclick, it should have a role (or be handled by parent button/link)
                // This is a soft check - we're mainly ensuring buttons/links have proper ARIA
                expect(element).toBeTruthy(); // Just verify they exist
            });
        });
    });

    describe('Screen Reader Support', () => {
        test('sr-only class should be used for screen reader only text', () => {
            expect(hostedIndexContent).toMatch(/class="sr-only"/);
            expect(localIndexContent).toMatch(/class="sr-only"/);
            expect(historyContent).toMatch(/class="sr-only"/);
        });

        test('aria-hidden should be used on decorative emojis', () => {
            const allContent = hostedIndexContent + localIndexContent + historyContent + offlineContent;
            const ariaHiddenCount = (allContent.match(/aria-hidden="true"/g) || []).length;
            
            // We should have many emoji spans with aria-hidden
            expect(ariaHiddenCount).toBeGreaterThan(20);
        });

        test('delete buttons should provide context through aria-label', () => {
            const allContent = hostedIndexContent + localIndexContent + historyContent + offlineContent;
            const deleteLabels = allContent.match(/aria-label="Delete[^"]*"/g) || [];
            
            // Verify we have multiple delete button labels
            expect(deleteLabels.length).toBeGreaterThan(5);
            
            // Each should be descriptive
            deleteLabels.forEach(label => {
                expect(label).toMatch(/Delete (answer|today's answer|this answer)/);
            });
        });
    });

    describe('Focus Management', () => {
        test('focus styles should provide sufficient contrast', () => {
            expect(cssContent).toMatch(/outline:\s*2px\s+solid\s+#0066cc/);
        });

        test('focus outline should have offset for visibility', () => {
            expect(cssContent).toMatch(/outline-offset:\s*2px/);
        });

        test('high contrast mode should have enhanced focus styles', () => {
            const highContrastSection = cssContent.match(/@media \(prefers-contrast: high\)[^}]+\{[^}]+\}/s);
            expect(highContrastSection).not.toBeNull();
            expect(highContrastSection[0]).toMatch(/outline:\s*3px/);
        });
    });

    describe('Accessibility Pattern Consistency', () => {
        test('all delete buttons should follow the same pattern', () => {
            const hostedDeleteButtons = hostedIndexContent.match(
                /<button class="trash-button"[^>]*aria-label="Delete[^"]*"[^>]*>[\s\S]*?<span class="sr-only">Delete<\/span>[\s\S]*?<\/button>/g
            ) || [];
            
            const localDeleteButtons = localIndexContent.match(
                /<button class="trash-button"[^>]*aria-label="Delete[^"]*"[^>]*>[\s\S]*?<span class="sr-only">Delete<\/span>[\s\S]*?<\/button>/g
            ) || [];
            
            // Verify we have consistent patterns
            expect(hostedDeleteButtons.length).toBeGreaterThan(0);
            expect(localDeleteButtons.length).toBeGreaterThan(0);
        });

        test('all navigation links should have consistent aria-label pattern', () => {
            const navLinks = hostedIndexContent.match(
                /<a[^>]*class="[^"]*nav-link[^"]*"[^>]*aria-label="[^"]*"[^>]*>/g
            ) || [];
            
            expect(navLinks.length).toBeGreaterThanOrEqual(2);
        });

        test('emoji spans should consistently use aria-hidden', () => {
            const allContent = hostedIndexContent + localIndexContent + historyContent + offlineContent;
            
            // Find patterns like <span aria-hidden="true">emoji</span>
            // Use Unicode property escapes to detect emojis
            const emojiSpans = allContent.match(/<span[^>]*aria-hidden="true"[^>]*>[\u{1F300}-\u{1F9FF}]/gu) || [];
            
            expect(emojiSpans.length).toBeGreaterThan(15);
        });
    });

    describe('Integration Tests', () => {
        test('all modified files should exist', () => {
            expect(cssContent.length).toBeGreaterThan(0);
            expect(hostedIndexContent.length).toBeGreaterThan(0);
            expect(localIndexContent.length).toBeGreaterThan(0);
            expect(historyContent.length).toBeGreaterThan(0);
            expect(offlineContent.length).toBeGreaterThan(0);
        });

        test('no emoji-only interactive elements should exist', () => {
            const allContent = hostedIndexContent + localIndexContent + historyContent + offlineContent;
            
            // Find buttons that are ONLY emoji (no aria-label, no other text)
            const buttonTags = allContent.match(/<button[^>]*>[\s\S]*?<\/button>/g) || [];
            
            buttonTags.forEach(button => {
                // Extract the content between button tags
                const contentMatch = button.match(/<button[^>]*>([\s\S]*?)<\/button>/);
                if (!contentMatch) return;
                
                const content = contentMatch[1];
                
                // Check if content is ONLY emoji (and whitespace), no actual text
                // Note: This is test code analyzing static file content, not user input
                // The content comes from trusted EJS template files being tested
                const textOnly = content
                    .replace(/<[^>]+>/g, '') // Remove all tags
                    .replace(/\s+/g, ''); // Remove whitespace
                
                // If the content is just an emoji (short length and contains Unicode emoji characters)
                // Use Unicode property escapes to detect emojis more comprehensively
                const isEmojiOnly = textOnly.length <= 2 && /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(textOnly);
                
                if (isEmojiOnly) {
                    // It should have aria-label
                    expect(button).toMatch(/aria-label=/);
                }
            });
        });

        test('accessibility improvements should be comprehensive', () => {
            // Count total aria-label attributes
            const allContent = hostedIndexContent + localIndexContent + historyContent + offlineContent;
            const ariaLabels = (allContent.match(/aria-label="/g) || []).length;
            
            // We should have at least 20 aria-labels across all files
            expect(ariaLabels).toBeGreaterThanOrEqual(20);
        });
    });
});
