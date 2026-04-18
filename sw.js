// sw.js
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('arcvault-store').then((cache) => cache.addAll([
      './index.html',
      './manifest.json',
      './sw.js'
    ])),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request)),
  );
});
