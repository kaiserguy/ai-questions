/**
 * WikipediaPublicSearch - Handles Wikipedia search using the public API
 * This is for the /offline page to search Wikipedia via the REST API
 */

class WikipediaPublicSearch {
    constructor() {
        this.searchInput = null;
        this.searchButton = null;
        this.resultsContainer = null;
        this.loading = false;
    }

    /**
     * Initialize the Wikipedia search UI
     */
    initialize() {
        this.searchInput = document.getElementById('wikiSearchInput');
        this.searchButton = document.getElementById('wikiSearchBtn');
        this.resultsContainer = document.getElementById('wikiResults');

        if (!this.searchInput || !this.searchButton || !this.resultsContainer) {
            console.error('[WikipediaPublicSearch] Required elements not found');
            return false;
        }

        // Add event listeners
        this.searchButton.addEventListener('click', () => this.performSearch());
        
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        console.log('[WikipediaPublicSearch] Initialized successfully');
        return true;
    }

    /**
     * Perform a Wikipedia search
     */
    async performSearch() {
        const query = this.searchInput.value.trim();
        
        if (!query) {
            this.showMessage('Please enter a search term', 'warning');
            return;
        }

        if (this.loading) {
            console.log('[WikipediaPublicSearch] Search already in progress');
            return;
        }

        this.loading = true;
        this.showLoading();

        try {
            const response = await fetch(`/api/wikipedia/public/search?query=${encodeURIComponent(query)}&limit=10`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.displayResults(data.results || []);
        } catch (error) {
            console.error('[WikipediaPublicSearch] Search failed:', error);
            this.showMessage('Failed to search Wikipedia. Please try again.', 'error');
        } finally {
            this.loading = false;
        }
    }

    /**
     * Display search results
     * @param {Array} results - Array of search results
     */
    displayResults(results) {
        if (!results || results.length === 0) {
            this.showMessage('No results found. Try a different search term.', 'info');
            return;
        }

        const html = `
            <div class="wiki-results-list">
                ${results.map(result => `
                    <div class="wiki-result-item" data-title="${this.escapeHtml(result.title)}">
                        <h3 class="wiki-result-title">${this.escapeHtml(result.title)}</h3>
                        <p class="wiki-result-description">${this.escapeHtml(result.description || 'No description available')}</p>
                        <div class="wiki-result-actions">
                            <button class="wiki-action-btn view-summary" data-title="${this.escapeHtml(result.title)}">
                                View Summary
                            </button>
                            <button class="wiki-action-btn view-article" data-title="${this.escapeHtml(result.title)}">
                                View Article
                            </button>
                            <a href="${this.escapeHtml(result.url)}" target="_blank" class="wiki-action-link">
                                Open in Wikipedia ↗
                            </a>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        this.resultsContainer.innerHTML = html;

        // Add event listeners to result actions
        this.resultsContainer.querySelectorAll('.view-summary').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const title = e.target.getAttribute('data-title');
                this.viewSummary(title);
            });
        });

        this.resultsContainer.querySelectorAll('.view-article').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const title = e.target.getAttribute('data-title');
                this.viewArticle(title);
            });
        });
    }

    /**
     * View article summary
     * @param {string} title - Article title
     */
    async viewSummary(title) {
        if (this.loading) return;

        this.loading = true;
        this.showLoading();

        try {
            const response = await fetch(`/api/wikipedia/public/summary?title=${encodeURIComponent(title)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.displaySummary(data);
        } catch (error) {
            console.error('[WikipediaPublicSearch] Failed to get summary:', error);
            this.showMessage('Failed to load article summary. Please try again.', 'error');
        } finally {
            this.loading = false;
        }
    }

    /**
     * Display article summary
     * @param {Object} summary - Article summary data
     */
    displaySummary(summary) {
        const html = `
            <div class="wiki-summary">
                <div class="wiki-summary-header">
                    <button class="wiki-back-btn" id="wikiBackBtn">← Back to Results</button>
                    <h2 class="wiki-summary-title">${this.escapeHtml(summary.title)}</h2>
                </div>
                ${summary.thumbnail ? `
                    <img src="${this.escapeHtml(summary.thumbnail.source)}" 
                         alt="${this.escapeHtml(summary.title)}" 
                         class="wiki-summary-image">
                ` : ''}
                ${summary.description ? `
                    <p class="wiki-summary-description"><strong>${this.escapeHtml(summary.description)}</strong></p>
                ` : ''}
                <div class="wiki-summary-extract">
                    ${this.escapeHtml(summary.extract)}
                </div>
                <div class="wiki-summary-actions">
                    <button class="wiki-action-btn view-full-article" data-title="${this.escapeHtml(summary.title)}">
                        View Full Article
                    </button>
                    <a href="${this.escapeHtml(summary.url)}" target="_blank" class="wiki-action-link">
                        Open in Wikipedia ↗
                    </a>
                    <button class="wiki-action-btn use-in-chat" data-text="${this.escapeHtml(summary.extract)}" data-title="${this.escapeHtml(summary.title)}">
                        Use in Chat
                    </button>
                </div>
            </div>
        `;

        this.resultsContainer.innerHTML = html;

        // Add event listeners
        const backBtn = document.getElementById('wikiBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.performSearch());
        }

        const viewFullBtn = this.resultsContainer.querySelector('.view-full-article');
        if (viewFullBtn) {
            viewFullBtn.addEventListener('click', (e) => {
                const title = e.target.getAttribute('data-title');
                this.viewArticle(title);
            });
        }

        const useChatBtn = this.resultsContainer.querySelector('.use-in-chat');
        if (useChatBtn) {
            useChatBtn.addEventListener('click', (e) => {
                const text = e.target.getAttribute('data-text');
                const title = e.target.getAttribute('data-title');
                this.useInChat(text, title);
            });
        }
    }

    /**
     * View full article
     * @param {string} title - Article title
     */
    async viewArticle(title) {
        if (this.loading) return;

        this.loading = true;
        this.showLoading();

        try {
            const response = await fetch(`/api/wikipedia/public/article?title=${encodeURIComponent(title)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.displayArticle(data);
        } catch (error) {
            console.error('[WikipediaPublicSearch] Failed to get article:', error);
            this.showMessage('Failed to load article. Please try again.', 'error');
        } finally {
            this.loading = false;
        }
    }

    /**
     * Display full article
     * @param {Object} article - Article data
     */
    displayArticle(article) {
        const html = `
            <div class="wiki-article">
                <div class="wiki-article-header">
                    <button class="wiki-back-btn" id="wikiBackBtn">← Back to Results</button>
                    <h2 class="wiki-article-title">${this.escapeHtml(article.title)}</h2>
                </div>
                <div class="wiki-article-content">
                    ${article.content}
                </div>
                <div class="wiki-article-actions">
                    <a href="${this.escapeHtml(article.url)}" target="_blank" class="wiki-action-link">
                        Open in Wikipedia ↗
                    </a>
                </div>
            </div>
        `;

        this.resultsContainer.innerHTML = html;

        // Add back button listener
        const backBtn = document.getElementById('wikiBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.performSearch());
        }
    }

    /**
     * Use Wikipedia content in chat
     * @param {string} text - Text to use
     * @param {string} title - Article title
     */
    useInChat(text, title) {
        // Check if chat input exists
        const chatInput = document.getElementById('chatInput');
        
        if (chatInput) {
            const contextText = `Based on the Wikipedia article "${title}": ${text.substring(0, 500)}... `;
            chatInput.value = contextText;
            chatInput.focus();
            
            // Show toast notification
            if (typeof showToast === 'function') {
                showToast('Wikipedia context added to chat!', 'success');
            } else {
                console.log('[WikipediaPublicSearch] Context added to chat');
            }

            // Scroll to chat section
            const chatSection = document.getElementById('chatSection');
            if (chatSection) {
                chatSection.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
            console.error('[WikipediaPublicSearch] Chat input not found');
            if (typeof showToast === 'function') {
                showToast('Chat feature not available', 'error');
            }
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.resultsContainer.innerHTML = `
            <div class="wiki-loading">
                <div class="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        `;
    }

    /**
     * Show message
     * @param {string} message - Message to display
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
}

// Export for browser
if (typeof window !== 'undefined') {
    window.WikipediaPublicSearch = WikipediaPublicSearch;
}

// Export for Node.js (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WikipediaPublicSearch;
}
