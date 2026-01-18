/**
 * NEW BATCH-SCORING SEARCH ALGORITHM
 * 
 * Architecture:
 * 1. AI generates ONE broad SQL query (no LIMIT)
 * 2. Execute query, get ALL matching articles (title + summary only)
 * 3. Batch-score all articles (AI scores titles in batches based on context budget)
 * 4. Sort by score, take top N candidates
 * 5. Read full content for top candidates and get detailed scores
 * 6. Return final sorted results
 * 
 * This replaces the iterative approach with efficient batch processing.
 */

async function doPreliminarySearchBatchMode(userQuery) {
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
    
    console.log(`[AIWikipediaSearch] Using batch mode: ${budget.batchSize} titles/batch, ${budget.maxResults} max results`);

    try {
        // STEP 1: Generate broad search query
        console.log(`[AIWikipediaSearch] Step 1: Generating broad search query...`);
        
        const searchPrompt = `You are a Wikipedia database search agent. Generate a SQLite query to find ALL relevant articles.

Database schema: wikipedia_articles (id, article_id, title, content, summary, categories, word_count)

User's question: "${userQuery}"

Your task: Write a SELECT query to find ALL potentially relevant articles.

IMPORTANT:
- Select title and summary columns only (not full content yet)
- Use LIKE operator for text searches: WHERE title LIKE '%keyword%' OR content LIKE '%keyword%'
- Use broad keywords to catch all related articles
- NO LIMIT - return all matches
- Use ORDER BY RANDOM() for variety

Examples:
- Question: "capital of France?" → Query: SELECT title, summary FROM wikipedia_articles WHERE title LIKE '%France%' OR title LIKE '%capital%' OR title LIKE '%Paris%' ORDER BY RANDOM()
- Question: "who invented telephone?" → Query: SELECT title, summary FROM wikipedia_articles WHERE content LIKE '%invent%' OR content LIKE '%telephone%' OR content LIKE '%communication%' ORDER BY RANDOM()
- Question: "is bread made from wheat?" → Query: SELECT title, summary FROM wikipedia_articles WHERE content LIKE '%bread%' OR content LIKE '%wheat%' OR content LIKE '%grain%' OR content LIKE '%food%' ORDER BY RANDOM()

Return SQL query:`;

        const decision = await this.aiModel.generateResponse(searchPrompt);
        let cleanDecision = decision.trim();
        cleanDecision = cleanDecision.replace(/```sql?/gi, '').replace(/```/g, '').trim();
        cleanDecision = cleanDecision.replace(/;+$/g, '').trim();
        
        // Extract SELECT statement
        const sqlMatch = cleanDecision.match(/SELECT[\s\S]+?$/i);
        const sql = sqlMatch ? sqlMatch[0].trim() : cleanDecision.trim();
        
        // Validate it's a SELECT query
        if (!sql || !sql.toUpperCase().startsWith('SELECT')) {
            console.error(`[AIWikipediaSearch] Invalid SQL response: ${sql}`);
            return [];
        }
        
        console.log(`[AIWikipediaSearch] Executing: ${sql.substring(0, 100)}...`);
        this.showMessage('Searching Wikipedia database...', 'info');
        
        // STEP 2: Execute query to get ALL matching articles
        const stmt = this.db.prepare(sql);
        const allArticles = [];
        while (stmt.step()) {
            allArticles.push(stmt.getAsObject());
        }
        stmt.free();
        
        console.log(`[AIWikipediaSearch] Found ${allArticles.length} matching articles`);
        
        if (allArticles.length === 0) {
            console.log(`[AIWikipediaSearch] No articles found`);
            return [];
        }
        
        // STEP 3: Batch score all articles (title + summary only)
        console.log(`[AIWikipediaSearch] Step 2: Batch scoring ${allArticles.length} articles...`);
        this.showMessage(`Scoring ${allArticles.length} articles in batches...`, 'info');
        
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

            try {
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
                    // Fallback: keyword matching
                    console.log(`[AIWikipediaSearch] Batch ${batchNum} scoring failed, using keyword fallback`);
                    batch.forEach(article => {
                        const queryLower = userQuery.toLowerCase();
                        const titleLower = article.title.toLowerCase();
                        const summaryLower = (article.summary || '').toLowerCase();
                        
                        const keywords = queryLower.split(/\s+/).filter(w => w.length > 3);
                        const matches = keywords.filter(kw => 
                            titleLower.includes(kw) || summaryLower.includes(kw)
                        );
                        
                        article.relevancy = Math.min(matches.length * 30, 80);
                    });
                }
            } catch (error) {
                console.error(`[AIWikipediaSearch] Batch ${batchNum} error:`, error);
                // Fallback scoring
                batch.forEach(article => {
                    article.relevancy = 50;
                });
            }

            return batch;
        }));

        // Aggregate results and report progress sequentially to avoid race conditions
        scoredArticles = batchResults.filter(Boolean).flat();
        this.showMessage(`Scored ${scoredArticles.length}/${allArticles.length} articles...`, 'info');
        
        // STEP 4: Sort by relevancy and take top candidates
        console.log(`[AIWikipediaSearch] Step 3: Sorting and selecting top ${budget.maxResults} articles...`);
        scoredArticles.sort((a, b) => (b.relevancy || 0) - (a.relevancy || 0));
        const topArticles = scoredArticles.slice(0, budget.maxResults);
        
        console.log(`[AIWikipediaSearch] Top ${topArticles.length} articles: ${topArticles.map(a => `"${a.title}" (${a.relevancy}/100)`).join(', ')}`);
        
        // STEP 5: Read full content for top articles and get detailed scores
        console.log(`[AIWikipediaSearch] Step 4: Reading full content for top ${topArticles.length} articles...`);
        this.showMessage(`Reading full content for top ${topArticles.length} articles...`, 'info');
        
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
                this.showMessage(`Reading article ${index + 1}/${topArticles.length}: "${fullArticle.title}"...`, 'info');
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
        
        this.showMessage(`Completed reading ${finalArticles.length}/${topArticles.length} articles`, 'info');
        
        // STEP 6: Sort final results by detailed scores
        finalArticles.sort((a, b) => (b.relevancy || 0) - (a.relevancy || 0));
        
        console.log(`[AIWikipediaSearch] Batch search complete: ${finalArticles.length} articles`);
        if (finalArticles.length > 0) {
            const bestScore = Math.max(...finalArticles.map(a => a.relevancy || 0));
            console.log(`[AIWikipediaSearch] Best article: "${finalArticles[0].title}" (${bestScore}/100)`);
        }
        
        return finalArticles;
        
    } catch (error) {
        console.error(`[AIWikipediaSearch] Batch search error:`, error);
        this.showMessage('Search error - see console', 'error');
        return [];
    }
}

// Export for integration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { doPreliminarySearchBatchMode };
}
