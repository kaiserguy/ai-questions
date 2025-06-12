/**
 * Wikipedia Parser for n8n Integration
 * Ensures proper parsing and formatting of Wikipedia content
 */

const WikipediaParserN8n = {
  /**
   * Parse and format Wikipedia article content
   * @param {Object} rawArticle - Raw Wikipedia article data
   * @returns {Object} - Formatted article data
   */
  parseArticle(rawArticle) {
    if (!rawArticle || rawArticle.error) {
      return {
        success: false,
        error: rawArticle?.error || 'Article not found'
      };
    }

    // Format the main content
    const formattedContent = this.formatContent(rawArticle.content || '');
    
    // Process infobox if available
    const infobox = this.processInfobox(rawArticle.infobox);
    
    // Format sections
    const formattedSections = this.formatSections(rawArticle.sections || []);
    
    // Format links for local Wikipedia
    const formattedLinks = this.formatLinks(rawArticle.links || []);
    
    return {
      success: true,
      article: {
        id: rawArticle.id,
        title: rawArticle.title,
        content: formattedContent,
        summary: this.formatContent(rawArticle.summary || ''),
        infobox: infobox,
        sections: formattedSections,
        links: formattedLinks,
        categories: rawArticle.categories || [],
        images: rawArticle.images || [],
        metadata: {
          lastUpdated: rawArticle.last_updated || new Date().toISOString(),
          processingTime: new Date().toISOString()
        }
      }
    };
  },
  
  /**
   * Format Wikipedia content text
   * @param {string} content - Raw content
   * @returns {string} - Formatted content
   */
  formatContent(content) {
    if (!content) return '';
    
    // Remove raw formatting artifacts
    let formatted = content
      // Remove pipe characters from links
      .replace(/\[\[([^\]]+)\|([^\]]+)\]\]/g, '$2')
      // Remove remaining wiki markup
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove citation references
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
      .replace(/<ref[^>]*\/>/g, '')
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      // Clean up multiple newlines
      .replace(/\n{3,}/g, '\n\n');
      
    return formatted;
  },
  
  /**
   * Process and format infobox data
   * @param {Object} infobox - Raw infobox data
   * @returns {Object} - Formatted infobox
   */
  processInfobox(infobox) {
    if (!infobox) return null;
    
    const formattedInfobox = {};
    
    try {
      // Process each infobox field
      for (const [key, value] of Object.entries(infobox)) {
        // Clean up field names
        const cleanKey = key.replace(/[|[\]{}]/g, '').trim();
        
        // Clean up values
        let cleanValue = value;
        if (typeof value === 'string') {
          cleanValue = value
            .replace(/[[\]{}]/g, '')
            .replace(/\|/g, ' ')
            .trim();
        }
        
        formattedInfobox[cleanKey] = cleanValue;
      }
    } catch (error) {
      console.error('Error parsing infobox:', error);
      return null;
    }
    
    return formattedInfobox;
  },
  
  /**
   * Format article sections
   * @param {Array} sections - Raw sections data
   * @returns {Array} - Formatted sections
   */
  formatSections(sections) {
    if (!sections || !Array.isArray(sections)) return [];
    
    return sections.map(section => {
      return {
        title: section.title || '',
        level: section.level || 2,
        content: this.formatContent(section.content || '')
      };
    });
  },
  
  /**
   * Format article links for local Wikipedia
   * @param {Array} links - Raw links data
   * @returns {Array} - Formatted links
   */
  formatLinks(links) {
    if (!links || !Array.isArray(links)) return [];
    
    return links.map(link => {
      return {
        title: link.title || '',
        id: link.id || '',
        url: `/wikipedia/article/${link.id}`
      };
    });
  },
  
  /**
   * Extract key entities from article content
   * @param {string} content - Article content
   * @returns {Array} - Extracted entities
   */
  extractEntities(content) {
    if (!content) return [];
    
    const entities = new Set();
    
    // Extract proper nouns (capitalized words)
    const properNouns = content.match(/\b[A-Z][a-z]{2,}\b/g) || [];
    properNouns.forEach(noun => entities.add(noun));
    
    // Extract dates
    const dates = content.match(/\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/g) || [];
    dates.forEach(date => entities.add(date));
    
    // Extract locations (simple heuristic)
    const locations = content.match(/\b(?:in|at|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g) || [];
    locations.forEach(location => {
      const match = location.match(/\b(?:in|at|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
      if (match && match[1]) {
        entities.add(match[1]);
      }
    });
    
    return Array.from(entities);
  }
};

// Export the module
module.exports = WikipediaParserN8n;
