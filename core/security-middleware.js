/**
 * Security Middleware
 * 
 * Provides comprehensive security headers and protection against common web vulnerabilities
 */

const helmet = require('helmet');

/**
 * Configure security headers using Helmet
 * @param {object} app - Express app instance
 * @param {object} config - Configuration object
 */
function setupSecurityHeaders(app, config = {}) {
    // Use Helmet with custom configuration
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'", // Required for inline scripts (consider removing in production)
                    "https://cdn.jsdelivr.net",
                    "https://unpkg.com"
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'", // Required for inline styles
                    "https://cdn.jsdelivr.net",
                    "https://fonts.googleapis.com"
                ],
                fontSrc: [
                    "'self'",
                    "https://fonts.gstatic.com",
                    "https://cdn.jsdelivr.net"
                ],
                imgSrc: [
                    "'self'",
                    "data:",
                    "https:",
                    "http:" // Allow external images
                ],
                connectSrc: [
                    "'self'",
                    "https://api.openai.com",
                    "https://api-inference.huggingface.co",
                    "http://localhost:11434", // Ollama local API
                    "http://localhost:5678"   // n8n local API
                ],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: config.isLocal ? [] : null
            }
        },
        
        // Prevent clickjacking
        frameguard: {
            action: 'deny'
        },
        
        // Hide X-Powered-By header
        hidePoweredBy: true,
        
        // Strict Transport Security (HTTPS only)
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        },
        
        // Prevent MIME type sniffing
        noSniff: true,
        
        // Disable DNS prefetch
        dnsPrefetchControl: {
            allow: false
        },
        
        // Referrer Policy
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin'
        },
        
        // Permissions Policy
        permittedCrossDomainPolicies: {
            permittedPolicies: 'none'
        }
    }));
    
    // Additional custom security headers
    app.use((req, res, next) => {
        // Prevent XSS attacks
        res.setHeader('X-XSS-Protection', '1; mode=block');
        
        // Prevent MIME type sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        // Disable browser caching for sensitive pages
        if (req.path.startsWith('/api/')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
        
        next();
    });
}

/**
 * Rate limiting middleware to prevent brute force attacks
 * Note: This is a simple in-memory rate limiter. For production with multiple instances,
 * consider using redis-based rate limiting.
 */
class RateLimiter {
    constructor(windowMs = 15 * 60 * 1000, maxRequests = 100) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.requests = new Map();
    }
    
    middleware() {
        return (req, res, next) => {
            const identifier = req.ip || req.connection.remoteAddress;
            const now = Date.now();
            
            // Clean up old entries
            for (const [key, value] of this.requests.entries()) {
                if (now - value.resetTime > this.windowMs) {
                    this.requests.delete(key);
                }
            }
            
            // Get or create request record
            let record = this.requests.get(identifier);
            if (!record || now - record.resetTime > this.windowMs) {
                record = {
                    count: 0,
                    resetTime: now
                };
                this.requests.set(identifier, record);
            }
            
            // Increment request count
            record.count++;
            
            // Check if limit exceeded
            if (record.count > this.maxRequests) {
                return res.status(429).json({
                    error: 'Too many requests',
                    message: 'Please try again later'
                });
            }
            
            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', this.maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - record.count));
            res.setHeader('X-RateLimit-Reset', new Date(record.resetTime + this.windowMs).toISOString());
            
            next();
        };
    }
}

/**
 * SQL Injection Protection Middleware
 * Logs warnings if potential SQL injection patterns are detected
 */
function sqlInjectionProtection(req, res, next) {
    const sqlInjectionPatterns = [
        /(\bselect\b|\bunion\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bcreate\b|\balter\b|\bexec\b|\bexecute\b).*(\bfrom\b|\binto\b|\bwhere\b|\btable\b)/gi,
        /(\bor\b|\band\b)\s+(\d+\s*=\s*\d+|\btrue\b|\bfalse\b)/gi,
        /(--|;|\/\*|\*\/|xp_|sp_)/gi
    ];
    
    const checkValue = (value, path = '') => {
        if (typeof value === 'string') {
            for (const pattern of sqlInjectionPatterns) {
                if (pattern.test(value)) {
                    console.warn(`[SECURITY WARNING] Potential SQL injection attempt detected in ${path}:`, value.substring(0, 100));
                    // Note: We're just logging for now. In production, consider blocking the request.
                }
            }
        } else if (typeof value === 'object' && value !== null) {
            for (const [key, val] of Object.entries(value)) {
                checkValue(val, `${path}.${key}`);
            }
        }
    };
    
    // Check all request inputs
    checkValue(req.body, 'body');
    checkValue(req.query, 'query');
    checkValue(req.params, 'params');
    
    next();
}

module.exports = {
    setupSecurityHeaders,
    RateLimiter,
    sqlInjectionProtection
};
