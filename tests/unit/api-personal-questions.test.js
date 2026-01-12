/**
 * Tests for personal question API routes
 * Validates the implementation of personal question endpoints
 */

const fs = require('fs');
const path = require('path');

describe('Personal Question API Routes Tests', () => {
    const routesFilePath = path.join(__dirname, '../../core/routes.js');
    let routesContent;

    beforeAll(() => {
        routesContent = fs.readFileSync(routesFilePath, 'utf8');
    });

    describe('GET /api/personal-questions/:id/answers', () => {
        test('should have route defined', () => {
            expect(routesContent).toContain('router.get("/api/personal-questions/:id/answers"');
        });

        test('should use ensureAuthenticated middleware', () => {
            const routeMatch = routesContent.match(/router\.get\("\/api\/personal-questions\/:id\/answers",\s*ensureAuthenticated/);
            expect(routeMatch).toBeTruthy();
        });

        test('should be an async route handler', () => {
            const routeMatch = routesContent.match(/router\.get\("\/api\/personal-questions\/:id\/answers".*async/);
            expect(routeMatch).toBeTruthy();
        });

        test('should check for authentication', () => {
            expect(routesContent).toMatch(/\/api\/personal-questions\/:id\/answers[\s\S]*?if\s*\(!userId\)/);
        });

        test('should call getPersonalQuestionAnswers database method', () => {
            expect(routesContent).toMatch(/\/api\/personal-questions\/:id\/answers[\s\S]*?getPersonalQuestionAnswers/);
        });

        test('should return 404 if answers not found', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.get("/api/personal-questions/:id/answers"'),
                routesContent.indexOf('router.get("/api/personal-questions/:id/schedule"')
            );
            expect(section).toContain('404');
        });

        test('should handle errors with 500 status', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.get("/api/personal-questions/:id/answers"'),
                routesContent.indexOf('router.get("/api/personal-questions/:id/schedule"')
            );
            expect(section).toContain('500');
        });
    });

    describe('GET /api/personal-questions/:id/schedule', () => {
        test('should have route defined', () => {
            expect(routesContent).toContain('router.get("/api/personal-questions/:id/schedule"');
        });

        test('should use ensureAuthenticated middleware', () => {
            const routeMatch = routesContent.match(/router\.get\("\/api\/personal-questions\/:id\/schedule",\s*ensureAuthenticated/);
            expect(routeMatch).toBeTruthy();
        });

        test('should be an async route handler', () => {
            const routeMatch = routesContent.match(/router\.get\("\/api\/personal-questions\/:id\/schedule".*async/);
            expect(routeMatch).toBeTruthy();
        });

        test('should check for authentication', () => {
            expect(routesContent).toMatch(/\/api\/personal-questions\/:id\/schedule[\s\S]*?if\s*\(!userId\)/);
        });

        test('should call getQuestionSchedules database method', () => {
            expect(routesContent).toMatch(/\/api\/personal-questions\/:id\/schedule[\s\S]*?getQuestionSchedules/);
        });

        test('should filter schedules by question_id', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.get("/api/personal-questions/:id/schedule"'),
                routesContent.indexOf('router.delete("/api/personal-questions/:id/schedule"')
            );
            expect(section).toMatch(/schedules\.find.*question_id/);
        });

        test('should return 404 if schedule not found', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.get("/api/personal-questions/:id/schedule"'),
                routesContent.indexOf('router.delete("/api/personal-questions/:id/schedule"')
            );
            expect(section).toContain('404');
        });

        test('should handle errors with 500 status', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.get("/api/personal-questions/:id/schedule"'),
                routesContent.indexOf('router.delete("/api/personal-questions/:id/schedule"')
            );
            expect(section).toContain('500');
        });
    });

    describe('DELETE /api/personal-questions/:id/schedule', () => {
        test('should have route defined', () => {
            expect(routesContent).toContain('router.delete("/api/personal-questions/:id/schedule"');
        });

        test('should use ensureAuthenticated middleware', () => {
            const routeMatch = routesContent.match(/router\.delete\("\/api\/personal-questions\/:id\/schedule",\s*ensureAuthenticated/);
            expect(routeMatch).toBeTruthy();
        });

        test('should be an async route handler', () => {
            const routeMatch = routesContent.match(/router\.delete\("\/api\/personal-questions\/:id\/schedule".*async/);
            expect(routeMatch).toBeTruthy();
        });

        test('should check for authentication', () => {
            expect(routesContent).toMatch(/router\.delete\("\/api\/personal-questions\/:id\/schedule"[\s\S]*?if\s*\(!userId\)/);
        });

        test('should call getQuestionSchedules to find schedule', () => {
            expect(routesContent).toMatch(/router\.delete\("\/api\/personal-questions\/:id\/schedule"[\s\S]*?getQuestionSchedules/);
        });

        test('should call deleteQuestionSchedule database method', () => {
            expect(routesContent).toMatch(/router\.delete\("\/api\/personal-questions\/:id\/schedule"[\s\S]*?deleteQuestionSchedule/);
        });

        test('should return 404 if schedule not found', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.delete("/api/personal-questions/:id/schedule"'),
                routesContent.indexOf('router.post("/api/personal-questions/:id/ask"')
            );
            expect(section).toContain('404');
        });

        test('should return success message on deletion', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.delete("/api/personal-questions/:id/schedule"'),
                routesContent.indexOf('router.post("/api/personal-questions/:id/ask"')
            );
            expect(section).toMatch(/success.*true/);
        });

        test('should handle errors with 500 status', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.delete("/api/personal-questions/:id/schedule"'),
                routesContent.indexOf('router.post("/api/personal-questions/:id/ask"')
            );
            expect(section).toContain('500');
        });
    });

    describe('POST /api/personal-questions/:id/ask', () => {
        test('should have route defined', () => {
            expect(routesContent).toContain('router.post("/api/personal-questions/:id/ask"');
        });

        test('should use ensureAuthenticated middleware', () => {
            const routeMatch = routesContent.match(/router\.post\("\/api\/personal-questions\/:id\/ask",\s*ensureAuthenticated/);
            expect(routeMatch).toBeTruthy();
        });

        test('should be an async route handler', () => {
            const routeMatch = routesContent.match(/router\.post\("\/api\/personal-questions\/:id\/ask".*async/);
            expect(routeMatch).toBeTruthy();
        });

        test('should check for authentication', () => {
            expect(routesContent).toMatch(/\/api\/personal-questions\/:id\/ask[\s\S]*?if\s*\(!userId\)/);
        });

        test('should validate model parameter', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/personal-questions/:id/ask"'),
                routesContent.indexOf('router.get("/personal-question-history/:id"')
            );
            expect(section).toMatch(/if\s*\(!model\)/);
        });

        test('should return 400 if model is missing', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/personal-questions/:id/ask"'),
                routesContent.indexOf('router.get("/personal-question-history/:id"')
            );
            expect(section).toMatch(/400.*Model is required/);
        });

        test('should call getPersonalQuestionById database method', () => {
            expect(routesContent).toMatch(/\/api\/personal-questions\/:id\/ask[\s\S]*?getPersonalQuestionById/);
        });

        test('should call generateAnswer AI method', () => {
            expect(routesContent).toMatch(/\/api\/personal-questions\/:id\/ask[\s\S]*?generateAnswer/);
        });

        test('should call saveAnswer database method', () => {
            expect(routesContent).toMatch(/\/api\/personal-questions\/:id\/ask[\s\S]*?saveAnswer/);
        });

        test('should mark answer as personal (isPersonal: true)', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/personal-questions/:id/ask"'),
                routesContent.indexOf('router.get("/personal-question-history/:id"')
            );
            expect(section).toMatch(/true.*isPersonal|isPersonal.*true/);
        });

        test('should return 404 if personal question not found', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/personal-questions/:id/ask"'),
                routesContent.indexOf('router.get("/personal-question-history/:id"')
            );
            expect(section).toContain('404');
        });

        test('should handle errors with 500 status', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/personal-questions/:id/ask"'),
                routesContent.indexOf('router.get("/personal-question-history/:id"')
            );
            expect(section).toContain('500');
        });
    });

    describe('Route Integration', () => {
        test('all routes should be in correct order', () => {
            const getAnswersIndex = routesContent.indexOf('router.get("/api/personal-questions/:id/answers"');
            const getScheduleIndex = routesContent.indexOf('router.get("/api/personal-questions/:id/schedule"');
            const deleteScheduleIndex = routesContent.indexOf('router.delete("/api/personal-questions/:id/schedule"');
            const postAskIndex = routesContent.indexOf('router.post("/api/personal-questions/:id/ask"');

            expect(getAnswersIndex).toBeGreaterThan(0);
            expect(getScheduleIndex).toBeGreaterThan(getAnswersIndex);
            expect(deleteScheduleIndex).toBeGreaterThan(getScheduleIndex);
            expect(postAskIndex).toBeGreaterThan(deleteScheduleIndex);
        });

        test('all routes should use consistent error handling pattern', () => {
            const routes = [
                'router.get("/api/personal-questions/:id/answers"',
                'router.get("/api/personal-questions/:id/schedule"',
                'router.delete("/api/personal-questions/:id/schedule"',
                'router.post("/api/personal-questions/:id/ask"'
            ];

            // All routes use try-catch pattern
            routes.forEach(route => {
                const startIdx = routesContent.indexOf(route);
                expect(startIdx).toBeGreaterThan(-1);
                const section = routesContent.substring(startIdx, startIdx + 2000);
                expect(section).toMatch(/try[\s\S]*catch/);
                expect(section).toMatch(/logger\.error/);
            });
        });

        test('all routes should validate user authentication', () => {
            const routes = [
                'router.get("/api/personal-questions/:id/answers"',
                'router.get("/api/personal-questions/:id/schedule"',
                'router.delete("/api/personal-questions/:id/schedule"',
                'router.post("/api/personal-questions/:id/ask"'
            ];

            routes.forEach(route => {
                const section = routesContent.match(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?}\\);`));
                expect(section[0]).toMatch(/userId.*req\.user/);
                expect(section[0]).toMatch(/if\s*\(!userId\)/);
            });
        });
    });

    describe('Database Method Verification', () => {
        const pgDbPath = path.join(__dirname, '../../core/pg-db.js');
        let pgDbContent;

        beforeAll(() => {
            pgDbContent = fs.readFileSync(pgDbPath, 'utf8');
        });

        test('getPersonalQuestionAnswers method should exist', () => {
            expect(pgDbContent).toContain('async getPersonalQuestionAnswers');
        });

        test('getQuestionSchedules method should exist', () => {
            expect(pgDbContent).toContain('async getQuestionSchedules');
        });

        test('deleteQuestionSchedule method should exist', () => {
            expect(pgDbContent).toContain('async deleteQuestionSchedule');
        });

        test('getPersonalQuestionById method should exist', () => {
            expect(pgDbContent).toContain('async getPersonalQuestionById');
        });

        test('saveAnswer method should exist', () => {
            expect(pgDbContent).toContain('async saveAnswer');
        });
    });
});
