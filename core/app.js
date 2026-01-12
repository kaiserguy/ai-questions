const express = require('express');
const path = require('path');
const { setupSecurityHeaders, RateLimiter, sqlInjectionProtection } = require('./security-middleware');

module.exports = (config) => {
    const app = express();

    // Set up security headers and protection
    setupSecurityHeaders(app, config);

    // Set up EJS as the view engine
    app.set('view engine', 'ejs');
    app.set("views", path.join(__dirname, 'views'));
    
    // Body parsing middleware with size limits
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // SQL injection detection middleware (logs warnings)
    app.use(sqlInjectionProtection);
    
    // Rate limiting for API routes
    const apiRateLimiter = new RateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes
    app.use('/api/', apiRateLimiter.middleware());
    
    // Serve static files from the 'public' directory
    app.use(express.static(path.join(__dirname, 'public')));

    // Add common middleware or configurations here

    return app;
};

