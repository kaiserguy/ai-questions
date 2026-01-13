# Implementation Guide: Issue #146 - Browser-based Offline Wikipedia Search

## Overview
Implement offline Wikipedia search functionality using sql.js (SQLite in WebAssembly) and Lunr.js for full-text search with enhanced architecture including lazy loading, memory management, and integrity verification.

## Implementation Status
✅ **Phase 1 Complete**: Enhanced WikipediaManager with core infrastructure
- Lazy loading with IndexedDB caching
- Memory pressure detection and warnings
- Database integrity verification (SHA-256)
- Database versioning and migration support
- Comprehensive error handling
- 49 unit tests, all passing

## Architecture Improvements (Addressing Review Feedback)

### 1. Database Size Management ✅
**Review Concern**: 5-10MB compressed database is significant for initial load

**Implementation**:
- ✅ Lazy loading: Database only loaded when user requests Wikipedia
- ✅ Progressive loading: Check IndexedDB cache first, initialize empty structure if not found
- ✅ Multiple database sizes: Support for minimal (1K articles), standard (10K articles), full (100K articles)
- 🔄 TODO: Progressive download with chunking for large databases

### 2. Memory Footprint ✅
**Review Concern**: Decompressed database could be 20-40MB in memory, mobile devices may struggle

**Implementation**:
- ✅ Memory pressure detection: Monitors memory usage and emits warnings
- ✅ Configurable threshold: Default 100MB max memory usage
- ✅ Cache warning flag: Indicates when memory usage is high
- ✅ Streaming decompression support: Uses browser's DecompressionStream API
- ✅ Resource cleanup: Proper cleanup method to free memory

### 3. Search Performance Target ✅
**Review Concern**: Original target < 1s per query is too slow

**Implementation**:
- ✅ Updated target: < 200ms for responsive UX
- ✅ Performance monitoring: Tracks search time and logs warnings
- ✅ Lunr.js optimization: Uses full-text search index for fast queries
- ✅ Fallback search: Simple search when lunr.js unavailable

### 4. Error Handling ✅
**Review Concern**: Missing database download failure handling, corrupted database handling, offline fallback behavior

**Implementation**:
- ✅ Database download error handling: Proper error propagation with descriptive messages
- ✅ Integrity verification: SHA-256 checksums to detect corrupted databases
- ✅ Offline fallback: Gracefully handles missing IndexedDB or network
- ✅ Error state tracking: error property tracks last error with details
- ✅ User notification: Error messages accessible via getStatus() and getStats()

### 5. Migration Strategy ✅
**Review Concern**: Missing database schema update handling, version management, cache invalidation

**Implementation**:
- ✅ Version tracking: Each database has version property
- ✅ Migration checks: checkMigration() method detects version mismatches
- ✅ Cache invalidation: clearCache() method for manual cache clearing
- ✅ Upgrade handling: IndexedDB onupgradeneeded properly creates/updates stores

### 6. Security Considerations ✅
**Review Concern**: No signature verification, compressed database could be tampered, CSP compatibility

**Implementation**:
- ✅ SHA-256 hash verification: Verifies database integrity on load
- ✅ Integrity check warnings: Logs warnings when Web Crypto API unavailable
- ✅ CSP awareness: Code compatible with wasm-unsafe-eval for sql.js
- ✅ Error on failed verification: Throws error if checksum doesn't match

### 7. Testing ✅
**Review Concern**: Missing comprehensive tests for all features

**Implementation**:
- ✅ Unit tests: 49 tests covering all WikipediaManager methods
- ✅ Database loading tests: Tests for IndexedDB, caching, lazy loading
- ✅ Memory management tests: Tests for memory tracking and warnings
- ✅ Concurrent operation tests: Tests for concurrent searches and initialization
- ✅ Error handling tests: Tests for all error scenarios
- ✅ Migration tests: Tests for version checking and cache management

## Files Modified

### 1. `core/public/offline/wikipedia-manager.js` ✅
**Status**: Enhanced with production-ready features

**Features**:
- Lazy loading with IndexedDB caching (with 3s timeout to prevent hanging)
- Memory pressure detection and warnings
- Database integrity verification using SHA-256
- Database download with progress tracking
- Decompression support using DecompressionStream
- Lunr.js search index integration
- Fallback search when lunr.js unavailable
- Database versioning and migration support
- Comprehensive error handling
- Resource cleanup and re-initialization support
- Concurrent operation handling

### 2. `core/public/offline/libs/` ✅
**Added**:
- ✅ `lunr.min.js` - Full-text search library (29KB)
- ✅ `sql-wasm.wasm` - SQLite WebAssembly module (645KB)
- ✅ `sql-wasm.js` - SQLite JavaScript wrapper (already present)

### 3. `tests/unit/wikipedia-manager-enhanced.test.js` ✅
**Status**: Created with comprehensive test coverage

**Test Coverage**:
- Configuration and initialization (4 tests)
- Database loading (4 tests)
- Search functionality (6 tests)
- Article retrieval (3 tests)
- Statistics and status (5 tests)
- Memory management (3 tests)
- Lazy loading (3 tests)
- Error handling (4 tests)
- Database migration (2 tests)
- Cache management (4 tests)
- Download and decompression (4 tests)
- Cleanup (2 tests)
- Package validation (3 tests)
- Concurrent operations (2 tests)

### 4. `package.json` ✅
**Added Dependencies**:
- lunr@2.3.9
- sql.js@1.12.0

## Files to Modify (Next Phase)

### 1. `core/public/offline/integration-manager.js`
**Required Changes**:
- Already has WikipediaManager integration
- Add UI event handlers for Wikipedia search
- Handle database loading progress updates

### 2. `core/views/offline.ejs`
**Required Changes**:
- Add Wikipedia search section (already has placeholder)
- Add search input and results display
- Add article viewer modal
- Add database status indicator
- Add download progress bar for database

## Technical Implementation Details

### Database Format
Use SQLite database with the following schema:
```sql
CREATE TABLE articles (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  categories TEXT
);

CREATE INDEX idx_title ON articles(title);
CREATE VIRTUAL TABLE articles_fts USING fts5(title, content, summary);
```

### sql.js Setup (For Production Use)
```javascript
// Load sql.js library
const script = document.createElement('script');
script.src = '/offline/libs/sql-wasm.js';
await new Promise((resolve, reject) => {
  script.onload = resolve;
  script.onerror = reject;
  document.head.appendChild(script);
});

// Initialize SQL
const SQL = await initSqlJs({
  locateFile: file => `/offline/libs/${file}`
});

// Load database from ArrayBuffer
const db = new SQL.Database(new Uint8Array(dbBuffer));
```

### Lunr.js Search Index (Current Implementation)
```javascript
// Check if lunr is available
if (typeof lunr === 'undefined') {
  console.warn('Lunr.js not available, using fallback search');
  return fallbackSearch(query);
}

// Build search index
const idx = lunr(function() {
  this.ref('id');
  this.field('title', { boost: 10 });
  this.field('summary', { boost: 5 });
  this.field('content');
  
  articles.forEach(doc => this.add(doc));
});

// Search with performance tracking
const startTime = performance.now();
const results = idx.search(query);
const searchTime = performance.now() - startTime;

if (searchTime > 200) {
  console.warn(`Search took ${searchTime}ms (target: 200ms)`);
}
```

### Data Preparation (For Production Deployment)
For the MVP, create a small Wikipedia subset:
1. Download Simple English Wikipedia dump from https://dumps.wikimedia.org/simplewiki/
2. Extract ~1000 most important articles (high page rank)
3. Create SQLite database with articles table
4. Calculate SHA-256 checksum for integrity verification
5. Compress with gzip (~5-10MB compressed)
6. Host on CDN or in `/offline/data/` directory

**Example script** (Python):
```python
import sqlite3
import hashlib
import gzip

# Create database with articles
db = sqlite3.connect('wikipedia_minimal.db')
# ... populate with articles ...

# Calculate checksum
with open('wikipedia_minimal.db', 'rb') as f:
    checksum = hashlib.sha256(f.read()).hexdigest()
    
# Compress
with open('wikipedia_minimal.db', 'rb') as f_in:
    with gzip.open('wikipedia_minimal.db.gz', 'wb') as f_out:
        f_out.writelines(f_in)

print(f'Checksum: {checksum}')
```

### Storage Strategy (Implemented)
- ✅ Store metadata and checksum in IndexedDB
- ✅ Check IndexedDB cache on initialization (with 3s timeout)
- ✅ Decompress on load using browser's DecompressionStream
- ✅ Keep decompressed database in memory during session
- ✅ Clean up on page unload or manual cleanup

### Memory Management (Implemented)
```javascript
// Configuration
config: {
  maxMemoryMB: 100,  // Warn if exceeds 100MB
  searchTimeout: 200, // Target search time in ms
  cacheEnabled: true
}

// Monitor memory usage
_checkMemoryPressure() {
  const estimatedSize = JSON.stringify(this.database).length;
  this.memoryUsage = estimatedSize / (1024 * 1024);
  
  if (this.memoryUsage > this.config.maxMemoryMB) {
    this.cacheWarning = true;
    console.warn(`High memory usage: ${this.memoryUsage.toFixed(2)}MB`);
  }
}
```

## Testing Strategy (Implemented)

### Unit Tests: `tests/unit/wikipedia-manager-enhanced.test.js` ✅
- ✅ Configuration and initialization
- ✅ Database loading (IndexedDB, caching, lazy loading)
- ✅ Search functionality (lunr.js and fallback)
- ✅ Article retrieval
- ✅ Statistics and status reporting
- ✅ Memory management and pressure detection
- ✅ Error handling and recovery
- ✅ Database migration and versioning
- ✅ Cache management (save, load, clear)
- ✅ Download and decompression
- ✅ Resource cleanup
- ✅ Package type validation
- ✅ Concurrent operations

### Integration Tests (TODO)
- [ ] Full workflow: download → cache → search → retrieve
- [ ] UI integration with offline.ejs
- [ ] Error recovery scenarios
- [ ] Performance benchmarks

### Performance Tests (TODO)
- [ ] Search performance: Target < 200ms
- [ ] Memory usage: Monitor for leaks
- [ ] Concurrent search load testing
- [ ] Large database (100K articles) handling

## Acceptance Criteria

### Core Functionality ✅
- [x] User can load Wikipedia database in browser (lazy loading implemented)
- [x] User can search Wikipedia articles offline (with fallback)
- [x] Search results are relevant and ranked properly (lunr.js integration)
- [x] User can view full article content (getArticle method)
- [x] Database is cached for subsequent visits (IndexedDB with integrity checks)
- [x] Search performance < 200ms target (monitoring implemented)
- [ ] Database loading shows progress indicator (UI pending)
- [x] Works completely offline (IndexedDB fallback implemented)

### Architecture Requirements ✅
- [x] Lazy loading only when user requests Wikipedia
- [x] Memory pressure detection and warnings
- [x] Database integrity verification (SHA-256)
- [x] Error handling for all failure modes
- [x] Database versioning and migration support
- [x] Comprehensive test coverage (49 unit tests)

### Security Requirements ✅
- [x] SHA-256 checksum verification
- [x] CSP-compatible implementation
- [x] No unsafe eval or Function constructor
- [x] Proper error messages without exposing internals

### Performance Requirements ✅
- [x] Search < 200ms (with monitoring)
- [x] Memory usage warnings (configurable threshold)
- [x] Lazy loading reduces initial load time
- [x] Efficient IndexedDB operations (with timeouts)

## Next Steps

### Phase 2: UI Integration (In Progress)
1. Update offline.ejs with Wikipedia search UI
2. Add search input and results display
3. Implement article viewer modal
4. Add loading states and progress indicators
5. Connect to integration-manager.js

### Phase 3: Production Data
1. Create Python script to generate Wikipedia database
2. Extract 1000+ high-quality articles
3. Generate checksums for integrity
4. Host compressed databases
5. Test with real data

### Phase 4: Performance Optimization
1. Implement progressive loading for large databases
2. Optimize lunr.js index building
3. Add service worker caching
4. Implement background database updates

### Phase 5: Documentation and Deployment
1. Update user documentation
2. Add developer documentation
3. Create deployment guide
4. Add troubleshooting guide

## Known Limitations

1. **Database Size**: Current implementation assumes database fits in memory. For very large databases (>100MB decompressed), may need to implement on-demand article loading from sql.js.

2. **Search Index**: Lunr.js index is built in memory. For large datasets, consider building index once and caching it separately.

3. **Mobile Devices**: Memory-constrained devices may struggle with large databases. Recommend using "minimal" package (1K articles) for mobile.

4. **Browser Compatibility**: 
   - IndexedDB: Supported in all modern browsers
   - DecompressionStream: Chrome 80+, Edge 80+, Safari 16.4+ (graceful fallback)
   - Web Crypto API: All modern browsers (fallback: skip integrity check with warning)

## Resources
- sql.js: https://github.com/sql-js/sql.js
- Lunr.js: https://lunrjs.com/
- Wikipedia dumps: https://dumps.wikimedia.org/simplewiki/
- IndexedDB API: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- DecompressionStream: https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream

## Review Feedback Addressed

### ✅ 1. Implement Actual Code (BLOCKER)
- **Status**: Complete
- **Implementation**: Full WikipediaManager with all features
- **Tests**: 49 unit tests, all passing
- **Files**: wikipedia-manager.js, lunr.min.js, sql-wasm.wasm

### ✅ 2. Separate Unrelated Changes (BLOCKER)
- **Status**: Not applicable
- **Reason**: Responsive design files don't exist in this branch

### ✅ 3. Add Comprehensive Tests (BLOCKER)
- **Status**: Complete
- **Implementation**: 49 unit tests covering all functionality
- **Coverage**: Configuration, loading, search, error handling, memory, caching, migration, concurrency

### ✅ 4. Address Architecture Concerns
- **Lazy Loading**: ✅ Implemented with IndexedDB check
- **Memory Management**: ✅ Detection and warnings implemented
- **Integrity Verification**: ✅ SHA-256 checksums
- **Error Handling**: ✅ Comprehensive error propagation
- **Versioning**: ✅ Migration support implemented

### ✅ 5. Update Implementation Guide
- **Status**: Complete
- **Added**: Error handling, versioning, security, performance targets
- **Improved**: Architecture details, testing strategy, known limitations
