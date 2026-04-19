const CACHE_NAME = 'arcvault-os-v3.0';

// Core static assets to cache for instant offline booting
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png'
];

// INSTALL EVENT: Cache the static UI shell
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ArcVault SW] Caching OS Shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// ACTIVATE EVENT: Clean up outdated caches if you update the OS version
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ArcVault SW] Purging old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// FETCH EVENT: Network-first for APIs, Cache-first for static UI
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // STRICT BYPASS: Never cache live blockchain API calls or Firebase auth
    if (requestUrl.pathname.startsWith('/api/') || requestUrl.hostname.includes('firebase')) {
        return; // Let the browser handle these normally (always network)
    }

    // CACHE STRATEGY: Stale-While-Revalidate for OS assets
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Update the cache with the fresh version for next time
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // If network fails, silently fail to keep UI clean
                console.warn('[ArcVault SW] Network request failed for:', event.request.url);
            });

            // Return cached response instantly if available, otherwise wait for network
            return cachedResponse || fetchPromise;
        })
    );
});
