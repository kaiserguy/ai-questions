/**
 * Tests for schedule execution API routes
 * Validates the implementation of schedule execution endpoints
 */

const fs = require('fs');
const path = require('path');

describe('Schedule Execution API Routes Tests', () => {
    const routesFilePath = path.join(__dirname, '../../core/routes.js');
    const pgDbFilePath = path.join(__dirname, '../../core/pg-db.js');
    let routesContent;
    let pgDbContent;

    beforeAll(() => {
        routesContent = fs.readFileSync(routesFilePath, 'utf8');
        pgDbContent = fs.readFileSync(pgDbFilePath, 'utf8');
    });

    describe('POST /api/schedules/:id/toggle', () => {
        test('should have route defined', () => {
            expect(routesContent).toContain('router.post("/api/schedules/:id/toggle"');
        });

        test('should use ensureAuthenticated middleware', () => {
            const routeMatch = routesContent.match(/router\.post\("\/api\/schedules\/:id\/toggle",\s*ensureAuthenticated/);
            expect(routeMatch).toBeTruthy();
        });

        test('should be an async route handler', () => {
            const routeMatch = routesContent.match(/router\.post\("\/api\/schedules\/:id\/toggle".*async/);
            expect(routeMatch).toBeTruthy();
        });

        test('should check for authentication', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/toggle"'),
                routesContent.indexOf('router.post("/api/schedules/:id/execute"')
            );
            expect(section).toMatch(/if\s*\(!userId\)/);
        });

        test('should call toggleScheduleActive database method', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/toggle"'),
                routesContent.indexOf('router.post("/api/schedules/:id/execute"')
            );
            expect(section).toContain('toggleScheduleActive');
        });

        test('should return 404 if schedule not found', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/toggle"'),
                routesContent.indexOf('router.post("/api/schedules/:id/execute"')
            );
            expect(section).toContain('404');
        });

        test('should return schedule on success', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/toggle"'),
                routesContent.indexOf('router.post("/api/schedules/:id/execute"')
            );
            expect(section).toMatch(/res\.json\(result\.schedule\)/);
        });

        test('should handle errors with 500 status', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/toggle"'),
                routesContent.indexOf('router.post("/api/schedules/:id/execute"')
            );
            expect(section).toContain('500');
        });
    });

    describe('POST /api/schedules/:id/execute', () => {
        test('should have route defined', () => {
            expect(routesContent).toContain('router.post("/api/schedules/:id/execute"');
        });

        test('should use ensureAuthenticated middleware', () => {
            const routeMatch = routesContent.match(/router\.post\("\/api\/schedules\/:id\/execute",\s*ensureAuthenticated/);
            expect(routeMatch).toBeTruthy();
        });

        test('should be an async route handler', () => {
            const routeMatch = routesContent.match(/router\.post\("\/api\/schedules\/:id\/execute".*async/);
            expect(routeMatch).toBeTruthy();
        });

        test('should check for authentication', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toMatch(/if\s*\(!userId\)/);
        });

        test('should call getQuestionScheduleById database method', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toContain('getQuestionScheduleById');
        });

        test('should call getPersonalQuestionById database method', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toContain('getPersonalQuestionById');
        });

        test('should call createScheduleExecution database method', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toContain('createScheduleExecution');
        });

        test('should call ai.generateAnswer for each model', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toContain('ai.generateAnswer');
        });

        test('should call saveAnswer database method', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toContain('saveAnswer');
        });

        test('should call updateScheduleExecution database method', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toContain('updateScheduleExecution');
        });

        test('should call updateScheduleNextRun database method', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toContain('updateScheduleNextRun');
        });

        test('should track success and failure counts', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toContain('successCount');
            expect(section).toContain('failureCount');
        });

        test('should return execution results', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toMatch(/execution_id.*success_count.*failure_count/s);
        });

        test('should return 404 if schedule not found', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toContain('404');
        });

        test('should handle errors with 500 status', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toContain('500');
        });
    });

    describe('GET /api/schedules/:id/executions', () => {
        test('should have route defined', () => {
            expect(routesContent).toContain('router.get("/api/schedules/:id/executions"');
        });

        test('should use ensureAuthenticated middleware', () => {
            const routeMatch = routesContent.match(/router\.get\("\/api\/schedules\/:id\/executions",\s*ensureAuthenticated/);
            expect(routeMatch).toBeTruthy();
        });

        test('should be an async route handler', () => {
            const routeMatch = routesContent.match(/router\.get\("\/api\/schedules\/:id\/executions".*async/);
            expect(routeMatch).toBeTruthy();
        });

        test('should check for authentication', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.get("/api/schedules/:id/executions"'),
                routesContent.indexOf('function calculateNextRunDate')
            );
            expect(section).toMatch(/if\s*\(!userId\)/);
        });

        test('should call getScheduledExecutions database method', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.get("/api/schedules/:id/executions"'),
                routesContent.indexOf('function calculateNextRunDate')
            );
            expect(section).toContain('getScheduledExecutions');
        });

        test('should return executions array', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.get("/api/schedules/:id/executions"'),
                routesContent.indexOf('function calculateNextRunDate')
            );
            expect(section).toMatch(/res\.json\(executions\)/);
        });

        test('should handle errors with 500 status', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.get("/api/schedules/:id/executions"'),
                routesContent.indexOf('function calculateNextRunDate')
            );
            expect(section).toContain('500');
        });
    });

    describe('Helper Function: calculateNextRunDate', () => {
        test('should have calculateNextRunDate function defined', () => {
            expect(routesContent).toContain('function calculateNextRunDate');
        });

        test('should handle daily frequency', () => {
            const section = routesContent.substring(
                routesContent.indexOf('function calculateNextRunDate'),
                routesContent.indexOf('function calculateNextRunDate') + 1000
            );
            expect(section).toContain('daily');
        });

        test('should handle weekly frequency', () => {
            const section = routesContent.substring(
                routesContent.indexOf('function calculateNextRunDate'),
                routesContent.indexOf('function calculateNextRunDate') + 1000
            );
            expect(section).toContain('weekly');
        });

        test('should handle monthly frequency', () => {
            const section = routesContent.substring(
                routesContent.indexOf('function calculateNextRunDate'),
                routesContent.indexOf('function calculateNextRunDate') + 1000
            );
            expect(section).toContain('monthly');
        });

        test('should handle custom frequency with hours', () => {
            const section = routesContent.substring(
                routesContent.indexOf('function calculateNextRunDate'),
                routesContent.indexOf('function calculateNextRunDate') + 1500
            );
            expect(section).toContain('hours');
        });

        test('should handle custom frequency with days', () => {
            const section = routesContent.substring(
                routesContent.indexOf('function calculateNextRunDate'),
                routesContent.indexOf('function calculateNextRunDate') + 1500
            );
            expect(section).toContain('days');
        });

        test('should handle custom frequency with weeks', () => {
            const section = routesContent.substring(
                routesContent.indexOf('function calculateNextRunDate'),
                routesContent.indexOf('function calculateNextRunDate') + 1500
            );
            expect(section).toContain('weeks');
        });
    });

    describe('Database Methods', () => {
        test('toggleScheduleActive method should exist', () => {
            expect(pgDbContent).toContain('async toggleScheduleActive');
        });

        test('toggleScheduleActive should toggle is_active field', () => {
            const section = pgDbContent.substring(
                pgDbContent.indexOf('async toggleScheduleActive'),
                pgDbContent.indexOf('async toggleScheduleActive') + 500
            );
            expect(section).toMatch(/is_active\s*=\s*NOT\s*is_active/);
        });

        test('toggleScheduleActive should verify user ownership', () => {
            const section = pgDbContent.substring(
                pgDbContent.indexOf('async toggleScheduleActive'),
                pgDbContent.indexOf('async toggleScheduleActive') + 500
            );
            expect(section).toContain('user_id');
        });

        test('createScheduleExecution method should exist', () => {
            expect(pgDbContent).toContain('async createScheduleExecution');
        });

        test('createScheduleExecution should insert into scheduled_executions', () => {
            const section = pgDbContent.substring(
                pgDbContent.indexOf('async createScheduleExecution'),
                pgDbContent.indexOf('async createScheduleExecution') + 500
            );
            expect(section).toContain('scheduled_executions');
            expect(section).toContain('INSERT');
        });

        test('createScheduleExecution should set initial status to running', () => {
            const section = pgDbContent.substring(
                pgDbContent.indexOf('async createScheduleExecution'),
                pgDbContent.indexOf('async createScheduleExecution') + 500
            );
            expect(section).toContain('running');
        });

        test('updateScheduleExecution method should exist', () => {
            expect(pgDbContent).toContain('async updateScheduleExecution');
        });

        test('updateScheduleExecution should update execution record', () => {
            const section = pgDbContent.substring(
                pgDbContent.indexOf('async updateScheduleExecution'),
                pgDbContent.indexOf('async updateScheduleExecution') + 500
            );
            expect(section).toContain('UPDATE scheduled_executions');
            expect(section).toContain('success_count');
            expect(section).toContain('failure_count');
            expect(section).toContain('execution_status');
        });

        test('getScheduledExecutions method should already exist', () => {
            expect(pgDbContent).toContain('async getScheduledExecutions');
        });

        test('updateScheduleNextRun method should already exist', () => {
            expect(pgDbContent).toContain('async updateScheduleNextRun');
        });
    });

    describe('Route Integration', () => {
        test('all routes should be in correct order', () => {
            const toggleIndex = routesContent.indexOf('router.post("/api/schedules/:id/toggle"');
            const executeIndex = routesContent.indexOf('router.post("/api/schedules/:id/execute"');
            const executionsIndex = routesContent.indexOf('router.get("/api/schedules/:id/executions"');

            expect(toggleIndex).toBeGreaterThan(0);
            expect(executeIndex).toBeGreaterThan(toggleIndex);
            expect(executionsIndex).toBeGreaterThan(executeIndex);
        });

        test('all routes should use consistent error handling pattern', () => {
            const routes = [
                'router.post("/api/schedules/:id/toggle"',
                'router.post("/api/schedules/:id/execute"',
                'router.get("/api/schedules/:id/executions"'
            ];

            routes.forEach(route => {
                const startIdx = routesContent.indexOf(route);
                expect(startIdx).toBeGreaterThan(-1);
                const section = routesContent.substring(startIdx, startIdx + 3000);
                expect(section).toMatch(/try[\s\S]*catch/);
                expect(section).toMatch(/console\.error/);
            });
        });

        test('all routes should validate user authentication', () => {
            const routes = [
                'router.post("/api/schedules/:id/toggle"',
                'router.post("/api/schedules/:id/execute"',
                'router.get("/api/schedules/:id/executions"'
            ];

            routes.forEach(route => {
                const startIdx = routesContent.indexOf(route);
                const section = routesContent.substring(startIdx, startIdx + 500);
                expect(section).toMatch(/userId.*req\.user/);
                expect(section).toMatch(/if\s*\(!userId\)/);
            });
        });
    });

    describe('Execution Logic', () => {
        test('execute endpoint should handle multiple models', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toMatch(/for.*models/);
        });

        test('execute endpoint should handle model failures gracefully', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toContain('errors.push');
            expect(section).toMatch(/catch.*error/);
        });

        test('execute endpoint should calculate next run date', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toContain('calculateNextRunDate');
        });

        test('execute endpoint should mark answers as personal', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toMatch(/true.*isPersonal|isPersonal.*true/);
        });

        test('execute endpoint should include schedule_id and execution_id in answers', () => {
            const section = routesContent.substring(
                routesContent.indexOf('router.post("/api/schedules/:id/execute"'),
                routesContent.indexOf('router.get("/api/schedules/:id/executions"')
            );
            expect(section).toMatch(/schedule\.id/);
            expect(section).toMatch(/execution\.id/);
        });
    });
});
