'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a plain confirmation stays on screen. */
const VISIBLE_MS = 2600;

/**
 * Longer, because an offer has to be read before it can be taken. Still short
 * enough that the bubble does not become furniture.
 */
const ACTIONABLE_VISIBLE_MS = 7000;

export interface StatusAction {
  readonly label: string;
  readonly onAction: () => void;
}

export interface StatusMessage {
  readonly text: string;
  /** An offer attached to the message, such as undoing what just happened. */
  readonly action?: StatusAction;
}

export type Announce = (text: string, action?: StatusAction) => void;

export function useStatusMessage(): [StatusMessage | null, Announce] {
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback<Announce>((text, action) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setMessage(action ? { text, action } : { text });
    timer.current = setTimeout(() => setMessage(null), action ? ACTIONABLE_VISIBLE_MS : VISIBLE_MS);
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
