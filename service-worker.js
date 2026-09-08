/**
 * Service worker.
 *
 * Strategy:
 *  - App code (HTML, CSS, JS): network-first, cache as fallback. The app is
 *    a graph of ES modules that must all come from the same version: served
 *    cache-first, a deploy could hand out a new module next to an old one and
 *    the app breaks in ways no error message explains. Online, the server
 *    always wins; offline, the last good copy still opens.
 *  - Static assets (icons, manifest): cache-first — they rarely change and
 *    never depend on each other.
 *  - API calls: network-only. Financial figures must never be served stale,
 *    and the API lives on a different origin anyway.
 */

const VERSION = 'v28';
const SHELL_CACHE = `fintech-shell-${VERSION}`;

// Assets that never depend on another file's version.
const STATIC_PATTERN = /^\/(icons|manifest\.webmanifest)/;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/env.js',
  '/manifest.webmanifest',
  '/styles/tokens.css',
  '/styles/base.css',
  '/styles/components.css',
  '/src/main.js',
  '/src/App.js',
  '/src/config.js',
  '/src/core/runtime.js',
  '/src/core/api.js',
  '/src/core/router.js',
  '/src/core/pwa.js',
  '/src/components/blocks/BlockRenderer.js',
  '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll fails atomically; keep it tolerant so one 404 cannot block install.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(asset))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache API traffic (different origin or /api path).
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return;

  // Navigations: serve the shell so hash routes work offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Icons and the manifest: cache-first, they stand alone.
  if (STATIC_PATTERN.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetchAndStore(request)),
    );
    return;
  }

  // Everything else is app code: the network decides, the cache rescues.
  event.respondWith(
    fetchAndStore(request).catch(() => caches.match(request)),
  );
});

function fetchAndStore(request) {
  return fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  });
}
