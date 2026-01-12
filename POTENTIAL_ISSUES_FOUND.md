# Potential Issues and Opportunities Found

## Analysis Date
January 11, 2026

## Methodology
- Codebase analysis via grep for TODO/FIXME/HACK comments
- Code review of key files
- Test file examination
- Architecture pattern review

## Issues Found

### 1. Extensive TODO Comments in Offline Mode Implementation

**Severity**: Medium  
**Location**: `core/public/offline/` directory (multiple files)  
**Impact**: Offline mode features are incomplete or using placeholder implementations

**Details**:
- 53 TODO/FIXME comments found across 15 files
- Many critical functions marked as "TODO: Process actual AI generation"
- Placeholder implementations in:
  - `ai-models.js`: "TODO: Use actual model for streaming generation"
  - `local-ai-model.js`: "TODO: Use ONNX Runtime Web for actual model loading"
  - `download-manager.js`: "TODO: Initialize actual IndexedDB storage"
  - `enhanced-wikipedia-search.js`: "TODO: Use actual local LLM to assess relevance"

**Evidence**:
```javascript
// From ai-models.js line 380
// TODO: Use actual model for streaming generation
return await this.streamResponse(prompt, onToken, options);

// From local-ai-model.js line 137
// TODO: Use ONNX Runtime Web for actual model loading

// From download-manager.js line 394
// TODO: Initialize actual IndexedDB storage
```

**Recommendation**: Create issue to audit and complete offline mode implementation

---

### 2. Placeholder Database Implementation Still Present

**Severity**: Low  
**Location**: `core/db.js`  
**Impact**: Legacy placeholder code exists alongside production code

**Details**:
- File contains `PlaceholderDatabase` class with TODO comments
- Lines 3, 84, 92 have "TODO: Implement actual database query"
- This appears to be unused legacy code that should be removed

**Evidence**:
```javascript
// core/db.js line 3
// TODO: Replace with actual database implementation
class PlaceholderDatabase extends DatabaseInterface {
```

**Recommendation**: Remove unused placeholder database class or document why it's kept

---

### 3. Debug Token Generation in Production Code

**Severity**: Low-Medium  
**Location**: `core/routes.js` lines 6-13  
**Impact**: Security concern - random debug tokens generated on startup

**Details**:
- Debug token is randomly generated if not set via environment variable
- Token is logged to console on startup
- Used for debug endpoints like `/api/question` with debug_token query param

**Evidence**:
```javascript
// core/routes.js lines 6-13
const DEBUG_TOKEN = process.env.DEBUG_TOKEN || (() => {
    const token = crypto.randomBytes(32).toString('hex');
    console.log('\\n===========================================')
    console.log('DEBUG TOKEN GENERATED (for development):')
    console.log(`   ${token}`)
    console.log('   Set DEBUG_TOKEN env var to use a custom token')
    console.log('===========================================\\n')
    return token;
})();
```

**Recommendation**: 
- Add warning about debug endpoints in production
- Consider disabling debug endpoints in production mode
- Document security implications

---

### 4. Console.log Debug Statements in Production Code

**Severity**: Low  
**Location**: `core/routes.js` lines 94-96, 119  
**Impact**: Unnecessary logging in production

**Details**:
- Multiple `console.log` statements for debugging config and view rendering
- Should use proper logging library or be removed

**Evidence**:
```javascript
// core/routes.js
console.log(`[DEBUG] Config object:`, config);
console.log(`[DEBUG] config.isLocal:`, config.isLocal);
console.log(`[DEBUG] Rendering view: ${indexFlavor}, isLocal: ${config.isLocal}`);
```

**Recommendation**: Replace with proper logging or remove debug statements

---

### 5. Anti-Demo Validation Test Exists But May Not Be Comprehensive

**Severity**: Info  
**Location**: `tests/unit/anti-demo-validation.test.js`  
**Impact**: Positive - shows awareness of demo code problem

**Details**:
- Test file exists to detect demo/placeholder code
- Checks for TODO comments and mock implementations
- However, many TODOs still exist in offline mode (see Issue #1)

**Recommendation**: 
- Strengthen anti-demo validation tests
- Add offline mode files to validation scope
- Consider failing build if TODOs found in production paths

---

### 6. Third-Party Library Contains Extensive TODOs

**Severity**: Info (Not our code)  
**Location**: `core/public/offline/libs/transformers.js`  
**Impact**: None - this is bundled third-party code

**Details**:
- ONNX Runtime Web library contains many TODO comments
- This is expected for third-party dependencies
- Not an issue to fix

---

## Summary Statistics

- **Total TODO/FIXME comments found**: 53
- **Files affected**: 15
- **Critical issues**: 0
- **Medium severity**: 2
- **Low severity**: 3
- **Info only**: 2

## Next Steps

1. Create issues for each finding above
2. Prioritize offline mode completion (Issue #1)
3. Clean up debug logging
4. Remove unused placeholder code
5. Document security considerations for debug endpoints
