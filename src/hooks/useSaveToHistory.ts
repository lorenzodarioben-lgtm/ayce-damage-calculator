'use client';

import { useCallback, useState } from 'react';
import { createSavedSession, fingerprintSession } from '@/lib/history';
import { saveSession } from '@/lib/historyRepository';
import { createId } from '@/lib/id';
import type { Verdict } from '@/lib/verdicts';
import type { DamageReport, MealSession } from '@/types/meal';

export type SaveState = 'idle' | 'saving' | 'inserted' | 'updated' | 'unavailable';

export interface UseSaveToHistoryResult {
  state: SaveState;
  save: () => Promise<void>;
}

/**
 * Records a completed session on demand. Saving is deliberately an action the
 * diner takes rather than a side effect of opening the report, which is what
 * keeps history a list of meals instead of a list of page views.
 */
export function useSaveToHistory(
  session: MealSession,
  report: DamageReport,
  verdict: Verdict,
): UseSaveToHistoryResult {
  const [state, setState] = useState<SaveState>('idle');
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);

  const fingerprint = fingerprintSession(session);

  // Editing the meal after saving makes the confirmation stale, so the control
  // returns to its resting state and can be used again.
  if (savedFingerprint !== null && savedFingerprint !== fingerprint && state !== 'saving') {
    setSavedFingerprint(null);
    setState('idle');
  }

  const save = useCallback(async () => {
    setState('saving');

    const outcome = await saveSession(
      createSavedSession(session, report, verdict, {
        id: createId(),
        createdAt: new Date().toISOString(),
      }),
    );

    setSavedFingerprint(outcome === 'unavailable' ? null : fingerprintSession(session));
    setState(outcome === 'unavailable' ? 'unavailable' : outcome);
  }, [session, report, verdict]);

  return { state, save };
}
