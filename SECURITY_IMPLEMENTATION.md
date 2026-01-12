# Security Implementation Guide

This document describes the comprehensive security measures implemented to protect against XSS, SQL injection, and other common web vulnerabilities.

## Table of Contents

1. [Overview](#overview)
2. [Input Validation](#input-validation)
3. [Output Sanitization](#output-sanitization)
4. [SQL Injection Protection](#sql-injection-protection)
5. [XSS Protection](#xss-protection)
6. [Security Headers](#security-headers)
7. [Rate Limiting](#rate-limiting)
8. [API Key Security](#api-key-security)
9. [Testing Security](#testing-security)
10. [Best Practices](#best-practices)

## Overview

The application implements a multi-layered security approach using industry-standard libraries and best practices:

- **express-validator**: Comprehensive input validation
- **sanitize-html**: HTML sanitization to prevent XSS
- **helmet**: Security headers middleware
- Custom rate limiting and SQL injection detection

## Input Validation

All user inputs are validated using `express-validator` with strict rules.

### Validation Rules

Located in `core/validation.js`, validation rules cover:

- **Questions**: 3-2000 characters, sanitized
- **Context**: 0-5000 characters, sanitized
- **Model IDs**: Alphanumeric with specific allowed characters
- **API Keys**: 10-500 characters, specific format
- **Providers**: Whitelist of allowed providers
- **Schedules**: Integer IDs, enum frequency types
- **Wikipedia searches**: 1-200 characters, sanitized

### Usage Example

```javascript
const { validationRules, validateRequest } = require('./core/validation');

router.post("/api/generate-answer",
    ensureAuthenticated,
    validationRules.question(),
    validationRules.context(),
    validationRules.modelId(),
    validateRequest,
    async (req, res) => {
        // Request body is now validated and sanitized
        const { question, context, modelId } = req.body;
        // ... process request
    }
);
```

### Validation Error Response

Invalid requests return a 400 status with details:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "question",
      "message": "Question must be between 3 and 2000 characters"
    }
  ]
}
```

## Output Sanitization

All user-generated content is sanitized before storage and display.

### HTML Sanitization

```javascript
const { sanitizeInput, sanitizeFormattedText } = require('./core/validation');

// Remove all HTML tags (default)
const cleanText = sanitizeInput(userInput);

// Allow basic formatting tags
const formattedText = sanitizeFormattedText(userInput);
// Allows: <b>, <i>, <em>, <strong>, <br>, <p>
```

### Object Sanitization

Recursively sanitize entire objects:

```javascript
const { sanitizeObject } = require('./core/validation');

const sanitizedData = sanitizeObject(req.body);
```

## SQL Injection Protection

### Parameterized Queries

All database queries use parameterized statements (prepared statements):

```javascript
// PostgreSQL (core/pg-db.js)
const result = await pool.query(
    'SELECT * FROM questions WHERE id = $1',
    [questionId]
);

// SQLite (local/local-database.js)
const stmt = db.prepare('SELECT * FROM questions WHERE id = ?');
const result = stmt.get(questionId);
```

### SQL Injection Detection

The `sqlInjectionProtection` middleware logs warnings for suspicious patterns:

```javascript
// Patterns detected:
// - SQL keywords: SELECT, UNION, INSERT, UPDATE, DELETE, DROP, etc.
// - Logic operators: OR 1=1, AND true, etc.
// - SQL injection markers: --, ;, /* */
```

**Note**: Detection logs warnings but does not block requests by default. This allows legitimate use cases while alerting administrators to potential attacks.

### Never Use String Concatenation

❌ **NEVER DO THIS:**
```javascript
const query = `SELECT * FROM users WHERE id = ${userId}`;
```

✅ **ALWAYS DO THIS:**
```javascript
const query = 'SELECT * FROM users WHERE id = $1';
const result = await pool.query(query, [userId]);
```

## XSS Protection

### Content Security Policy (CSP)

Implemented via Helmet in `core/security-middleware.js`:

```javascript
contentSecurityPolicy: {
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        // ... other directives
    }
}
```

### X-XSS-Protection Header

```
X-XSS-Protection: 1; mode=block
```

Enables browser's built-in XSS filter.

### Template Engine Auto-Escaping

EJS templates automatically escape variables:

```ejs
<!-- Automatically escaped -->
<p><%= userInput %></p>

<!-- Unescaped (use with caution, only for trusted content) -->
<p><%- trustedContent %></p>
```

## Security Headers

All security headers are configured in `core/security-middleware.js` using Helmet:

### Headers Included

- **X-Frame-Options**: `DENY` - Prevents clickjacking
- **Strict-Transport-Security**: Enforces HTTPS
- **X-Content-Type-Options**: `nosniff` - Prevents MIME type sniffing
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **X-XSS-Protection**: `1; mode=block`
- **Cache-Control**: No caching for API responses

### Custom Headers

```javascript
// No caching for sensitive API responses
if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
}
```

## Rate Limiting

Prevents brute force and DDoS attacks.

### API Rate Limiting

```javascript
// 100 requests per 15 minutes for API routes
const apiRateLimiter = new RateLimiter(15 * 60 * 1000, 100);
app.use('/api/', apiRateLimiter.middleware());
```

### Rate Limit Headers

Responses include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 2026-01-12T05:15:00.000Z
```

### Rate Limit Exceeded Response

```json
{
  "error": "Too many requests",
  "message": "Please try again later"
}
```

## API Key Security

### Storage

- API keys are stored encrypted in the database
- Only masked versions are returned in API responses
- Never log full API keys

### Validation

```javascript
validationRules.apiKey(): [
    body('apiKey')
        .trim()
        .notEmpty()
        .isLength({ min: 10, max: 500 })
        .matches(/^[a-zA-Z0-9\-_\.]+$/)
]
```

### Provider Validation

Only whitelisted providers are allowed:

```javascript
validationRules.provider(): [
    body('provider')
        .isIn(['openai', 'anthropic', 'google', 'huggingface', 'ollama'])
]
```

## Testing Security

### Running Security Tests

```bash
# Run all tests
npm test

# Run security-specific tests
npm test -- tests/security/

# Check for security vulnerabilities in dependencies
npm audit

# Fix security vulnerabilities
npm audit fix
```

### Manual Security Testing

1. **XSS Testing**: Try injecting `<script>alert('XSS')</script>` in inputs
2. **SQL Injection Testing**: Try `' OR 1=1--` in text fields
3. **Rate Limiting**: Send rapid requests to API endpoints
4. **Header Validation**: Check response headers in browser DevTools

### Security Scanning

```bash
# Run npm security audit
npm audit --audit-level=moderate

# Check outdated packages with vulnerabilities
npm outdated
```

## Best Practices

### For Developers

1. **Always validate user input**
   - Use `validationRules` for all routes accepting user data
   - Add `validateRequest` middleware after validation rules

2. **Always sanitize output**
   - Use `sanitizeInput()` for plain text
   - Use `sanitizeFormattedText()` when basic formatting is needed
   - Never trust user input, even after validation

3. **Use parameterized queries**
   - PostgreSQL: Use `$1, $2, ...` placeholders
   - SQLite: Use `?` placeholders
   - Never concatenate SQL strings with user input

4. **Keep dependencies updated**
   - Run `npm audit` regularly
   - Update security-related packages promptly
   - Monitor security advisories

5. **Review security headers**
   - Check `core/security-middleware.js` when adding new features
   - Update CSP if adding new external resources

6. **Test security features**
   - Write tests for validation rules
   - Test rate limiting behavior
   - Verify sanitization works correctly

### For Operations

1. **Monitor security logs**
   - Watch for SQL injection warnings in logs
   - Monitor rate limiting 429 responses
   - Track authentication failures

2. **Configure environment**
   - Set strong `SESSION_SECRET`
   - Enable HTTPS in production
   - Configure appropriate rate limits

3. **Regular security audits**
   - Run `npm audit` before each deployment
   - Review security headers with browser tools
   - Test common attack vectors

## Security Checklist

Before deploying:

- [ ] All user inputs validated with `validationRules`
- [ ] All outputs sanitized with `sanitizeInput()` or equivalent
- [ ] All database queries use parameterized statements
- [ ] Rate limiting configured appropriately
- [ ] Security headers enabled (check with Helmet)
- [ ] CSP configured for all external resources
- [ ] API keys never exposed in logs or responses
- [ ] HTTPS enabled in production
- [ ] `npm audit` shows no high-severity vulnerabilities
- [ ] Session secret is strong and unique

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [express-validator Documentation](https://express-validator.github.io/docs/)
- [sanitize-html Documentation](https://www.npmjs.com/package/sanitize-html)

## Support

For security concerns or questions:

1. Review this documentation
2. Check `core/validation.js` for validation examples
3. Check `core/security-middleware.js` for security configuration
4. Open an issue on GitHub (for non-sensitive questions)
5. For sensitive security issues, contact the maintainer directly

---

**Last Updated**: January 2026
**Security Level**: Production-Ready
