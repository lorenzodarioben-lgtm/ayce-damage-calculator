'use client';

import { useCallback, useEffect, useState } from 'react';

const SKIP_WAITING_MESSAGE = 'ayce:skip-waiting';

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
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

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
    const update = () => setOnline(navigator.onLine);
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
     * So the property is re-read whenever the page is looked at again. It is
     * the browser's own answer rather than a probe of our own: cheap, correct
     * for the case that actually goes wrong, and never a request the visitor
     * did not ask for. `navigator.onLine` can still only prove the negative —
     * false means definitely no network, true means only that an interface is
     * up — so the bar keeps saying what is safe to say, and says it only while
     * the browser agrees.
     */
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('beforeinstallprompt', capture);
    return () => {
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
