/**
 * Public Application Entry Point
 * 
 * This is the entry point for the publicly-hosted version of AI Questions.
 * It uses PostgreSQL database, external LLMs, and supports user authentication.
 */

const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const zlib = require("zlib");
const { promisify } = require("util");
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");
const cron = require("node-cron");

// Import core components
const { addOfflinePackageRoutes } = require("../core/offline-package-routes");
const createApp = require("../core/app");
const PostgresDatabase = require("../core/pg-db");
const ExternalLLMClient = require("../core/external-llm-client");
const commonRoutes = require("../core/routes");

const WIKIPEDIA_CACHE_NAME = "wikipedia-db";
const WIKIPEDIA_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
const dbInitialization = db.initialize().catch(err => {
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
app.use('/offline-resources', offlineResourceRoutes);

// Mount common routes
app.use("/", commonRoutes(db, ai, wikipedia, PUBLIC_CONFIG));

// Serve offline HTML5 endpoint
app.get("/offline", (req, res) => {
    res.render("offline", { 
        title: "AI Questions - Offline Mode",
        isLocal: false,
        user: req.user,
        cacheBuster: Date.now() // Force cache invalidation on every load
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

// ===== AUTOMATED SCHEDULING =====
// Platform-agnostic cron jobs for daily question generation

// Schedule daily question generation at midnight UTC
cron.schedule('0 0 * * *', async () => {
    try {
        console.log('Running daily scheduled task at:', new Date().toISOString());
        
        // Generate answer for today's question
        const modelsResponse = await ai.listModels(null);
        const availableModels = modelsResponse.models.filter(m => m.available);
        
        if (availableModels.length === 0) {
            console.log('No available models for daily question generation');
            return;
        }
        
        // Get today's question from routes
        const today = new Date();
        const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        
        // Daily questions array (synced with core/routes.js)
        const DAILY_QUESTIONS = [
            {
                question: "In '1984', was Winston Smith's rebellion against the Party justified? Why or why not?",
                context: "In George Orwell's novel '1984', Winston Smith works at the Ministry of Truth but secretly rebels against the totalitarian regime of Big Brother and the Party. He keeps a diary, engages in a forbidden relationship with Julia, and seeks out the Brotherhood resistance movement."
            },
            {
                question: "Is the concept of 'doublethink' from '1984' present in today's society? Provide specific examples.",
                context: "In '1984', doublethink is described as the act of simultaneously accepting two mutually contradictory beliefs as correct. It involves the ability to tell deliberate lies while genuinely believing in them, to forget any fact that has become inconvenient, and then to draw it back from oblivion when needed."
            },
            {
                question: "Compare the surveillance state in '1984' with modern data collection practices. Are there meaningful differences, and why?",
                context: "In '1984', the Party monitors citizens through telescreens that both transmit and record, the Thought Police, and children who spy on their parents. Modern data collection includes internet tracking, smartphone location data, facial recognition, and various forms of digital surveillance by both governments and corporations."
            },
            {
                question: "In '1984', the Party rewrites history. What are the dangers of historical revisionism, and do you see examples today?",
                context: "In '1984', Winston Smith works at the Ministry of Truth where he alters historical documents to match the Party's ever-changing version of history. The novel portrays a society where 'Who controls the past controls the future. Who controls the present controls the past.'"
            },
            {
                question: "How does the concept of 'Newspeak' in '1984' relate to modern political language? Give examples.",
                context: "Newspeak in '1984' is a controlled language created by the Party to limit freedom of thought. It eliminates nuance and restricts the range of ideas that can be expressed. Words like 'doublethink', 'thoughtcrime', and 'unperson' show how language can be manipulated to control thought."
            },
            {
                question: "Was Julia a true rebel against the Party in '1984', or was her rebellion superficial? Explain your reasoning.",
                context: "In '1984', Julia is Winston's lover who appears to rebel against the Party through illegal sexual relationships and obtaining black market goods. However, her rebellion seems focused on personal pleasure rather than ideological opposition, unlike Winston who questions the Party's control of reality itself."
            },
            {
                question: "In '1984', what does the slogan 'Freedom is Slavery' mean, and is there any truth to it in our society?",
                context: "In '1984', the Party's three slogans are 'War is Peace', 'Freedom is Slavery', and 'Ignorance is Strength'. These paradoxes are central to the Party's control through doublethink."
            },
            {
                question: "Discuss the role of technology in '1984' as a tool of oppression. How does this compare to technology's role today?",
                context: "Technology in '1984' is primarily used for surveillance and control, such as telescreens, hidden microphones, and advanced weaponry. Today, technology offers both liberation and control, with concerns about privacy, data collection, and algorithmic manipulation."
            },
            {
                question: "How does '1984' explore the themes of individuality versus conformity?",
                context: "'1984' depicts a society where individuality is suppressed, and conformity to the Party's ideology is enforced through constant surveillance, propaganda, and re-education. Winston's struggle is a battle to maintain his own thoughts and identity."
            },
            {
                question: "What is the significance of Room 101 in '1984'?",
                context: "Room 101 is the torture chamber in the Ministry of Love where prisoners are subjected to their worst fears. It is the ultimate tool of the Party to break individuals and force them to conform."
            }
        ];
        
        const todayQuestion = DAILY_QUESTIONS[dayOfYear % DAILY_QUESTIONS.length];
        console.log(`Daily question: "${todayQuestion.question}"`);
        
        // Check if answer already exists for today
        const existingAnswer = await db.getAnswer(todayQuestion.question, availableModels[0].id);
        if (existingAnswer) {
            const existingDate = new Date(existingAnswer.date);
            const isSameUtcDay =
                existingDate.getUTCFullYear() === today.getUTCFullYear() &&
                existingDate.getUTCMonth() === today.getUTCMonth() &&
                existingDate.getUTCDate() === today.getUTCDate();
            if (isSameUtcDay) {
                console.log('Answer already generated today, skipping');
                return;
            }
        }
        
        // Generate answer with first available model
        const model = availableModels[0];
        console.log(`Generating answer with model: ${model.name}`);
        
        const aiResponse = await ai.generateResponse(
            model.id,
            todayQuestion.question,
            todayQuestion.context,
            null // No user ID for daily questions
        );
        
        // Save the answer
        await db.saveAnswer(
            todayQuestion.question,
            todayQuestion.context,
            aiResponse.answer,
            aiResponse.model,
            aiResponse.model_name,
            aiResponse.confidence,
            new Date(),
            null, // user_id
            null, // personal_question_id
            false, // is_personal
            '2.0' // prompt_version
        );
        
        console.log('Daily answer generated and saved successfully');
        
    } catch (error) {
        console.error('Error in daily scheduled task:', error);
    }
});

console.log('✅ Daily question generation scheduled (runs at midnight UTC)');

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
    
    // Auto-download Wikipedia database if not present
    initializeWikipediaCache().catch((error) => {
        console.error(`❌ Wikipedia cache initialization failed: ${error.message}`);
    });
});

/**
 * Initialize Wikipedia cache on server startup
 * Downloads Wikipedia database if not already present (using Node.js downloader)
 */
async function initializeWikipediaCache() {
    await dbInitialization;
    const dbPath = path.resolve(PUBLIC_CONFIG.wikipedia.dbPath);
    const dataDir = path.join(path.dirname(dbPath), 'wikipedia_data');
    const cacheMetadata = await getWikipediaCacheMetadata();
    const cacheAgeMs = cacheMetadata
        ? Date.now() - new Date(cacheMetadata.updated_at).getTime()
        : null;
    const cacheIsFresh = cacheMetadata && cacheAgeMs <= WIKIPEDIA_CACHE_MAX_AGE_MS;
    const localFileInfo = getWikipediaFileInfo(dbPath);
    const localFileIsFresh = localFileInfo && localFileInfo.ageMs <= WIKIPEDIA_CACHE_MAX_AGE_MS;

    if (localFileIsFresh) {
        console.log(`✅ Wikipedia database ready on disk (${localFileInfo.sizeMB} MB)`);

        if (!cacheIsFresh) {
            await cacheWikipediaDatabase(dbPath);
        }

        verifyWikipediaTables(dbPath);
        return;
    }

    if (cacheIsFresh) {
        console.log(`✅ Wikipedia database cache found in PostgreSQL (${formatBytes(cacheMetadata.size)})`);
        try {
            await ensureWikipediaDbOnDisk(dbPath);
            
            // Verify the restored database is valid
            const isValid = await validateWikipediaDatabase(dbPath);
            if (!isValid) {
                console.warn('⚠️  Restored database is corrupted, invalidating cache and re-downloading...');
                await db.deleteFileChunks(WIKIPEDIA_CACHE_NAME);
                fs.unlinkSync(dbPath);
            } else {
                verifyWikipediaTables(dbPath);
                return;
            }
        } catch (error) {
            console.error(`❌ Failed to restore from cache: ${error.message}`);
            console.log('🔄 Invalidating cache and re-downloading...');
            try {
                await db.deleteFileChunks(WIKIPEDIA_CACHE_NAME);
                if (fs.existsSync(dbPath)) {
                    fs.unlinkSync(dbPath);
                }
            } catch (cleanupError) {
                console.error(`⚠️  Cache cleanup failed: ${cleanupError.message}`);
            }
        }
    }
    
    console.log('📥 Wikipedia database cache missing or stale, downloading minimal package...');
    console.log('⏱️  This may take 5-10 minutes on first startup...');
    
    // Use Node.js Wikipedia downloader (no Python dependency)
    const { downloadAndProcessWikipedia } = require('../core/wikipedia-downloader');

    try {
        const resultPath = await downloadAndProcessWikipedia('simple', dbPath, dataDir);
        console.log(`✅ Wikipedia database ready at: ${resultPath}`);
        
        const fileSize = fs.statSync(resultPath).size;
        
        // Upload to PostgreSQL in chunks for future restarts
        console.log('📤 Caching to PostgreSQL for faster future restarts...');
        try {
            await cacheWikipediaDatabase(resultPath);
            console.log('✅ Database cached successfully - will restore from PostgreSQL on next restart');
            console.log(`📁 Keeping file on ephemeral disk for current session (${formatBytes(fileSize)})`);
        } catch (cacheError) {
            console.error(`⚠️  Failed to cache to PostgreSQL: ${cacheError.message}`);
            console.log(`📁 Database will be served from ephemeral disk (${formatBytes(fileSize)})`);
            console.log('💡 File persists until dyno restart, then will be regenerated');
        }
        
        // Force garbage collection
        if (global.gc) {
            console.log('🗑️  Running garbage collection...');
            global.gc();
        }
        
        // Reinitialize Wikipedia integration
        if (wikipedia && typeof wikipedia.initializeWikipedia === 'function') {
            wikipedia.initializeWikipedia();
        }
    } catch (error) {
        console.error(`❌ Wikipedia download/processing failed: ${error.message}`);

        if (cacheMetadata) {
            console.log('♻️ Falling back to cached Wikipedia database from PostgreSQL');
            await ensureWikipediaDbOnDisk(dbPath);
            verifyWikipediaTables(dbPath);
            return;
        }

        console.log('💡 Wikipedia will be available for manual download from /offline page');
    }
}

function getWikipediaFileInfo(dbPath) {
    if (!fs.existsSync(dbPath)) {
        return null;
    }

    const stats = fs.statSync(dbPath);
    return {
        size: stats.size,
        sizeMB: (stats.size / 1024 / 1024).toFixed(2),
        ageMs: Date.now() - stats.mtimeMs
    };
}

async function getWikipediaCacheMetadata() {
    if (!db || typeof db.getChunkedFileMetadata !== 'function') {
        return null;
    }

    try {
        // Check for chunked file first (new format)
        const chunkedMetadata = await db.getChunkedFileMetadata(WIKIPEDIA_CACHE_NAME);
        
        if (chunkedMetadata) {
            console.log(`🔍 Found ${chunkedMetadata.chunks_present} of ${chunkedMetadata.total_chunks} chunks in cache`);
            
            // Use parseInt to ensure both are numbers for comparison
            const chunksPresent = parseInt(chunkedMetadata.chunks_present);
            const totalChunks = parseInt(chunkedMetadata.total_chunks);
            
            if (chunksPresent === totalChunks) {
                return {
                    size: chunkedMetadata.total_size,
                    updated_at: chunkedMetadata.updated_at
                };
            } else {
                console.warn(`⚠️  Incomplete cache: ${chunksPresent}/${totalChunks} chunks`);
            }
        } else {
            console.log('🔍 No chunked cache found, checking old format...');
        }
        
        // Fall back to old monolithic format
        return await db.getCachedFileMetadata(WIKIPEDIA_CACHE_NAME);
    } catch (error) {
        console.warn(`⚠️ Failed to load Wikipedia cache metadata: ${error.message}`);
        return null;
    }
}

async function ensureWikipediaDbOnDisk(dbPath) {
    if (fs.existsSync(dbPath)) {
        return;
    }

    console.log('📥 Restoring Wikipedia database from PostgreSQL chunks...');
    
    try {
        // Try chunked format first (new format)
        const chunks = await db.getFileChunks(WIKIPEDIA_CACHE_NAME);
        
        if (chunks && chunks.length > 0) {
        const totalChunks = chunks[0].total_chunks;
        
        if (chunks.length !== totalChunks) {
            console.error(`❌ Incomplete chunked cache: ${chunks.length}/${totalChunks} chunks`);
            throw new Error('Incomplete cache');
        }
        
        console.log(`📥 Fetched ${chunks.length} chunks, decompressing independently...`);
        
        // Ensure chunks are in order
        chunks.sort((a, b) => a.chunk_index - b.chunk_index);
        
        await fs.promises.mkdir(path.dirname(dbPath), { recursive: true });
        
        // Stream chunks to disk to avoid memory overflow (Heroku 512 MB limit)
        console.log(`📝 Writing ${chunks.length} chunks to disk using streaming...`);
        const writeStream = fs.createWriteStream(dbPath);
        let totalSize = 0;
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            // Decompress this chunk
            const decompressed = await gunzip(chunk.chunk_data);
            totalSize += decompressed.length;
            
            // Write chunk immediately to minimize memory usage
            await new Promise((resolve, reject) => {
                const canContinue = writeStream.write(decompressed);
                if (canContinue) {
                    resolve();
                } else {
                    writeStream.once('drain', resolve);
                }
                writeStream.once('error', reject);
            });
            
            if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
                const progress = ((i + 1) / chunks.length * 100).toFixed(1);
                console.log(`📝 Written ${i + 1}/${chunks.length} chunks (${formatBytes(totalSize)}) - ${progress}%`);
            }
            
            // Force GC periodically to keep memory low
            if (i % 5 === 0 && global.gc) {
                global.gc();
            }
        }
        
        // Close the write stream and wait for finish
        await new Promise((resolve, reject) => {
            writeStream.end(() => resolve());
            writeStream.once('error', reject);
        });
        
        // Verify the file size matches
        const fileSize = fs.statSync(dbPath).size;
        if (fileSize !== totalSize) {
            throw new Error(`File size mismatch: expected ${totalSize}, got ${fileSize}`);
        }
        
        console.log(`✅ Restored Wikipedia database (${formatBytes(fileSize)})`);
        
        // Validate the restored database
        const isValid = await validateDatabase(dbPath);
        if (!isValid) {
            console.error('❌ Restored database is corrupted, invalidating cache...');
            await fs.promises.unlink(dbPath).catch(() => {});
            await db.query('DELETE FROM cached_files WHERE file_key = $1', ['wikipedia-database']);
            throw new Error('Database validation failed');
        }
        
        return;
    }
    
    // Fall back to old monolithic format if no chunks
    const cachedFile = await db.getCachedFile(WIKIPEDIA_CACHE_NAME);
    if (!cachedFile) {
        throw new Error('No Wikipedia database found in cache');
    }

    await fs.promises.mkdir(path.dirname(dbPath), { recursive: true });
    
    console.log(`📥 Decompressing database (${formatBytes(cachedFile.data.length)})...`);
    const decompressed = await gunzip(cachedFile.data);
    
    await fs.promises.writeFile(dbPath, decompressed);
    console.log(`✅ Restored Wikipedia database from PostgreSQL cache (${formatBytes(decompressed.length)})`);
    } catch (error) {
        console.error('❌ Failed to restore from cache:', error.message);
        throw error;
    }
}

async function cacheWikipediaDatabase(dbPath) {
    if (!db || typeof db.insertFileChunk !== 'function') {
        return;
    }

    // Validate database before caching
    const isValid = await validateWikipediaDatabase(dbPath);
    if (!isValid) {
        console.error('❌ Refusing to cache invalid Wikipedia database (0 articles or corrupted)');
        return;
    }

    // Read and compress uncompressed chunks independently to avoid gzip stream corruption
    const fileSize = fs.statSync(dbPath).size;
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB uncompressed chunks
    console.log(`📤 Uploading database in independently compressed chunks (${formatBytes(fileSize)})...`);
    
    // Force garbage collection before starting
    if (global.gc) {
        global.gc();
    }
    
    try {
        // Delete any existing chunks first
        await db.deleteFileChunks(WIKIPEDIA_CACHE_NAME);
        
        // Read file in chunks, compress each independently
        const fd = await fs.promises.open(dbPath, 'r');
        let chunkIndex = 0;
        let totalCompressedSize = 0;
        let offset = 0;
        
        while (offset < fileSize) {
            const chunkSize = Math.min(CHUNK_SIZE, fileSize - offset);
            const buffer = Buffer.alloc(chunkSize); // Use alloc() to zero-initialize
            
            // Read chunk from file and verify bytes read
            const { bytesRead } = await fd.read(buffer, 0, chunkSize, offset);
            
            if (bytesRead !== chunkSize) {
                throw new Error(`Read failed: expected ${chunkSize} bytes, read ${bytesRead}`);
            }
            
            // Compress this chunk independently
            const compressed = await gzip(buffer);
            
            // Upload to PostgreSQL
            await db.insertFileChunk(WIKIPEDIA_CACHE_NAME, chunkIndex, compressed, -1);
            
            totalCompressedSize += compressed.length;
            offset += chunkSize;
            chunkIndex++;
            
            const progress = (offset / fileSize * 100).toFixed(1);
            console.log(`📤 Uploaded chunk ${chunkIndex} (${formatBytes(compressed.length)} compressed from ${formatBytes(chunkSize)}) - ${progress}%`);
            
            // Clear buffers and force GC periodically
            if (chunkIndex % 5 === 0 && global.gc) {
                global.gc();
            }
        }
        
        await fd.close();
        
        // Update all chunks with final count
        const totalChunks = chunkIndex;
        await db.pool.query(
            `UPDATE cached_file_chunks SET total_chunks = $1 WHERE name = $2`,
            [totalChunks, WIKIPEDIA_CACHE_NAME]
        );
        
        console.log(`✅ Uploaded ${totalChunks} independently compressed chunks (${formatBytes(totalCompressedSize)} total, ${((1 - totalCompressedSize/fileSize) * 100).toFixed(1)}% compression)`);
        console.log(`📊 Original: ${formatBytes(fileSize)}, Compressed: ${formatBytes(totalCompressedSize)}`);
    } catch (error) {
        console.error('❌ Failed to cache Wikipedia database:', error.message);
        throw error;
    }
}

/**
 * Validate Wikipedia database has articles
 */
async function validateWikipediaDatabase(dbPath) {
    return new Promise((resolve) => {
        const sqlite3 = require('sqlite3').verbose();
        const testDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error(`❌ Failed to open database for validation: ${err.message}`);
                resolve(false);
                return;
            }
            
            testDb.get('SELECT COUNT(*) as count FROM wikipedia_articles', (err, row) => {
                testDb.close();
                
                if (err) {
                    console.error(`❌ Failed to validate database: ${err.message}`);
                    resolve(false);
                    return;
                }
                
                const MIN_VALID_ARTICLES = 10000;
                if (row.count < MIN_VALID_ARTICLES) {
                    console.error(`❌ Database has only ${row.count} articles (expected at least ${MIN_VALID_ARTICLES})`);
                    resolve(false);
                    return;
                }
                
                console.log(`✅ Database validated: ${row.count.toLocaleString()} articles`);
                resolve(true);
            });
        });
    });
}

function formatBytes(bytes) {
    if (!bytes || Number.isNaN(bytes)) {
        return '0 MB';
    }
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Verify Wikipedia database has required tables
 */
function verifyWikipediaTables(dbPath) {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error(`❌ Failed to open database for verification: ${err.message}`);
            return;
        }
        
        // Check for required tables
        db.all(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`, (err, tables) => {
            if (err) {
                console.error(`❌ Failed to query tables: ${err.message}`);
                db.close();
                return;
            }
            
            const tableNames = tables.map(t => t.name);
            console.log(`📊 Database tables: ${tableNames.join(', ')}`);
            
            // Check for FTS table
            const hasFTS = tableNames.some(name => name.includes('fts'));
            if (hasFTS) {
                console.log('✅ Full-text search (FTS) table found');
            } else {
                console.log('⚠️  Warning: No FTS table found - search performance will be limited');
            }
            
            // Get article count
            db.get('SELECT COUNT(*) as count FROM wikipedia_articles', (err, row) => {
                if (err) {
                    console.error(`❌ Failed to count articles: ${err.message}`);
                } else {
                    console.log(`📚 Total articles: ${row.count.toLocaleString()}`);
                }
                db.close();
            });
        });
    });
}
