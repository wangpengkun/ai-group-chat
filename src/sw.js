// Service Worker for AI Group Chat PWA
// Bump CACHE_NAME on every release so clients drop the previous cache.
const CACHE_NAME = 'ai-chat-v1.5.0';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './store.js',
  './ai-service.js',
  './api-bridge.js',
  './renderer.js',
  './manifest.json',
  './assets/icon.png',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => {
        console.log('Cache addAll error:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch strategy:
//   app code (html/js/css) -> network-first, so a new release is picked up
//                             immediately; falls back to cache when offline.
//   other same-origin files -> cache-first (icons, manifest, ...).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (API calls go directly to network)
  if (url.origin !== self.location.origin) return;

  const isAppCode = /\.(html|js|css)$/i.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');

  if (isAppCode) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => cached);
    })
  );
});
