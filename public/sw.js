// Service Worker - Discado PWA
const CACHE_NAME = 'discado-v1';

// Ressources à mettre en cache lors de l'installation
const PRECACHE_URLS = [
  '/',
  '/pages/login.html',
  '/css/welcome.css',
  '/css/login.css',
  '/css/main.css',
  '/css/catalog.css',
  '/css/cart.css',
  '/css/orders.css',
  '/css/profile.css',
  '/images/logo/logo_discado_noir.png',
  '/images/logo/icon-192.png',
  '/images/logo/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.png'
];

// ===== INSTALLATION =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS.map(url => new Request(url, { credentials: 'same-origin' })));
    }).then(() => self.skipWaiting())
  );
});

// ===== ACTIVATION =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas interférer avec les requêtes API, non-GET ou cross-origin
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.origin !== location.origin
  ) {
    return;
  }

  // Stratégie Network First pour les pages HTML
  if (request.headers.get('Accept') && request.headers.get('Accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/')))
    );
    return;
  }

  // Stratégie Cache First pour les assets statiques (CSS, JS, images)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (!response || !response.ok || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => cached);
    })
  );
});
