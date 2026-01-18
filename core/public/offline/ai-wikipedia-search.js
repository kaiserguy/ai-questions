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
     * Search and batch-score articles, then deep-read top candidates
     * @param {string} userQuery - User's search query
     * @returns {Promise<Array>} Articles collected for context
     */
    async doPreliminarySearch(userQuery) {
        if (!this.db || !this.aiModel || !this.aiModel.isReady()) {
            return [];
        }

        // Get context budget from AI model configuration
        const budget = this.aiModel.getContextBudget ? this.aiModel.getContextBudget() : {
            maxIterations: 8,
            maxHistory: 5,
            maxResults: 10,
            batchSize: 10
        };
        
        console.log(`[AIWikipediaSearch] Using context budget: batch size ${budget.batchSize}, ${budget.maxResults} max results`);

        const MAX_INITIAL_RESULTS = 100;
        const MAX_REFINEMENT_ATTEMPTS = 30;
        let refinementAttempt = 0;
        let allArticles = [];
        let failedPatterns = [];

        try {
            // STEP 1: Generate targeted search query (loop until we get ≤100 results)
            while (refinementAttempt < MAX_REFINEMENT_ATTEMPTS && !this.searchCancelled) {
                refinementAttempt++;
                console.log(`[AIWikipediaSearch] Search attempt ${refinementAttempt}: Generating query...`);
                
                let feedbackContext = '';
                if (failedPatterns.length > 0) {
                    const lastFailure = failedPatterns[failedPatterns.length - 1];
                    if (lastFailure.type === 'error') {
                        feedbackContext = `Last query had SQL error. Don't use ORDER BY with COUNT(*) or other aggregates.`;
                    } else if (lastFailure.type === 'too_many') {
                        feedbackContext = `Last query returned ${lastFailure.count} results. Too many. Be MORE SPECIFIC.`;
                    } else if (lastFailure.type === 'too_few') {
                        feedbackContext = `Last query returned 0 results. Too narrow. Use broader patterns.`;
                    }
                    
                    if (failedPatterns.length > 1) {
                        feedbackContext += ` Don't repeat failed patterns.`;
                    }
                }
                
                const searchPrompt = `Query: "${userQuery}"
${feedbackContext ? feedbackContext + '\n' : ''}
Strategy: Try the simplest query first. If searching for "France", start with WHERE title = 'France'. Only use LIKE patterns if exact match fails.

Examples:
- SELECT * FROM wikipedia_articles WHERE title = 'France'
- SELECT * FROM wikipedia_articles WHERE title LIKE '%World War%'
- SELECT * FROM wikipedia_articles WHERE categories LIKE '%History%'

Write ONE SQLite SELECT query. Return ONLY the SQL.`;

                const decision = await this.aiModel.generateResponse(searchPrompt);
                
                console.log(`[AIWikipediaSearch] Raw AI response: "${decision}"`);
                
                // Extract SQL using regex - grab everything from SELECT up to (but not including) LIMIT/markdown/semicolon
                const sqlMatch = decision.match(/SELECT\s+[\s\S]*?FROM\s+[\s\S]+?(?:WHERE\s+[\s\S]+?)?(?:ORDER BY\s+[\s\S]+?)?(?=\s*(?:LIMIT|\n\n|```|$|;))/i);
                
                if (!sqlMatch) {
                    console.error(`[AIWikipediaSearch] No valid SQL found in response: "${decision}"`);
                    continue;
                }
                
                let sql = sqlMatch[0].trim().replace(/;+$/, ''); // Remove trailing semicolons
                console.log(`[AIWikipediaSearch] Extracted SQL: "${sql}"`);
                
                console.log(`[AIWikipediaSearch] Checking result count for: ${sql.substring(0, 100)}...`);
                this.showMessage(`Searching Wikipedia (attempt ${refinementAttempt})...`, 'info', true);
                
                // First, count how many results this query would return
                let resultCount = 0;
                try {
                    const countSql = sql.replace(/SELECT\s+[\s\S]+?\s+FROM/i, 'SELECT COUNT(*) as count FROM');
                    const countStmt = this.db.prepare(countSql);
                    
                    if (countStmt.step()) {
                        resultCount = countStmt.get()[0];
                    }
                    countStmt.free();
                    
                    console.log(`[AIWikipediaSearch] Query would return ${resultCount} articles`);
                } catch (error) {
                    console.error(`[AIWikipediaSearch] Query error:`, error);
                    this.showMessage('Invalid query, retrying...', 'info', true);
                    failedPatterns.push({ type: 'error', sql: sql.substring(0, 60) });
                    continue;
                }
                
                // Check if result set is reasonable
                if (resultCount === 0) {
                    console.log(`[AIWikipediaSearch] No results - query too specific`);
                    this.showMessage('Query too specific, trying broader search...', 'info', true);
                    failedPatterns.push({ type: 'too_few', sql: sql.substring(0, 60) });
                    continue;
                } else if (resultCount > MAX_INITIAL_RESULTS) {
                    console.log(`[AIWikipediaSearch] ${resultCount} results - too many, refining...`);
                    this.showMessage(`Found ${resultCount} articles - too many. Refining search...`, 'info', true);
                    failedPatterns.push({ type: 'too_many', count: resultCount, sql: sql.substring(0, 60) });
                    continue;
                }
                
                // Good count - execute the query
                console.log(`[AIWikipediaSearch] Good result count: ${resultCount} articles - fetching data...`);
                
                try {
                    const stmt = this.db.prepare(sql);
                    allArticles = [];
                    while (stmt.step()) {
                        allArticles.push(stmt.getAsObject());
                    }
                    stmt.free();
                    
                    console.log(`[AIWikipediaSearch] Fetched ${allArticles.length} articles`);
                    break;
                } catch (execError) {
                    console.error(`[AIWikipediaSearch] Query execution failed:`, execError);
                    this.showMessage('Query failed, retrying...', 'info', true);
                    failedPatterns.push({ type: 'error', sql: sql.substring(0, 60) });
                    continue;
                }
            }
            
            // Check if we got usable results
            if (allArticles.length === 0) {
                console.log(`[AIWikipediaSearch] No articles found after ${refinementAttempt} attempts`);
                return [];
            }
            
            // STEP 2: Batch score all articles (title + summary only)
            console.log(`[AIWikipediaSearch] Step 2: Batch scoring ${allArticles.length} articles...`);
            this.showMessage(`Scoring ${allArticles.length} articles in batches...`, 'info', true);
            
            let scoredArticles = [];
            const batches = [];
            const totalBatches = Math.ceil(allArticles.length / budget.batchSize);
            
            for (let i = 0; i < allArticles.length && !this.searchCancelled; i += budget.batchSize) {
                batches.push({
                    batch: allArticles.slice(i, i + budget.batchSize),
                    batchNum: Math.floor(i / budget.batchSize) + 1,
                    totalBatches
                });
            }
            
            try {
                const batchResults = await Promise.all(batches.map(async ({ batch, batchNum, totalBatches: total }) => {
                    if (this.searchCancelled) return null;
                    
                    console.log(`[AIWikipediaSearch] Scoring batch ${batchNum}/${total} (${batch.length} articles)...`);
                    
                    // Build batch scoring prompt
                    const batchPrompt = `Question: "${userQuery}"

Score each article's relevance (0-100). Return ONLY an array of numbers in the same order.

Articles:
${batch.map((a, idx) => `${idx + 1}. "${a.title}"\n   Summary: ${(a.summary || '').substring(0, 200)}...`).join('\n\n')}

Examples:
Q: "Is France in Europe?" + ["France", "China", "Europe"] → [100, 21, 95]
Q: "Is bread made of wheat?" + ["Farming", "Spain", "Cooking"] → [82, 24, 71]

Return array [score1, score2, ...]:`;

                    const scoreResponse = await this.aiModel.generateResponse(batchPrompt);
                    
                    // Extract array of numbers
                    const arrayMatch = scoreResponse.match(/\[([0-9,\s]+)\]/);
                    if (arrayMatch) {
                        const scores = arrayMatch[1].split(',').map(s => Math.min(parseInt(s.trim()), 100));
                        
                        // Assign scores to articles
                        batch.forEach((article, idx) => {
                            article.relevancy = scores[idx] !== undefined ? scores[idx] : 0;
                        });
                        
                        console.log(`[AIWikipediaSearch] Batch ${batchNum} scored: ${scores.join(', ')}`);
                    } else {
                        throw new Error('No valid score array found');
                    }

                    return batch;
                }));

                // Aggregate results and report progress sequentially to avoid race conditions
                scoredArticles = batchResults.filter(Boolean).flat();
                this.showMessage(`Scored ${scoredArticles.length}/${allArticles.length} articles...`, 'info', true);
            } catch (error) {
                console.error('[AIWikipediaSearch] Batch scoring error:', error);
                // Fail search entirely if scoring fails
                this.showMessage('Error scoring articles, aborting search.', 'error');
                return [];
            }
            
            // STEP 4: Sort by relevancy and take top candidates
            console.log(`[AIWikipediaSearch] Step 3: Sorting and selecting top ${budget.maxResults} articles...`);
            scoredArticles.sort((a, b) => (b.relevancy || 0) - (a.relevancy || 0));
            const topArticles = scoredArticles.slice(0, budget.maxResults);
            
            console.log(`[AIWikipediaSearch] Top ${topArticles.length} articles: ${topArticles.map(a => `"${a.title}" (${a.relevancy}/100)`).join(', ')}`);
            
            // STEP 5: Read full content for top articles and get detailed scores
            console.log(`[AIWikipediaSearch] Step 4: Reading full content for top ${topArticles.length} articles...`);
            this.showMessage(`Reading full content for top ${topArticles.length} articles...`, 'info', true);
            
            const finalArticles = [];
            
            const readResults = await Promise.all(topArticles.map(async (article, index) => {
                if (this.searchCancelled) return null;
                
                // Fetch full article content
                const contentStmt = this.db.prepare(`SELECT * FROM wikipedia_articles WHERE title = ?`);
                contentStmt.bind([article.title]);
                
                let fullArticle = null;
                
                if (contentStmt.step()) {
                    fullArticle = contentStmt.getAsObject();
                    
                    // Get detailed score with full content
                    try {
                        const detailedPrompt = `Question: "${userQuery}"
Article: "${fullArticle.title}"
Content preview: ${(fullArticle.content || '').substring(0, 500)}...

After reading the article content, how relevant is this to the question?

Score 0-100 (0=not relevant, 100=perfect answer):`;
                        
                        const detailedResponse = await this.aiModel.generateResponse(detailedPrompt);
                        const scoreMatch = detailedResponse.match(/\b([0-9]{1,3})\b/);
                        
                        if (scoreMatch) {
                            fullArticle.relevancy = Math.min(parseInt(scoreMatch[0]), 100);
                        } else {
                            fullArticle.relevancy = article.relevancy; // Keep preliminary score
                        }
                    } catch (error) {
                        fullArticle.relevancy = article.relevancy;
                    }
                    
                    console.log(`[AIWikipediaSearch] Read article ${index + 1}/${topArticles.length}: "${fullArticle.title}" (final score: ${fullArticle.relevancy}/100)`);
                }
                
                contentStmt.free();
                
                return fullArticle;
            }));
            
            // Aggregate results and report progress sequentially to avoid race conditions
            readResults.forEach(article => {
                if (article) {
                    finalArticles.push(article);
                }
            });
            
            this.showMessage(`Read ${finalArticles.length}/${topArticles.length} articles...`, 'info', true);
            
            // STEP 6: Sort final results by detailed scores
            finalArticles.sort((a, b) => (b.relevancy || 0) - (a.relevancy || 0));
            
            console.log(`[AIWikipediaSearch] Batch search complete: ${finalArticles.length} articles`);
            if (finalArticles.length > 0) {
                const bestScore = Math.max(...finalArticles.map(a => a.relevancy || 0));
                console.log(`[AIWikipediaSearch] Best article: "${finalArticles[0].title}" (${bestScore}/100)`);
            }
            
            if (this.searchCancelled) {
                console.log(`[AIWikipediaSearch] Search cancelled by user`);
            }
            
            return finalArticles;
        } catch (error) {
            console.error('[AIWikipediaSearch] Preliminary search failed:', error);
            return [];
        }
    }

    /**
     * Use AI to gather and score relevant articles
     * @param {string} userQuery - User's natural language query
     * @returns {Promise<Array|null>} Sorted articles or null if cancelled
     */
    async generateSearchQuery(userQuery) {
        // Do preliminary search to gather and score articles
        const contextArticles = await this.doPreliminarySearch(userQuery);
        
        // If search was cancelled, display the articles we read instead
        if (this.searchCancelled && contextArticles.length > 0) {
            console.log(`[AIWikipediaSearch] Displaying ${contextArticles.length} articles from cancelled search`);
            this.displayArticleList(contextArticles, userQuery);
            return null; // Signal to skip final search
        }
        
        // Sort articles by relevancy and return them
        if (contextArticles.length > 0) {
            const sortedArticles = contextArticles.sort((a, b) => (b.relevancy || 0) - (a.relevancy || 0));
            console.log(`[AIWikipediaSearch] Returning ${sortedArticles.length} articles sorted by relevancy (best: ${sortedArticles[0].relevancy}/100)`);
            return sortedArticles; // Return articles instead of SQL query
        }
        
        // No articles found
        console.log(`[AIWikipediaSearch] No articles found during preliminary search`);
        return [];
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
                            <div style="background: ${article.relevancy >= 70 ? '#10b981' : article.relevancy >= 50 ? '#f59e0b' : '#ef4444'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: bold;">
                                ${article.relevancy || '?'}/100
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
            // Get AI-scored articles (returns array of articles, not SQL query)
            const results = await this.generateSearchQuery(userQuery);
            
            // If search was cancelled and articles were displayed, we're done
            if (results === null) {
                this.loading = false;
                return;
            }
            
            // Display the sorted articles
            if (results && results.length > 0) {
                console.log(`[AIWikipediaSearch] Displaying ${results.length} AI-scored articles`);
                this.displayArticleList(results, userQuery);
            } else {
                this.showMessage('No relevant articles found. Try rephrasing your question.', 'warning');
            }
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
                // Auto-correct common SQL errors
                let correctedQuery = query;
                
                // Fix: category -> categories (plural)
                correctedQuery = correctedQuery.replace(/\bcategory\b/gi, 'categories');
                
                // Fix: MySQL LIMIT syntax to SQLite (LIMIT offset, count -> LIMIT count OFFSET offset)
                correctedQuery = correctedQuery.replace(/LIMIT\s+(\d+)\s*,\s*(\d+)/gi, (match, offset, count) => {
                    return `LIMIT ${count} OFFSET ${offset}`;
                });
                
                if (correctedQuery !== query) {
                    console.log(`[AIWikipediaSearch] Auto-corrected SQL: ${correctedQuery}`);
                }
                
                // Validate the SQL query for safety before execution
                if (!this.validateSqlQuery(correctedQuery)) {
                    console.warn('[AIWikipediaSearch] Unsafe SQL query rejected, falling back to LIKE search');
                    return [];
                }
                
                // Execute the validated SQL query
                console.log(`[AIWikipediaSearch] Executing validated SQL query: ${correctedQuery}`);
                const stmt = this.db.prepare(correctedQuery);
                const results = [];
                while (stmt.step()) {
                    results.push(stmt.getAsObject());
                }
                stmt.free();
                console.log(`[AIWikipediaSearch] Found ${results.length} results`);
                return results;
            } else {
                console.log(`[AIWikipediaSearch] Failed to recognize query as SQL, failing`);
                return [];
            }
        } catch (error) {
            console.error('[AIWikipediaSearch] Database search error:', error);
            console.error('[AIWikipediaSearch] Failed query:', query);
            return []; // Return empty results rather than throwing
        }
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
     * @param {boolean} keepStopButton - Keep stop button visible (for progress updates during search)
     */
    showMessage(message, type = 'info', keepStopButton = false) {
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
        
        // Hide stop button unless we're showing progress during search
        const stopBtn = document.getElementById('wikiStopBtn');
        if (stopBtn) {
            stopBtn.style.display = keepStopButton ? 'inline-block' : 'none';
        }
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
