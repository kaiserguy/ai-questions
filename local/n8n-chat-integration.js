const logger = require('../core/logger');
/**
 * n8n Chat Integration
 * Handles routing chat and Wikipedia requests through n8n workflows
 */

const N8nChatIntegration = {
  // Configuration
  config: {
    n8nBaseUrl: 'http://localhost:5678/webhook/',
    endpoints: {
      chat: 'ai-chat-processor',
      wikipediaArticle: 'wikipedia-article-processor'
    },
    fallbackToDirectApi: true
  },

  /**
   * Initialize the n8n chat integration
   */
  initialize() {
    logger.info('Initializing n8n Chat Integration...');
    // Check if n8n is available
    this.checkN8nAvailability()
      .then(available => {
        logger.info(`n8n availability: ${available ? 'Available' : 'Unavailable'}`);
        this.isAvailable = available;
      })
      .catch(error => {
        logger.error('Error checking n8n availability:', error);
        this.isAvailable = false;
      });
  },

  /**
   * Check if n8n is available
   */
  async checkN8nAvailability() {
    try {
      const response = await fetch(`${this.config.n8nBaseUrl}${this.config.endpoints.chat}`, {
        method: 'OPTIONS',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch (error) {
      logger.error('n8n availability check failed:', error);
      return false;
    }
  },

  /**
   * Send a chat message through n8n
   * @param {Object} params - Chat parameters
   * @param {string} params.message - User message
   * @param {string} params.model - AI model to use
   * @param {Array} params.context - Previous conversation context
   * @param {boolean} params.includeWikipedia - Whether to include Wikipedia context
   * @param {boolean} params.enableQueryLogging - Whether to enable query logging
   * @returns {Promise<Object>} - Chat response
   */
  async sendChatMessage(params) {
    if (!this.isAvailable && !this.config.fallbackToDirectApi) {
      throw new Error('n8n is not available and fallback is disabled');
    }

    try {
      // Try to use n8n workflow
      if (this.isAvailable) {
        const response = await fetch(`${this.config.n8nBaseUrl}${this.config.endpoints.chat}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params)
        });

        if (response.ok) {
          return await response.json();
        } else {
          logger.warn('n8n chat request failed, falling back to direct API');
        }
      }

      // Fall back to direct API if n8n is unavailable or request failed
      if (this.config.fallbackToDirectApi) {
        logger.info('Using direct API fallback for chat');
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params)
        });
        return await response.json();
      }

      throw new Error('Chat request failed and no fallback available');
    } catch (error) {
      logger.error('Chat request error:', error);
      throw error;
    }
  },

  /**
   * Get Wikipedia article through n8n
   * @param {string} articleId - Wikipedia article ID
   * @returns {Promise<Object>} - Article data
   */
  async getWikipediaArticle(articleId) {
    if (!this.isAvailable && !this.config.fallbackToDirectApi) {
      throw new Error('n8n is not available and fallback is disabled');
    }

    try {
      // Try to use n8n workflow
      if (this.isAvailable) {
        const response = await fetch(`${this.config.n8nBaseUrl}${this.config.endpoints.wikipediaArticle}?id=${articleId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          return await response.json();
        } else {
          logger.warn('n8n Wikipedia article request failed, falling back to direct API');
        }
      }

      // Fall back to direct API if n8n is unavailable or request failed
      if (this.config.fallbackToDirectApi) {
        logger.info('Using direct API fallback for Wikipedia article');
        const response = await fetch(`/api/wikipedia/article/${articleId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        return await response.json();
      }

      throw new Error('Wikipedia article request failed and no fallback available');
    } catch (error) {
      logger.error('Wikipedia article request error:', error);
      throw error;
    }
  }
};

// Export the module
module.exports = N8nChatIntegration;
