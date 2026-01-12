/**
 * Integration module for local-index.js
 * Connects the main application with n8n workflows
 */

// Import required modules
const n8nChatIntegration = require('./n8n-chat-integration');
const WikipediaParserN8n = require('./wikipedia-parser-n8n');
const { validationRules, validateRequest, sanitizeInput } = require('../core/validation');

/**
 * Initialize n8n integration in the main application
 * @param {Object} app - Express application instance
 */
function initializeN8nIntegration(app) {
  console.log('Initializing n8n integration for chat and Wikipedia...');
  
  // Initialize the n8n chat integration
  n8nChatIntegration.initialize();
  
  // Create new endpoints that route through n8n
  
  // n8n Chat endpoint
  app.post('/api/n8n/chat',
    validationRules.chatMessage(),
    validateRequest,
    async (req, res) => {
      try {
        const { message, model, context, includeWikipedia, enableQueryLogging } = req.body;
        
        // Process chat through n8n
        const result = await n8nChatIntegration.sendChatMessage({
          message,
          model,
          context: context || [],
          includeWikipedia: includeWikipedia !== false,
          enableQueryLogging: enableQueryLogging || false
        });
        
        res.json(result);
      } catch (error) {
        console.error('n8n chat error:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message || 'Failed to process chat through n8n'
        });
      }
    }
  );
  
  // n8n Wikipedia article endpoint
  app.get('/api/n8n/wikipedia/article/:id', async (req, res) => {
    try {
      const id = sanitizeInput(req.params.id);
      
      if (!id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Article ID is required' 
        });
      }
      
      // Get article through n8n
      const result = await n8nChatIntegration.getWikipediaArticle(id);
      
      res.json(result);
    } catch (error) {
      console.error('n8n Wikipedia article error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to get Wikipedia article through n8n'
      });
    }
  });
  
  // Update the existing chat endpoint to use n8n when available
  const originalChatHandler = app._router.stack.find(
    layer => layer.route && layer.route.path === '/api/chat' && layer.route.methods.post
  );
  
  if (originalChatHandler && originalChatHandler.route) {
    const originalHandler = originalChatHandler.route.stack[0].handle;
    
    // Replace with wrapper that tries n8n first
    originalChatHandler.route.stack[0].handle = async (req, res, next) => {
      try {
        // Check if n8n is available
        const n8nAvailable = await n8nChatIntegration.checkN8nAvailability();
        
        if (n8nAvailable) {
          // Use n8n for chat
          const result = await n8nChatIntegration.sendChatMessage(req.body);
          return res.json(result);
        } else {
          // Fall back to original handler
          return originalHandler(req, res, next);
        }
      } catch (error) {
        console.error('Error in n8n chat wrapper:', error);
        // Fall back to original handler
        return originalHandler(req, res, next);
      }
    };
  }
  
  // Update the existing Wikipedia article endpoint to use n8n when available
  const originalArticleHandler = app._router.stack.find(
    layer => layer.route && layer.route.path === '/api/wikipedia/article/:id' && layer.route.methods.get
  );
  
  if (originalArticleHandler && originalArticleHandler.route) {
    const originalHandler = originalArticleHandler.route.stack[0].handle;
    
    // Replace with wrapper that tries n8n first
    originalArticleHandler.route.stack[0].handle = async (req, res, next) => {
      try {
        // Check if n8n is available
        const n8nAvailable = await n8nChatIntegration.checkN8nAvailability();
        
        if (n8nAvailable) {
          // Use n8n for Wikipedia article
          const result = await n8nChatIntegration.getWikipediaArticle(req.params.id);
          return res.json(result);
        } else {
          // Fall back to original handler
          return originalHandler(req, res, next);
        }
      } catch (error) {
        console.error('Error in n8n Wikipedia article wrapper:', error);
        // Fall back to original handler
        return originalHandler(req, res, next);
      }
    };
  }
  
  console.log('n8n integration initialized successfully');
  return true;
}

module.exports = {
  initializeN8nIntegration
};
