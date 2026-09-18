/**
 * The service worker, hand-written rather than generated.
 *
 * It exists for one reason: to make the app installable and to let the shell
 * open when the network is slow or absent. It deliberately does not cache a
 * single price. Every API answer is account-specific and hours-fresh at best,
 * so a stale one is worse than no answer at all — `/api/*` is never touched
 * here, not even to read it.
 *
 * Three rules, and nothing else:
 *   1. navigations        network first, falling back to the cached shell
 *   2. build output       cache first — `/_next/static/*` filenames are hashed,
 *                         so a cached one can never be the wrong version
 *   3. product images     cache first, trimmed, from the two image CDNs
 */
const VERSION = 'v4';
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const IMAGE_CACHE = `images-${VERSION}`;
const IMAGE_LIMIT = 300;

const SHELL_URLS = ['/', '/search', '/basket', '/accounts', '/settings', '/manifest.webmanifest'];

const IMAGE_HOSTS = [
  /^https:\/\/(static|cdn)\.snapp\.express$/i,
  /^https:\/\/dkstatics-public\.digikala\.com$/i,
  /^https:\/\/(.*\.)?okala\.com$/i,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One failed page must not fail the whole install.
      await Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/** Keep a cache from growing without bound; oldest entries go first. */
async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}

async function cacheFirst(request, cacheName, { limit } = {}) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone());
    if (limit) trim(cacheName, limit);
  }
  return response;
}

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) ?? (await cache.match('/'));
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Prices, tokens, sign-in codes: always live, never stored.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }

  if (url.origin === self.location.origin) {
    if (
      url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname === '/favicon.svg'
    ) {
      event.respondWith(cacheFirst(request, ASSET_CACHE));
    }
    return;
  }

  if (IMAGE_HOSTS.some((host) => host.test(url.origin))) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, { limit: IMAGE_LIMIT }));
  }
});

// Lets a future version take over without waiting for every tab to close.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
