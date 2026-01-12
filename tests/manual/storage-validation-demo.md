# Storage Validation Feature - Manual Testing Guide

This document describes how to manually test the storage space validation feature for offline package downloads.

## Feature Overview

The storage validation feature checks available browser storage space before allowing users to download offline packages. It provides:

1. **Visual Storage Indicator**: Shows available vs. required storage space
2. **Pre-download Validation**: Checks storage before starting download
3. **User Warnings**: Alerts users when storage is insufficient or tight
4. **Graceful Degradation**: Falls back gracefully on browsers without Storage API support

## Test Scenarios

### Scenario 1: Sufficient Storage (Green)
**Expected Behavior:**
- Storage indicator shows green progress bar
- Download button is enabled
- No warning messages displayed

**Steps:**
1. Open `/offline` page
2. Select "Minimal Package" (175MB)
3. Observe storage indicator:
   - Should show available storage
   - Should show required storage (with 20% buffer)
   - Progress bar should be green
   - No warnings should appear

### Scenario 2: Low Storage Warning (Orange)
**Expected Behavior:**
- Storage indicator shows orange progress bar
- Download button is enabled (with warning)
- Warning message about tight storage space

**Steps:**
1. Open browser DevTools Console
2. Mock low storage:
   ```javascript
   // Override storage estimate
   navigator.storage.estimate = () => Promise.resolve({
     quota: 300 * 1024 * 1024,  // 300MB total
     usage: 100 * 1024 * 1024   // 100MB used
   });
   ```
3. Select "Minimal Package"
4. Observe orange warning with message about tight storage

### Scenario 3: Insufficient Storage (Red)
**Expected Behavior:**
- Storage indicator shows red progress bar
- Download button is disabled
- Error message about insufficient storage

**Steps:**
1. Open browser DevTools Console
2. Mock insufficient storage:
   ```javascript
   navigator.storage.estimate = () => Promise.resolve({
     quota: 150 * 1024 * 1024,  // 150MB total
     usage: 50 * 1024 * 1024    // 50MB used
   });
   ```
3. Select "Minimal Package" (requires ~210MB with buffer)
4. Observe:
   - Red storage bar
   - Button disabled with text "Insufficient Storage"
   - Error message showing how much space to free

### Scenario 4: Storage API Not Supported
**Expected Behavior:**
- Warning about storage check not available
- Download still allowed to proceed
- Orange warning indicator

**Steps:**
1. Open browser DevTools Console
2. Disable Storage API:
   ```javascript
   delete navigator.storage;
   ```
3. Select any package
4. Observe warning message about storage check unavailability

### Scenario 5: Download Blocked by Insufficient Storage
**Expected Behavior:**
- Download fails with storage error before starting

**Steps:**
1. Mock insufficient storage (see Scenario 3)
2. Click download button (if enabled)
3. Observe error message: "Insufficient storage space. Required: X, Available: Y"

## Visual Indicators

### Storage Bar Colors:
- **Green** (#10b981): Sufficient storage (>150% of required)
- **Orange** (#f59e0b): Low storage (100-150% of required)
- **Red** (#ef4444): Insufficient storage (<100% of required)

### Storage Calculation:
- Base package size + 20% buffer
- Example: 175MB package requires 210MB (175 * 1.2)

## Package Sizes

| Package | Libraries | AI Model | Wikipedia | Total | With Buffer |
|---------|-----------|----------|-----------|-------|-------------|
| Minimal | 5MB | 150MB | 20MB | 175MB | 210MB |
| Standard | 5MB | 500MB | 50MB | 555MB | 666MB |
| Full | 5MB | 1500MB | 200MB | 1705MB | 2046MB |

Note: These sizes match the actual calculations in `getPackageSizeInBytes()` and the UI display.

## Browser Compatibility

### Supported Browsers:
- ✅ Chrome 52+
- ✅ Firefox 51+
- ✅ Safari 15.2+
- ✅ Edge 79+

### Fallback Behavior:
- Browsers without Storage API: Shows warning, allows download
- Storage check errors: Shows warning, allows download

## Automated Tests

Run the automated tests for storage validation:

```bash
npm test -- tests/offline/download-manager.test.js
```

Tests include:
- ✅ Storage check with sufficient space
- ✅ Storage check with insufficient space
- ✅ Missing Storage API handling
- ✅ Correct package size calculations
- ✅ 20% buffer application
- ✅ Storage estimation errors
- ✅ Download prevention on insufficient storage

## Implementation Details

### Files Modified:
1. **core/public/offline/download-manager.js**
   - Added `checkStorageSpace()` method
   - Added `getPackageSizeInBytes()` method
   - Storage check in `startDownload()`

2. **core/views/offline.ejs**
   - Added storage indicator HTML
   - Added `checkStorageForPackage()` function
   - Updated package selection handler

3. **core/public/css/styles.css**
   - Added `.storage-indicator` styles
   - Added `.storage-bar` and `.storage-fill` styles
   - Added `.storage-warning` styles
   - Added shimmer animation

4. **tests/offline/download-manager.test.js**
   - Added 8 new storage validation tests

## Security Considerations

1. **No User Data Exposure**: Storage API only returns quota/usage, not content
2. **Graceful Failures**: Never blocks downloads completely on API failures
3. **Buffer Margin**: 20% safety margin prevents edge cases
4. **User Control**: Users can still clear cache or choose smaller packages

## Accessibility

- Storage indicator uses color + text for colorblind users
- Progress bar has semantic ARIA labels
- Warning messages are screen-reader friendly
- Keyboard navigation fully supported
