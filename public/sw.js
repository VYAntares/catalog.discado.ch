// Service Worker - Discado PWA
const CACHE_NAME = 'discado-v5';

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
  '/favicon.png',
  '/error-503.html'
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

// ===== MESSAGE (force skipWaiting from page) =====
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// ===== HELPER: Serve custom error page for 503 =====
function serve503Page() {
  return caches.match('/error-503.html').then(cached => {
    if (cached) return cached;
    // Fallback inline error page if not cached
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Erreur</title></head>' +
      '<body style="display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif;background:#e9394f;margin:0">' +
      '<div style="background:#fff;padding:40px;border-radius:20px;text-align:center;max-width:90%;width:400px">' +
      '<h1 style="font-size:20px;margin-bottom:12px">Service temporairement indisponible</h1>' +
      '<p style="color:#666;margin-bottom:24px">Veuillez rafraîchir la page.</p>' +
      '<button onclick="location.reload()" style="background:#e9394f;color:#fff;border:none;padding:14px 28px;border-radius:10px;font-size:16px;cursor:pointer;width:100%">Rafraîchir</button>' +
      '</div></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  });
}

// ===== FETCH =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas interférer avec les requêtes non-GET ou cross-origin
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // Pour les requêtes API: intercepter les 503 et retourner une erreur JSON propre
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'Service temporairement indisponible' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Ne JAMAIS cacher les fichiers JS/admin — toujours Network First
  if (url.pathname.endsWith('.js') || url.pathname.startsWith('/admin/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.status === 503) return serve503Page();
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || serve503Page()))
    );
    return;
  }

  // Stratégie Network First pour les pages HTML
  if (request.headers.get('Accept') && request.headers.get('Accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.status === 503) return serve503Page();
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || serve503Page()))
    );
    return;
  }

  // Stratégie Cache First pour les assets statiques (CSS, images)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (response.status === 503) return serve503Page();
        if (!response || !response.ok || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => cached || serve503Page());
    })
  );
});
