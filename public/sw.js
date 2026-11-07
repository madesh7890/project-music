// MUSIC - Service Worker v22 — High-Impact Audible Audio DSP + Direct On-Sheet Download Dialog z-index 3500
const CACHE_NAME = 'music-app-v22';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/auth.html',
  '/auth.css',
  '/auth.js',
  '/style.css',
  '/app.js',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Always go straight to network for API calls and media
  if (url.includes('/api/') || url.includes('.mp4') || url.includes('.mp3') || url.includes('jiosaavn') || url.includes('saavn')) {
    return;
  }

  // Network-first strategy: try network, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((networkRes) => {
        // Clone and cache fresh response
        if (networkRes && networkRes.ok) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkRes;
      })
      .catch(() => {
        // Offline fallback: serve from cache
        return caches.match(event.request);
      })
  );
});
