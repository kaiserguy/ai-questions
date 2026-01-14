# Dependencies to Add to offline.ejs

## CDN Script Includes (Add before existing scripts)

```html
<!-- ONNX Runtime Web - Required for Phi-3 model inference -->
<script src="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort.min.js"></script>

<!-- Lunr.js - Required for Wikipedia full-text search -->
<script src="https://cdn.jsdelivr.net/npm/lunr@2.3.9/lunr.min.js"></script>

<!-- Our new storage and download modules -->
<script src="/offline/storage/indexeddb-manager.js"></script>
<script src="/offline/storage/model-storage.js"></script>
<script src="/offline/storage/wikipedia-storage.js"></script>
<script src="/offline/download/download-manager-v2.js"></script>
<script src="/offline/search/lunr-search.js"></script>
```

## Script Load Order

1. External dependencies (ONNX Runtime Web, Lunr.js)
2. Storage layer (indexeddb-manager, model-storage, wikipedia-storage)
3. Download manager (download-manager-v2)
4. Search (lunr-search)
5. Existing scripts (download-manager, integration-manager, etc.)

## Package.json - No Changes Needed

These are browser-only dependencies loaded via CDN, so no npm packages needed.

## Service Worker Updates

The service worker should cache these CDN resources:
- onnxruntime-web (1.17.1)
- lunr.js (2.3.9)

Add to service worker cache list in `/core/public/offline/service-worker.js`
