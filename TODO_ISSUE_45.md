# TODO: Implement /api/answers/history route

## Task
Add the `/api/answers/history` API endpoint to `core/routes.js`

## Implementation needed
```javascript
router.get('/api/answers/history', async (req, res) => {
    try {
        const questionId = req.query.question_id;
        
        if (!questionId) {
            return res.status(400).json({ 
                error: 'Missing required parameter: question_id' 
            });
        }
        
        const history = await db.getHistory(questionId);
        res.json(history);
    } catch (error) {
        console.error('Error in answers history API route:', error);
        res.status(500).json({ 
            error: 'Failed to get answer history', 
            message: error.message 
        });
    }
});
```

## Location
Add to `core/routes.js` after the `/api/question` route

## Note
The `getHistory(questionId)` database method already exists (restored in PR #39).
This route returns all historical answers for a specific question.
