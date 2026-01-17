/**
 * AIWikipediaSearch - AI-powered Wikipedia search for offline mode
 * Uses AI to generate optimized search queries from natural language input
 * Searches local SQLite Wikipedia database and displays results as local article links
 */

class AIWikipediaSearch {
    constructor() {
        this.searchInput = null;
        this.searchButton = null;
        this.resultsContainer = null;
        this.articleContainer = null;
        this.loading = false;
        this.searchCancelled = false;
        this.db = null;
        this.dbReady = false;
        this.aiModel = null;
        this.initialized = false;
        this.dataProvider = null; // WikipediaClientProvider instance
    }

    /**
     * Initialize the AI Wikipedia search
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        console.log('[AIWikipediaSearch] Initializing...');
        
        // Get UI elements
        this.searchInput = document.getElementById('wikiSearchInput');
        this.searchButton = document.getElementById('wikiSearchBtn');
        this.resultsContainer = document.getElementById('wikiResults');
        this.articleContainer = document.getElementById('wikiArticleView');

        if (!this.searchInput || !this.searchButton || !this.resultsContainer) {
            console.error('[AIWikipediaSearch] Required UI elements not found');
            return false;
        }

        // Use AIModelManager (WebLLM) for AI query generation
        if (window.offlineIntegrationManager && window.offlineIntegrationManager.aiModelManager) {
            const aiManager = window.offlineIntegrationManager.aiModelManager;
            if (aiManager.ready && aiManager.isReady()) {
                this.aiModel = aiManager;
                console.log('[AIWikipediaSearch] Connected to AIModelManager with WebLLM');
            }
        } else {
            console.warn('[AIWikipediaSearch] SimpleQAModel not available, using basic search');
        }

        // Initialize SQL.js for local database access
        try {
            await this.initializeDatabase();
        } catch (error) {
            // Check if this is the expected "not downloaded yet" condition
            if (error.message && error.message.includes('not found in storage')) {
                console.log('[AIWikipediaSearch] Wikipedia database not yet downloaded - this is normal on first visit');
            } else {
                console.error('[AIWikipediaSearch] Database initialization failed:', error);
            }
            // Don't return false - UI should still work, just without database
        }

        // Set up event listeners (only once)
        if (!this.initialized) {
            this.searchButton.addEventListener('click', () => this.performSearch());
            this.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }

        // Update status indicator
        this.updateStatusIndicator();

        this.initialized = true;
        console.log('[AIWikipediaSearch] Initialized successfully');
        return true;
    }

    /**
     * Check if Wikipedia search is ready
     * @returns {boolean} True if database is loaded
     */
    isReady() {
        return this.dbReady && this.db !== null;
    }

    /**
     * Cancel the current search operation
     */
    cancelSearch() {
        console.log('[AIWikipediaSearch] Search cancelled by user');
        this.searchCancelled = true;
        this.loading = false;
        this.showMessage('Search cancelled by user', 'info');
    }

    /**
     * Search method for integration manager compatibility
     * @param {string} query - Search query
     * @returns {Promise<Array>} Search results
     */
    async search(query) {
        if (!this.dbReady || !this.db) {
            throw new Error('Wikipedia database not loaded');
        }
        
        // Generate search query and perform search
        const searchQuery = await this.generateSearchQuery(query);
        return await this.searchLocalDatabase(searchQuery);
    }

    /**
     * Update the Wikipedia search status indicator
     */
    updateStatusIndicator() {
        const statusEl = document.getElementById('wikiSearchStatus');
        const statusText = document.getElementById('wikiStatusText');
        
        console.log('[AIWikipediaSearch] updateStatusIndicator called, dbReady:', this.dbReady, 'db:', !!this.db);
        
        if (!statusEl || !statusText) {
            console.log('[AIWikipediaSearch] Status elements not found');
            return;
        }
        
        if (this.dbReady) {
            console.log('[AIWikipediaSearch] Setting status to READY (green)');
            statusEl.style.display = 'block';
            statusEl.style.background = '#d1fae5';
            statusText.textContent = '✅ Local Wikipedia database loaded and ready';
        } else {
            console.log('[AIWikipediaSearch] Setting status to NOT READY (yellow warning)');
            statusEl.style.display = 'block';
            statusEl.style.background = '#fef3c7';
            statusText.textContent = '⚠️ Download the offline package to enable local Wikipedia search';
        }
    }

    /**
     * Initialize the SQLite database using SQL.js
     */
    async initializeDatabase() {
        console.log('[AIWikipediaSearch] Loading SQL.js...');
        
        // Check if SQL.js is available
        if (typeof initSqlJs === 'undefined') {
            console.log('[AIWikipediaSearch] SQL.js not loaded, attempting to load...');
            // SQL.js should be loaded via script tag
            throw new Error('SQL.js not available');
        }

        try {
            const SQL = await initSqlJs({
                locateFile: file => `/offline/libs/${file}`
            });

            // Retrieve the Wikipedia database from IndexedDB
            console.log('[AIWikipediaSearch] Retrieving Wikipedia database from IndexedDB...');
            const dbData = await this.getWikipediaFromStorage();
            
            if (!dbData) {
                throw new Error('Wikipedia database not found in storage. Please download it first.');
            }

            this.db = new SQL.Database(dbData);
            this.dbReady = true;
            
            // Create data provider for enhanced features
            if (typeof WikipediaClientProvider !== 'undefined') {
                this.dataProvider = new WikipediaClientProvider(this.db);
                console.log('[AIWikipediaSearch] Data provider initialized');
            }
            
            // Get article count
            const result = this.db.exec('SELECT COUNT(*) FROM wikipedia_articles');
            const count = result[0]?.values[0]?.[0] || 0;
            console.log(`[AIWikipediaSearch] Database loaded with ${count} articles`);
            
            // Update status indicator now that database is ready
            this.updateStatusIndicator();
            
            return true;
        } catch (error) {
            // Check if this is the expected "not downloaded yet" condition
            const isNotDownloaded = error.message && error.message.includes('not found in storage');
            if (isNotDownloaded) {
                console.log('[AIWikipediaSearch] Wikipedia database not found - download required');
            } else {
                console.error('[AIWikipediaSearch] Database initialization error:', error);
            }
            this.dbReady = false;
            // Update status to show not ready (not an error for expected conditions)
            this.updateStatusIndicator();
            throw error;
        }
    }

    /**
     * Retrieve Wikipedia database from IndexedDB
     * @returns {Promise<Uint8Array>} The database file
     */
    async getWikipediaFromStorage() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('OfflineAI', 2);
            
            request.onerror = () => reject(request.error);
            
            request.onupgradeneeded = (event) => {
                // Database doesn't exist yet - create the stores
                const db = event.target.result;
                if (!db.objectStoreNames.contains('wikipedia')) {
                    db.createObjectStore('wikipedia', { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains('libraries')) {
                    db.createObjectStore('libraries', { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains('models')) {
                    db.createObjectStore('models', { keyPath: 'name' });
                }
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                
                console.log('[AIWikipediaSearch] Database opened successfully');
                console.log('[AIWikipediaSearch] Available object stores:', Array.from(db.objectStoreNames));
                
                // Check if wikipedia store exists
                if (!db.objectStoreNames.contains('wikipedia')) {
                    console.log('[AIWikipediaSearch] Wikipedia store not found in database');
                    resolve(null);
                    return;
                }
                
                console.log('[AIWikipediaSearch] Wikipedia store found, listing all keys...');
                const transaction = db.transaction(['wikipedia'], 'readonly');
                const store = transaction.objectStore('wikipedia');
                
                // First, get ALL keys to see what's actually stored
                const getAllKeysRequest = store.getAllKeys();
                getAllKeysRequest.onsuccess = () => {
                    const allKeys = getAllKeysRequest.result;
                    console.log('[AIWikipediaSearch] All keys in wikipedia store:', allKeys);
                    
                    // Try different possible names (includes legacy names for backwards compatibility)
                    const names = ['Simple-Wikipedia-210MB', 'Wikipedia-Subset-20MB', 'Simple-Wikipedia-50MB', 'Extended-Wikipedia'];
                    
                    const tryName = (index) => {
                        if (index >= names.length) {
                            console.log('[AIWikipediaSearch] No Wikipedia database found with any known name');
                            resolve(null);
                            return;
                        }
                        
                        console.log(`[AIWikipediaSearch] Trying to get: ${names[index]}`);
                        const getRequest = store.get(names[index]);
                        
                        getRequest.onsuccess = () => {
                            if (getRequest.result && getRequest.result.data) {
                                console.log(`[AIWikipediaSearch] Found Wikipedia database: ${names[index]}`);
                                resolve(getRequest.result.data);
                            } else {
                                console.log(`[AIWikipediaSearch] ${names[index]} not found or has no data`);
                                tryName(index + 1);
                            }
                        };
                        
                        getRequest.onerror = () => {
                            console.log(`[AIWikipediaSearch] Error retrieving ${names[index]}`);
                            tryName(index + 1);
                        };
                    };
                    
                    tryName(0);
                };
                
                getAllKeysRequest.onerror = () => {
                    console.error('[AIWikipediaSearch] Error getting keys from wikipedia store');
                    resolve(null);
                };
            };
        });
    }

    /**
     * Iteratively search and read articles until AI is satisfied it has enough context
     * @param {string} userQuery - User's search query
     * @returns {Promise<Array>} Articles collected for context
     */
    async doPreliminarySearch(userQuery) {
        if (!this.db || !this.aiModel || !this.aiModel.isReady()) {
            return [];
        }

        const collectedArticles = [];
        const searchHistory = []; // Track unsuccessful searches
        let consecutiveDone = 0; // Track consecutive DONE attempts
        let iteration = 0;
        const maxIterations = 20; // Increased safety limit

        try {
            console.log(`[AIWikipediaSearch] Starting iterative preliminary search...`);
            
            while (iteration < maxIterations && !this.searchCancelled) {
                iteration++;
                
                // Build article context
                let articleContext = '';
                if (collectedArticles.length > 0) {
                    articleContext = `\n\nArticles read so far:\n${collectedArticles.map((a, i) => `${i + 1}. "${a.title}" (Relevancy: ${a.relevancy}/10)`).join('\n')}\n`;
                }
                
                // Build search history to prevent repeats
                let historyContext = '';
                if (searchHistory.length > 0) {
                    historyContext = `\n\nPrevious SQL queries that found nothing:\n${searchHistory.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nTry DIFFERENT query!`;
                }
                
                // Ask AI to generate SQL query to find next article
                const searchPrompt = `You are a Wikipedia database search agent. Your ONLY job is to write SQLite queries to find articles.

Database schema: wikipedia_articles (id, article_id, title, content, summary, categories, word_count)

User's question: "${userQuery}"${articleContext}${historyContext}

${collectedArticles.length === 0 ? 'STATUS: No articles found yet.\n' : `STATUS: ${collectedArticles.length} articles collected.\n`}
Your task: Write a SELECT query to find ONE relevant article.

Examples:
- Question: "capital of France?" → Query: SELECT title, summary FROM wikipedia_articles WHERE title LIKE '%Paris%' LIMIT 1
- Question: "who invented telephone?" → Query: SELECT title, summary FROM wikipedia_articles WHERE content LIKE '%Bell%' AND content LIKE '%telephone%' LIMIT 1
- Question: "is bread made from wheat?" → Query: SELECT title, summary FROM wikipedia_articles WHERE title LIKE '%bread%' OR title LIKE '%wheat%' LIMIT 1

Use LIKE with % wildcards. Do NOT use exact equality (=).
${collectedArticles.length === 0 ? 'You CANNOT say DONE yet.\n' : 'Say "DONE" only if you have article(s) with score 7+.\n'}
Response (SQL query or DONE):`;

                const decision = await this.aiModel.generateResponse(searchPrompt);
                let cleanDecision = decision.trim();
                cleanDecision = cleanDecision.replace(/```sql?/gi, '').replace(/```/g, '').trim();
                cleanDecision = cleanDecision.replace(/;+$/g, '').trim();
                const firstLine = cleanDecision.split('\n')[0].trim().toUpperCase();
                
                console.log(`[AIWikipediaSearch] Iteration ${iteration} - AI response: "${cleanDecision.substring(0, 100)}..."`);
                
                // Check if AI says DONE
                if (firstLine === 'DONE' || firstLine.startsWith('DONE')) {
                    consecutiveDone++;
                    
                    if (collectedArticles.length === 0) {
                        console.log(`[AIWikipediaSearch] AI tried to finish with 0 articles - REJECTED (attempt ${consecutiveDone})`);
                        
                        // After many failed attempts, give up
                        if (consecutiveDone >= 10) {
                            console.error(`[AIWikipediaSearch] AI refusing to search after ${consecutiveDone} attempts - aborting`);
                            break;
                        }
                        continue;
                    }
                    
                    const bestScore = Math.max(...collectedArticles.map(a => a.relevancy || 0));
                    if (bestScore >= 7) {
                        console.log(`[AIWikipediaSearch] AI satisfied with ${collectedArticles.length} articles (best: ${bestScore}/10)`);
                        break;
                    } else {
                        console.log(`[AIWikipediaSearch] Best score ${bestScore}/10 insufficient - continuing`);
                        continue;
                    }
                }
                
                // AI gave SQL query - reset DONE counter
                consecutiveDone = 0;
                
                // Extract SELECT statement
                const sqlMatch = cleanDecision.match(/SELECT[\s\S]+?$/i);
                const sql = sqlMatch ? sqlMatch[0].trim() : cleanDecision.trim();
                
                // Validate it's a SELECT query
                if (!sql || !sql.toUpperCase().startsWith('SELECT')) {
                    console.log(`[AIWikipediaSearch] Invalid SQL response - skipping`);
                    continue;
                }
                
                console.log(`[AIWikipediaSearch] Executing: ${sql.substring(0, 80)}...`);
                
                const stmt = this.db.prepare(sql);
                if (stmt.step()) {
                    const article = stmt.getAsObject();
                    
                    // Ask AI to score this article's relevancy
                    try {
                        const scorePrompt = `Database search task: "${userQuery}"\nFound article: "${article.title}"\nSummary: ${(article.summary || article.snippet).substring(0, 200)}\n\nRelevance score (0-10)?\nRespond with ONLY a number 0-10:`;
                        const scoreResponse = await this.aiModel.generateResponse(scorePrompt);
                        const scoreMatch = scoreResponse.match(/\d+/);
                        article.relevancy = scoreMatch ? Math.min(parseInt(scoreMatch[0]), 10) : 5;
                    } catch (error) {
                        article.relevancy = 5;
                    }
                    
                    collectedArticles.push(article);
                    console.log(`[AIWikipediaSearch] Read article: "${article.title}" (relevancy: ${article.relevancy}/10)`);
                } else {
                    // No article found - add SQL to history to prevent repeats
                    console.log(`[AIWikipediaSearch] Query returned no results - adding to history`);
                    searchHistory.push(sql.substring(0, 100));
                }
                stmt.free();
                
                // Update UI to show progress
                const bestScore = collectedArticles.length > 0 ? Math.max(...collectedArticles.map(a => a.relevancy || 0)) : 0;
                this.showMessage(`AI reading articles... (${collectedArticles.length} read, best: ${bestScore}/10)`, 'info');
            }
            
            if (iteration >= maxIterations) {
                console.log(`[AIWikipediaSearch] Reached iteration limit with ${collectedArticles.length} articles`);
            }
            
            if (this.searchCancelled) {
                console.log(`[AIWikipediaSearch] Search cancelled by user with ${collectedArticles.length} articles read`);
            }
            
            console.log(`[AIWikipediaSearch] Preliminary search complete - collected ${collectedArticles.length} articles`);
            return collectedArticles;
        } catch (error) {
            console.error('[AIWikipediaSearch] Preliminary search failed:', error);
            return collectedArticles;
        }
    }

    /**
     * Use AI to generate optimized search query from user input
     * @param {string} userQuery - User's natural language query
     * @returns {Promise<string>} Optimized search query
     */
    async generateSearchQuery(userQuery) {
        if (!this.aiModel || !this.aiModel.isReady()) {
            console.warn('[AIWikipediaSearch] AI model not available, using keyword extraction');
            return this.extractKeyTerms(userQuery);
        }

        try {
            // Phase 1: Do preliminary search to gather context
            const contextArticles = await this.doPreliminarySearch(userQuery);
            
            // If search was cancelled, display the articles we read instead
            if (this.searchCancelled && contextArticles.length > 0) {
                console.log(`[AIWikipediaSearch] Displaying ${contextArticles.length} articles from cancelled search`);
                this.displayArticleList(contextArticles, userQuery);
                return null; // Signal to skip final search
            }
            
            // Build context from articles if found
            let articleContext = '';
            let bestArticleTitle = null;
            if (contextArticles.length > 0) {
                // Get high-scoring articles
                const topArticles = contextArticles.filter(a => a.relevancy >= 7).slice(0, 3);
                
                if (topArticles.length > 0) {
                    articleContext = '\n\nHighly relevant articles found:\n';
                    topArticles.forEach((article, idx) => {
                        articleContext += `- "${article.title}" (${article.relevancy}/10)\n`;
                    });
                    bestArticleTitle = topArticles[0].title;
                } else {
                    // No high-scoring articles, use best one
                    const best = contextArticles.sort((a, b) => (b.relevancy || 0) - (a.relevancy || 0))[0];
                    articleContext = `\n\nBest match found: "${best.title}" (${best.relevancy}/10)\n`;
                    bestArticleTitle = best.title;
                }
            }

            const prompt = `SQLite Wikipedia database query task.

User question: "${userQuery}"${articleContext}

Schema: wikipedia_articles (id, article_id, title, content, summary, categories, word_count)

${bestArticleTitle ? `Focus on finding: "${bestArticleTitle}" or closely related articles.\n\n` : ''}Generate a SELECT query that returns the most specific, relevant articles.
- Use EXACT title match if possible: WHERE title = '...'
- Or use narrow LIKE patterns: WHERE title LIKE '%term%'
- Limit to 1-5 results max

Respond with ONLY the SQL query:`;
            
            let response = await this.aiModel.generateResponse(prompt);
            
            // Clean up response - remove code fences, semicolons, extra whitespace
            response = response.replace(/```sql?/gi, '').replace(/```/g, '').trim();
            response = response.replace(/;+$/g, '').trim();
            
            // Extract just the SQL query if the model added extra text
            const sqlMatch = response.match(/SELECT[\s\S]+?(?:LIMIT \d+)?$/i);
            const sql = sqlMatch ? sqlMatch[0].trim() : response.trim();
            
            // Normalize to single line for cleaner logs
            const cleanSql = sql.replace(/\s+/g, ' ').trim();
            
            console.log(`[AIWikipediaSearch] AI generated SQL: "${cleanSql}"`);
            console.log(`[AIWikipediaSearch] Original query: "${userQuery}"`);
            return cleanSql;
        } catch (error) {
            console.error('[AIWikipediaSearch] AI query generation failed:', error);
            return this.extractKeyTerms(userQuery);
        }
    }

    /**
     * Extract key terms from a query (fallback method)
     * @param {string} query - User query
     * @returns {string} Key terms
     */
    extractKeyTerms(query) {
        // Remove common stop words and extract meaningful terms
        const stopWords = new Set([
            'what', 'is', 'are', 'the', 'a', 'an', 'how', 'does', 'do', 'can', 'could',
            'would', 'should', 'will', 'tell', 'me', 'about', 'explain', 'describe',
            'i', 'want', 'to', 'know', 'learn', 'understand', 'please', 'help',
            'of', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'and', 'or', 'but'
        ]);

        const words = query.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));

        return words.join(' ');
    }

    /**
     * Display list of articles read during preliminary search
     * @param {Array} articles - Articles with relevancy scores
     * @param {string} originalQuery - Original user query
     */
    displayArticleList(articles, originalQuery) {
        // Sort by relevancy
        const sorted = [...articles].sort((a, b) => (b.relevancy || 0) - (a.relevancy || 0));
        
        const html = `
            <div class="wiki-search-info">
                <p>📚 AI Research Results for "<strong>${this.escapeHtml(originalQuery)}</strong>"</p>
                <p style="color: #6b7280; font-size: 0.9em;">The AI read ${articles.length} article${articles.length !== 1 ? 's' : ''} to research your question.</p>
            </div>
            <div class="wiki-results-list">
                ${sorted.map(article => `
                    <div class="wiki-result-item" data-id="${article.id}">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h3 class="wiki-result-title" style="margin: 0;">
                                <a href="#" class="wiki-article-link" data-id="${article.id}" data-title="${this.escapeHtml(article.title)}">
                                    📄 ${this.escapeHtml(article.title)}
                                </a>
                            </h3>
                            <div style="background: ${article.relevancy >= 7 ? '#10b981' : article.relevancy >= 5 ? '#f59e0b' : '#ef4444'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: bold;">
                                ${article.relevancy || '?'}/10
                            </div>
                        </div>
                        <p class="wiki-result-description" style="margin-top: 8px;">${this.escapeHtml((article.summary || article.snippet).substring(0, 300))}...</p>
                        <div class="wiki-result-actions">
                            <button class="wiki-action-btn view-local-article" data-id="${article.id}" data-title="${this.escapeHtml(article.title)}">
                                📖 View Full Article
                            </button>
                            <button class="wiki-action-btn use-in-chat" data-title="${this.escapeHtml(article.title)}" data-summary="${this.escapeHtml(article.summary || article.snippet)}">
                                💬 Use in Chat
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        this.resultsContainer.innerHTML = html;
        
        // Hide stop button
        const stopBtn = document.getElementById('wikiStopBtn');
        if (stopBtn) stopBtn.style.display = 'none';

        // Add event listeners
        this.resultsContainer.querySelectorAll('.wiki-article-link, .view-local-article').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const id = e.target.getAttribute('data-id') || e.target.closest('[data-id]').getAttribute('data-id');
                const title = e.target.getAttribute('data-title') || e.target.closest('[data-title]').getAttribute('data-title');
                this.viewLocalArticle(parseInt(id), title);
            });
        });

        this.resultsContainer.querySelectorAll('.use-in-chat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const title = e.target.getAttribute('data-title');
                const summary = e.target.getAttribute('data-summary');
                this.useInChat(title, summary);
            });
        });
    }

    /**
     * Perform the Wikipedia search
     */
    async performSearch() {
        const userQuery = this.searchInput.value.trim();
        
        if (!userQuery) {
            this.showMessage('Please enter a search term', 'warning');
            return;
        }

        if (this.loading) {
            console.log('[AIWikipediaSearch] Search already in progress');
            return;
        }

        this.loading = true;
        this.searchCancelled = false;
        this.showLoading();

        try {
            // Generate AI-optimized search query
            const searchQuery = await this.generateSearchQuery(userQuery);
            
            // If search was cancelled and articles were displayed, we're done
            if (searchQuery === null) {
                this.loading = false;
                return;
            }
            
            console.log(`[AIWikipediaSearch] Searching for: "${searchQuery}" (original: "${userQuery}")`);

            let results = [];

            if (this.dbReady && this.db) {
                // Search local database using FTS5
                results = await this.searchLocalDatabase(searchQuery);
            } else {
                // Try to initialize database if not ready
                try {
                    await this.initializeDatabase();
                    results = await this.searchLocalDatabase(searchQuery);
                } catch (error) {
                    console.error('[AIWikipediaSearch] Database not available:', error);
                    this.showMessage('Wikipedia database not available. Please download the offline package first.', 'warning');
                    this.loading = false;
                    return;
                }
            }

            this.displayResults(results, userQuery, searchQuery);
        } catch (error) {
            console.error('[AIWikipediaSearch] Search failed:', error);
            this.showMessage('Search failed. Please try again.', 'error');
        } finally {
            this.loading = false;
        }
    }

    /**
     * Validate an AI-generated SQL query for safety
     * Only allows SELECT queries on wikipedia_articles table
     * @param {string} sql - SQL query to validate
     * @returns {boolean} True if query is safe
     */
    validateSqlQuery(sql) {
        if (!sql || typeof sql !== 'string') return false;
        
        const normalized = sql.trim().toUpperCase();
        
        // Must start with SELECT
        if (!normalized.startsWith('SELECT')) {
            console.warn('[AIWikipediaSearch] Query rejected: not a SELECT statement');
            return false;
        }
        
        // Must not contain dangerous patterns (semicolons already stripped during cleaning)
        const dangerousPatterns = [
            /--/,                         // SQL comments
            /\/\*/,                       // Block comments
            /\bDROP\b/i,                  // DROP statements
            /\bDELETE\b/i,                // DELETE statements
            /\bINSERT\b/i,                // INSERT statements
            /\bUPDATE\b/i,                // UPDATE statements
            /\bALTER\b/i,                 // ALTER statements
            /\bCREATE\b/i,                // CREATE statements
            /\bTRUNCATE\b/i,              // TRUNCATE statements
            /\bEXEC\b/i,                  // EXEC statements
            /\bUNION\b/i,                 // UNION (could be used for injection)
            /\bATTACH\b/i,                // ATTACH database
            /\bDETACH\b/i,                // DETACH database
        ];
        
        for (const pattern of dangerousPatterns) {
            if (pattern.test(sql)) {
                console.warn(`[AIWikipediaSearch] Query rejected: contains dangerous pattern ${pattern}`);
                return false;
            }
        }
        
        // Must reference wikipedia_articles table
        if (!normalized.includes('WIKIPEDIA_ARTICLES')) {
            console.warn('[AIWikipediaSearch] Query rejected: does not reference wikipedia_articles table');
            return false;
        }
        
        return true;
    }

    /**
     * Search the local SQLite database
     * @param {string} query - Search query or SQL statement
     * @returns {Promise<Array>} Search results
     */
    async searchLocalDatabase(query) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        try {
            // Check if query is a SQL statement
            if (query.trim().toUpperCase().startsWith('SELECT')) {
                // Validate the SQL query for safety before execution
                if (!this.validateSqlQuery(query)) {
                    console.warn('[AIWikipediaSearch] Unsafe SQL query rejected, falling back to LIKE search');
                    const results = this.searchWithLike(query);
                    console.log(`[AIWikipediaSearch] Found ${results.length} results (fallback)`);
                    return results;
                }
                
                // Execute the validated SQL query
                console.log(`[AIWikipediaSearch] Executing validated SQL query: ${query}`);
                const stmt = this.db.prepare(query);
                const results = [];
                while (stmt.step()) {
                    results.push(stmt.getAsObject());
                }
                stmt.free();
                console.log(`[AIWikipediaSearch] Found ${results.length} results`);
                return results;
            } else {
                // Fallback to LIKE search
                const results = this.searchWithLike(query);
                console.log(`[AIWikipediaSearch] Found ${results.length} results`);
                return results;
            }
        } catch (error) {
            console.error('[AIWikipediaSearch] Database search error:', error);
            throw error;
        }
    }

    /**
     * Fallback search using LIKE
     * @param {string} query - Search query
     * @returns {Array} Search results
     */
    searchWithLike(query) {
        const terms = query.split(/\s+/).filter(t => t.length > 0);
        const conditions = terms.map(() => '(title LIKE ? OR content LIKE ? OR summary LIKE ?)').join(' OR ');
        const params = terms.flatMap(term => [`%${term}%`, `%${term}%`, `%${term}%`]);

        const sql = `
            SELECT id, title, summary, categories,
                   substr(content, 1, 200) as snippet
            FROM wikipedia_articles
            WHERE ${conditions}
            LIMIT 10
        `;

        const results = [];
        try {
            const stmt = this.db.prepare(sql);
            stmt.bind(params);
            
            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push({
                    id: row.id,
                    title: row.title,
                    summary: row.summary || row.snippet + '...',
                    categories: row.categories,
                    snippet: row.snippet
                });
            }
            stmt.free();
        } catch (error) {
            console.error('[AIWikipediaSearch] LIKE search error:', error);
        }

        return results;
    }

    /**
     * Display search results
     * @param {Array} results - Search results
     * @param {string} originalQuery - Original user query
     * @param {string} searchQuery - AI-generated search query
     */
    displayResults(results, originalQuery, searchQuery) {
        if (!results || results.length === 0) {
            this.showMessage(`No results found for "${originalQuery}". Try different keywords.`, 'info');
            return;
        }

        const html = `
            <div class="wiki-search-info">
                <p>Showing ${results.length} result${results.length !== 1 ? 's' : ''} for "<strong>${this.escapeHtml(originalQuery)}</strong>"</p>
                ${searchQuery !== originalQuery ? `<p class="wiki-search-terms">AI search terms: <em>${this.escapeHtml(searchQuery)}</em></p>` : ''}
            </div>
            <div class="wiki-results-list">
                ${results.map(result => `
                    <div class="wiki-result-item" data-id="${result.id}">
                        <h3 class="wiki-result-title">
                            <a href="#" class="wiki-article-link" data-id="${result.id}" data-title="${this.escapeHtml(result.title)}">
                                📄 ${this.escapeHtml(result.title)}
                            </a>
                        </h3>
                        <p class="wiki-result-description">${result.snippet || this.escapeHtml(result.summary || 'No description available')}</p>
                        ${result.categories ? `<p class="wiki-result-categories">Categories: ${this.escapeHtml(result.categories)}</p>` : ''}
                        <div class="wiki-result-actions">
                            <button class="wiki-action-btn view-local-article" data-id="${result.id}" data-title="${this.escapeHtml(result.title)}">
                                📖 View Article
                            </button>
                            <button class="wiki-action-btn use-in-chat" data-title="${this.escapeHtml(result.title)}" data-summary="${this.escapeHtml(result.summary || '')}">
                                💬 Use in Chat
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        this.resultsContainer.innerHTML = html;
        
        // Hide stop button
        const stopBtn = document.getElementById('wikiStopBtn');
        if (stopBtn) stopBtn.style.display = 'none';

        // Add event listeners for article links
        this.resultsContainer.querySelectorAll('.wiki-article-link, .view-local-article').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const id = e.target.getAttribute('data-id') || e.target.closest('[data-id]').getAttribute('data-id');
                const title = e.target.getAttribute('data-title') || e.target.closest('[data-title]').getAttribute('data-title');
                this.viewLocalArticle(parseInt(id), title);
            });
        });

        // Add event listeners for "Use in Chat" buttons
        this.resultsContainer.querySelectorAll('.use-in-chat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const title = e.target.getAttribute('data-title');
                const summary = e.target.getAttribute('data-summary');
                this.useInChat(title, summary);
            });
        });
    }

    /**
     * View a local Wikipedia article
     * @param {number} id - Article ID
     * @param {string} title - Article title
     */
    async viewLocalArticle(id, title) {
        if (!this.db) {
            this.showMessage('Database not available', 'error');
            return;
        }

        this.showLoading();

        try {
            const sql = 'SELECT * FROM wikipedia_articles WHERE id = ?';
            const stmt = this.db.prepare(sql);
            stmt.bind([id]);
            
            let article = null;
            if (stmt.step()) {
                article = stmt.getAsObject();
            }
            stmt.free();

            if (!article) {
                this.showMessage('Article not found', 'error');
                return;
            }

            this.displayArticle(article);
        } catch (error) {
            console.error('[AIWikipediaSearch] Failed to load article:', error);
            this.showMessage('Failed to load article', 'error');
        }
    }

    /**
     * Display a full Wikipedia article
     * @param {Object} article - Article data
     */
    displayArticle(article) {
        // Format the content with proper paragraphs
        const formattedContent = article.content
            .split('\n\n')
            .map(para => `<p>${this.escapeHtml(para)}</p>`)
            .join('');

        const html = `
            <div class="wiki-article">
                <div class="wiki-article-header">
                    <button class="wiki-back-btn" id="wikiBackBtn">← Back to Results</button>
                    <h2 class="wiki-article-title">📄 ${this.escapeHtml(article.title)}</h2>
                </div>
                ${article.summary ? `
                    <div class="wiki-article-summary">
                        <strong>Summary:</strong> ${this.escapeHtml(article.summary)}
                    </div>
                ` : ''}
                <div class="wiki-article-content">
                    ${formattedContent}
                </div>
                ${article.categories ? `
                    <div class="wiki-article-categories">
                        <strong>Categories:</strong> ${this.escapeHtml(article.categories)}
                    </div>
                ` : ''}
                <div class="wiki-article-actions">
                    <button class="wiki-action-btn use-in-chat" data-title="${this.escapeHtml(article.title)}" data-summary="${this.escapeHtml(article.summary || article.content.substring(0, 500))}">
                        💬 Use in Chat
                    </button>
                    ${article.url ? `
                        <a href="${this.escapeHtml(article.url)}" target="_blank" class="wiki-action-link">
                            🌐 View on Wikipedia ↗
                        </a>
                    ` : ''}
                </div>
            </div>
        `;

        this.resultsContainer.innerHTML = html;

        // Add back button listener
        const backBtn = document.getElementById('wikiBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.performSearch());
        }

        // Add "Use in Chat" listener
        const useChatBtn = this.resultsContainer.querySelector('.use-in-chat');
        if (useChatBtn) {
            useChatBtn.addEventListener('click', (e) => {
                const title = e.target.getAttribute('data-title');
                const summary = e.target.getAttribute('data-summary');
                this.useInChat(title, summary);
            });
        }
    }

    /**
     * Use Wikipedia content in the AI chat
     * @param {string} title - Article title
     * @param {string} summary - Article summary
     */
    useInChat(title, summary) {
        const chatInput = document.getElementById('chatInput');
        
        if (chatInput) {
            const contextText = `Based on the Wikipedia article "${title}": ${summary.substring(0, 300)}... \n\nMy question is: `;
            chatInput.value = contextText;
            chatInput.focus();
            
            // Show notification
            if (typeof showToast === 'function') {
                showToast('Wikipedia context added to chat!', 'success');
            }

            // Scroll to chat section
            const chatSection = document.getElementById('chatSection');
            if (chatSection) {
                chatSection.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
            console.error('[AIWikipediaSearch] Chat input not found');
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.resultsContainer.innerHTML = `
            <div class="wiki-loading">
                <div class="loading-spinner"></div>
                <p>Searching Wikipedia...</p>
            </div>
        `;
        
        // Show stop button
        const stopBtn = document.getElementById('wikiStopBtn');
        if (stopBtn) stopBtn.style.display = 'inline-block';
    }

    /**
     * Show a message
     * @param {string} message - Message text
     * @param {string} type - Message type (info, warning, error)
     */
    showMessage(message, type = 'info') {
        const iconMap = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅'
        };

        const icon = iconMap[type] || iconMap.info;

        this.resultsContainer.innerHTML = `
            <div class="wiki-message wiki-message-${type}">
                <span class="wiki-message-icon">${icon}</span>
                <p>${this.escapeHtml(message)}</p>
            </div>
        `;
        
        // Hide stop button
        const stopBtn = document.getElementById('wikiStopBtn');
        if (stopBtn) stopBtn.style.display = 'none';
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get database status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            dbReady: this.dbReady,
            aiReady: !!this.simpleQA,
            loading: this.loading
        };
    }

    /**
     * Get random articles using data provider
     * @param {number} count - Number of articles
     * @returns {Promise<Array>} Random articles
     */
    async getRandomArticles(count = 5) {
        if (!this.dataProvider) {
            throw new Error('Data provider not initialized');
        }
        return await this.dataProvider.getRandomArticles(count);
    }

    /**
     * Get database statistics using data provider
     * @returns {Promise<Object>} Statistics
     */
    async getStatistics() {
        if (!this.dataProvider) {
            throw new Error('Data provider not initialized');
        }
        return await this.dataProvider.getStatistics();
    }

    /**
     * Get all categories using data provider
     * @returns {Promise<Array>} Categories
     */
    async getCategories() {
        if (!this.dataProvider) {
            throw new Error('Data provider not initialized');
        }
        return await this.dataProvider.getCategories();
    }

    /**
     * Get articles by category using data provider
     * @param {string} category - Category name
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>} Articles
     */
    async getArticlesByCategory(category, limit = 20) {
        if (!this.dataProvider) {
            throw new Error('Data provider not initialized');
        }
        return await this.dataProvider.getArticlesByCategory(category, limit);
    }

    /**
     * Get article by ID or title using data provider
     * @param {string|number} idOrTitle - Article identifier
     * @returns {Promise<Object>} Article
     */
    async getArticle(idOrTitle) {
        if (!this.dataProvider) {
            throw new Error('Data provider not initialized');
        }
        return await this.dataProvider.getArticle(idOrTitle);
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.AIWikipediaSearch = AIWikipediaSearch;
}

// Export for Node.js (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIWikipediaSearch;
}
