# Loading States and Error Feedback Guide

This guide explains how to use the toast notification system and loading states that have been added to the AI Questions application.

## Overview

The application now includes:
- **Toast Notification System** - For success/error/warning/info messages
- **Loading State Manager** - For button loading states and overlays
- **Async Action Handler** - Simplified error handling for async operations
- **Fetch with Feedback** - Enhanced fetch with automatic loading and error handling

## Toast Notifications

### Basic Usage

```javascript
// Success message
toast.success('Question saved successfully!');

// Error message
toast.error('Failed to save question');

// Warning message
toast.warning('This action cannot be undone');

// Info message
toast.info('New features available');
```

### With Custom Title and Duration

```javascript
// Custom title
toast.success('Question saved successfully!', 'Success');

// Custom duration (in milliseconds)
toast.success('Question saved!', null, 3000); // 3 seconds

// Persistent toast (doesn't auto-dismiss)
toast.error('Critical error occurred', 'Error', 0);
```

### Advanced Usage

```javascript
// Show a toast and get reference
const toastElement = toast.show(
    'Processing your request...',
    'info',
    5000,
    'Please Wait'
);

// Manually dismiss a specific toast
toast.dismiss(toastElement);

// Dismiss all toasts
toast.dismissAll();
```

## Loading States

### Button Loading States

```javascript
const button = document.getElementById('submit-btn');

// Show loading state
loading.showButton(button);

// Hide loading state
loading.hideButton(button);
```

### Full Example with Button

```javascript
const saveButton = document.getElementById('save-btn');

saveButton.addEventListener('click', async () => {
    loading.showButton(saveButton);
    
    try {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: 'example' })
        });
        
        if (!response.ok) throw new Error('Save failed');
        
        toast.success('Saved successfully!');
    } catch (error) {
        toast.error(error.message);
    } finally {
        loading.hideButton(saveButton);
    }
});
```

### Full-Page Loading Overlay

```javascript
// Show overlay
loading.showOverlay('Loading data...');

// Hide overlay
loading.hideOverlay();
```

### Progress Bar

```javascript
// Show progress bar at top of page
loading.showProgressBar();

// Hide progress bar
loading.hideProgressBar();
```

### Inline Spinner

```javascript
// Create a spinner element
const spinner = loading.createSpinner(); // Light spinner
const darkSpinner = loading.createSpinner(true); // Dark spinner

// Add to DOM
document.getElementById('container').appendChild(spinner);
```

## Async Action Handler

The `handleAsyncAction` function wraps async operations with automatic loading states and error handling.

### Basic Usage

```javascript
const deleteButton = document.getElementById('delete-btn');

deleteButton.addEventListener('click', async () => {
    await handleAsyncAction(
        async () => {
            const response = await fetch('/api/delete/123', { method: 'DELETE' });
            if (!response.ok) throw new Error('Delete failed');
            return await response.json();
        },
        deleteButton,
        {
            successMessage: 'Item deleted successfully',
            errorMessage: 'Failed to delete item'
        }
    );
});
```

### With Callbacks

```javascript
await handleAsyncAction(
    async () => {
        // Your async operation
        return await someAsyncFunction();
    },
    button,
    {
        successMessage: 'Operation completed',
        errorMessage: 'Operation failed',
        onSuccess: (result) => {
            console.log('Success!', result);
            // Update UI, redirect, etc.
        },
        onError: (error) => {
            console.error('Error:', error);
            // Additional error handling
        }
    }
);
```

### With Overlay or Progress Bar

```javascript
await handleAsyncAction(
    async () => {
        // Long-running operation
        return await fetchLargeDataset();
    },
    null, // No button
    {
        showOverlay: true,
        loadingMessage: 'Fetching data...',
        successMessage: 'Data loaded successfully'
    }
);

// Or with progress bar
await handleAsyncAction(
    async () => {
        return await someOperation();
    },
    null,
    {
        showProgressBar: true,
        successMessage: 'Complete!'
    }
);
```

## Fetch with Feedback

The `fetchWithFeedback` function is a wrapper around `fetch` with automatic error handling and feedback.

### Basic GET Request

```javascript
const data = await fetchWithFeedback('/api/questions', {}, {
    successMessage: 'Questions loaded',
    errorMessage: 'Failed to load questions'
});
```

### POST Request

```javascript
const result = await fetchWithFeedback(
    '/api/questions',
    {
        method: 'POST',
        body: { question: 'What is AI?', context: 'General' }
    },
    {
        successMessage: 'Question created',
        errorMessage: 'Failed to create question'
    }
);
```

### Without Loading Feedback

```javascript
const data = await fetchWithFeedback(
    '/api/questions',
    {},
    {
        showLoading: false // No loading state or success message
    }
);
```

### With Overlay

```javascript
const data = await fetchWithFeedback(
    '/api/large-dataset',
    {},
    {
        showOverlay: true,
        loadingMessage: 'Downloading data...',
        successMessage: 'Download complete'
    }
);
```

## Real-World Examples

### Example 1: Form Submission

```javascript
const form = document.getElementById('question-form');
const submitBtn = document.getElementById('submit-btn');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    await handleAsyncAction(
        async () => {
            return await fetchWithFeedback(
                '/api/questions',
                {
                    method: 'POST',
                    body: data
                },
                {
                    showLoading: false // We're using button loading instead
                }
            );
        },
        submitBtn,
        {
            successMessage: 'Question submitted successfully!',
            errorMessage: 'Failed to submit question',
            onSuccess: () => {
                form.reset();
                // Redirect or update UI
            }
        }
    );
});
```

### Example 2: Delete with Confirmation

```javascript
async function deleteQuestion(questionId) {
    if (!confirm('Are you sure you want to delete this question?')) {
        return;
    }
    
    const deleteBtn = document.getElementById(`delete-${questionId}`);
    
    await handleAsyncAction(
        async () => {
            return await fetchWithFeedback(
                `/api/questions/${questionId}`,
                { method: 'DELETE' },
                { showLoading: false }
            );
        },
        deleteBtn,
        {
            successMessage: 'Question deleted',
            errorMessage: 'Failed to delete question',
            onSuccess: () => {
                // Remove from DOM
                document.getElementById(`question-${questionId}`).remove();
            }
        }
    );
}
```

### Example 3: Page Load with Progress Bar

```javascript
document.addEventListener('DOMContentLoaded', async () => {
    loading.showProgressBar();
    
    try {
        const questions = await fetch('/api/questions').then(r => r.json());
        renderQuestions(questions);
        toast.success(`Loaded ${questions.length} questions`);
    } catch (error) {
        toast.error('Failed to load questions');
    } finally {
        loading.hideProgressBar();
    }
});
```

### Example 4: Schedule Execution

```javascript
async function executeSchedule(scheduleId) {
    const executeBtn = document.getElementById(`execute-${scheduleId}`);
    
    await handleAsyncAction(
        async () => {
            return await fetchWithFeedback(
                `/api/schedules/${scheduleId}/execute`,
                { method: 'POST' },
                { showLoading: false }
            );
        },
        executeBtn,
        {
            successMessage: 'Schedule executed successfully',
            errorMessage: 'Failed to execute schedule',
            onSuccess: (result) => {
                toast.info(
                    `Executed ${result.success_count} models successfully`,
                    'Execution Complete'
                );
                // Refresh execution history
                loadExecutionHistory(scheduleId);
            }
        }
    );
}
```

## Accessibility

All loading states and notifications are accessible:

- **Toast notifications** use `role="alert"` and `aria-live="assertive"`
- **Loading overlays** use `role="alert"` and `aria-busy="true"`
- **Spinners** use `role="status"` and `aria-label="Loading"`
- **Loading buttons** are automatically disabled during loading

## Styling

### Custom Toast Styles

You can customize toast appearance by modifying `/css/toast.css`:

```css
.toast.success {
    background-color: #10b981; /* Change success color */
}

.toast.error {
    background-color: #ef4444; /* Change error color */
}
```

### Custom Spinner

```css
.spinner {
    width: 20px; /* Adjust size */
    height: 20px;
    border-width: 3px; /* Adjust thickness */
}
```

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11 not supported (uses modern JavaScript features)

## Testing

To test the toast system:

```javascript
// Open browser console and run:
toast.success('Success test');
toast.error('Error test');
toast.warning('Warning test');
toast.info('Info test');

loading.showOverlay('Testing overlay');
setTimeout(() => loading.hideOverlay(), 2000);
```

## Migration Guide

### Before (Old Pattern)

```javascript
button.disabled = true;
button.textContent = 'Loading...';

try {
    const response = await fetch('/api/endpoint');
    if (!response.ok) throw new Error('Failed');
    alert('Success!');
} catch (error) {
    alert('Error: ' + error.message);
} finally {
    button.disabled = false;
    button.textContent = 'Submit';
}
```

### After (New Pattern)

```javascript
await handleAsyncAction(
    async () => {
        const response = await fetch('/api/endpoint');
        if (!response.ok) throw new Error('Failed');
        return await response.json();
    },
    button,
    {
        successMessage: 'Success!',
        errorMessage: 'Operation failed'
    }
);
```

## Best Practices

1. **Always provide feedback** - Every user action should have visual feedback
2. **Use appropriate message types** - Success for completions, error for failures, warning for cautions, info for updates
3. **Keep messages concise** - Users should understand at a glance
4. **Set appropriate durations** - Errors can stay longer (7s), success messages shorter (5s)
5. **Disable buttons during loading** - Prevent duplicate submissions
6. **Use overlays sparingly** - Only for operations that truly block the UI
7. **Test accessibility** - Ensure screen readers announce notifications

## Troubleshooting

### Toast not showing

- Check that `toast.css` and `toast.js` are loaded
- Check browser console for errors
- Verify the toast container exists in DOM

### Loading state not working

- Ensure button has a valid ID or reference
- Check that `loading.hideButton()` is called in `finally` block
- Verify toast.js is loaded before your script

### Styles not applying

- Check that `toast.css` is loaded after `styles.css`
- Clear browser cache
- Check for CSS conflicts

## Support

For issues or questions, please open an issue on GitHub.
