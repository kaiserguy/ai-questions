// AI Agent API Endpoints for Local AI Questions

// Agent status endpoint
app.get('/api/agent/status', async (req, res) => {
  try {
    const status = await aiAgent.getAgentStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get agent status',
      details: error.message
    });
  }
});

// Task automation endpoint
app.post('/api/agent/task', async (req, res) => {
  try {
    const { type, data, priority = 'normal' } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({
        success: false,
        error: 'Task type and data are required'
      });
    }
    
    const result = await aiAgent.automateTask(type, data, priority);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Task automation failed',
      details: error.message
    });
  }
});

// Enhanced question processing endpoint
app.post('/api/agent/question', async (req, res) => {
  try {
    const { question, context = '', preferences = {} } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required'
      });
    }
    
    const result = await aiAgent.processQuestion(question, context, preferences);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Question processing failed',
      details: error.message
    });
  }
});

// Agent initialization endpoint
app.post('/api/agent/initialize', async (req, res) => {
  try {
    const status = await aiAgent.initialize();
    res.json({
      success: true,
      message: 'AI Agent initialized successfully',
      status: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Agent initialization failed',
      details: error.message
    });
  }
});

