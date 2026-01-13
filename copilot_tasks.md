# Copilot Task Descriptions for Parallel Implementation

## Task 1: Storage Layer Foundation (Issue #162)
**Priority**: HIGH (Required by all other tasks)
**Estimated Time**: 2-3 hours
**Can Start**: Immediately

### Objective
Implement ModelStorage and WikipediaStorage classes for managing Phi-3 models and Wikipedia articles in IndexedDB.

### Files to Create
1. `core/public/offline/storage/model-storage.js`
2. `core/public/offline/storage/wikipedia-storage.js`

### Base Class Available
- `core/public/offline/storage/indexeddb-manager.js` (already implemented)

### Implementation Reference
See `IMPLEMENTATION_GUIDE.md` sections 1 and 2 for complete code structures.

### Requirements

#### ModelStorage Class
Extend IndexedDBManager with:
- Database name: `'phi3-models'`
- Object stores: `'model-files'`, `'model-metadata'`
- Methods:
  - `storeModelFile(modelId, fileName, blob, checksum)`
  - `getModelFile(fileName)`
  - `isModelComplete(modelId, requiredFiles)`
  - `getModelMetadata(modelId)`
  - `updateModelMetadata(modelId, metadata)`
  - `deleteModel(modelId)`
  - `getTotalStorageUsed()`

#### WikipediaStorage Class
Extend IndexedDBManager with:
- Database name: `'wikipedia-offline'`
- Object stores: `'articles'`, `'search-index'`, `'metadata'`
- Methods:
  - `storeArticle(article)`
  - `storeArticlesBatch(articles, onProgress)`
  - `getArticle(articleId)`
  - `getArticleByTitle(title)`
  - `getArticlesByCategory(category)`
  - `storeSearchIndex(indexData)`
  - `getSearchIndex()`
  - `storeMetadata(metadata)`
  - `getMetadata()`
  - `getArticleCount()`
  - `clearAll()`

### Acceptance Criteria
- [ ] Both classes extend IndexedDBManager
- [ ] All methods implemented with proper error handling
- [ ] JSDoc comments for all public methods
- [ ] Export classes to window object
- [ ] Follow code structure from IMPLEMENTATION_GUIDE.md exactly

### Testing
Create simple test in browser console:
```javascript
const modelStorage = new ModelStorage();
await modelStorage.initialize();
await modelStorage.storeModelFile('test', 'test.onnx', new Blob(['test']), 'abc123');
const file = await modelStorage.getModelFile('test.onnx');
console.log('Test passed:', file.size === 4);
```

---

## Task 2: Enhanced Download Manager (Issue #163)
**Priority**: HIGH (Required by integration tasks)
**Estimated Time**: 2-3 hours
**Can Start**: Immediately (independent of Task 1)

### Objective
Implement download manager with progress tracking, checksum validation, and retry logic.

### Files to Create
1. `core/public/offline/download/download-manager-v2.js`

### Implementation Reference
See `IMPLEMENTATION_GUIDE.md` section 3 for complete code structure.

### Requirements

#### DownloadManagerV2 Class
Implement with:
- Constructor: Initialize with retry settings
- Methods:
  - `downloadFile(url, fileName, options)` - Single file with progress
  - `_downloadWithProgress(url, fileName, onProgress)` - Internal helper
  - `downloadMultiple(files, onProgress)` - Multiple files with overall progress
  - `validateChecksum(blob, expectedChecksum)` - SHA-256 validation
  - `calculateChecksum(blob)` - Calculate SHA-256
  - `delay(ms)` - Helper for retry delays
  - `cancelDownload(fileName)` - Cancel in-progress download

#### Features
- Progress callbacks with `{ fileName, loaded, total, percentage }`
- Retry with exponential backoff (default 3 attempts)
- SHA-256 checksum validation using Web Crypto API
- Proper error messages
- Support for large files (streaming)

### Acceptance Criteria
- [ ] Single file download works with progress
- [ ] Multiple file downloads work with overall progress
- [ ] Checksum validation using SHA-256
- [ ] Retry logic with exponential backoff
- [ ] Proper error handling and messages
- [ ] JSDoc comments for all methods

### Testing
```javascript
const dm = new DownloadManagerV2();
await dm.downloadFile(
  'https://example.com/test.txt',
  'test.txt',
  {
    onProgress: (p) => console.log(`${p.percentage.toFixed(1)}%`),
    expectedChecksum: 'abc123...'
  }
);
```

---

## Task 3: Lunr.js Search Integration (Issue #165)
**Priority**: MEDIUM (Can start immediately, needs storage layer for testing)
**Estimated Time**: 3-4 hours
**Can Start**: Immediately (parallel with Task 1 & 2)

### Objective
Implement full-text search for Wikipedia articles using Lunr.js.

### Files to Create
1. `core/public/offline/search/lunr-search.js`

### Dependencies
- Lunr.js library (will be loaded via CDN)

### Implementation Reference
See `IMPLEMENTATION_GUIDE.md` section 4 for complete code structure.

### Requirements

#### LunrSearch Class
Implement with:
- Constructor: Initialize empty index
- Methods:
  - `buildIndex(articles)` - Build search index from articles
  - `loadIndex(indexData)` - Load serialized index
  - `search(query, options)` - Search with results
  - `getHighlightedSnippet(matchData, content, contextLength)` - Extract snippets
  - `clear()` - Clear index and articles

#### Search Features
- Index fields: title (boost 10), summary (boost 5), content
- Return results with score and match data
- Support result limiting
- Optional content inclusion
- Highlighted snippets with `<mark>` tags

### Acceptance Criteria
- [ ] Build index from article array
- [ ] Serialize and load index
- [ ] Search returns ranked results
- [ ] Highlighted snippets work
- [ ] Proper error handling
- [ ] JSDoc comments

### Testing
```javascript
const search = new LunrSearch();
const articles = [
  { id: '1', title: 'Test', summary: 'Summary', content: 'Content' }
];
const indexData = search.buildIndex(articles);
const results = search.search('test');
console.log('Found:', results.length);
```

---

## Task 4: Wikipedia Article Extraction Pipeline (Issue #166)
**Priority**: LOW (Can be done independently, needed for final testing)
**Estimated Time**: 4-5 hours
**Can Start**: Immediately (completely independent)

### Objective
Create Python pipeline to extract and package Wikipedia articles for offline use.

### Files to Create
1. `scripts/wikipedia/extract_articles.py` - Main extraction script
2. `scripts/wikipedia/select_articles.py` - Article selection logic
3. `scripts/wikipedia/build_packages.py` - Package builder
4. `scripts/wikipedia/README.md` - Usage documentation

### Requirements

#### Article Selection
- Download Wikipedia page view statistics
- Download featured/good article lists
- Download vital articles list
- Rank by: views × quality score × recency
- Select top N for each package size

#### Package Sizes
- Minimal (20MB): 2,000-3,000 articles
- Standard (50MB): 5,000-7,000 articles
- Extended (200MB): 20,000-30,000 articles

#### Extraction Process
1. Download Wikipedia XML dumps
2. Parse with `mwparserfromhell`
3. Extract title, content, categories
4. Clean HTML, convert to plain text
5. Generate summary (first paragraph)
6. Store in JSON structure

#### Output Format
```json
{
  "metadata": {
    "version": "1.0",
    "package": "standard",
    "articleCount": 5000,
    "created": "2024-01-01"
  },
  "articles": {
    "article_id": {
      "id": "article_id",
      "title": "Title",
      "summary": "Summary",
      "content": "Content",
      "url": "https://...",
      "categories": [],
      "lastModified": "2024-01-01"
    }
  }
}
```

#### Build Search Index
- Use Node.js to run Lunr.js
- Build index from articles
- Serialize to JSON
- Include in package

#### Compression & Checksums
- Compress JSON with gzip
- Calculate SHA-256 checksums
- Generate manifest file

### Acceptance Criteria
- [ ] Downloads Wikipedia dumps
- [ ] Extracts articles correctly
- [ ] Selects articles by criteria
- [ ] Generates all three package sizes
- [ ] Builds Lunr.js indexes
- [ ] Compresses and checksums
- [ ] Documentation for running

### Dependencies
```bash
pip install mwparserfromhell mwxml requests beautifulsoup4
npm install lunr
```

---

## Parallel Execution Strategy

### Phase 1 (Start Immediately)
- **Copilot Instance A**: Task 1 (Storage Layer) - 2-3 hours
- **Copilot Instance B**: Task 2 (Download Manager) - 2-3 hours
- **Copilot Instance C**: Task 3 (Lunr Search) - 3-4 hours
- **Copilot Instance D**: Task 4 (Article Pipeline) - 4-5 hours

### Phase 2 (After Task 1 & 2 Complete)
- **Copilot Instance A**: Task 5 (Phi-3 Integration) - 3-4 hours
- **Copilot Instance B**: Task 6 (Wikipedia Integration) - 2-3 hours

### Phase 3 (Integration & Testing)
- Combine all components
- End-to-end testing
- Bug fixes
- Performance optimization

## Time Savings

**Sequential**: 15-20 hours
**Parallel (4 instances)**: 4-5 hours (Phase 1) + 3-4 hours (Phase 2) + 2 hours (Phase 3) = **9-11 hours**

## Notes for Copilot

- All code structures are in `IMPLEMENTATION_GUIDE.md`
- Follow the structures EXACTLY as documented
- Include JSDoc comments
- Export classes to window object
- Use proper error handling
- Test each component independently
- No fake/demo code allowed (will fail anti-demo validation)
