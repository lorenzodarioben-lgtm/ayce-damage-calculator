'use client';

import { useEffect, useState } from 'react';

/**
 * The current time, refreshed on a coarse interval.
 *
 * The clock is never the meal's source of truth — elapsed time is always
 * derived from the instants the ledger recorded — so this only exists to make
 * a derived figure re-render. That is why it can stop ticking entirely while
 * the tab is hidden and simply catch up on return: a backgrounded phone throws
 * timers away, and reading the real clock again is more reliable than trying to
 * keep a counter alive through it.
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const start = () => {
      stop();
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), intervalMs);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        start();
      } else {
        stop();
      }
    };

    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [intervalMs, enabled]);

  return now;
}
