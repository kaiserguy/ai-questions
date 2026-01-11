/**
 * Public Application Entry Point
 * 
 * This is the entry point for the publicly-hosted version of AI Questions.
 * It uses PostgreSQL database, external LLMs, and supports user authentication.
 */

const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");

// Import core components
const { addOfflinePackageRoutes } = require("../core/offline-package-routes");
const createApp = require("../core/app");
const PostgresDatabase = require("../core/pg-db");
const ExternalLLMClient = require("../core/external-llm-client");
const commonRoutes = require("../core/routes");

// Public configuration
const PUBLIC_CONFIG = {
    isLocal: false,
    app: {
        port: process.env.PORT || 3000,
        name: "AI Questions"
    },
    session: {
        secret: process.env.SESSION_SECRET || "default-session-secret-change-in-production",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    database: {
        url: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    },
    auth: {
        google: {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.NODE_ENV === "production" 
                ? "https://peaceful-sierra-40313-4a09d237c70e.herokuapp.com/auth/google/callback"
                : "/auth/google/callback"
        }
    },
    wikipedia: {
        dbPath: process.env.WIKIPEDIA_DB_PATH || "./wikipedia.db"
    }
};

// Initialize database and AI client with error handling
console.log("Initializing database connection...");
if (!PUBLIC_CONFIG.database.url) {
    console.warn("Warning: DATABASE_URL not set. Database operations may fail.");
}

const db = new PostgresDatabase(PUBLIC_CONFIG.database.url);
const ai = new ExternalLLMClient();

console.log("Database and AI client initialized successfully.");

// Initialize database tables
db.initialize().catch(err => {
    console.warn("Database initialization warning:", err.message);
    console.log("App will continue running with limited database functionality");
});

// Initialize Wikipedia integration
const WikipediaIntegration = require("../core/wikipedia-integration");
const wikipedia = new WikipediaIntegration(PUBLIC_CONFIG.wikipedia.dbPath);

// Create Express app with core setup
const app = createApp(PUBLIC_CONFIG);

app.use(session({
    secret: PUBLIC_CONFIG.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: PUBLIC_CONFIG.session.secure,
        maxAge: PUBLIC_CONFIG.session.maxAge
    }
}));

// Set up Passport for authentication (simplified for testing)
app.use(passport.initialize());
app.use(passport.session());

// Set up Google OAuth strategy (only if credentials are available)
if (PUBLIC_CONFIG.auth.google.clientID && PUBLIC_CONFIG.auth.google.clientSecret) {
    passport.use(new GoogleStrategy({
        clientID: PUBLIC_CONFIG.auth.google.clientID,
        clientSecret: PUBLIC_CONFIG.auth.google.clientSecret,
        callbackURL: PUBLIC_CONFIG.auth.google.callbackURL
    }, (accessToken, refreshToken, profile, done) => {
        // In a real app, save user to database
        return done(null, profile);
    }));
    
    console.log("Google OAuth strategy configured successfully");
} else {
    console.warn("Google OAuth credentials not configured - authentication will be limited");
}

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id || user);
});

passport.deserializeUser((id, done) => {
    // In a real app, fetch user from database
    done(null, { id: id });
});

// Authentication routes (only if OAuth is configured)
if (PUBLIC_CONFIG.auth.google.clientID && PUBLIC_CONFIG.auth.google.clientSecret) {
    app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
    
    app.get("/auth/google/callback", 
        passport.authenticate("google", { failureRedirect: "/" }),
        (req, res) => {
            res.redirect("/");
        });
    
    app.get("/logout", (req, res) => {
        req.logout((err) => {
            if (err) console.error("Logout error:", err);
            res.redirect("/");
        });
    });
    
    console.log("OAuth routes configured successfully");
} else {
    // Provide fallback auth routes for development/environments without OAuth configured
    app.get("/auth/google", (req, res) => {
        res.redirect("/?error=oauth_not_configured");
    });
    
    app.get("/logout", (req, res) => {
        res.redirect("/");
    });
}

// Authentication routes removed - duplicates of routes defined in OAuth configuration block above

// Serve login page
app.get("/login", (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/");
    }
    res.render("login", {
        title: "Sign In - AI Questions",
        config: PUBLIC_CONFIG,
        error: req.query.error
    });
});

// Middleware to check authentication
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/login");
};

// Add offline package routes
addOfflinePackageRoutes(app);

// Add offline resource routes for serving libraries, models, and Wikipedia
const offlineResourceRoutes = require("../core/offline-resource-routes");
app.use('/offline', offlineResourceRoutes);

// Mount common routes
app.use("/", commonRoutes(db, ai, wikipedia, PUBLIC_CONFIG));

// Serve offline HTML5 endpoint
app.get("/offline", (req, res) => {
    res.render("offline", { 
        title: "AI Questions - Offline Mode",
        isLocal: false,
        user: req.user
    });
});

// Generate and serve local package
app.get("/generate-local-package", async (req, res) => {
    const packageDir = path.join(__dirname, "local-package");
    const outputPath = path.join(__dirname, "local-package.zip");
    
    try {
        // Create output stream
        const output = fs.createWriteStream(outputPath);
        const archive = archiver("zip", {
            zlib: { level: 9 } // Maximum compression
        });
        
        // Listen for all archive data to be written
        output.on("close", function() {
            console.log(`Local package created: ${archive.pointer()} total bytes`);
            res.json({
                success: true,
                message: "Package generated successfully",
                size: archive.pointer(),
                downloadUrl: "/download-local-package"
            });
        });
        
        // Handle errors
        archive.on("error", function(err) {
            console.error("Archive error:", err);
            res.status(500).json({
                success: false,
                message: "Failed to generate package",
                error: err.message
            });
        });
        
        // Pipe archive data to the file
        archive.pipe(output);
        
        // Add files from local directory
        archive.directory(path.join(__dirname, "local"), "local");
        
        // Add core files
        archive.directory(path.join(__dirname, "core"), "core");
        
        // Add views
        archive.directory(path.join(__dirname, "views"), "views");
        
        // Add public assets
        archive.directory(path.join(__dirname, "public"), "public");
        
        // Add local-app.js
        archive.file(path.join(__dirname, "local-app.js"), { name: "local-app.js" });
        
        // Add package.json with dependencies
        archive.file(path.join(__dirname, "package.json"), { name: "package.json" });
        
        // Add README and installation instructions
        archive.file(path.join(__dirname, "README.md"), { name: "README.md" });
        archive.file(path.join(__dirname, "local/setup-local.sh"), { name: "setup-local.sh" });
        archive.file(path.join(__dirname, "local/start-local.sh"), { name: "start-local.sh" });
        
        // Finalize the archive
        await archive.finalize();
    } catch (error) {
        console.error("Package generation error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate package",
            error: error.message
        });
    }
});

// Download offline version route (generates and downloads package)
app.get("/download/offline", async (req, res) => {
    const archiver = require('archiver');
    
    try {
        // Set response headers for download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="ai-questions-offline.zip"');
        
        // Create archive
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        // Handle errors
        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to create download package' });
            }
        });
        
        // Pipe archive to response
        archive.pipe(res);
        
        // Add install script (from repository root)
        const installPath = path.join(__dirname, '..', 'install.sh');
        if (fs.existsSync(installPath)) {
            archive.file(installPath, { name: 'install.sh' });
        }
        
        // Add readme (from repository root)
        const readmePath = path.join(__dirname, '..', 'README-OFFLINE.md');
        if (fs.existsSync(readmePath)) {
            archive.file(readmePath, { name: 'README.md' });
        }
        
        // Add local version files (from repository root)
        const localPath = path.join(__dirname, '..', 'local');
        if (fs.existsSync(localPath)) {
            archive.directory(localPath, 'ai-questions-local');
        }
        
        // Finalize the archive
        await archive.finalize();
        
    } catch (error) {
        console.error('Error creating download package:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to create download package' });
        }
    }
});

// Serve the generated package
app.get("/download-local-package", (req, res) => {
    const packagePath = path.join(__dirname, "local-package.zip");
    
    // Check if package exists
    if (fs.existsSync(packagePath)) {
        res.download(packagePath, "ai-questions-local.zip");
    } else {
        res.status(404).send("Package not found. Please generate it first.");
    }
});

// Start the server
const PORT = PUBLIC_CONFIG.app.port;

console.log(`Starting server on port ${PORT}...`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Database URL configured: ${!!PUBLIC_CONFIG.database.url}`);

app.listen(PORT, () => {
    console.log(`AI Questions server running on port ${PORT}`);
    if (process.env.NODE_ENV === "production") {
        console.log("Running in production mode");
    } else {
        console.log(`Visit http://localhost:${PORT} to access the application`);
    }
});


