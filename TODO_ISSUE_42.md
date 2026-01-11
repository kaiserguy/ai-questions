# TODO: Implement /api/question route

## Task
Add the `/api/question` API endpoint to `core/routes.js`

## Implementation needed
```javascript
router.get('/api/question', (req, res) => {
    try {
        const todayQuestion = getTodayQuestion();
        res.json(todayQuestion);
    } catch (error) {
        console.error('Error in question API route:', error);
        res.status(500).json({ 
            error: 'Failed to get question', 
            message: error.message 
        });
    }
});
```

## Location
Add to `core/routes.js` after the `/api/answers` route

## Note
The `getTodayQuestion()` function already exists in the routes module.
This is a simpler, public version of `/api/daily-question` (which requires auth).
