# Service Worker Security & Best Practices

This document outlines the security considerations and best practices implemented in the AI Questions service worker caching strategy.

## Security Features Implemented

### 1. HTTPS Enforcement
- **Implementation**: The service worker checks for secure context on load
- **Code**: `isSecureContext` check in service-worker.template.js
- **Protection**: Ensures service worker only operates over HTTPS (or localhost for development)
- **Why**: Service workers have powerful capabilities and must only run in secure contexts to prevent man-in-the-middle attacks

### 2. Same-Origin Policy
- **Implementation**: All fetch requests are validated against `self.location.origin`
- **Code**: `if (!event.request.url.startsWith(self.location.origin)) return;`
- **Protection**: Prevents caching of cross-origin resources
- **Why**: Prevents potential XSS attacks from cached external content

### 3. Method Validation
- **Implementation**: Only GET requests are cached
- **Code**: `if (event.request.method !== 'GET') return;`
- **Protection**: Prevents caching of POST/PUT/DELETE requests
- **Why**: These methods often contain sensitive data or perform state-changing operations

### 4. Credential Detection in URLs
- **Implementation**: Checks URL parameters for common credential field names
- **Code**: Scans for `token`, `key`, `password` in URL parameters
- **Protection**: Prevents caching requests with credentials in the URL
- **Why**: Credentials in URLs can be exposed through cache inspection

### 5. Response Type Validation
- **Implementation**: Only caches `basic` type responses (same-origin)
- **Code**: `response.type !== 'basic'` check
- **Protection**: Ensures only same-origin responses are cached
- **Why**: Prevents caching opaque responses that could contain sensitive data

### 6. Response Status Validation
- **Implementation**: Only caches successful responses (status 200)
- **Code**: `response.status !== 200` check
- **Protection**: Prevents caching error responses
- **Why**: Error pages should not be cached as they may be temporary

### 7. Content-Type Validation
- **Implementation**: Validates content-type before caching
- **Allowed types**: text/, application/javascript, application/json, image/, font/
- **Protection**: Prevents caching unexpected content types
- **Why**: Reduces risk of caching malicious content

### 8. Message Handler Security
- **Implementation**: Validates message structure and source
- **Code**: Type checking and port existence validation
- **Protection**: Prevents processing of malformed messages
- **Why**: Protects against malicious postMessage attacks

### 9. Error Response Status Codes
- **Implementation**: Uses appropriate HTTP status codes
- **503**: Service Unavailable (for offline API responses)
- **408**: Request Timeout (for network errors)
- **Why**: Proper status codes help clients handle errors correctly

## Edge Cases Handled

### 1. Missing Git Installation
- **Scenario**: Build script runs in environment without git
- **Handling**: Falls back to timestamp-only versioning
- **Code**: Try-catch around git commands with fallback
- **Test**: Verified in build-service-worker-security.test.js

### 2. Git Command Failures
- **Scenario**: Git command fails (not a repo, shallow clone, etc.)
- **Handling**: Graceful degradation to timestamp versioning
- **Code**: stderr suppression with `stdio: ['pipe', 'pipe', 'pipe']`

### 3. File Permission Errors (EACCES)
- **Scenario**: Script lacks permission to read/write files
- **Handling**: Clear error message with actionable guidance
- **Code**: Catches EACCES and provides helpful message

### 4. Disk Space Errors (ENOSPC)
- **Scenario**: No space left on device during build
- **Handling**: Specific error message for disk space issues
- **Code**: Catches ENOSPC separately from other errors

### 5. Missing Template File
- **Scenario**: Template doesn't exist but service-worker.js does
- **Handling**: Auto-generates template from existing file
- **Code**: Falls back to creating template from output

### 6. Network Failures
- **Scenario**: Network request fails during fetch
- **Handling**: Falls back to cached version or returns offline response
- **Code**: Comprehensive catch blocks with fallbacks

### 7. Missing MessageChannel Ports
- **Scenario**: Message handler called without response port
- **Handling**: Checks for port existence before responding
- **Code**: `if (event.ports && event.ports[0])` guard

### 8. Cache Operation Failures
- **Scenario**: Cache API operations fail
- **Handling**: Error logging and graceful degradation
- **Code**: Error handlers on all cache operations

## Cache Invalidation Strategy

### Automatic Version-Based Invalidation
1. **On Each Build**: New cache name generated with git hash + timestamp
2. **On Service Worker Activation**: Old caches automatically deleted
3. **Cache Name Format**: `ai-questions-cache-{gitHash}-{timestamp}`

### Benefits
- **No Manual Intervention**: Users automatically get fresh content
- **No Stale Content**: Old caches are cleaned up immediately
- **Rollback Safe**: Each deployment has unique cache version

### Implementation Details
```javascript
// On activate, delete old caches
cacheNames.filter(cacheName => {
  return cacheName.startsWith('ai-questions-cache-') && cacheName !== CACHE_NAME;
}).map(cacheName => caches.delete(cacheName))
```

## Caching Strategies by Resource Type

### 1. Navigation Requests (HTML Pages)
- **Strategy**: Network-first with cache fallback
- **Why**: Always try to serve fresh content
- **Fallback**: Cached version if offline
- **Best Practice**: ✅ Users see up-to-date content when online

### 2. API Requests
- **Strategy**: Network-first with cache fallback
- **Why**: Data freshness is critical
- **Fallback**: Cached response with 503 status if offline
- **Best Practice**: ✅ Clear offline status communicated

### 3. Static Assets (CSS, JS, Images)
- **Strategy**: Cache-first with background refresh
- **Why**: Fast page loads, background updates ensure freshness
- **Implementation**: Return cached immediately, fetch fresh in background
- **Best Practice**: ✅ Performance + freshness

## Service Worker Lifecycle Best Practices

### 1. Immediate Activation (skipWaiting)
- **Implementation**: `self.skipWaiting()` on install
- **Why**: New service worker activates immediately without waiting
- **Consideration**: Can cause race conditions if not handled properly
- **Mitigation**: Combined with clients.claim() and update notifications

### 2. Immediate Control (clients.claim)
- **Implementation**: `self.clients.claim()` on activate
- **Why**: New service worker takes control of all clients immediately
- **Best Practice**: ✅ Ensures all tabs use the same cache version

### 3. Update Notifications
- **Implementation**: Update detection in main.js
- **Why**: Users are notified when new version is available
- **User Experience**: Non-intrusive notification with manual refresh option
- **Best Practice**: ✅ User-controlled updates prevent disruption

### 4. Periodic Update Checks
- **Implementation**: `registration.update()` every 5 minutes
- **Why**: Detects updates even on long-running tabs
- **Best Practice**: ✅ Keeps application up-to-date

### 5. Controlled Reload on Activation
- **Implementation**: `controllerchange` event listener
- **Why**: Ensures page state matches service worker state
- **Best Practice**: ✅ Prevents inconsistencies

## Testing Coverage

### Unit Tests (39 total)
- 12 basic functionality tests (build-service-worker.test.js)
- 27 security and edge case tests (build-service-worker-security.test.js)

### Test Categories
1. **Security Features** (10 tests)
   - HTTPS enforcement
   - Response validation
   - Content-type checking
   - Credential detection

2. **Edge Case Handling** (7 tests)
   - Missing git
   - Permission errors
   - Disk space errors
   - Network failures

3. **Cache Invalidation** (3 tests)
   - Old cache deletion
   - Version filtering
   - Cleanup logic

4. **Service Worker Lifecycle** (3 tests)
   - skipWaiting behavior
   - clients.claim timing
   - event.waitUntil usage

5. **Caching Strategies** (4 tests)
   - Network-first for navigation
   - Network-first for APIs
   - Cache-first for assets
   - Background refresh

## Potential Risks & Mitigations

### Risk 1: skipWaiting Race Conditions
- **Risk**: New service worker activates while old one is handling requests
- **Mitigation**: Update notification allows users to control when to activate
- **Severity**: Low - unlikely to cause issues with our simple caching strategy

### Risk 2: Cache Storage Quota
- **Risk**: Service worker cache could exceed storage quota
- **Mitigation**: 
  - Only cache specific resources (PRECACHE_RESOURCES)
  - Old caches are deleted on each activation
  - Content-type validation limits what gets cached
- **Severity**: Low - our cache is relatively small

### Risk 3: Stale Content in Cache-First Assets
- **Risk**: Users might see old CSS/JS briefly
- **Mitigation**: Background refresh updates cache after serving
- **Severity**: Low - fixed on next page load or refresh

### Risk 4: Offline API Responses Treated as Valid
- **Risk**: Application might treat cached API responses as current
- **Mitigation**: 
  - Offline API responses include `offline: true` flag
  - 503 status code indicates service unavailable
- **Severity**: Low - application can detect offline state

## Recommendations for Future Improvements

### 1. Cache Size Monitoring
- Implement cache size tracking
- Add limits and cleanup strategies
- Alert if approaching quota

### 2. Selective Precaching
- Make PRECACHE_RESOURCES configurable
- Allow dynamic precache based on user preferences
- Implement cache priorities

### 3. Stale-While-Revalidate
- Consider stale-while-revalidate for API requests
- Would improve perceived performance
- Requires careful handling of data consistency

### 4. Background Sync
- Implement background sync for failed requests
- Queue mutations when offline
- Replay when online

### 5. Push Notifications for Updates
- Notify users of important updates
- Reduce reliance on periodic checks
- Improve user experience

### 6. Cache Versioning API
- Expose cache version to application code
- Allow application to detect version mismatches
- Enable more sophisticated update strategies

## Conclusion

The implemented service worker strategy balances security, performance, and reliability. Key strengths:

✅ **Security First**: Multiple layers of validation and protection
✅ **Graceful Degradation**: Handles edge cases without breaking
✅ **Automatic Updates**: No manual cache management required
✅ **User Control**: Users can choose when to update
✅ **Comprehensive Testing**: 39 tests covering all critical paths

The strategy is production-ready and follows industry best practices for Progressive Web App service worker implementation.
