/**
 * Wikipedia Content Parser for Offline Mode
 * Cleans and formats Wikipedia content for better display
 */

class WikipediaContentParser {
    
    /**
     * Parse and clean Wikipedia content
     */
    static parseWikipediaContent(rawContent) {
        if (!rawContent) return '';
        
        let content = rawContent;
        
        // The infobox doesn't have opening {{ - it starts directly with |
        // Find the first line that contains actual article content
        const lines = content.split('\n');
        let startIndex = 0;
        
        // Look for the end of the infobox (marked by }}) and start of real content
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Look for lines that contain actual article content
            if (line.includes('is a country') || 
                line.includes('was a') || 
                line.includes('is a') ||
                (line.length > 50 && !line.startsWith('|') && !line.startsWith('{{') && !line.startsWith('}}') && !line.startsWith('<!--'))) {
                startIndex = i;
                break;
            }
            
            // Also check if we hit the end of infobox
            if (line === '}}' && i < lines.length - 1) {
                startIndex = i + 1;
                break;
            }
        }
        
        // Get content from the real article start
        content = lines.slice(startIndex).join('\n');
        
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

    /**
     * Extract infobox data from Wikipedia content
     */
    static extractInfoboxData(rawContent) {
        if (!rawContent) return {};
        
        const infoboxData = {};
        const lines = rawContent.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Stop at end of infobox
            if (trimmed === '}}') break;
            
            // Parse infobox fields
            if (trimmed.startsWith('|') && trimmed.includes('=')) {
                const [key, ...valueParts] = trimmed.substring(1).split('=');
                const value = valueParts.join('=').trim();
                
                if (key && value && !value.includes('{{') && !value.includes('[[')) {
                    const cleanKey = key.trim().replace(/_/g, ' ');
                    const cleanValue = value.replace(/<[^>]*>/g, '').trim();
                    
                    if (cleanValue.length > 0 && cleanValue.length < 100) {
                        infoboxData[cleanKey] = cleanValue;
                    }
                }
            }
        }
        
        return infoboxData;
    }

    /**
     * Generate clean article HTML for display
     */
    static generateArticleHTML(article) {
        if (!article) return '';
        
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
        const infoboxData = {}; // Skip infobox extraction for now
        
        // Create infobox HTML if we have data
        let infoboxHtml = '';
        if (Object.keys(infoboxData).length > 0) {
            infoboxHtml = `
                <div class="infobox">
                    <h3>${article.title}</h3>
                    ${Object.entries(infoboxData).map(([key, value]) => 
                        `<div class="info-row"><strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong> ${value}</div>`
                    ).join('')}
                </div>
            `;
        }
        
        return `
            <div class="container">
                <div class="header">
                    <a href="javascript:history.back()" class="back-link">← Back to AI Questions</a>
                    <h1>📄 ${article.title}</h1>
                    <p style="color: #666; margin: 0;">From Offline Wikipedia Database</p>
                </div>
                ${infoboxHtml}
                <div class="content">${cleanContent}</div>
            </div>
        `;
    }

    /**
     * Get CSS styles for Wikipedia articles
     */
    static getArticleCSS() {
        return `
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
            .infobox {
                float: right;
                width: 300px;
                margin: 0 0 20px 20px;
                padding: 15px;
                background: #f8f9fa;
                border: 1px solid #ddd;
                border-radius: 5px;
                font-size: 0.9em;
            }
            .infobox h3 {
                margin-top: 0;
                text-align: center;
                background: #007bff;
                color: white;
                padding: 10px;
                margin: -15px -15px 15px -15px;
                border-radius: 5px 5px 0 0;
            }
            .info-row {
                margin-bottom: 8px;
                padding: 5px 0;
                border-bottom: 1px solid #eee;
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
                .infobox {
                    float: none;
                    width: 100%;
                    margin: 0 0 20px 0;
                }
                body { padding: 10px; }
                .container { padding: 20px; }
                h1 { font-size: 2em; }
            }
        `;
    }
}

// Export for use in offline app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WikipediaContentParser;
} else {
    window.WikipediaContentParser = WikipediaContentParser;
}

