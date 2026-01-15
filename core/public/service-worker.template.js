// Service Worker for AI Questions Offline Mode
// Security: This service worker only operates on same-origin requests over HTTPS (or localhost for development)

const CACHE_NAME = 'ai-questions-cache-{{VERSION}}';
const OFFLINE_URL = '/offline';

// Security: Enforce HTTPS in production (allow localhost for development)
const isSecureContext = self.location.protocol === 'https:' || 
                       self.location.hostname === 'localhost' ||
                       self.location.hostname === '127.0.0.1';

if (!isSecureContext && self.location.hostname !== 'localhost') {
    console.warn('Service Worker: Insecure context detected. Service workers should only run over HTTPS.');
}

// Resources to cache immediately on install
const PRECACHE_RESOURCES = [
  '/',
  '/offline',
  '/css/styles.css',
  '/js/main.js',
  '/manifest.json',
  '/img/logo.png',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/offline/ai-models.js',
  '/offline/wikipedia.js'
];

// Install event - precache resources
self.addEventListener('install', event => {
  console.log('Service worker installing... Version: {{VERSION}}');
  
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(PRECACHE_RESOURCES);
      })
      .catch(error => {
        console.error('Precaching failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service worker activating... Version: {{VERSION}}');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          // Delete all caches that don't match the current version
          return cacheName.startsWith('ai-questions-cache-') && cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  // Security: Skip cross-origin requests to prevent caching external content
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Security: Only cache GET requests (never cache POST/PUT/DELETE)
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Security: Don't cache requests with credentials in the URL
  const url = new URL(event.request.url);
  if (url.searchParams.has('token') || url.searchParams.has('key') || url.searchParams.has('password')) {
    console.warn('Service Worker: Skipping cache for request with credentials in URL');
    return;
  }
  
  // Handle API requests differently - network first, then cache
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Security: Only cache successful responses with proper content type
          if (response && response.ok && response.headers.get('content-type')?.includes('application/json')) {
            // Clone the response to store in cache
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          
          return response;
        })
        .catch(() => {
          // If network request fails, try to serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              
              // If not in cache, return offline fallback for API
              return new Response(
                JSON.stringify({ 
                  error: 'Network request failed',
                  offline: true 
                }),
                { 
                  headers: { 'Content-Type': 'application/json' },
                  status: 503
                }
              );
            });
        })
    );
    return;
  }
  
  // For navigation requests, use network-first strategy to get fresh content
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Security: Only cache successful responses
          if (response && response.ok) {
            // Clone and cache the fresh response
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          return response;
        })
        .catch(() => {
          // If offline, serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Fall back to offline page
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }
  
  // For static assets, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if available
        if (cachedResponse) {
          // Fetch fresh version in background for next time
          fetch(event.request)
            .then(response => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, response);
                  });
              }
            })
            .catch(() => {
              // Ignore background fetch errors
            });
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Security: Don't cache non-successful responses or non-basic types
            // Only cache responses from our origin (type: 'basic')
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Security: Validate content type before caching
            const contentType = response.headers.get('content-type');
            const allowedTypes = ['text/', 'application/javascript', 'application/json', 'image/', 'font/'];
            const isAllowedType = allowedTypes.some(type => contentType?.includes(type));
            
            if (!isAllowedType) {
              console.warn('Service Worker: Skipping cache for unexpected content type:', contentType);
              return response;
            }
            
            // Clone the response to store in cache
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            console.error('Fetch failed:', error);
            
            // For other requests, return a simple error response
            return new Response('Network error', { 
              status: 408, 
              headers: { 'Content-Type': 'text/plain' } 
            });
          });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', event => {
  // Security: Validate message source
  if (!event.data || typeof event.data.type !== 'string') {
    console.warn('Service Worker: Invalid message received');
    return;
  }
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Allow clients to request cache clear
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        // Security: Only send response if MessageChannel port is provided
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      }).catch(error => {
        console.error('Cache clear failed:', error);
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: false, error: error.message });
        }
      })
    );
  }
  
  // Allow clients to get version info
  if (event.data.type === 'GET_VERSION') {
    // Security: Only send response if MessageChannel port is provided
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ 
        version: '{{VERSION}}',
        cacheName: CACHE_NAME,
        timestamp: Date.now()
      });
    }
  }
});
