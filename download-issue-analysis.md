# Download Initialization Issue - Root Cause Analysis

## Problem Identified
The offline package download initialization fails because the JavaScript code has several critical issues:

### 1. **Undefined Variables in downloadResource Method**
In `/home/ubuntu/ai-questions/core/public/offline/download-manager.js` around line 330:

```javascript
// Real progress calculation based on bytes downloaded
const progressIncrement = Math.min(bytesDownloaded / totalBytes * 100, 5);
```

**Issue**: `bytesDownloaded` and `totalBytes` are undefined variables, causing JavaScript errors.

### 2. **Missing Resource Files**
The API returns URLs for resources that don't exist:
- `/offline/libs/transformers.js` → 404 Not Found
- `/offline/libs/sql-wasm.js` → 404 Not Found  
- `/offline/libs/tokenizers.js` → 404 Not Found
- `/offline/models/phi3-mini.bin` → 404 Not Found
- `/offline/wikipedia/simple-wikipedia.db` → 404 Not Found

### 3. **Incomplete Download Logic**
The `downloadResource` method uses `setTimeout` with undefined variables instead of actual HTTP requests.

### 4. **API Mismatch**
The download manager expects different API endpoints than what's implemented:
- Expects: Direct file downloads from `/offline/libs/`
- Available: API endpoints like `/api/offline/download/library/:filename`

## Current Status
- ✅ Package availability API works (`/api/offline/packages/availability`)
- ✅ Download API endpoints exist (`/api/offline/download/*`)
- ❌ JavaScript download logic is broken
- ❌ Resource files don't exist at expected URLs
- ❌ Progress tracking uses undefined variables

## Solution Required
1. Fix undefined variables in download-manager.js
2. Update download logic to use correct API endpoints
3. Implement actual file downloads or mock them properly
4. Ensure progress tracking works with real data

