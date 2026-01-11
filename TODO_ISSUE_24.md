# TODO: Add loading states and error feedback

## Task
Add loading indicators and error messages throughout the app for better UX

## Areas needing loading states

### 1. Answer generation
- Show spinner while AI is generating answer
- Disable submit button during generation
- Show progress indicator if possible

### 2. Page navigation
- Show loading state when navigating to history page
- Show skeleton loaders for content being fetched

### 3. API calls
- Show loading state for `/api/user` calls
- Show loading state for `/api/answers` calls
- Show loading state for `/api/question` calls

## Error feedback needed

### 1. Network errors
```javascript
catch (error) {
    showError('Failed to connect. Please check your internet connection.');
}
```

### 2. API errors
```javascript
if (response.status === 404) {
    showError('Resource not found');
} else if (response.status === 500) {
    showError('Server error. Please try again later.');
}
```

### 3. Validation errors
```javascript
if (!questionText) {
    showError('Please enter a question');
}
```

## Implementation suggestions

- Add a reusable loading spinner component
- Add a toast/notification system for errors
- Use aria-live regions for screen reader announcements
- Add retry buttons for failed operations

## Files to update
- `core/views/hosted-index.ejs`
- `core/views/history.ejs`
- Frontend JavaScript files
