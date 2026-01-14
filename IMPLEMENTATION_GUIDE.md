# Phase 2 Implementation Guide

## Overview

This document provides complete code structures and implementation details for Phase 2: Model Loading and Storage.

## Architecture Overview

```
core/public/offline/
├── storage/
│   ├── indexeddb-manager.js      ✅ DONE - Base IndexedDB wrapper
│   ├── model-storage.js          📝 TODO - Phi-3 model storage
│   └── wikipedia-storage.js      📝 TODO - Wikipedia database storage
├── download/
│   └── download-manager-v2.js    📝 TODO - Enhanced download manager
├── search/
│   └── lunr-search.js            📝 TODO - Lunr.js search integration
├── local-ai-model.js             🔧 MODIFY - Integrate model storage
├── wikipedia-manager.js          🔧 MODIFY - Integrate wiki storage
└── ai-model-manager.js           🔧 MODIFY - Use new storage layer
```

## Sub-PRs Breakdown

### PR 1: Storage Layer Foundation (Issues #156, #158 - Part 1)
**Files**: `indexeddb-manager.js`, `model-storage.js`, `wikipedia-storage.js`
**Goal**: Complete storage infrastructure
**Estimated Time**: 2-3 hours

### PR 2: Download Manager (Issues #156, #158 - Part 2)
**Files**: `download-manager-v2.js`
**Goal**: Download with progress tracking and validation
**Estimated Time**: 2-3 hours

### PR 3: Phi-3 Model Integration (Issue #156 - Part 3)
**Files**: `local-ai-model.js`, dependencies
**Goal**: Load Phi-3 from storage with ONNX Runtime Web
**Estimated Time**: 3-4 hours

### PR 4: Wikipedia Database & Search (Issue #159, #160)
**Files**: `wikipedia-storage.js`, `lunr-search.js`, `wikipedia-manager.js`
**Goal**: Wikipedia database loading and search
**Estimated Time**: 3-4 hours

### PR 5: Article Extraction Pipeline (Issue #159 - Part 2)
**Files**: Python scripts, data processing
**Goal**: Extract and package Wikipedia articles
**Estimated Time**: 4-5 hours

---

## Detailed Code Structures

### 1. model-storage.js

```javascript
/**
 * Model Storage Manager
 * Handles Phi-3 ONNX model storage in IndexedDB
 */
class ModelStorage extends IndexedDBManager {
    constructor() {
        super('phi3-models', 1);
        this.schema = {
            'model-files': {
                keyPath: 'name',
                indexes: {
                    'modelId': { keyPath: 'modelId' },
                    'downloadedAt': { keyPath: 'downloadedAt' }
                }
            },
            'model-metadata': {
                keyPath: 'id'
            }
        };
    }

    async initialize() {
        await this.open(this.schema);
    }

    /**
     * Store model file
     * @param {string} modelId - Model identifier
     * @param {string} fileName - File name
     * @param {Blob} blob - File data
     * @param {string} checksum - SHA-256 checksum
     */
    async storeModelFile(modelId, fileName, blob, checksum) {
        const fileData = {
            name: fileName,
            modelId: modelId,
            blob: blob,
            size: blob.size,
            checksum: checksum,
            downloadedAt: new Date().toISOString()
        };
        
        await this.put('model-files', fileData);
    }

    /**
     * Get model file
     * @param {string} fileName
     * @returns {Promise<Blob>}
     */
    async getModelFile(fileName) {
        const fileData = await this.get('model-files', fileName);
        if (!fileData) {
            throw new Error(`Model file not found: ${fileName}`);
        }
        return fileData.blob;
    }

    /**
     * Check if model is fully downloaded
     * @param {string} modelId
     * @param {Array<string>} requiredFiles
     * @returns {Promise<boolean>}
     */
    async isModelComplete(modelId, requiredFiles) {
        const files = await this.queryByIndex('model-files', 'modelId', modelId);
        const fileNames = files.map(f => f.name);
        return requiredFiles.every(rf => fileNames.includes(rf));
    }

    /**
     * Get model metadata
     * @param {string} modelId
     * @returns {Promise<Object>}
     */
    async getModelMetadata(modelId) {
        return await this.get('model-metadata', modelId);
    }

    /**
     * Update model metadata
     * @param {string} modelId
     * @param {Object} metadata
     */
    async updateModelMetadata(modelId, metadata) {
        const existing = await this.getModelMetadata(modelId) || { id: modelId };
        const updated = { ...existing, ...metadata, updatedAt: new Date().toISOString() };
        await this.put('model-metadata', updated);
    }

    /**
     * Delete model and all its files
     * @param {string} modelId
     */
    async deleteModel(modelId) {
        const files = await this.queryByIndex('model-files', 'modelId', modelId);
        for (const file of files) {
            await this.delete('model-files', file.name);
        }
        await this.delete('model-metadata', modelId);
    }

    /**
     * Get total storage used by models
     * @returns {Promise<number>} Size in bytes
     */
    async getTotalStorageUsed() {
        const files = await this.getAll('model-files');
        return files.reduce((total, file) => total + file.size, 0);
    }
}

if (typeof window !== 'undefined') {
    window.ModelStorage = ModelStorage;
}
```

### 2. wikipedia-storage.js

```javascript
/**
 * Wikipedia Storage Manager
 * Handles Wikipedia article database storage in IndexedDB
 */
class WikipediaStorage extends IndexedDBManager {
    constructor() {
        super('wikipedia-offline', 1);
        this.schema = {
            'articles': {
                keyPath: 'id',
                indexes: {
                    'title': { keyPath: 'title' },
                    'categories': { keyPath: 'categories', multiEntry: true }
                }
            },
            'search-index': {
                keyPath: 'version'
            },
            'metadata': {
                keyPath: 'id'
            }
        };
    }

    async initialize() {
        await this.open(this.schema);
    }

    /**
     * Store article
     * @param {Object} article
     */
    async storeArticle(article) {
        await this.put('articles', article);
    }

    /**
     * Store articles in batch
     * @param {Array<Object>} articles
     * @param {Function} onProgress - Progress callback
     */
    async storeArticlesBatch(articles, onProgress) {
        const batchSize = 100;
        let processed = 0;

        for (let i = 0; i < articles.length; i += batchSize) {
            const batch = articles.slice(i, i + batchSize);
            await this.batchPut('articles', batch);
            processed += batch.length;
            if (onProgress) {
                onProgress(processed, articles.length);
            }
        }
    }

    /**
     * Get article by ID
     * @param {string} articleId
     * @returns {Promise<Object>}
     */
    async getArticle(articleId) {
        return await this.get('articles', articleId);
    }

    /**
     * Get article by title
     * @param {string} title
     * @returns {Promise<Object>}
     */
    async getArticleByTitle(title) {
        const results = await this.queryByIndex('articles', 'title', title);
        return results[0] || null;
    }

    /**
     * Get articles by category
     * @param {string} category
     * @returns {Promise<Array<Object>>}
     */
    async getArticlesByCategory(category) {
        return await this.queryByIndex('articles', 'categories', category);
    }

    /**
     * Store search index
     * @param {Object} indexData - Lunr.js serialized index
     */
    async storeSearchIndex(indexData) {
        await this.put('search-index', {
            version: '1.0',
            index: indexData,
            createdAt: new Date().toISOString()
        });
    }

    /**
     * Get search index
     * @returns {Promise<Object>}
     */
    async getSearchIndex() {
        const data = await this.get('search-index', '1.0');
        return data ? data.index : null;
    }

    /**
     * Store metadata
     * @param {Object} metadata
     */
    async storeMetadata(metadata) {
        await this.put('metadata', {
            id: 'wikipedia-db',
            ...metadata,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Get metadata
     * @returns {Promise<Object>}
     */
    async getMetadata() {
        return await this.get('metadata', 'wikipedia-db');
    }

    /**
     * Get article count
     * @returns {Promise<number>}
     */
    async getArticleCount() {
        return await this.count('articles');
    }

    /**
     * Clear all Wikipedia data
     */
    async clearAll() {
        await this.clear('articles');
        await this.clear('search-index');
        await this.clear('metadata');
    }
}

if (typeof window !== 'undefined') {
    window.WikipediaStorage = WikipediaStorage;
}
```

### 3. download-manager-v2.js

```javascript
/**
 * Enhanced Download Manager
 * Handles file downloads with progress tracking, validation, and retry logic
 */
class DownloadManagerV2 {
    constructor() {
        this.downloads = new Map();
        this.retryAttempts = 3;
        this.retryDelay = 1000; // ms
    }

    /**
     * Download file with progress tracking
     * @param {string} url - File URL
     * @param {string} fileName - File name
     * @param {Object} options - Download options
     * @returns {Promise<Blob>}
     */
    async downloadFile(url, fileName, options = {}) {
        const {
            onProgress = null,
            expectedChecksum = null,
            retryAttempts = this.retryAttempts
        } = options;

        let lastError = null;

        for (let attempt = 0; attempt < retryAttempts; attempt++) {
            try {
                const blob = await this._downloadWithProgress(url, fileName, onProgress);
                
                // Validate checksum if provided
                if (expectedChecksum) {
                    const isValid = await this.validateChecksum(blob, expectedChecksum);
                    if (!isValid) {
                        throw new Error('Checksum validation failed');
                    }
                }

                return blob;
            } catch (error) {
                lastError = error;
                console.error(`Download attempt ${attempt + 1} failed:`, error);
                
                if (attempt < retryAttempts - 1) {
                    await this.delay(this.retryDelay * Math.pow(2, attempt));
                }
            }
        }

        throw new Error(`Failed to download ${fileName} after ${retryAttempts} attempts: ${lastError.message}`);
    }

    /**
     * Internal download with progress tracking
     * @private
     */
    async _downloadWithProgress(url, fileName, onProgress) {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }

        const contentLength = +response.headers.get('Content-Length');
        if (!contentLength) {
            throw new Error('Content-Length header missing');
        }

        const reader = response.body.getReader();
        let receivedLength = 0;
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            chunks.push(value);
            receivedLength += value.length;
            
            if (onProgress) {
                onProgress({
                    fileName,
                    loaded: receivedLength,
                    total: contentLength,
                    percentage: (receivedLength / contentLength) * 100
                });
            }
        }

        return new Blob(chunks);
    }

    /**
     * Download multiple files with overall progress
     * @param {Array<Object>} files - Array of {url, name, checksum}
     * @param {Function} onProgress - Overall progress callback
     * @returns {Promise<Map<string, Blob>>}
     */
    async downloadMultiple(files, onProgress) {
        const results = new Map();
        const fileProgress = new Map();
        
        // Initialize progress tracking
        files.forEach(file => {
            fileProgress.set(file.name, { loaded: 0, total: 0 });
        });

        const updateOverallProgress = () => {
            let totalLoaded = 0;
            let totalSize = 0;
            
            fileProgress.forEach(progress => {
                totalLoaded += progress.loaded;
                totalSize += progress.total;
            });

            if (onProgress && totalSize > 0) {
                onProgress({
                    loaded: totalLoaded,
                    total: totalSize,
                    percentage: (totalLoaded / totalSize) * 100,
                    filesCompleted: results.size,
                    filesTotal: files.length
                });
            }
        };

        // Download files sequentially (could be parallelized)
        for (const file of files) {
            const blob = await this.downloadFile(file.url, file.name, {
                expectedChecksum: file.checksum,
                onProgress: (progress) => {
                    fileProgress.set(file.name, {
                        loaded: progress.loaded,
                        total: progress.total
                    });
                    updateOverallProgress();
                }
            });
            
            results.set(file.name, blob);
        }

        return results;
    }

    /**
     * Validate file checksum
     * @param {Blob} blob
     * @param {string} expectedChecksum - SHA-256 hex string
     * @returns {Promise<boolean>}
     */
    async validateChecksum(blob, expectedChecksum) {
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex === expectedChecksum.toLowerCase();
    }

    /**
     * Calculate checksum for a blob
     * @param {Blob} blob
     * @returns {Promise<string>} SHA-256 hex string
     */
    async calculateChecksum(blob) {
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Delay helper for retry logic
     * @private
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cancel download
     * @param {string} fileName
     */
    cancelDownload(fileName) {
        // Implementation would need AbortController integration
        this.downloads.delete(fileName);
    }
}

if (typeof window !== 'undefined') {
    window.DownloadManagerV2 = DownloadManagerV2;
}
```

### 4. lunr-search.js

```javascript
/**
 * Lunr.js Search Integration
 * Handles Wikipedia full-text search
 */
class LunrSearch {
    constructor() {
        this.index = null;
        this.articles = new Map();
    }

    /**
     * Build search index from articles
     * @param {Array<Object>} articles
     * @returns {Object} Serialized index
     */
    buildIndex(articles) {
        // Store articles for retrieval
        articles.forEach(article => {
            this.articles.set(article.id, article);
        });

        // Build Lunr index
        this.index = lunr(function () {
            this.ref('id');
            this.field('title', { boost: 10 });
            this.field('summary', { boost: 5 });
            this.field('content');

            articles.forEach(article => {
                this.add({
                    id: article.id,
                    title: article.title,
                    summary: article.summary,
                    content: article.content
                });
            });
        });

        return this.index.toJSON();
    }

    /**
     * Load index from serialized data
     * @param {Object} indexData
     */
    loadIndex(indexData) {
        this.index = lunr.Index.load(indexData);
    }

    /**
     * Search for articles
     * @param {string} query
     * @param {Object} options
     * @returns {Array<Object>} Search results with articles
     */
    search(query, options = {}) {
        const {
            limit = 10,
            includeContent = false
        } = options;

        if (!this.index) {
            throw new Error('Search index not loaded');
        }

        // Perform search
        const results = this.index.search(query);

        // Limit results
        const limitedResults = results.slice(0, limit);

        // Enrich with article data
        return limitedResults.map(result => {
            const article = this.articles.get(result.ref);
            if (!article) {
                return null;
            }

            return {
                id: article.id,
                title: article.title,
                summary: article.summary,
                content: includeContent ? article.content : undefined,
                url: article.url,
                categories: article.categories,
                score: result.score,
                matchData: result.matchData
            };
        }).filter(r => r !== null);
    }

    /**
     * Get highlighted snippet from match
     * @param {Object} matchData
     * @param {string} content
     * @param {number} contextLength
     * @returns {string}
     */
    getHighlightedSnippet(matchData, content, contextLength = 150) {
        // Extract matched terms
        const terms = Object.keys(matchData.metadata);
        
        // Find first occurrence
        const lowerContent = content.toLowerCase();
        let firstIndex = -1;
        
        for (const term of terms) {
            const index = lowerContent.indexOf(term.toLowerCase());
            if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
                firstIndex = index;
            }
        }

        if (firstIndex === -1) {
            return content.substring(0, contextLength) + '...';
        }

        // Extract context around match
        const start = Math.max(0, firstIndex - contextLength / 2);
        const end = Math.min(content.length, firstIndex + contextLength / 2);
        let snippet = content.substring(start, end);

        // Add ellipsis
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';

        // Highlight matched terms
        terms.forEach(term => {
            const regex = new RegExp(`(${term})`, 'gi');
            snippet = snippet.replace(regex, '<mark>$1</mark>');
        });

        return snippet;
    }

    /**
     * Clear search index and articles
     */
    clear() {
        this.index = null;
        this.articles.clear();
    }
}

if (typeof window !== 'undefined') {
    window.LunrSearch = LunrSearch;
}
```

### 5. Integration Code Snippets

#### local-ai-model.js modifications

```javascript
// Add at top
const modelStorage = new ModelStorage();
await modelStorage.initialize();

// In loadModel method
async loadModel(modelId) {
    // Check if model exists in storage
    const isComplete = await modelStorage.isModelComplete(modelId, MODEL_FILES);
    
    if (!isComplete) {
        throw new Error('Model not downloaded. Please download the model first.');
    }

    // Load model files from storage
    const modelBlob = await modelStorage.getModelFile('phi3-mini-4k-instruct-web.onnx');
    const modelArrayBuffer = await modelBlob.arrayBuffer();

    // Create ONNX Runtime session with WebGPU if available, otherwise fall back to WASM
    const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu;
    const executionProviders = hasWebGPU ? ['webgpu'] : ['wasm'];
    const session = await ort.InferenceSession.create(modelArrayBuffer, {
        executionProviders,
        graphOptimizationLevel: 'all'
    });

    // Store session
    this.sessions.set(modelId, session);
    
    // Update metadata
    await modelStorage.updateModelMetadata(modelId, {
        status: 'loaded',
        loadedAt: new Date().toISOString()
    });
}
```

#### wikipedia-manager.js modifications

```javascript
// Add at top
const wikiStorage = new WikipediaStorage();
const lunrSearch = new LunrSearch();
await wikiStorage.initialize();

// Load search index
const indexData = await wikiStorage.getSearchIndex();
if (indexData) {
    lunrSearch.loadIndex(indexData);
}

// In search method
async search(query, options = {}) {
    const results = lunrSearch.search(query, options);
    
    // Enrich with full article data if needed
    for (const result of results) {
        if (options.includeFullArticle) {
            const article = await wikiStorage.getArticle(result.id);
            result.fullArticle = article;
        }
    }
    
    return results;
}
```

---

## Dependencies to Add

### package.json

```json
{
  "dependencies": {
    "onnxruntime-web": "^1.17.0",
    "lunr": "^2.3.9"
  }
}
```

### HTML Script Tags (offline.ejs)

```html
<!-- ONNX Runtime Web -->
<script src="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort.min.js"></script>

<!-- Lunr.js -->
<script src="https://cdn.jsdelivr.net/npm/lunr@2.3.9/lunr.min.js"></script>

<!-- Storage Layer -->
<script src="/offline/storage/indexeddb-manager.js"></script>
<script src="/offline/storage/model-storage.js"></script>
<script src="/offline/storage/wikipedia-storage.js"></script>

<!-- Download Manager -->
<script src="/offline/download/download-manager-v2.js"></script>

<!-- Search -->
<script src="/offline/search/lunr-search.js"></script>
```

---

## Testing Checklist

### Storage Layer Tests
- [ ] IndexedDB database creation
- [ ] Store and retrieve model files
- [ ] Store and retrieve articles
- [ ] Batch insert performance
- [ ] Storage quota handling
- [ ] Database cleanup

### Download Tests
- [ ] Single file download with progress
- [ ] Multiple file downloads
- [ ] Checksum validation
- [ ] Retry on failure
- [ ] Cancel download
- [ ] Network error handling

### Integration Tests
- [ ] End-to-end model download and loading
- [ ] End-to-end Wikipedia download and search
- [ ] Storage persistence across sessions
- [ ] WebGPU availability detection
- [ ] Browser compatibility

---

## Implementation Order

1. ✅ **IndexedDB Manager** - Base storage layer
2. 📝 **Model Storage** - Phi-3 specific storage
3. 📝 **Wikipedia Storage** - Article database storage
4. 📝 **Download Manager** - File download with progress
5. 📝 **Lunr Search** - Full-text search
6. 📝 **Model Integration** - Connect storage to local-ai-model.js
7. 📝 **Wikipedia Integration** - Connect storage to wikipedia-manager.js
8. 📝 **UI Updates** - Progress bars, status indicators
9. 📝 **Testing** - Unit and integration tests
10. 📝 **Documentation** - Usage guides and API docs

---

## Next Steps

1. Review this implementation guide
2. Create sub-issues for each PR
3. Begin with PR 1: Complete storage layer
4. Test thoroughly before moving to next PR
5. Iterate based on feedback
