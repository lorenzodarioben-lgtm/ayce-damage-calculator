'use client';

import { useId, useState } from 'react';
import { Archive, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePricingProfile } from '@/components/session/PricingContext';
import { useSaveToHistory } from '@/hooks/useSaveToHistory';
import { MAX_SESSION_NOTE_LENGTH } from '@/lib/constants';
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
  const pricingProfile = usePricingProfile();
  const { state, save } = useSaveToHistory(session, report, verdict, pricingProfile);
  const noteId = useId();
  const [note, setNote] = useState('');

  const filed = state === 'inserted' || state === 'updated';
  const settled = state !== 'idle' && state !== 'saving';

  return (
    <div className="space-y-2">
      {/* The note is optional and stays out of the way: a label, a box, and no
          demand that anything be written before the meal can be filed. */}
      <div>
        <label htmlFor={noteId} className="mb-1.5 block text-xs text-cream-700">
          Note for the file (optional)
        </label>
        <textarea
          id={noteId}
          rows={2}
          value={note}
          maxLength={MAX_SESSION_NOTE_LENGTH}
          disabled={filed || state === 'saving'}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Who was there, what was worth ordering again…"
          className="w-full resize-none rounded-[10px] border border-line bg-ash-900 px-3 py-2 text-sm text-cream-100 placeholder:text-cream-700 disabled:opacity-60"
        />
      </div>

      <Button
        variant="secondary"
        fullWidth
        onClick={() => void save(note)}
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
