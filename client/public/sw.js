// __BUILD_ID__ is replaced by the build (see vite.config.ts): every build ships a different worker, so the
// browser installs it by itself, and activate drops every cache of an earlier build. Nothing has to be
// unregistered or cleared by hand after a rebuild.
const BUILD_ID = '__BUILD_ID__';
const CACHE_NAME = `vehiclevault-${BUILD_ID}`;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Resilient prefetch: individual failures won't abort the entire install
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(new Request(asset, { cache: 'reload' }));
        } catch (err) {
          console.warn('SW prefetch skipped:', asset, err?.message || err);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Only a real, successful response of the right kind goes into the cache. A missing bundle that the server
// answers with the index page (200, text/html) must never be stored under the bundle's URL.
function isCacheable(response, { html }) {
  if (!response || response.status !== 200 || response.type !== 'basic') return false;
  const isHtml = (response.headers.get('content-type') || '').includes('text/html');
  return html ? isHtml : !isHtml;
}

function networkFirst(request, { cacheKey = request, html = false, fallback } = {}) {
  return fetch(request)
    .then((response) => {
      if (isCacheable(response, { html })) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy));
      }
      return response;
    })
    .catch(() =>
      caches.match(cacheKey).then(
        (cached) =>
          cached ||
          fallback ||
          new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
      )
    );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === '/sw.js') return;

  // API: always the network, with an offline notice
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: 'You are currently offline. Local cache active.' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          })
      )
    );
    return;
  }

  // The page and the manifest name the current JS bundle and the release channel: network first, cache only
  // when offline.
  if (request.mode === 'navigate' || url.pathname === '/index.html' || url.pathname === '/manifest.json') {
    const isPage = request.mode === 'navigate' || url.pathname === '/index.html';
    event.respondWith(
      networkFirst(request, {
        cacheKey: isPage ? '/index.html' : request,
        html: isPage
      })
    );
    return;
  }

  // Hashed bundles never change under the same name: cache first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (isCacheable(response, { html: false })) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else (icons, uploaded photos and documents, ...): fresh when online, cached when offline.
  event.respondWith(networkFirst(request));
});

// Web Push: the server sends a JSON payload ({ title, body, tag, url }) through the browser's push service.
// Browsers (iOS in particular) require every push to result in a visible notification.
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'VehicleVault';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    requireInteraction: data.priority === 'urgent',
    data: { url: typeof data.url === 'string' ? data.url : '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Only ever open pages of this app, whatever the payload says.
  let target = new URL('/', self.location.origin);
  try {
    const requested = new URL(event.notification.data?.url || '/', self.location.origin);
    if (requested.origin === self.location.origin) target = requested;
  } catch {}

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === target.origin && 'focus' in client) {
          return client.focus().then((focused) => {
            if ('navigate' in focused && focused.url !== target.href) return focused.navigate(target.href);
            return focused;
          });
        }
      }
      return self.clients.openWindow(target.href);
    })
  );
});
