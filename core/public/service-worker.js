// Service Worker for AI Questions Offline Mode

const CACHE_NAME = 'ai-questions-cache-v1';
const OFFLINE_URL = '/offline';

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
  console.log('Service worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(PRECACHE_RESOURCES);
      })
      .catch(error => {
        console.error('Precaching failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service worker activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Handle API requests differently
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response to store in cache
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
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
                  headers: { 'Content-Type': 'application/json' } 
                }
              );
            });
        })
    );
    return;
  }
  
  // For regular requests
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if available
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
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
            
            // For navigation requests, serve the offline page
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            
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
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
