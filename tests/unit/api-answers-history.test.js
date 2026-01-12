/**
 * Tests for /api/answers/history endpoint
 * Validates the implementation of the answers history API route
 */

const fs = require('fs');
const path = require('path');

describe('API Answers History Route Tests', () => {
    const routesFilePath = path.join(__dirname, '../../core/routes.js');
    let routesContent;

    beforeAll(() => {
        routesContent = fs.readFileSync(routesFilePath, 'utf8');
    });

    describe('Route Definition', () => {
        test('should have /api/answers/history route defined', () => {
            expect(routesContent).toContain('router.get("/api/answers/history"');
        });

        test('should use ensureAuthenticated middleware', () => {
            const routeMatch = routesContent.match(/router\.get\("\/api\/answers\/history",\s*ensureAuthenticated/);
            expect(routeMatch).toBeTruthy();
        });

        test('should be an async route handler', () => {
            const routeMatch = routesContent.match(/router\.get\("\/api\/answers\/history"[\s\S]*?async/);
            expect(routeMatch).toBeTruthy();
        });
    });

    describe('Parameter Validation', () => {
        test('should check for question parameter', () => {
            expect(routesContent).toContain('req.query.question');
        });

        test('should return 400 error if question parameter is missing', () => {
            const missingParamCheck = routesContent.includes('if (!question)') ||
                                     routesContent.includes('if(!question)');
            expect(missingParamCheck).toBe(true);
            
            // Should return 400 status
            const lines = routesContent.split('\n');
            let foundMissingCheck = false;
            let foundStatus400 = false;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('if (!question)') || lines[i].includes('if(!question)')) {
                    foundMissingCheck = true;
                }
                if (foundMissingCheck && lines[i].includes('res.status(400)')) {
                    foundStatus400 = true;
                    break;
                }
            }
            
            expect(foundStatus400).toBe(true);
        });

        test('should have error message for missing parameter', () => {
            expect(routesContent).toContain('Missing required parameter: question');
        });
    });

    describe('Database Integration', () => {
        test('should call db.getHistory with question parameter', () => {
            expect(routesContent).toContain('db.getHistory(question)');
        });

        test('should handle null or undefined history results', () => {
            const hasNullCheck = routesContent.includes('history === null') ||
                                routesContent.includes('typeof history === \'undefined\'');
            expect(hasNullCheck).toBe(true);
        });

        test('should handle empty array history results', () => {
            const hasEmptyArrayCheck = routesContent.includes('Array.isArray(history)') &&
                                      routesContent.includes('history.length === 0');
            expect(hasEmptyArrayCheck).toBe(true);
        });
    });

    describe('Response Handling', () => {
        test('should return 404 for non-existent questions', () => {
            const lines = routesContent.split('\n');
            let foundNullCheck = false;
            let foundStatus404 = false;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('history === null') || lines[i].includes('typeof history === \'undefined\'')) {
                    foundNullCheck = true;
                }
                if (foundNullCheck && lines[i].includes('res.status(404)')) {
                    foundStatus404 = true;
                    break;
                }
            }
            
            expect(foundStatus404).toBe(true);
        });

        test('should include question in 404 response', () => {
            expect(routesContent).toContain('question: question');
        });

        test('should return 200 with empty array for questions with no history', () => {
            const lines = routesContent.split('\n');
            let foundEmptyArrayCheck = false;
            let foundStatus200 = false;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('history.length === 0')) {
                    foundEmptyArrayCheck = true;
                }
                if (foundEmptyArrayCheck && lines[i].includes('res.status(200)')) {
                    foundStatus200 = true;
                    break;
                }
            }
            
            expect(foundStatus200).toBe(true);
        });

        test('should include message in empty history response', () => {
            expect(routesContent).toContain('No answer history found for this question');
        });

        test('should return question and history in successful response', () => {
            expect(routesContent).toContain('res.json({');
            
            // Check that both question and history are included in response
            const jsonResponsePattern = /res\.json\(\{[^}]*question:[^}]*history:[^}]*\}\)/s;
            expect(routesContent).toMatch(jsonResponsePattern);
        });
    });

    describe('Error Handling', () => {
        test('should have try-catch block', () => {
            const routeSection = routesContent.substring(
                routesContent.indexOf('router.get("/api/answers/history"'),
                routesContent.indexOf('router.get("/api/answers/history"') + 2000
            );
            
            expect(routeSection).toContain('try {');
            expect(routeSection).toContain('} catch');
        });

        test('should use application logger if available', () => {
            expect(routesContent).toContain('req.app.get(\'logger\')');
        });

        test('should fallback to console.error if logger not available', () => {
            expect(routesContent).toContain('console.error(');
        });

        test('should return 500 status on error', () => {
            const routeSection = routesContent.substring(
                routesContent.indexOf('router.get("/api/answers/history"'),
                routesContent.indexOf('router.get("/api/answers/history"') + 2000
            );
            
            expect(routeSection).toContain('res.status(500)');
        });

        test('should include error message in error response', () => {
            expect(routesContent).toContain('error.message');
        });
    });

    describe('Code Quality', () => {
        test('should follow consistent indentation', () => {
            const lines = routesContent.split('\n');
            const routeStart = lines.findIndex(line => line.includes('router.get("/api/answers/history"'));
            
            if (routeStart !== -1) {
                const routeSection = lines.slice(routeStart, routeStart + 60);
                
                // Check that try block has proper indentation
                const tryLine = routeSection.find(line => line.trim() === 'try {');
                expect(tryLine).toBeDefined();
            }
        });

        test('should use proper async/await pattern', () => {
            const routeSection = routesContent.substring(
                routesContent.indexOf('router.get("/api/answers/history"'),
                routesContent.indexOf('router.get("/api/answers/history"') + 2000
            );
            
            expect(routeSection).toContain('await db.getHistory');
        });

        test('should not have console.log statements in production code', () => {
            const routeSection = routesContent.substring(
                routesContent.indexOf('router.get("/api/answers/history"'),
                routesContent.indexOf('router.get("/api/answers/history"') + 2000
            );
            
            // console.error is ok, console.log is not
            const hasConsoleLog = routeSection.includes('console.log(');
            expect(hasConsoleLog).toBe(false);
        });
    });

    describe('Security Considerations', () => {
        test('should require authentication', () => {
            const routeDefinition = routesContent.match(/router\.get\("\/api\/answers\/history"[^{]*/);
            expect(routeDefinition[0]).toContain('ensureAuthenticated');
        });

        test('should validate input exists before processing', () => {
            const routeSection = routesContent.substring(
                routesContent.indexOf('router.get("/api/answers/history"'),
                routesContent.indexOf('router.get("/api/answers/history"') + 2000
            );
            
            // Should check if question exists
            expect(routeSection).toContain('if (!question)');
        });

        test('should use parameterized queries (via db.getHistory)', () => {
            // The route should call db.getHistory which uses parameterized queries
            // This test verifies the route doesn't do direct SQL
            const routeSection = routesContent.substring(
                routesContent.indexOf('router.get("/api/answers/history"'),
                routesContent.indexOf('router.get("/api/answers/history"') + 2000
            );
            
            // Should NOT contain direct SQL
            const hasDirectSQL = routeSection.includes('SELECT ') || 
                                routeSection.includes('UPDATE ') ||
                                routeSection.includes('INSERT ');
            expect(hasDirectSQL).toBe(false);
        });
    });

    describe('Route Placement', () => {
        test('should be defined before personal questions routes', () => {
            const historyIndex = routesContent.indexOf('router.get("/api/answers/history"');
            const personalIndex = routesContent.indexOf('router.get("/personal-questions"');
            
            // History route should come before personal questions
            expect(historyIndex).toBeGreaterThan(0);
            expect(personalIndex).toBeGreaterThan(0);
            expect(historyIndex).toBeLessThan(personalIndex);
        });
    });
});
