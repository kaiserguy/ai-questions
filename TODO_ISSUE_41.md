# TODO: Implement /api/answers route

## Task
Add the `/api/answers` API endpoint to `core/routes.js`

## Implementation needed
```javascript
router.get('/api/answers', async (req, res) => {
    try {
        const latestAnswers = await db.getLatestAnswers();
        res.json(latestAnswers);
    } catch (error) {
        console.error('Error in answers API route:', error);
        res.status(500).json({ 
            error: 'Failed to get latest answers', 
            message: error.message 
        });
    }
});
```

## Location
Add to `core/routes.js` after the `/api/user` route

## Note
The `getLatestAnswers()` database method already exists (restored in PR #39)
