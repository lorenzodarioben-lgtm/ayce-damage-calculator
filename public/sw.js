/*
 * AYCE Damage Calculator service worker.
 *
 * The calculator is entirely client-side, so "offline" only needs the document
 * and the hashed build assets. The caching rules are deliberately conservative:
 *
 *   - Navigations are network-first. A deployed build ships new hashed chunk
 *     names, so serving a stale document from cache would reference chunks that
 *     no longer exist. Cache is the fallback, never the preference.
 *   - /_next/static/* is cache-first. Those URLs are content-hashed, so a hit is
 *     always the exact bytes that URL has ever meant.
 *   - /images/* is cache-first too, but for a weaker reason: those names are
 *     not hashed, so a replaced picture keeps serving from cache until the
 *     version below changes. That is the trade accepted knowingly — a backdrop
 *     is decoration, the offline page should not lose it, and the version is
 *     bumped whenever the artwork changes anyway.
 *   - Everything else passes straight through to the network.
 *
 * Bump CACHE_VERSION to retire every previously cached response.
 */

const CACHE_VERSION = 'v4';
const CACHE_NAME = `ayce-shell-${CACHE_VERSION}`;

const APP_SHELL_URL = '/';
const OFFLINE_URL = '/offline';

/** Requests we are willing to answer from cache when the network is gone. */
const PRECACHE_URLS = [APP_SHELL_URL, OFFLINE_URL];

/*
 * Routes whose documents carry someone's own meal inside the URL. They are
 * rendered on demand and were never available offline, so keeping one would buy
 * nothing and would leave a report, menu or challenge someone shared on this
 * device long after the visit that opened it.
 */
const PRIVATE_PATH_PREFIXES = ['/share/', '/menu/', '/challenge/'];

function carriesSharedData(pathname) {
  return PRIVATE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Individually, so one unavailable URL cannot fail the whole install.
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
        ),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('ayce-shell-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * The page asks for this once the user has been told an update is ready. It is
 * never called automatically: swapping the worker under a running document can
 * leave the page requesting chunks the new build no longer serves.
 */
self.addEventListener('message', (event) => {
  if (event.data === 'ayce:skip-waiting') {
    self.skipWaiting();
  }
});

function isCacheableResponse(response) {
  /*
   * An opaque response has an unreadable status, so storing one would mean
   * caching an unknown. Everything reaching here is already same-origin, which
   * makes a plain 200 safe to keep.
   */
  return Boolean(response) && response.status === 200 && response.type !== 'opaque';
}

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);

  /*
   * Keyed on the path alone. A query such as `?stage=report` describes in-page
   * state rather than a different document, so every variant of a path collapses
   * onto one entry — while distinct routes still each keep their own.
   */
  const pathKey = new Request(`${url.origin}${url.pathname}`);

  try {
    const response = await fetch(request);
    if (!carriesSharedData(url.pathname) && isCacheableResponse(response)) {
      cache.put(pathKey, response.clone());
    }
    return response;
  } catch {
    // A route that was never visited has nothing to restore, so it gets the
    // offline page instead of some other route's document.
    return (await cache.match(pathKey)) ?? (await cache.match(OFFLINE_URL)) ?? Response.error();
  }
}

async function handleStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);

  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/images/')) {
    event.respondWith(handleStaticAsset(request));
  }
});
