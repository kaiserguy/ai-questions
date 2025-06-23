/**
 * Service Worker for Offline AI Chat
 * Handles caching of downloaded resources and offline functionality
 */

const CACHE_NAME = 'offline-ai-v1';
const STATIC_CACHE = 'static-v1';

// Files to cache immediately
const STATIC_FILES = [
    '/offline/',
    '/css/styles.css',
    '/offline/offline-ai-chat.js',
    '/offline/ai-models.js',
    '/offline/wikipedia.js',
    '/offline/resource-monitor.js',
    '/offline/integration-manager.js'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Caching static files...');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Static files cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Failed to cache static files:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Handle offline resources
    if (url.pathname.startsWith('/offline/')) {
        event.respondWith(handleOfflineRequest(event.request));
        return;
    }
    
    // Handle static files
    if (STATIC_FILES.includes(url.pathname)) {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    return response || fetch(event.request);
                })
        );
        return;
    }
    
    // Default: network first, then cache
    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

/**
 * Handle requests for offline resources (models, libraries, wikipedia)
 */
async function handleOfflineRequest(request) {
    const url = new URL(request.url);
    
    try {
        // Try to serve from IndexedDB first
        const cachedFile = await getFileFromIndexedDB(url.pathname);
        if (cachedFile) {
            console.log('Serving from IndexedDB:', url.pathname);
            return new Response(cachedFile.data, {
                headers: {
                    'Content-Type': getContentType(url.pathname),
                    'Content-Length': cachedFile.size.toString(),
                    'Cache-Control': 'max-age=31536000' // 1 year
                }
            });
        }
        
        // Try network
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            // Cache the response for future use
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        throw new Error(`Network response not ok: ${networkResponse.status}`);
        
    } catch (error) {
        console.error('Failed to serve offline resource:', url.pathname, error);
        
        // Return a 404 response
        return new Response('Resource not found', {
            status: 404,
            statusText: 'Not Found'
        });
    }
}

/**
 * Get file from IndexedDB
 */
async function getFileFromIndexedDB(pathname) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('OfflineAI', 1);
        
        request.onsuccess = () => {
            const db = request.result;
            const stores = ['libraries', 'models', 'wikipedia'];
            let found = false;
            
            const checkStore = (storeIndex) => {
                if (storeIndex >= stores.length || found) {
                    if (!found) resolve(null);
                    return;
                }
                
                const transaction = db.transaction([stores[storeIndex]], 'readonly');
                const store = transaction.objectStore(stores[storeIndex]);
                
                // Extract filename from pathname
                const filename = pathname.split('/').pop();
                const getRequest = store.get(filename);
                
                getRequest.onsuccess = () => {
                    if (getRequest.result && !found) {
                        found = true;
                        resolve(getRequest.result);
                    } else {
                        checkStore(storeIndex + 1);
                    }
                };
                
                getRequest.onerror = () => {
                    if (!found) checkStore(storeIndex + 1);
                };
            };
            
            checkStore(0);
        };
        
        request.onerror = () => resolve(null);
    });
}

/**
 * Get appropriate content type for file
 */
function getContentType(pathname) {
    const ext = pathname.split('.').pop().toLowerCase();
    
    const contentTypes = {
        'js': 'application/javascript',
        'bin': 'application/octet-stream',
        'safetensors': 'application/octet-stream',
        'db': 'application/x-sqlite3',
        'zim': 'application/x-zim',
        'json': 'application/json',
        'wasm': 'application/wasm'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CACHE_FILE') {
        // Cache a file that was downloaded
        const { name, data } = event.data;
        cacheDownloadedFile(name, data);
    }
});

/**
 * Cache a downloaded file
 */
async function cacheDownloadedFile(name, data) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = new Response(data, {
            headers: {
                'Content-Type': getContentType(name),
                'Content-Length': data.length.toString()
            }
        });
        
        await cache.put(`/offline/cached/${name}`, response);
        console.log('Cached downloaded file:', name);
    } catch (error) {
        console.error('Failed to cache downloaded file:', name, error);
    }
}

