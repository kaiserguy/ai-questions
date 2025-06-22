/**
 * Intelligent Wikipedia Query System
 * Analyzes user queries and generates intelligent Wikipedia searches
 */

class WikipediaQueryAnalyzer {
  constructor() {
    this.intentPatterns = {
      factual: /what is|tell me about|explain|describe|information about/i,
      comparison: /compare|difference|versus|vs|better than|different from/i,
      calculation: /how many|how much|calculate|convert|size of|number of/i,
      location: /where is|located|find|geography|position/i,
      definition: /define|meaning|definition of/i,
      historical: /history|historical|when did|founded|established/i,
      technical: /how does|how to|process|mechanism|works/i
    };

    this.entityPatterns = {
      country: /\b(poland|germany|france|usa|united states|japan|china|russia|uk|britain|canada|australia|brazil|india)\b/i,
      military: /\b(air force|army|navy|military|armed forces|marines|coast guard)\b/i,
      science: /\b(physics|chemistry|biology|quantum|photosynthesis|dna|atom|molecule)\b/i,
      technology: /\b(computer|internet|software|hardware|programming|ai|artificial intelligence)\b/i,
      geography: /\b(mountain|river|ocean|continent|capital|city|border|climate)\b/i,
      math: /\b(calculate|convert|ounces|pounds|kilometers|miles|celsius|fahrenheit)\b/i
    };

    this.stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'what', 'when', 'where', 'why', 'how'
    ]);
  }

  /**
   * Analyze user query and generate search strategy
   */
  analyzeQuery(message) {
    const lowerMessage = message.toLowerCase().trim();
    
    const analysis = {
      originalMessage: message,
      intent: this.detectIntent(lowerMessage),
      entities: this.extractEntities(lowerMessage),
      questionType: this.classifyQuestionType(lowerMessage),
      searchTerms: this.generateSearchTerms(message),
      confidence: 0.8,
      requiresCalculation: this.requiresCalculation(lowerMessage),
      keywords: this.extractKeywords(message)
    };

    // Adjust confidence based on analysis quality
    analysis.confidence = this.calculateConfidence(analysis);
    
    return analysis;
  }

  /**
   * Detect user intent from message
   */
  detectIntent(message) {
    for (const [intent, pattern] of Object.entries(this.intentPatterns)) {
      if (pattern.test(message)) {
        return intent;
      }
    }
    return 'general';
  }

  /**
   * Extract entities (topics, subjects) from message
   */
  extractEntities(message) {
    const entities = {};
    
    for (const [category, pattern] of Object.entries(this.entityPatterns)) {
      const matches = message.match(pattern);
      if (matches) {
        entities[category] = matches[0];
      }
    }
    
    return entities;
  }

  /**
   * Classify the type of question being asked
   */
  classifyQuestionType(message) {
    if (message.startsWith('what')) return 'what';
    if (message.startsWith('where')) return 'where';
    if (message.startsWith('when')) return 'when';
    if (message.startsWith('why')) return 'why';
    if (message.startsWith('how')) return 'how';
    if (message.startsWith('who')) return 'who';
    if (message.includes('?')) return 'question';
    return 'statement';
  }

  /**
   * Generate intelligent search terms for Wikipedia
   */
  generateSearchTerms(message) {
    const searchTerms = [];
    const lowerMessage = message.toLowerCase();

    // Specific topic mappings
    const topicMappings = {
      'us air force': ['United_States_Air_Force', 'United_States_Armed_Forces', 'Military_aviation'],
      'air force size': ['United_States_Air_Force', 'Military_personnel', 'Air_force'],
      'poland': ['Poland', 'Polish_history', 'Geography_of_Poland'],
      'germany': ['Germany', 'German_history', 'Geography_of_Germany'],
      'photosynthesis': ['Photosynthesis', 'Plant_biology', 'Chlorophyll'],
      'quantum physics': ['Quantum_mechanics', 'Quantum_physics', 'Physics'],
      'internet': ['Internet', 'World_Wide_Web', 'Computer_network'],
      'artificial intelligence': ['Artificial_intelligence', 'Machine_learning', 'Computer_science'],
      'feelings': ['Emotion', 'Consciousness', 'Artificial_intelligence'],
      'consciousness': ['Consciousness', 'Philosophy_of_mind', 'Artificial_intelligence']
    };

    // Check for direct mappings
    for (const [key, terms] of Object.entries(topicMappings)) {
      if (lowerMessage.includes(key)) {
        searchTerms.push(...terms);
      }
    }

    // Extract meaningful keywords if no direct mapping
    if (searchTerms.length === 0) {
      const keywords = this.extractKeywords(message);
      
      // Convert keywords to potential Wikipedia article titles
      keywords.forEach(keyword => {
        // Capitalize first letter for Wikipedia format
        const formatted = keyword.charAt(0).toUpperCase() + keyword.slice(1);
        searchTerms.push(formatted);
        
        // Add variations
        if (keyword.length > 4) {
          searchTerms.push(formatted + 's'); // Plural
          searchTerms.push(formatted.replace(/y$/, 'ies')); // -y to -ies
        }
      });
    }

    // Remove duplicates and limit to top 5 terms
    return [...new Set(searchTerms)].slice(0, 5);
  }

  /**
   * Extract meaningful keywords from message
   */
  extractKeywords(message) {
    return message
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !this.stopWords.has(word) &&
        !/^\d+$/.test(word) // Remove pure numbers
      )
      .slice(0, 10); // Limit to 10 keywords
  }

  /**
   * Check if query requires mathematical calculation
   */
  requiresCalculation(message) {
    const calcPatterns = [
      /\d+\s*[\+\-\*\/]\s*\d+/,
      /how many.*in/,
      /convert.*to/,
      /ounces.*pounds|pounds.*ounces/,
      /celsius.*fahrenheit|fahrenheit.*celsius/
    ];

    return calcPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Calculate confidence score for the analysis
   */
  calculateConfidence(analysis) {
    let confidence = 0.5; // Base confidence

    // Boost confidence for clear intent
    if (analysis.intent !== 'general') confidence += 0.2;

    // Boost confidence for recognized entities
    if (Object.keys(analysis.entities).length > 0) confidence += 0.2;

    // Boost confidence for clear question types
    if (analysis.questionType !== 'statement') confidence += 0.1;

    // Boost confidence for good search terms
    if (analysis.searchTerms.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }
}

/**
 * Wikipedia Search Engine
 * Executes intelligent searches against Wikipedia content
 */
class WikipediaSearchEngine {
  constructor() {
    this.baseUrl = 'https://en.wikipedia.org/w/api.php';
  }

  /**
   * Execute intelligent Wikipedia search
   */
  async executeSearch(analysis) {
    const results = {
      query: analysis,
      articles: [],
      summaries: [],
      relatedTopics: [],
      confidence: analysis.confidence
    };

    try {
      // Search for each term
      for (const term of analysis.searchTerms) {
        const searchResults = await this.searchWikipedia(term);
        if (searchResults.length > 0) {
          results.articles.push(...searchResults);
        }
      }

      // Get article summaries for top results
      const topArticles = results.articles.slice(0, 3);
      for (const article of topArticles) {
        const summary = await this.getArticleSummary(article.title);
        if (summary) {
          results.summaries.push(summary);
        }
      }

      // Generate related topics
      results.relatedTopics = this.generateRelatedTopics(analysis);

    } catch (error) {
      console.error('Wikipedia search error:', error);
      results.error = error.message;
    }

    return results;
  }

  /**
   * Search Wikipedia using OpenSearch API
   */
  async searchWikipedia(term) {
    try {
      const url = `${this.baseUrl}?action=opensearch&search=${encodeURIComponent(term)}&limit=5&format=json&origin=*`;
      const response = await fetch(url);
      const data = await response.json();

      if (data && data.length >= 4) {
        const [query, titles, descriptions, urls] = data;
        return titles.map((title, index) => ({
          title,
          description: descriptions[index] || '',
          url: urls[index] || '',
          relevance: this.calculateRelevance(term, title, descriptions[index])
        }));
      }
    } catch (error) {
      console.error(`Error searching for "${term}":`, error);
    }
    
    return [];
  }

  /**
   * Get article summary from Wikipedia
   */
  async getArticleSummary(title) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const response = await fetch(url);
      const data = await response.json();

      return {
        title: data.title,
        extract: data.extract,
        thumbnail: data.thumbnail?.source,
        url: data.content_urls?.desktop?.page
      };
    } catch (error) {
      console.error(`Error getting summary for "${title}":`, error);
      return null;
    }
  }

  /**
   * Calculate relevance score for search result
   */
  calculateRelevance(searchTerm, title, description) {
    let score = 0;
    const lowerTerm = searchTerm.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const lowerDesc = (description || '').toLowerCase();

    // Exact title match
    if (lowerTitle === lowerTerm) score += 1.0;
    // Title contains term
    else if (lowerTitle.includes(lowerTerm)) score += 0.8;
    // Description contains term
    else if (lowerDesc.includes(lowerTerm)) score += 0.6;
    // Partial match
    else if (lowerTitle.includes(lowerTerm.split(' ')[0])) score += 0.4;

    return score;
  }

  /**
   * Generate related topics based on analysis
   */
  generateRelatedTopics(analysis) {
    const related = [];
    
    // Add entity-based related topics
    Object.entries(analysis.entities).forEach(([category, entity]) => {
      switch (category) {
        case 'country':
          related.push(`Geography_of_${entity}`, `History_of_${entity}`, `Culture_of_${entity}`);
          break;
        case 'military':
          related.push('Military_organization', 'Armed_forces', 'Defense_policy');
          break;
        case 'science':
          related.push('Scientific_method', 'Physics', 'Chemistry', 'Biology');
          break;
        case 'technology':
          related.push('Computer_science', 'Information_technology', 'Engineering');
          break;
      }
    });

    return [...new Set(related)].slice(0, 5);
  }
}

/**
 * Response Synthesizer
 * Combines Wikipedia search results into conversational responses
 */
class ResponseSynthesizer {
  constructor() {
    this.maxResponseLength = 500;
  }

  /**
   * Generate conversational response from Wikipedia search results
   */
  synthesizeResponse(analysis, searchResults) {
    // Handle calculation requests first
    if (analysis.requiresCalculation) {
      const calcResponse = this.handleCalculation(analysis.originalMessage);
      if (calcResponse) {
        return this.formatResponse(calcResponse, searchResults, analysis);
      }
    }

    // Generate response based on intent and search results
    let response = '';
    
    if (searchResults.summaries.length > 0) {
      response = this.generateInformedResponse(analysis, searchResults);
    } else {
      response = this.generateFallbackResponse(analysis);
    }

    return this.formatResponse(response, searchResults, analysis);
  }

  /**
   * Handle mathematical calculations
   */
  handleCalculation(message) {
    const lowerMessage = message.toLowerCase();

    // Pounds to ounces conversion
    if (lowerMessage.includes('ounces') && lowerMessage.includes('lbs')) {
      const lbsMatch = message.match(/(\d+(?:\.\d+)?)\s*lbs?/i);
      if (lbsMatch) {
        const pounds = parseFloat(lbsMatch[1]);
        const ounces = pounds * 16;
        return `There are ${ounces} ounces in ${pounds} pound${pounds !== 1 ? 's' : ''}. (Since there are 16 ounces in 1 pound, ${pounds} × 16 = ${ounces})`;
      }
    }

    // Basic arithmetic
    const mathMatch = message.match(/(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)/);
    if (mathMatch) {
      const [, num1, operator, num2] = mathMatch;
      const a = parseFloat(num1);
      const b = parseFloat(num2);
      let result, operation;
      
      switch (operator) {
        case '+': result = a + b; operation = 'plus'; break;
        case '-': result = a - b; operation = 'minus'; break;
        case '*': result = a * b; operation = 'times'; break;
        case '/': result = b !== 0 ? a / b : 'undefined (division by zero)'; operation = 'divided by'; break;
      }
      
      return `${a} ${operation} ${b} equals ${result}`;
    }

    return null;
  }

  /**
   * Generate informed response using Wikipedia data
   */
  generateInformedResponse(analysis, searchResults) {
    const primarySummary = searchResults.summaries[0];
    
    if (!primarySummary) {
      return this.generateFallbackResponse(analysis);
    }

    let response = '';
    
    // Start with the main information
    if (primarySummary.extract) {
      // Take first 2-3 sentences from extract
      const sentences = primarySummary.extract.split('. ');
      response = sentences.slice(0, 3).join('. ');
      if (!response.endsWith('.')) response += '.';
    }

    // Add specific information based on intent
    if (analysis.intent === 'calculation' && analysis.entities.military) {
      response += ' For specific current numbers and detailed organizational information, military statistics can vary and are regularly updated by official sources.';
    }

    // Add context from additional summaries
    if (searchResults.summaries.length > 1) {
      const additionalInfo = searchResults.summaries[1];
      if (additionalInfo && additionalInfo.extract) {
        const additionalSentence = additionalInfo.extract.split('. ')[0];
        response += ` Related information: ${additionalSentence}.`;
      }
    }

    return response;
  }

  /**
   * Generate fallback response when no Wikipedia data is available
   */
  generateFallbackResponse(analysis) {
    const intent = analysis.intent;
    const entities = Object.values(analysis.entities).join(', ');
    
    switch (intent) {
      case 'factual':
        return `I'd be happy to help you learn about ${entities || 'that topic'}! While I don't have specific details readily available, I can guide you to search for more comprehensive information.`;
      
      case 'calculation':
        return `I can help with calculations! For the specific numbers you're looking for, you might want to search for current official data, as figures can change over time.`;
      
      case 'location':
        return `For geographic information about ${entities || 'that location'}, I'd recommend searching for detailed maps and current geographic data.`;
      
      default:
        return `That's an interesting question about ${entities || 'that topic'}! I'd be happy to help you explore this further. What specific aspect would you like to know more about?`;
    }
  }

  /**
   * Format final response with citations and links
   */
  formatResponse(response, searchResults, analysis) {
    let formattedResponse = response;

    // Add Wikipedia links if we have good search results
    if (searchResults.articles.length > 0) {
      const topArticles = searchResults.articles
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 3);

      const links = topArticles.map(article => 
        `<a href="#" onclick="searchWikipediaFromChat('${article.title.replace(/'/g, "\\'")}'); return false;" style="color: #0066cc; text-decoration: underline;">${article.title}</a>`
      );

      formattedResponse += `\n\n📚 Related Wikipedia articles: ${links.join(', ')}`;
    }

    return {
      response: formattedResponse,
      confidence: searchResults.confidence,
      sources: searchResults.articles.map(a => a.title),
      searchTerms: analysis.searchTerms,
      intent: analysis.intent
    };
  }
}

// Export classes for use in the main application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WikipediaQueryAnalyzer,
    WikipediaSearchEngine,
    ResponseSynthesizer
  };
}

