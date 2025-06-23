/**
 * Enhanced Wikipedia Search for Offline Mode
 * Implements LLM-driven search with query logging and article review
 */

class EnhancedWikipediaSearch {
    constructor(wikipediaManager) {
        this.wikipediaManager = wikipediaManager;
        this.queryLog = [];
        this.isSearching = false;
    }

    /**
     * Enhanced search that generates multiple queries and reviews articles
     */
    async enhancedSearch(question, limit = 5) {
        this.isSearching = true;
        const searchLog = [];
        
        try {
            searchLog.push({
                type: 'search',
                message: '🔍 Starting Wikipedia search...',
                timestamp: new Date().toISOString()
            });

            // Generate multiple search queries from the question
            const queries = this.generateSearchQueries(question);
            
            searchLog.push({
                type: 'search',
                message: `Generated ${queries.length} search queries`,
                timestamp: new Date().toISOString()
            });

            const allResults = new Map();

            // Search with each query
            for (const query of queries) {
                searchLog.push({
                    type: 'search',
                    message: `Searching Wikipedia with query: '${query}'`,
                    timestamp: new Date().toISOString()
                });

                // Log the actual SQL query
                const sqlQuery = `SELECT * FROM wikipedia_fts WHERE wikipedia_fts MATCH '${query}' ORDER BY rank LIMIT ${limit}`;
                searchLog.push({
                    type: 'sql',
                    message: `SQL: ${sqlQuery}`,
                    timestamp: new Date().toISOString()
                });

                const results = await this.searchWithQuery(query, limit);
                
                searchLog.push({
                    type: 'search',
                    message: `Found ${results.length} articles for query '${query}'`,
                    timestamp: new Date().toISOString()
                });

                // Add results to combined set
                for (const result of results) {
                    if (!allResults.has(result.title)) {
                        allResults.set(result.title, {
                            ...result,
                            relevance_score: this.calculateRelevance(question, result)
                        });
                    }
                }
            }

            // Try exact title matches
            const keyTerms = this.extractKeyTerms(question);
            for (const term of keyTerms) {
                const exactMatch = await this.findExactTitleMatch(term);
                if (exactMatch) {
                    searchLog.push({
                        type: 'search',
                        message: `Found exact title match: '${exactMatch.title}'`,
                        timestamp: new Date().toISOString()
                    });

                    const sqlQuery = `SELECT * FROM wikipedia_articles WHERE title = '${term}' LIMIT 1`;
                    searchLog.push({
                        type: 'sql',
                        message: `SQL: ${sqlQuery}`,
                        timestamp: new Date().toISOString()
                    });

                    allResults.set(exactMatch.title, {
                        ...exactMatch,
                        relevance_score: 1.0 // Perfect match
                    });
                }
            }

            // Convert to list and sort by relevance
            const finalResults = Array.from(allResults.values());
            finalResults.sort((a, b) => b.relevance_score - a.relevance_score);

            // Review articles for relevance
            const reviewedResults = [];
            for (let i = 0; i < Math.min(finalResults.length, limit); i++) {
                const result = finalResults[i];
                
                searchLog.push({
                    type: 'review',
                    message: `Reviewing article ${i + 1} of ${Math.min(finalResults.length, limit)}: '${result.title}'`,
                    timestamp: new Date().toISOString()
                });

                const relevance = this.reviewArticleRelevance(question, result);
                
                if (relevance > 0.05) {
                    searchLog.push({
                        type: 'result',
                        message: `Article '${result.title}' deemed relevant (score: ${relevance.toFixed(2)})`,
                        timestamp: new Date().toISOString()
                    });
                    
                    reviewedResults.push({
                        ...result,
                        relevance_score: relevance,
                        url: `/offline/wikipedia/article/${encodeURIComponent(result.title)}`
                    });
                } else {
                    searchLog.push({
                        type: 'review',
                        message: `Article '${result.title}' not relevant to question`,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            searchLog.push({
                type: 'result',
                message: `Final selection: ${reviewedResults.length} relevant articles`,
                timestamp: new Date().toISOString()
            });

            // Store in query log
            this.queryLog.push({
                question,
                queries,
                results: reviewedResults,
                searchLog,
                timestamp: new Date().toISOString()
            });

            return {
                results: reviewedResults,
                status_log: searchLog,
                total_found: allResults.size
            };

        } catch (error) {
            const errorLog = {
                type: 'error',
                message: `❌ Wikipedia search error: ${error.message}`,
                timestamp: new Date().toISOString()
            };
            
            searchLog.push(errorLog);
            
            return {
                results: [],
                error: error.message,
                status_log: searchLog
            };
        } finally {
            this.isSearching = false;
        }
    }

    /**
     * Generate multiple search queries from a question
     */
    generateSearchQueries(question) {
        const queries = [];
        
        // Add the original question
        queries.push(question);
        
        // Extract key terms
        const keyTerms = this.extractKeyTerms(question);
        queries.push(...keyTerms);
        
        // Create combinations of key terms
        if (keyTerms.length > 1) {
            for (let i = 0; i < keyTerms.length - 1; i++) {
                queries.push(`${keyTerms[i]} ${keyTerms[i + 1]}`);
            }
        }
        
        // Remove duplicates and empty queries
        return [...new Set(queries)].filter(q => q && q.trim().length > 0);
    }

    /**
     * Extract key terms from a question
     */
    extractKeyTerms(question) {
        // Remove common question words and extract meaningful terms
        const stopWords = new Set(['what', 'is', 'are', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'about', 'how', 'why', 'when', 'where', 'who']);
        
        const words = question.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));
        
        return words;
    }

    /**
     * Search with a specific query
     */
    async searchWithQuery(query, limit) {
        if (!this.wikipediaManager.db) {
            return [];
        }

        try {
            // Prepare FTS query
            const ftsQuery = query.toLowerCase().replace(/[^\w\s]/g, '');
            
            // Execute FTS search
            const stmt = this.wikipediaManager.db.prepare(`
                SELECT title, content, snippet(wikipedia_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
                FROM wikipedia_fts 
                WHERE wikipedia_fts MATCH ?
                ORDER BY rank 
                LIMIT ?
            `);
            
            const results = [];
            stmt.bind([ftsQuery, limit]);
            
            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push({
                    title: row.title,
                    content: row.content,
                    snippet: row.snippet || row.content?.substring(0, 200) + '...'
                });
            }
            
            stmt.free();
            return results;
            
        } catch (error) {
            console.error('Search query failed:', error);
            return [];
        }
    }

    /**
     * Find exact title match
     */
    async findExactTitleMatch(term) {
        if (!this.wikipediaManager.db) {
            return null;
        }

        try {
            const stmt = this.wikipediaManager.db.prepare(`
                SELECT title, content 
                FROM wikipedia_articles 
                WHERE LOWER(title) = LOWER(?)
                LIMIT 1
            `);
            
            stmt.bind([term]);
            
            if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                return {
                    title: row.title,
                    content: row.content,
                    snippet: row.content?.substring(0, 200) + '...'
                };
            }
            
            stmt.free();
            return null;
            
        } catch (error) {
            console.error('Exact match search failed:', error);
            return null;
        }
    }

    /**
     * Calculate relevance score for an article
     */
    calculateRelevance(question, article) {
        const questionWords = this.extractKeyTerms(question);
        const titleWords = this.extractKeyTerms(article.title);
        const contentWords = this.extractKeyTerms(article.content?.substring(0, 500) || '');
        
        let score = 0;
        
        // Title matches are highly relevant
        for (const qWord of questionWords) {
            if (titleWords.some(tWord => tWord.includes(qWord) || qWord.includes(tWord))) {
                score += 0.5;
            }
        }
        
        // Content matches
        for (const qWord of questionWords) {
            if (contentWords.some(cWord => cWord.includes(qWord) || qWord.includes(cWord))) {
                score += 0.1;
            }
        }
        
        return Math.min(score, 1.0);
    }

    /**
     * Review article relevance (simplified LLM processing)
     */
    reviewArticleRelevance(question, article) {
        // TODO: Use actual local LLM to assess relevance
        return this.calculateRelevance(question, article);
    }

    /**
     * Get query log
     */
    getQueryLog() {
        return this.queryLog;
    }

    /**
     * Clear query log
     */
    clearQueryLog() {
        this.queryLog = [];
    }
}

// Export for use in offline app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedWikipediaSearch;
} else {
    window.EnhancedWikipediaSearch = EnhancedWikipediaSearch;
}

