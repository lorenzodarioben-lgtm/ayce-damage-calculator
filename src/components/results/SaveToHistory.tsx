'use client';

import { Archive, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useSaveToHistory } from '@/hooks/useSaveToHistory';
import type { Verdict } from '@/lib/verdicts';
import type { DamageReport, MealSession } from '@/types/meal';

interface SaveToHistoryProps {
  session: MealSession;
  report: DamageReport;
  verdict: Verdict;
}

const CONFIRMATION = {
  inserted: 'Session filed. The record stays on this device.',
  updated: 'Existing record for this meal updated.',
  unavailable: 'This browser will not store history, so nothing was saved.',
} as const;

export function SaveToHistory({ session, report, verdict }: SaveToHistoryProps) {
  const { state, save } = useSaveToHistory(session, report, verdict);

  const filed = state === 'inserted' || state === 'updated';
  const settled = state !== 'idle' && state !== 'saving';

  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        fullWidth
        onClick={() => void save()}
        disabled={state === 'saving' || filed}
      >
        {filed ? <Check size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
        {state === 'saving' ? 'Filing…' : filed ? 'Filed to history' : 'Save to history'}
      </Button>

      {/* A live region rather than a toast: the outcome belongs next to the
          control that caused it, and saving is not an interruption. */}
      <p
        role="status"
        className={
          state === 'unavailable'
            ? 'text-center text-xs text-char-500'
            : 'text-center text-xs text-cream-700'
        }
      >
        {settled ? CONFIRMATION[state] : ''}
      </p>
    </div>
  );
}
