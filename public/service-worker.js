// Service Worker for AI Questions Offline Mode

const CACHE_NAME = 'ai-questions-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/offline',
  // Remove references to non-existent files
  // '/css/styles.css',
  // '/js/main.js',
  // '/img/logo.png',
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(error => {
        console.error('Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest)
          .then(response => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            // Cache the response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            // If fetch fails, show offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/offline');
            }
            
            // Otherwise, just propagate the error
            throw error;
          });
      })
  );
});

// Background sync for pending requests
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-requests') {
    event.waitUntil(syncPendingRequests());
  }
});

// Function to sync pending requests when online
async function syncPendingRequests() {
  try {
    const db = await openDatabase();
    const pendingRequests = await db.getAll('pendingRequests');
    
    for (const request of pendingRequests) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
        
        if (response.ok) {
          await db.delete('pendingRequests', request.id);
        }
      } catch (error) {
        console.error('Failed to sync request:', error);
      }
    }
  } catch (error) {
    console.error('Error syncing pending requests:', error);
  }
}

// IndexedDB for storing pending requests
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AIQuestionsOfflineDB', 1);
    
    request.onerror = event => {
      reject('Database error: ' + event.target.errorCode);
    };
    
    request.onsuccess = event => {
      const db = event.target.result;
      
      resolve({
        getAll: (storeName) => {
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
        },
        delete: (storeName, key) => {
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        },
        add: (storeName, item) => {
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(item);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
        }
      });
    };
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      db.createObjectStore('pendingRequests', { keyPath: 'id', autoIncrement: true });
    };
  });
}
