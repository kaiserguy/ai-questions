// Service Worker for AI Questions Offline Mode
const CACHE_NAME = 'ai-questions-offline-v1';
const STATIC_CACHE_NAME = 'ai-questions-static-v1';

// URLs to cache for offline functionality
const STATIC_URLS = [
    '/offline/',
    '/offline/app.js',
    '/offline/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_URLS);
            })
            .then(() => {
                console.log('Service Worker: Static assets cached');
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Only handle requests for our domain
    if (url.origin !== location.origin) {
        return;
    }
    
    // Handle offline page requests
    if (url.pathname.startsWith('/offline/')) {
        event.respondWith(handleOfflineRequest(request));
        return;
    }
    
    // Handle API requests for offline mode
    if (url.pathname.startsWith('/api/offline/')) {
        event.respondWith(handleOfflineAPI(request));
        return;
    }
    
    // Default: try network first, fallback to cache
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Clone the response before caching
                const responseClone = response.clone();
                
                // Cache successful responses
                if (response.status === 200) {
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(request, responseClone);
                        });
                }
                
                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(request);
            })
    );
});

// Handle offline page requests
async function handleOfflineRequest(request) {
    const url = new URL(request.url);
    
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache the response
        const cache = await caches.open(STATIC_CACHE_NAME);
        cache.put(request, networkResponse.clone());
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If no cache, return offline fallback
        if (url.pathname === '/offline/' || url.pathname === '/offline') {
            return new Response(getOfflineFallbackHTML(), {
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        // For other assets, return a basic error response
        return new Response('Offline - Resource not available', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Handle offline API requests
async function handleOfflineAPI(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Route offline API requests
    if (path === '/api/offline/chat') {
        return handleOfflineChat(request);
    }
    
    if (path === '/api/offline/wikipedia') {
        return handleOfflineWikipedia(request);
    }
    
    if (path === '/api/offline/models') {
        return handleOfflineModels(request);
    }
    
    return new Response(JSON.stringify({ error: 'API endpoint not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
    });
}

// Handle offline chat requests
async function handleOfflineChat(request) {
    try {
        const body = await request.json();
        const { message, model } = body;
        
        // TODO: Use WebAssembly models for actual AI processing
        const response = {
            message: `Echo: ${message}`,
            model: model || 'offline-model',
            timestamp: new Date().toISOString(),
            offline: true
        };
        
        return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle offline Wikipedia requests
async function handleOfflineWikipedia(request) {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    
    if (!query) {
        return new Response(JSON.stringify({ error: 'Query parameter required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // TODO: Query local database for Wikipedia search results
    const results = [
        {
            title: `Article about ${query}`,
            excerpt: `Load Wikipedia excerpt about ${query} from local SQLite database.`,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`
        }
    ];
    
    return new Response(JSON.stringify({ results }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// Handle offline models requests
async function handleOfflineModels(request) {
    const models = [
        {
            id: 'phi3-mini-offline',
            name: 'Phi-3 Mini (Offline)',
            size: '600MB',
            status: 'ready'
        },
        {
            id: 'tinybert-offline',
            name: 'TinyBERT (Offline)',
            size: '60MB',
            status: 'ready'
        }
    ];
    
    return new Response(JSON.stringify({ models }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// Fallback HTML for offline mode
function getOfflineFallbackHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Questions - Offline</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            color: white;
            text-align: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 12px;
            backdrop-filter: blur(10px);
        }
        h1 { margin-bottom: 20px; }
        p { margin-bottom: 15px; opacity: 0.9; }
        .retry-btn {
            background: white;
            color: #667eea;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 AI Questions Offline</h1>
        <p>You're currently offline, but the app is ready to work!</p>
        <p>All your AI models and Wikipedia database are stored locally.</p>
        <button class="retry-btn" onclick="location.reload()">Retry Connection</button>
    </div>
</body>
</html>
    `;
}

// Handle background sync for when connection is restored
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered');
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

// Background sync function
async function doBackgroundSync() {
    console.log('Service Worker: Performing background sync');
    
    try {
        // Sync any pending data when connection is restored
        // This could include uploading conversation logs, checking for updates, etc.
        
        // Notify the main app that sync is complete
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                timestamp: new Date().toISOString()
            });
        });
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Handle push notifications (for scheduled questions, etc.)
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: 'You have a scheduled AI question ready!',
        icon: '/offline/icon-192.png',
        badge: '/offline/badge-72.png',
        tag: 'ai-questions-notification',
        requireInteraction: true,
        actions: [
            {
                action: 'open',
                title: 'Open AI Questions'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('AI Questions', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/offline/')
        );
    }
});

console.log('Service Worker: Loaded and ready');

