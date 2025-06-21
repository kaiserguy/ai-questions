/**
 * Wikipedia Content Parser
 * Cleans and formats Wikipedia content for better display
 */

function parseWikipediaContent(rawContent) {
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
            line.includes('Poland is') ||
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

function extractInfoboxData(rawContent) {
    if (!rawContent) return {};
    
    const infoboxMatch = rawContent.match(/^\{\{([^}]*)\}\}/s);
    if (!infoboxMatch) return {};
    
    const infoboxContent = infoboxMatch[1];
    const data = {};
    
    // Extract key-value pairs from infobox
    const lines = infoboxContent.split('\n');
    for (const line of lines) {
        const match = line.match(/^\s*\|\s*([^=]+)\s*=\s*(.+)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            
            // Clean up common infobox fields
            if (key === 'capital' && value) {
                data.capital = value;
            } else if (key === 'population_census' && value) {
                data.population = value;
            } else if (key === 'area_km2' && value) {
                data.area = value + ' km²';
            } else if (key === 'languages' && value) {
                data.language = value;
            } else if (key === 'government_type' && value) {
                data.government = value;
            }
        }
    }
    
    return data;
}

module.exports = { parseWikipediaContent, extractInfoboxData };

