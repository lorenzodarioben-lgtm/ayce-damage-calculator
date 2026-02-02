'use client';

import { Button } from '@/components/ui/Button';
import type { SessionConflict } from '@/hooks/useMealSession';

interface SessionConflictNoticeProps {
  readonly conflict: SessionConflict;
  readonly onLoadExternal: () => void;
  readonly onKeepCurrent: () => void;
}

/**
 * A deliberate choice point for two tabs that edited the same active meal.
 * The tab never guesses how two ledgers should fit together.
 */
export function SessionConflictNotice({
  conflict,
  onLoadExternal,
  onKeepCurrent,
}: SessionConflictNoticeProps) {
  const changedText =
    conflict.kind === 'reset' ? 'Another tab reset this meal.' : 'Another tab changed this meal.';

  return (
    <section
      role="alert"
      aria-labelledby="session-conflict-heading"
      className="panel border-char-600 bg-char-700/20 p-4"
    >
      <h2 id="session-conflict-heading" className="text-sm font-bold text-cream-50">
        {changedText}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-cream-300">
        This tab has its own edits, so nothing was replaced. Choose which complete meal to keep; the
        app will not merge two tabs’ meal histories.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onLoadExternal}>
          {conflict.kind === 'reset' ? 'Load the reset' : 'Load newer meal'}
        </Button>
        <Button size="sm" variant="secondary" onClick={onKeepCurrent}>
          Keep this tab’s meal
        </Button>
      </div>
    </section>
  );
}
