# Implementation Guide: Issue #146 - Browser-based Offline Wikipedia Search

## Overview
Implement offline Wikipedia search functionality using sql.js (SQLite in WebAssembly) and Lunr.js for full-text search.

## Files to Modify

### 1. `core/public/offline/wikipedia-manager.js`
Current state: Has placeholder structure for Wikipedia management.

**Required Changes:**
- Implement database loading from IndexedDB
- Add sql.js integration for SQLite queries
- Implement Lunr.js search index
- Add article retrieval and display

```javascript
class WikipediaManager {
  async loadDatabase() {
    // 1. Check if database exists in IndexedDB
    // 2. If not, download compressed database
    // 3. Decompress and load into sql.js
    // 4. Build Lunr.js search index
    // 5. Set this.databaseLoaded = true
  }
  
  async search(query) {
    // 1. Use Lunr.js for full-text search
    // 2. Return ranked results with titles and snippets
  }
  
  async getArticle(articleId) {
    // 1. Query SQLite for full article content
    // 2. Parse and format content for display
  }
}
```

### 2. `core/public/offline/libs/` (new files)
**Add:**
- `sql.js` - SQLite WebAssembly library
- `lunr.min.js` - Full-text search library

### 3. `core/public/offline/integration-manager.js`
**Required Changes:**
- Connect WikipediaManager to search UI
- Handle database loading states
- Route search queries to Wikipedia manager

### 4. `core/views/offline.ejs`
**Required Changes:**
- Add Wikipedia search input field
- Add search results display area
- Add article viewer modal/section
- Show database loading progress
- Display database status (loading/ready/error)

## Technical Approach

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

### sql.js Setup
```javascript
import initSqlJs from 'sql.js';

const SQL = await initSqlJs({
  locateFile: file => `/offline/libs/${file}`
});

// Load database from ArrayBuffer
const db = new SQL.Database(new Uint8Array(dbBuffer));
```

### Lunr.js Search Index
```javascript
import lunr from 'lunr';

const idx = lunr(function() {
  this.ref('id');
  this.field('title', { boost: 10 });
  this.field('summary', { boost: 5 });
  this.field('content');
  
  articles.forEach(doc => this.add(doc));
});

// Search
const results = idx.search(query);
```

### Data Preparation
For the MVP, create a small Wikipedia subset:
1. Download Simple English Wikipedia dump
2. Extract ~1000 most important articles
3. Create SQLite database with articles
4. Compress with gzip (~5-10MB)
5. Host on CDN

### Storage Strategy
- Store compressed database in IndexedDB
- Decompress on load using browser's DecompressionStream
- Cache decompressed database in memory during session

## Testing Requirements

Add tests in `tests/offline-wikipedia.test.js`:
- Database loading success/failure
- Search returns relevant results
- Article retrieval works correctly
- Error handling for missing database

## Acceptance Criteria
- [ ] User can load Wikipedia database in browser
- [ ] User can search Wikipedia articles offline
- [ ] Search results are relevant and ranked properly
- [ ] User can view full article content
- [ ] Database is cached for subsequent visits
- [ ] Search performance < 1s per query
- [ ] Database loading shows progress indicator
- [ ] Works completely offline

## Resources
- sql.js: https://github.com/sql-js/sql.js
- Lunr.js: https://lunrjs.com/
- Wikipedia dumps: https://dumps.wikimedia.org/simplewiki/
