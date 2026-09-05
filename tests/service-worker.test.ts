// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * Exercises `public/sw.js` against an in-memory Cache Storage.
 *
 * Browser automation cannot test this: neither Playwright's offline emulation
 * nor its request routing reaches the fetch a service worker makes on its own,
 * so an end-to-end "offline" test would pass while silently using the network.
 * Driving the worker's own event handlers is what actually proves the policy.
 */

const ORIGIN = 'http://localhost:3100';
const SW_SOURCE = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8');

/*
 * Read from the worker rather than restated here. A bump is the one lever that
 * retires a stale shell, and a test carrying its own copy of the version would
 * keep passing against the old one — proving the retirement worked for a name
 * nothing is actually cached under.
 */
const CACHE_VERSION = /const CACHE_VERSION = '([^']+)'/.exec(SW_SOURCE)?.[1];
if (!CACHE_VERSION) {
  throw new Error('public/sw.js no longer declares a CACHE_VERSION to test against.');
}
const CURRENT_CACHE = `ayce-shell-${CACHE_VERSION}`;

/**
 * A stand-in for `Request`. The real constructor rejects `mode: 'navigate'` and
 * refuses relative URLs outside a document, both of which the worker relies on.
 */
class ScopedRequest {
  readonly url: string;
  readonly method: string;
  readonly mode: string;

  constructor(input: string | { url: string }, init: { method?: string; mode?: string } = {}) {
    this.url = new URL(typeof input === 'string' ? input : input.url, ORIGIN).toString();
    this.method = init.method ?? 'GET';
    this.mode = init.mode ?? 'no-cors';
  }
}

type SwRequest = ScopedRequest;
type FetchImpl = (request: SwRequest) => Promise<Response>;

class FakeCache {
  readonly entries = new Map<string, Response>();

  async match(request: SwRequest | string): Promise<Response | undefined> {
    return this.entries.get(keyFor(request));
  }

  async put(request: SwRequest | string, response: Response): Promise<void> {
    this.entries.set(keyFor(request), response);
  }

  async add(request: SwRequest | string): Promise<void> {
    const response = await currentFetch(new ScopedRequest(request));
    if (!response.ok) {
      throw new Error(`add failed: ${response.status}`);
    }
    await this.put(request, response);
  }

  async keys(): Promise<string[]> {
    return [...this.entries.keys()];
  }
}

class FakeCacheStorage {
  readonly stores = new Map<string, FakeCache>();

  async open(name: string): Promise<FakeCache> {
    const existing = this.stores.get(name);
    if (existing) {
      return existing;
    }
    const created = new FakeCache();
    this.stores.set(name, created);
    return created;
  }

  async keys(): Promise<string[]> {
    return [...this.stores.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name);
  }
}

function keyFor(request: SwRequest | string): string {
  return typeof request === 'string' ? new URL(request, ORIGIN).toString() : request.url;
}

let currentFetch: FetchImpl;

interface Harness {
  caches: FakeCacheStorage;
  skipWaiting: ReturnType<typeof vi.fn>;
  claim: ReturnType<typeof vi.fn>;
  install: () => Promise<void>;
  activate: () => Promise<void>;
  navigate: (url: string) => Promise<Response | undefined>;
  request: (
    url: string,
    init?: { method?: string; mode?: string },
  ) => Promise<Response | undefined>;
  message: (data: unknown) => void;
}

function loadServiceWorker(fetchImpl: FetchImpl): Harness {
  currentFetch = fetchImpl;

  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const cacheStorage = new FakeCacheStorage();
  const skipWaiting = vi.fn();
  const claim = vi.fn(async () => undefined);

  const scope = {
    addEventListener(type: string, handler: (event: unknown) => void) {
      const existing = listeners.get(type) ?? [];
      existing.push(handler);
      listeners.set(type, existing);
    },
    location: new URL(ORIGIN),
    clients: { claim },
    skipWaiting,
  };

  const factory = new Function('self', 'caches', 'fetch', 'Response', 'Request', 'URL', SW_SOURCE);
  factory(
    scope,
    cacheStorage,
    (request: SwRequest) => currentFetch(request),
    Response,
    ScopedRequest,
    URL,
  );

  function emit(type: string, event: unknown) {
    for (const handler of listeners.get(type) ?? []) {
      handler(event);
    }
  }

  async function lifecycle(type: 'install' | 'activate') {
    const pending: Array<Promise<unknown>> = [];
    emit(type, { waitUntil: (promise: Promise<unknown>) => pending.push(promise) });
    await Promise.all(pending);
  }

  async function dispatchFetch(request: SwRequest) {
    let responded: Promise<Response> | undefined;
    emit('fetch', {
      request,
      respondWith: (promise: Promise<Response>) => {
        responded = promise;
      },
    });
    return responded ? await responded : undefined;
  }

  return {
    caches: cacheStorage,
    skipWaiting,
    claim,
    install: () => lifecycle('install'),
    activate: () => lifecycle('activate'),
    navigate: (url) => dispatchFetch(new ScopedRequest(url, { mode: 'navigate' })),
    request: (url, init) => dispatchFetch(new ScopedRequest(url, init ?? {})),
    message: (data) => emit('message', { data }),
  };
}

/** A network that answers a fixed map of paths and 404s everything else. */
function networkServing(paths: Record<string, string>): FetchImpl {
  return async (request) => {
    const { pathname } = new URL(request.url);
    const body = paths[pathname];
    if (body === undefined) {
      return new Response('missing', { status: 404 });
    }
    return new Response(body, { status: 200 });
  };
}

const OFFLINE_NETWORK: FetchImpl = async () => {
  throw new TypeError('Failed to fetch');
};

const SHELL = { '/': 'calculator', '/offline': 'offline page' };

describe('Service worker lifecycle', () => {
  it('precaches the calculator shell and the offline page on install', async () => {
    const sw = loadServiceWorker(networkServing(SHELL));
    await sw.install();

    const cache = await sw.caches.open(CURRENT_CACHE);
    expect(await cache.keys()).toEqual(expect.arrayContaining([`${ORIGIN}/`, `${ORIGIN}/offline`]));
  });

  it('installs even when a precache target is unavailable', async () => {
    const sw = loadServiceWorker(networkServing({ '/': 'calculator' }));

    await expect(sw.install()).resolves.toBeUndefined();
    const cache = await sw.caches.open(CURRENT_CACHE);
    expect(await cache.keys()).toEqual([`${ORIGIN}/`]);
  });

  it('retires caches from previous versions and keeps the current one', async () => {
    const sw = loadServiceWorker(networkServing(SHELL));
    await sw.caches.open('ayce-shell-v0');
    await sw.caches.open(CURRENT_CACHE);
    // Belongs to something else on the same origin and must be left alone.
    await sw.caches.open('unrelated-cache');

    await sw.activate();

    expect(await sw.caches.keys()).toEqual(
      expect.arrayContaining([CURRENT_CACHE, 'unrelated-cache']),
    );
    expect(await sw.caches.keys()).not.toContain('ayce-shell-v0');
    expect(sw.claim).toHaveBeenCalled();
  });

  it('activates a waiting worker only when the page explicitly asks', async () => {
    const sw = loadServiceWorker(networkServing(SHELL));

    sw.message('something-else');
    expect(sw.skipWaiting).not.toHaveBeenCalled();

    sw.message('ayce:skip-waiting');
    expect(sw.skipWaiting).toHaveBeenCalledTimes(1);
  });
});

describe('Navigation requests', () => {
  it('prefers the network so a new deployment is never masked by cache', async () => {
    const sw = loadServiceWorker(networkServing({ '/': 'fresh build' }));
    const cache = await sw.caches.open(CURRENT_CACHE);
    await cache.put('/', new Response('stale build'));

    const response = await sw.navigate('/');

    expect(await response?.text()).toBe('fresh build');
  });

  it('collapses query variants of a path onto one cache entry', async () => {
    const sw = loadServiceWorker(networkServing(SHELL));

    await sw.navigate('/');
    await sw.navigate('/?stage=report');

    const cache = await sw.caches.open(CURRENT_CACHE);
    expect(await cache.keys()).toEqual([`${ORIGIN}/`]);
  });

  it('serves the cached document for a path when the network is gone', async () => {
    const sw = loadServiceWorker(networkServing({ '/': 'calculator', '/offline': 'offline page' }));
    await sw.navigate('/');

    currentFetch = OFFLINE_NETWORK;
    const response = await sw.navigate('/?stage=report');

    expect(await response?.text()).toBe('calculator');
  });

  it('falls back to the offline page for a route that was never visited', async () => {
    const sw = loadServiceWorker(networkServing(SHELL));
    await sw.install();

    currentFetch = OFFLINE_NETWORK;
    const response = await sw.navigate('/history');

    expect(await response?.text()).toBe('offline page');
  });

  it("does not keep a document that carries someone else's meal in its URL", async () => {
    const shared = '/share/1.gj4.1.bg-2-2-6.U2VvdWwgR2FyZGVu';
    const sw = loadServiceWorker(networkServing({ ...SHELL, [shared]: 'a shared report' }));

    const response = await sw.navigate(shared);

    // Served, but not kept: a shared report is rendered on demand and was never
    // available offline, so caching one would only leave it on this device.
    expect(await response?.text()).toBe('a shared report');
    const cache = await sw.caches.open(CURRENT_CACHE);
    expect(await cache.keys()).toEqual([]);
  });

  it('keeps no shared menu or challenge either', async () => {
    const paths = ['/menu/abc', '/challenge/abc'];
    const sw = loadServiceWorker(
      networkServing({ ...SHELL, '/menu/abc': 'a menu', '/challenge/abc': 'a challenge' }),
    );

    for (const path of paths) {
      await sw.navigate(path);
    }

    const cache = await sw.caches.open(CURRENT_CACHE);
    expect(await cache.keys()).toEqual([]);
  });

  it('never caches a non-200 document', async () => {
    const sw = loadServiceWorker(networkServing({ '/': 'calculator' }));

    const response = await sw.navigate('/does-not-exist');
    expect(response?.status).toBe(404);

    const cache = await sw.caches.open(CURRENT_CACHE);
    expect(await cache.keys()).toEqual([]);
  });
});

describe('Asset requests', () => {
  it('serves hashed build assets from cache once they are known', async () => {
    const sw = loadServiceWorker(networkServing({ '/_next/static/chunk.js': 'chunk body' }));

    const first = await sw.request('/_next/static/chunk.js');
    expect(await first?.text()).toBe('chunk body');

    // The URL is content-hashed, so a cache hit is always the right bytes.
    currentFetch = OFFLINE_NETWORK;
    const second = await sw.request('/_next/static/chunk.js');
    expect(await second?.text()).toBe('chunk body');
  });

  it('leaves non-GET requests entirely alone', async () => {
    const sw = loadServiceWorker(networkServing(SHELL));

    expect(await sw.request('/', { method: 'POST' })).toBeUndefined();
  });

  it('leaves cross-origin requests entirely alone', async () => {
    const sw = loadServiceWorker(networkServing(SHELL));

    expect(await sw.request('https://example.com/asset.js')).toBeUndefined();
  });

  it('does not intercept same-origin requests outside the build output', async () => {
    const sw = loadServiceWorker(networkServing({ '/api/thing': 'data' }));

    expect(await sw.request('/api/thing')).toBeUndefined();
  });
});
