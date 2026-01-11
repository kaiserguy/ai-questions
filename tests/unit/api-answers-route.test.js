/**
 * Unit tests for /api/answers route and getLatestAnswers method
 */

const path = require('path');
const fs = require('fs');

describe('API Answers Route Tests', () => {
  describe('Database Method Existence', () => {
    test('pg-db.js should have getLatestAnswers method', () => {
      const pgDbPath = path.join(__dirname, '../../core/pg-db.js');
      expect(fs.existsSync(pgDbPath)).toBe(true);
      
      const pgDbContent = fs.readFileSync(pgDbPath, 'utf8');
      expect(pgDbContent).toContain('async getLatestAnswers');
      expect(pgDbContent).toContain('limit = 10');
    });

    test('local-database.js should have getLatestAnswers method', () => {
      const localDbPath = path.join(__dirname, '../../local/local-database.js');
      expect(fs.existsSync(localDbPath)).toBe(true);
      
      const localDbContent = fs.readFileSync(localDbPath, 'utf8');
      expect(localDbContent).toContain('async getLatestAnswers');
      expect(localDbContent).toContain('limit = 10');
    });
  });

  describe('Route Configuration', () => {
    test('routes.js should have /api/answers endpoint', () => {
      const routesPath = path.join(__dirname, '../../core/routes.js');
      expect(fs.existsSync(routesPath)).toBe(true);
      
      const routesContent = fs.readFileSync(routesPath, 'utf8');
      expect(routesContent).toContain('router.get("/api/answers"');
      expect(routesContent).toContain('db.getLatestAnswers');
    });

    test('/api/answers route should have authentication middleware', () => {
      const routesPath = path.join(__dirname, '../../core/routes.js');
      const routesContent = fs.readFileSync(routesPath, 'utf8');
      
      // Check that the route uses ensureAuthenticated middleware
      expect(routesContent).toContain('router.get("/api/answers", ensureAuthenticated');
    });

    test('/api/answers route should have proper error handling', () => {
      const routesPath = path.join(__dirname, '../../core/routes.js');
      const routesContent = fs.readFileSync(routesPath, 'utf8');
      
      // Check for try-catch block
      const answersRouteMatch = routesContent.match(/router\.get\("\/api\/answers"[\s\S]*?}\);/);
      expect(answersRouteMatch).toBeTruthy();
      
      const answersRouteCode = answersRouteMatch[0];
      expect(answersRouteCode).toContain('try');
      expect(answersRouteCode).toContain('catch');
      expect(answersRouteCode).toContain('console.error');
    });

    test('/api/answers route should not expose sensitive error details', () => {
      const routesPath = path.join(__dirname, '../../core/routes.js');
      const routesContent = fs.readFileSync(routesPath, 'utf8');
      
      // Find the answers route
      const answersRouteMatch = routesContent.match(/router\.get\("\/api\/answers"[\s\S]*?}\);[\s\S]*?router\./);
      expect(answersRouteMatch).toBeTruthy();
      const answersRouteCode = answersRouteMatch[0];
      
      // Should have generic error message
      expect(answersRouteCode).toContain('Failed to get latest answers');
      
      // The key security check: Should NOT include error.message in the JSON response
      // This would be a pattern like: error: error.message or message: error.message
      expect(answersRouteCode).not.toMatch(/:\s*error\.message/);
    });

    test('/api/answers route should support limit query parameter', () => {
      const routesPath = path.join(__dirname, '../../core/routes.js');
      const routesContent = fs.readFileSync(routesPath, 'utf8');
      
      const answersRouteMatch = routesContent.match(/router\.get\("\/api\/answers"[\s\S]*?}\);/);
      const answersRouteCode = answersRouteMatch[0];
      
      // Should parse limit from query parameters
      expect(answersRouteCode).toContain('req.query.limit');
      expect(answersRouteCode).toContain('parseInt');
    });
  });

  describe('SQL Query Validation', () => {
    test('pg-db getLatestAnswers should query non-personal answers only', () => {
      const pgDbPath = path.join(__dirname, '../../core/pg-db.js');
      const pgDbContent = fs.readFileSync(pgDbPath, 'utf8');
      
      // Find the getLatestAnswers method
      const methodMatch = pgDbContent.match(/async getLatestAnswers[\s\S]*?}\s*\n\s*async/);
      expect(methodMatch).toBeTruthy();
      
      const methodCode = methodMatch[0];
      expect(methodCode).toContain('is_personal = false');
      expect(methodCode).toContain('ORDER BY date DESC');
      expect(methodCode).toContain('LIMIT');
    });

    test('local-database getLatestAnswers should join with questions table', () => {
      const localDbPath = path.join(__dirname, '../../local/local-database.js');
      const localDbContent = fs.readFileSync(localDbPath, 'utf8');
      
      // Find the getLatestAnswers method
      const methodMatch = localDbContent.match(/async getLatestAnswers[\s\S]*?}\s*\n\s*async/);
      expect(methodMatch).toBeTruthy();
      
      const methodCode = methodMatch[0];
      expect(methodCode).toContain('JOIN questions');
      expect(methodCode).toContain('ORDER BY');
      expect(methodCode).toContain('LIMIT');
    });
  });
});
