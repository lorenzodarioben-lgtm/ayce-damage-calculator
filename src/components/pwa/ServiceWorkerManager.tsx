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

  if (!waiting) {
    return null;
  }

  return (
    <div
      role="status"
      className="relative z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-line-ember bg-ash-850 px-4 py-2 text-center"
    >
      <p className="text-xs text-cream-300">A newer version of the calculator is available.</p>
      <button
        type="button"
        onClick={applyUpdate}
        className="min-h-8 cursor-pointer rounded-[8px] px-2 text-xs font-semibold uppercase tracking-[0.1em] text-ember-400 underline-offset-4 hover:underline"
      >
        Reload to update
      </button>
    </div>
  );
}
