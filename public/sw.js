// sw.js
const CACHE_NAME = 'study-vault-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// 1. Install event: Cache core assets individually so a single 404 doesn't break installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Caching core assets for offline loading...');
      for (const asset of CORE_ASSETS) {
        try {
          await cache.add(asset);
          console.log(`[SW] Successfully cached asset: ${asset}`);
        } catch (err) {
          console.warn(`[SW] Non-fatal: Failed to cache asset ${asset}:`, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate event: Clean up previous cache versions and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch event: Cache-First strategy with offline navigation fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return from cache immediately
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(event.request)
        .then((networkResponse) => {
          // If valid response from same-origin, cache it
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback for HTML navigation requests when offline
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
