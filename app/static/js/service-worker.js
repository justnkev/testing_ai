const STATIC_CACHE = 'fitvision-static-v1';
const RUNTIME_CACHE = 'fitvision-runtime-v1';
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/static/css/styles.css',
  '/static/js/dashboard.js',
  '/static/manifest.webmanifest',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
];
const OFFLINE_FALLBACK = '/offline';
const API_PATTERN = /\/api\//;
const STATIC_FILE_PATTERN = /\/static\/(css|js|icons|manifest\.webmanifest)/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => ![STATIC_CACHE, RUNTIME_CACHE].includes(cacheName))
          .map((cacheName) => caches.delete(cacheName))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin === self.location.origin && STATIC_FILE_PATTERN.test(requestUrl.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (API_PATTERN.test(requestUrl.pathname)) {
    event.respondWith(staleWhileRevalidate(event, request));
    return;
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.status === 200) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  });

  if (cached) {
    event.waitUntil(
      networkFetch.catch((error) => {
        console.warn('Service worker runtime refresh failed', error);
      })
    );
    return cached;
  }

  try {
    return await networkFetch;
  } catch (error) {
    return offlineJsonFallback();
  }
}

async function handleNavigationRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(OFFLINE_FALLBACK);
    if (cached) {
      return cached;
    }

    return offlineDocumentFallback();
  }
}

function offlineJsonFallback() {
  return new Response(
    JSON.stringify({ message: 'Offline. Data may be stale.' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      status: 503,
      statusText: 'Service Unavailable',
    }
  );
}

function offlineDocumentFallback() {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>FitVision Offline</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f182c; color: #f8f9ff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 2rem; text-align: center; }
      .card { max-width: 420px; }
      h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
      p { color: rgba(248, 249, 255, 0.8); line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>You are offline</h1>
      <p>Reconnect to sync your latest FitVision data. Cached information will reappear automatically when a connection is restored.</p>
    </div>
  </body>
</html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
      status: 503,
      statusText: 'Offline',
    }
  );
}
