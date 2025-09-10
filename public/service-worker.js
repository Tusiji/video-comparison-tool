/* Simple PWA service worker for offline support */
const CACHE_NAME = 'vct-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.webmanifest',
  '/icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    ).then(() => self.clients.claim())
  );
});

// Helper: classify navigation requests
function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isHTMLNav = isNavigationRequest(request);

  // Strategy 1: App shell (HTML) – Network first, fallback to cache
  if (isHTMLNav) {
    event.respondWith(
      fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put('/index.html', copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Strategy 2: Same-origin static – Cache first, then network
  if (isSameOrigin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {});
          return resp;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Strategy 3: Cross-origin (e.g., CDN like esm.sh, tailwindcdn) – Cache with fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request, { mode: request.mode, credentials: 'omit' }).then((resp) => {
        const copy = resp.clone();
        // Cache opaque or OK responses
        if (resp.ok || resp.type === 'opaque') {
          caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
    })
  );
});

