'use client';

import { useCallback, useEffect, useState } from 'react';

const SKIP_WAITING_MESSAGE = 'ayce:skip-waiting';

/**
 * The browser's own view of the connection, defaulting to connected.
 *
 * Node has defined a global `navigator` since v18 and it carries no `onLine`,
 * so the obvious guard — `typeof navigator === 'undefined'` — passes on the
 * server, reads `undefined`, and treats it as a disconnection. This page is
 * statically prerendered, so that put "You are offline" into the HTML shipped
 * to every visitor, before a line of client code had run and with nothing about
 * their actual connection involved.
 *
 * Only a real boolean is an answer. Anything else means nobody has said
 * otherwise, and the honest default for a page that just loaded over the
 * network is that the network is there.
 */
function browserReportsOnline(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
    ? navigator.onLine
    : true;
}

/**
 * What a lost connection is checked against.
 *
 * Small, same-origin, and always deployed. The service worker passes it
 * straight to the network — it is neither precached nor a hashed build asset —
 * so reaching it means the network was genuinely reachable rather than that a
 * cache answered.
 */
const REACHABILITY_URL = '/manifest.webmanifest';

/** Long enough for a slow connection, short enough not to leave the bar wrong. */
const REACHABILITY_TIMEOUT_MS = 3000;

/**
 * Whether a request actually completes.
 *
 * Any HTTP response counts, including an error status: this asks whether the
 * network carried a request, not whether a resource exists. Only a transport
 * failure — or taking longer than the timeout — reads as offline.
 */
async function networkReachable(): Promise<boolean> {
  if (typeof fetch !== 'function') {
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS);
  try {
    await fetch(REACHABILITY_URL, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Registers the service worker and surfaces waiting updates.
 *
 * The worker is never activated behind the user's back. A build swap mid-session
 * would leave the open document requesting chunks the new deployment no longer
 * has, so the exchange is explicit: the user is told, and the reload is theirs.
 */
export function ServiceWorkerManager() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [deferredInstall, setDeferredInstall] = useState<{ prompt: () => Promise<void> } | null>(
    null,
  );
  const [online, setOnline] = useState(browserReportsOnline);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }

    let cancelled = false;

    async function register() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          // The worker script itself must never come from the HTTP cache, or an
          // update could go unnoticed for as long as the cache entry lives.
          updateViaCache: 'none',
        });
        if (cancelled) {
          return;
        }

        if (registration.waiting) {
          setWaiting(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) {
            return;
          }
          installing.addEventListener('statechange', () => {
            // A worker that reaches "installed" while one is already in control
            // is an update rather than the very first registration.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaiting(installing);
            }
          });
        });
      } catch {
        // Registration is an enhancement; the calculator works without it.
      }
    }

    void register();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    /*
     * Each check supersedes the one before it. A slow verification must not be
     * allowed to land after a newer, faster answer and overwrite it.
     */
    let generation = 0;

    const settle = (value: boolean, from: number) => {
      if (!cancelled && from === generation) {
        setOnline(value);
      }
    };

    /*
     * `navigator.onLine` is a hint, and only one of its answers is worth
     * trusting outright.
     *
     * True is taken at face value: it costs nothing, and the case it would hide
     * — an interface that is up but leads nowhere — is not what this bar
     * claims. False is the unreliable one. The specification only promises that
     * false means no interface is up, and browsers get that wrong: on a machine
     * carrying a virtual adapter, Chrome reports false over a working
     * connection, which is exactly what this app was showing. So a claimed loss
     * is confirmed against the network before it is repeated to anyone.
     *
     * The request costs one HEAD, and only ever when the browser has already
     * said the connection is gone — never on the ordinary path where it is not.
     */
    const update = () => {
      generation += 1;
      const mine = generation;

      if (browserReportsOnline()) {
        settle(true, mine);
        return;
      }

      void networkReachable().then((reachable) => settle(reachable, mine));
    };

    const capture = (event: Event) => {
      event.preventDefault();
      // Nothing to offer where the app is already running as an installed one.
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setDeferredInstall(event as Event & { prompt: () => Promise<void> });
      }
    };
    /*
     * Re-read once on mount, before any listener could have helped. The initial
     * value is taken during render and this runs after paint, so an `online`
     * event arriving in that gap would otherwise be missed entirely — the exact
     * window a service worker's cached first paint tends to open.
     */
    update();

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    /*
     * The events alone are not enough to stay in step with the network.
     *
     * This state starts from `navigator.onLine` at hydration and, before this,
     * only ever moved again when an event arrived. A worker-backed app paints
     * its shell from the cache before the network has settled, so the first
     * reading is often a false "offline" — and the matching `online` event can
     * land before this effect is listening, or never fire at all if the tab was
     * in the background when connectivity returned. The bar then latches on and
     * stays on over a working connection, which is precisely the failure this
     * app was showing: `navigator.onLine` true, requests succeeding, and a
     * banner insisting otherwise.
     *
     * So the reading is refreshed whenever the page is looked at again, and a
     * claimed loss is confirmed against the network before the bar repeats it.
     */
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('beforeinstallprompt', capture);
    return () => {
      cancelled = true;
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('beforeinstallprompt', capture);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waiting) {
      return;
    }
    // controllerchange fires once the waiting worker takes over.
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    });
    waiting.postMessage(SKIP_WAITING_MESSAGE);
    setWaiting(null);
  }, [waiting]);

  const requestInstall = useCallback(async () => {
    const prompt = deferredInstall;
    if (!prompt) {
      return;
    }
    // Browsers issue each deferred prompt once. Remove the stale affordance
    // before awaiting it so a slow or rejected prompt cannot be invoked twice.
    setDeferredInstall(null);
    try {
      await prompt.prompt();
    } catch {
      // Installation remains an enhancement; a browser may withdraw the
      // prompt while the page is open, and the next event can offer a new one.
    }
  }, [deferredInstall]);

  const hasUpdate = waiting !== null;
  const canInstall = deferredInstall !== null;

  // Nothing to say: no waiting build, no installable prompt, and the network is
  // there. The bar is absent from the DOM rather than empty.
  if (!hasUpdate && !canInstall && online) {
    return null;
  }

  return (
    <div
      role="status"
      className="relative z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-line-ember bg-ash-850 bg-[image:var(--fill-panel)] px-4 py-2 text-center shadow-[inset_0_1px_0_rgb(255_250_240/0.05),0_6px_18px_-14px_#000]"
    >
      {/* Each line is tied to the condition it describes: being offline says
          nothing about whether a newer build exists, and claiming one that is
          not waiting would leave the reload with nothing to apply. */}
      {hasUpdate && (
        <p className="text-xs text-cream-300">A newer version of the calculator is available.</p>
      )}
      {!online && (
        <p className="text-xs text-cream-300">
          You are offline. Previously visited pages may remain available.
        </p>
      )}
      {canInstall && (
        <button
          type="button"
          onClick={() => void requestInstall()}
          className="min-h-8 cursor-pointer rounded-[8px] px-2 text-xs font-semibold text-ember-400"
        >
          Install app
        </button>
      )}
      {hasUpdate && (
        <button
          type="button"
          onClick={applyUpdate}
          className="min-h-8 cursor-pointer rounded-[8px] px-2 text-xs font-semibold uppercase tracking-[0.1em] text-ember-400 underline-offset-4 hover:underline"
        >
          Reload to update
        </button>
      )}
    </div>
  );
}
