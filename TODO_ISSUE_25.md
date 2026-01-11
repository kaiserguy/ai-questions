# TODO: Improve accessibility with aria-labels

## Task
Add aria-labels and text alternatives for emoji buttons throughout the app

## Files to update
- `core/views/hosted-index.ejs`
- `core/views/history.ejs`
- Any other view templates with emoji buttons

## Examples needed

### Emoji buttons without labels:
```html
<button class="emoji-btn">👍</button>
<button class="emoji-btn">👎</button>
<button class="emoji-btn">❤️</button>
```

### Should become:
```html
<button class="emoji-btn" aria-label="Like this answer">👍</button>
<button class="emoji-btn" aria-label="Dislike this answer">👎</button>
<button class="emoji-btn" aria-label="Love this answer">❤️</button>
```

## Other improvements
- Add alt text for any images without it
- Add aria-labels for icon-only buttons
- Add sr-only text for screen readers where needed

## Testing
- Verify with screen reader (NVDA, JAWS, or VoiceOver)
- Check keyboard navigation works properly
- Ensure all interactive elements are accessible
