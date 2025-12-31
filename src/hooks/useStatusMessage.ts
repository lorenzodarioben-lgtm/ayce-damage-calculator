'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const VISIBLE_MS = 2600;

export function useStatusMessage(): [string | null, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((next: string) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  return [message, announce];
}
