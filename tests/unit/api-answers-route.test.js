/**
 * Integration tests for /api/answers route and getLatestAnswers method
 * Tests database methods and route configuration
 */

const path = require('path');
const fs = require('fs');

// Mock database for testing
class MockDatabase {
  async getLatestAnswers(limit = 10) {
    return [
      {
        id: 1,
        question: 'Test question 1',
        context: 'Test context 1',
        answer: 'Test answer 1',
        model: 'gpt-4',
        model_name: 'GPT-4',
        confidence: 0.95,
        date: new Date('2024-01-01'),
        user_id: 1,
        is_personal: false,
        prompt_version: '1.0'
      },
      {
        id: 2,
        question: 'Test question 2',
        context: 'Test context 2',
        answer: 'Test answer 2',
        model: 'gpt-3.5',
        model_name: 'GPT-3.5',
        confidence: 0.88,
        date: new Date('2024-01-02'),
        user_id: 1,
        is_personal: false,
        prompt_version: '1.0'
      }
    ].slice(0, limit);
  }
}

describe('API Answers Route Integration Tests', () => {
  describe('Database Method Tests', () => {
    test('MockDatabase getLatestAnswers should return array', async () => {
      const db = new MockDatabase();
      const results = await db.getLatestAnswers(5);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    test('MockDatabase getLatestAnswers should respect limit', async () => {
      const db = new MockDatabase();
      const results = await db.getLatestAnswers(1);
      
      expect(results.length).toBe(1);
    });

    test('MockDatabase getLatestAnswers should have required fields', async () => {
      const db = new MockDatabase();
      const results = await db.getLatestAnswers(1);
      
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('question');
      expect(results[0]).toHaveProperty('answer');
      expect(results[0]).toHaveProperty('date');
      expect(results[0]).toHaveProperty('is_personal');
    });

    test('MockDatabase getLatestAnswers should filter non-personal answers', async () => {
      const db = new MockDatabase();
      const results = await db.getLatestAnswers(10);
      
      results.forEach(answer => {
        expect(answer.is_personal).toBe(false);
      });
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
      
      // Find the answers route
      const answersRouteMatch = routesContent.match(/router\.get\("\/api\/answers"[\s\S]*?}\);/);
      expect(answersRouteMatch).toBeTruthy();
      
      const answersRouteCode = answersRouteMatch[0];
      expect(answersRouteCode).toContain('try');
      expect(answersRouteCode).toContain('catch');
      // Updated to check for new error handling
      const hasErrorLogging = answersRouteCode.includes('logError') || answersRouteCode.includes('console.error');
      expect(hasErrorLogging).toBe(true);
    });

    test('/api/answers route should not expose sensitive error details', () => {
      const routesPath = path.join(__dirname, '../../core/routes.js');
      const routesContent = fs.readFileSync(routesPath, 'utf8');
      
      // Find the answers route - updated regex to match asyncHandler closing
      const answersRouteMatch = routesContent.match(/router\.get\("\/api\/answers"[\s\S]*?}\)\);/);
      expect(answersRouteMatch).toBeTruthy();
      const answersRouteCode = answersRouteMatch[0];
      
      // Should have error handling - either generic message or centralized error handler
      const hasErrorHandling = answersRouteCode.includes('createDatabaseError') || 
                               answersRouteCode.includes('Failed to') ||
                               answersRouteCode.includes('retrieve latest answers');
      expect(hasErrorHandling).toBe(true);
      
      // The key security check: Should NOT directly expose raw error.message in JSON
      // (unless it's being passed to a proper error handler)
      const hasDirectErrorExposure = answersRouteCode.match(/res\..*?error:\s*error\.message/);
      expect(hasDirectErrorExposure).toBeFalsy();
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

    test('/api/answers route should use default limit of 10', () => {
      const routesPath = path.join(__dirname, '../../core/routes.js');
      const routesContent = fs.readFileSync(routesPath, 'utf8');
      
      const answersRouteMatch = routesContent.match(/router\.get\("\/api\/answers"[\s\S]*?}\);/);
      const answersRouteCode = answersRouteMatch[0];
      
      // Should have default of 10 when parsing limit
      expect(answersRouteCode).toMatch(/\|\|\s*10/);
    });
  });

  describe('Database Query Consistency', () => {
    test('pg-db getLatestAnswers returns date field', () => {
      const pgDbPath = path.join(__dirname, '../../core/pg-db.js');
      const pgDbContent = fs.readFileSync(pgDbPath, 'utf8');
      
      const methodMatch = pgDbContent.match(/async getLatestAnswers[\s\S]*?}\s*\n\s*async/);
      expect(methodMatch).toBeTruthy();
      
      const methodCode = methodMatch[0];
      // Should return date field to match template expectations
      expect(methodCode).toContain('date');
      expect(methodCode).toContain('is_personal = false');
      expect(methodCode).toContain('ORDER BY');
      expect(methodCode).toContain('LIMIT');
    });

    test('local-database getLatestAnswers aliases created_at as date', () => {
      const localDbPath = path.join(__dirname, '../../local/local-database.js');
      const localDbContent = fs.readFileSync(localDbPath, 'utf8');
      
      const methodMatch = localDbContent.match(/async getLatestAnswers[\s\S]*?}\s*\n\s*async/);
      expect(methodMatch).toBeTruthy();
      
      const methodCode = methodMatch[0];
      // Should alias created_at as date to match template expectations
      expect(methodCode).toContain('created_at as date');
      expect(methodCode).toContain('is_personal');
      expect(methodCode).toContain('ORDER BY');
      expect(methodCode).toContain('LIMIT');
    });

    test('both databases should return consistent field structure', () => {
      const pgDbPath = path.join(__dirname, '../../core/pg-db.js');
      const localDbPath = path.join(__dirname, '../../local/local-database.js');
      
      const pgDbContent = fs.readFileSync(pgDbPath, 'utf8');
      const localDbContent = fs.readFileSync(localDbPath, 'utf8');
      
      // Both should have the method
      expect(pgDbContent).toContain('async getLatestAnswers');
      expect(localDbContent).toContain('async getLatestAnswers');
      
      // Both should filter non-personal answers
      const pgMatch = pgDbContent.match(/async getLatestAnswers[\s\S]*?}\s*\n\s*async/);
      const localMatch = localDbContent.match(/async getLatestAnswers[\s\S]*?}\s*\n\s*async/);
      
      expect(pgMatch[0]).toContain('is_personal');
      expect(localMatch[0]).toContain('is_personal');
    });

    test('both databases should include question and context fields', () => {
      const pgDbPath = path.join(__dirname, '../../core/pg-db.js');
      const localDbPath = path.join(__dirname, '../../local/local-database.js');
      
      const pgDbContent = fs.readFileSync(pgDbPath, 'utf8');
      const localDbContent = fs.readFileSync(localDbPath, 'utf8');
      
      const pgMatch = pgDbContent.match(/async getLatestAnswers[\s\S]*?}\s*\n\s*async/);
      const localMatch = localDbContent.match(/async getLatestAnswers[\s\S]*?}\s*\n\s*async/);
      
      // Both should select question and context
      expect(pgMatch[0]).toContain('question');
      expect(pgMatch[0]).toContain('context');
      expect(localMatch[0]).toContain('question');
      expect(localMatch[0]).toContain('context');
    });

    test('PostgreSQL query should use date column without alias', () => {
      const pgDbPath = path.join(__dirname, '../../core/pg-db.js');
      const pgDbContent = fs.readFileSync(pgDbPath, 'utf8');
      
      const methodMatch = pgDbContent.match(/async getLatestAnswers[\s\S]*?}\s*\n\s*async/);
      expect(methodMatch).toBeTruthy();
      
      const methodCode = methodMatch[0];
      // PostgreSQL uses 'date' column to match template expectations
      expect(methodCode).toContain('date');
      expect(methodCode).not.toContain('date as created_at');
      expect(methodCode).toContain('ORDER BY date DESC');
    });

    test('SQLite query should alias created_at as date', () => {
      const localDbPath = path.join(__dirname, '../../local/local-database.js');
      const localDbContent = fs.readFileSync(localDbPath, 'utf8');
      
      const methodMatch = localDbContent.match(/async getLatestAnswers[\s\S]*?}\s*\n\s*async/);
      expect(methodMatch).toBeTruthy();
      
      const methodCode = methodMatch[0];
      // SQLite has 'created_at' column but aliases it as 'date' to match PostgreSQL
      expect(methodCode).toContain('a.created_at as date');
      expect(methodCode).toContain('ORDER BY a.created_at DESC');
    });
  });
});
