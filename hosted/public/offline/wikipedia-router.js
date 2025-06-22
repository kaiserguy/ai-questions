/**
 * Wikipedia Article Router for Offline Mode
 * Handles routing and display of Wikipedia articles
 */

class OfflineWikipediaRouter {
    constructor(wikipediaManager) {
        this.wikipediaManager = wikipediaManager;
        this.setupRouting();
    }

    setupRouting() {
        // Handle Wikipedia article URLs
        if (window.location.pathname.startsWith('/offline/wikipedia/article/')) {
            this.handleArticleRoute();
        }
    }

    async handleArticleRoute() {
        const pathParts = window.location.pathname.split('/');
        const articleTitle = decodeURIComponent(pathParts[pathParts.length - 1]);
        
        if (articleTitle) {
            await this.displayArticle(articleTitle);
        }
    }

    async displayArticle(title) {
        try {
            // Show loading state
            document.body.innerHTML = `
                <div style="text-align: center; padding: 50px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <h2>📚 Loading Wikipedia Article...</h2>
                    <p>Retrieving "${title}" from offline database</p>
                    <div style="margin: 20px 0;">
                        <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    </div>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            `;

            // Get article from database
            const article = await this.getArticleByTitle(title);
            
            if (!article) {
                this.displayNotFound(title);
                return;
            }

            // Generate and display article HTML
            const articleHTML = this.generateArticleHTML(article);
            document.body.innerHTML = articleHTML;
            
            // Add CSS styles
            this.addArticleStyles();
            
        } catch (error) {
            console.error('Failed to display article:', error);
            this.displayError(title, error.message);
        }
    }

    async getArticleByTitle(title) {
        if (!this.wikipediaManager || !this.wikipediaManager.db) {
            throw new Error('Wikipedia database not available');
        }

        try {
            const stmt = this.wikipediaManager.db.prepare(`
                SELECT title, content 
                FROM wikipedia_articles 
                WHERE LOWER(title) = LOWER(?)
                LIMIT 1
            `);
            
            stmt.bind([title]);
            
            if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                return {
                    title: row.title,
                    content: row.content
                };
            }
            
            stmt.free();
            return null;
            
        } catch (error) {
            console.error('Database query failed:', error);
            throw error;
        }
    }

    generateArticleHTML(article) {
        // Parse and clean the Wikipedia content - remove infobox completely
        let cleanContent = article.content;
        
        // Find where the actual article content starts
        const commonStartPhrases = [
            `${article.title} is a`,
            `${article.title} was a`,
            'is a country',
            'is a city',
            'is a person',
            'was a'
        ];
        
        let startIndex = -1;
        for (const phrase of commonStartPhrases) {
            startIndex = cleanContent.indexOf(phrase);
            if (startIndex !== -1) break;
        }
        
        if (startIndex !== -1) {
            cleanContent = cleanContent.substring(startIndex);
        } else {
            // Fallback: remove everything until we find substantial content
            const lines = cleanContent.split('\n');
            let contentStartIndex = 0;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.length > 50 && !line.startsWith('|') && !line.startsWith('{{') && !line.startsWith('}}')) {
                    contentStartIndex = i;
                    break;
                }
            }
            cleanContent = lines.slice(contentStartIndex).join('\n');
        }
        
        cleanContent = this.parseWikipediaContent(cleanContent);
        
        return `
            <div class="container">
                <div class="header">
                    <a href="javascript:history.back()" class="back-link">← Back to AI Questions</a>
                    <h1>📄 ${article.title}</h1>
                    <p style="color: #666; margin: 0;">From Offline Wikipedia Database</p>
                </div>
                <div class="content">${cleanContent}</div>
            </div>
        `;
    }

    parseWikipediaContent(rawContent) {
        if (!rawContent) return '';
        
        let content = rawContent;
        
        // Remove any remaining template calls
        content = content.replace(/\{\{[^}]*\}\}/g, '');
        
        // Remove file/image references
        content = content.replace(/\[\[File:[^\]]*\]\]/g, '');
        content = content.replace(/\[\[Image:[^\]]*\]\]/g, '');
        
        // Convert internal links [[Link|Display]] to just Display
        content = content.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
        
        // Convert simple internal links [[Link]] to just Link
        content = content.replace(/\[\[([^\]]+)\]\]/g, '$1');
        
        // Convert external links [URL Display] to just Display
        content = content.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1');
        
        // Remove bare external links
        content = content.replace(/\[https?:\/\/[^\s\]]+\]/g, '');
        
        // Convert wiki markup for bold and italic
        content = content.replace(/'''([^']+)'''/g, '<strong>$1</strong>');
        content = content.replace(/''([^']+)''/g, '<em>$1</em>');
        
        // Convert section headers
        content = content.replace(/^====\s*([^=]+)\s*====/gm, '<h4>$1</h4>');
        content = content.replace(/^===\s*([^=]+)\s*===/gm, '<h3>$1</h3>');
        content = content.replace(/^==\s*([^=]+)\s*==/gm, '<h2>$1</h2>');
        
        // Convert bullet points
        content = content.replace(/^\*\s+(.+)$/gm, '<li>$1</li>');
        
        // Convert numbered lists
        content = content.replace(/^#\s+(.+)$/gm, '<li>$1</li>');
        
        // Remove reference tags
        content = content.replace(/<ref[^>]*>.*?<\/ref>/g, '');
        content = content.replace(/<ref[^>]*\/>/g, '');
        
        // Clean up multiple newlines
        content = content.replace(/\n{3,}/g, '\n\n');
        
        // Convert newlines to HTML breaks for better display
        content = content.replace(/\n\n/g, '</p><p>');
        content = content.replace(/\n/g, '<br>');
        
        // Wrap in paragraphs
        content = '<p>' + content + '</p>';
        
        // Fix list formatting
        content = content.replace(/(<li>.*?<\/li>)/gs, function(match) {
            return '<ul>' + match + '</ul>';
        });
        
        // Clean up empty paragraphs
        content = content.replace(/<p>\s*<\/p>/g, '');
        content = content.replace(/<p>\s*<br>\s*<\/p>/g, '');
        
        return content.trim();
    }

    addArticleStyles() {
        const style = document.createElement('style');
        style.textContent = `
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                line-height: 1.6; 
                max-width: 1000px; 
                margin: 0 auto; 
                padding: 20px; 
                color: #333;
                background: #f8f9fa;
            }
            .container {
                background: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header { 
                border-bottom: 2px solid #eee; 
                padding-bottom: 15px; 
                margin-bottom: 20px; 
            }
            .back-link { 
                color: #007bff; 
                text-decoration: none; 
                font-size: 14px;
                display: inline-block;
                margin-bottom: 10px;
            }
            .back-link:hover { text-decoration: underline; }
            h1 { 
                color: #000; 
                margin: 10px 0; 
                font-size: 2.5em;
                border-bottom: 3px solid #007bff;
                padding-bottom: 10px;
            }
            h2 { 
                color: #333; 
                margin-top: 30px; 
                margin-bottom: 15px;
                font-size: 1.5em;
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
            }
            h3 { 
                color: #555; 
                margin-top: 25px; 
                margin-bottom: 10px;
                font-size: 1.2em;
            }
            h4 { 
                color: #666; 
                margin-top: 20px; 
                margin-bottom: 8px;
            }
            .content { 
                line-height: 1.8; 
                font-size: 16px;
            }
            .content p {
                margin-bottom: 15px;
                text-align: justify;
            }
            .content ul, .content ol {
                margin: 15px 0;
                padding-left: 30px;
            }
            .content li {
                margin-bottom: 5px;
            }
            @media (max-width: 768px) {
                body { padding: 10px; }
                .container { padding: 20px; }
                h1 { font-size: 2em; }
            }
        `;
        document.head.appendChild(style);
    }

    displayNotFound(title) {
        document.body.innerHTML = `
            <div style="text-align: center; padding: 50px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <h1>📄 Article Not Found</h1>
                <p>The Wikipedia article "${title}" was not found in the offline database.</p>
                <p style="color: #666;">This might be because:</p>
                <ul style="text-align: left; display: inline-block; color: #666;">
                    <li>The article is not included in the current Wikipedia package</li>
                    <li>The article title might be spelled differently</li>
                    <li>The offline database is not properly loaded</li>
                </ul>
                <div style="margin-top: 30px;">
                    <a href="javascript:history.back()" style="color: #007bff; text-decoration: none; font-weight: 500;">← Back to AI Questions</a>
                </div>
            </div>
        `;
    }

    displayError(title, errorMessage) {
        document.body.innerHTML = `
            <div style="text-align: center; padding: 50px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <h1>❌ Error Loading Article</h1>
                <p>Failed to load the Wikipedia article "${title}".</p>
                <p style="color: #dc3545; font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 5px; display: inline-block;">
                    ${errorMessage}
                </p>
                <div style="margin-top: 30px;">
                    <a href="javascript:history.back()" style="color: #007bff; text-decoration: none; font-weight: 500;">← Back to AI Questions</a>
                </div>
            </div>
        `;
    }
}

// Auto-initialize if we're on a Wikipedia article page
if (window.location.pathname.startsWith('/offline/wikipedia/article/')) {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait for Wikipedia manager to be available
        const checkWikipedia = setInterval(() => {
            if (window.offlineApp && window.offlineApp.wikipediaDB) {
                clearInterval(checkWikipedia);
                new OfflineWikipediaRouter(window.offlineApp.wikipediaDB);
            }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkWikipedia);
            if (!window.offlineApp || !window.offlineApp.wikipediaDB) {
                document.body.innerHTML = `
                    <div style="text-align: center; padding: 50px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        <h1>⚠️ Wikipedia Not Available</h1>
                        <p>The offline Wikipedia database is not available.</p>
                        <p>Please ensure the Wikipedia package is downloaded and the offline app is properly initialized.</p>
                        <div style="margin-top: 30px;">
                            <a href="/offline" style="color: #007bff; text-decoration: none; font-weight: 500;">← Back to Offline Mode</a>
                        </div>
                    </div>
                `;
            }
        }, 10000);
    });
}

// Export for use in offline app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineWikipediaRouter;
} else {
    window.OfflineWikipediaRouter = OfflineWikipediaRouter;
}

