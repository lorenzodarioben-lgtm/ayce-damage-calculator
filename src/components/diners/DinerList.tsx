'use client';

import Link from 'next/link';
import { EMPTY_STATE_LINK } from '@/components/ui/Button';
import { useMealHistory } from '@/hooks/useMealHistory';
import { useRegularDiners } from '@/hooks/useRegularDiners';
import { summariseDiners, unsavedDinerNames } from '@/lib/dinerHub';
import { formatMoney, formatPlates, formatRecordedAt } from '@/lib/formatting';

/**
 * The people this device knows about, and what the file says about each.
 *
 * A profile is a name and an opaque local id, nothing more. There is no
 * directory to sync, no contact to link, and no way for a person to exist here
 * because of anything except somebody typing their name into a table roster.
 */
export function DinerList() {
  const { diners, hydrated } = useRegularDiners();
  const { records, status } = useMealHistory();

  if (!hydrated || status === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-sm text-cream-700">
        Reading the file…
      </p>
    );
  }

  const summaries = summariseDiners(diners, records);
  const unsaved = unsavedDinerNames(records, diners);

  if (summaries.length === 0) {
    return (
      <div className="panel border-dashed px-6 py-14 text-center">
        <p className="display-type text-2xl text-cream-300">Nobody on file.</p>
        <p className="mx-auto mt-3 max-w-[48ch] text-sm leading-relaxed text-cream-700">
          People appear here when you save them from a table roster. Table Mode is optional — the
          calculator works perfectly well as one shared tab, and nobody is added without you saying
          so.
        </p>
        <Link href="/" className={EMPTY_STATE_LINK}>
          Back to the calculator
        </Link>
        {unsaved.length > 0 && <UnsavedNote names={unsaved} />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {summaries.map((summary) => (
          <li key={summary.diner.id}>
            <Link
              href={`/diners/${summary.diner.id}`}
              className="panel lift-on-hover flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4 hover:border-line-ember hover:shadow-[var(--shadow-raised)] sm:p-5"
            >
              <div className="min-w-0">
                <p className="display-type truncate text-2xl text-cream-50">
                  {summary.diner.displayName}
                </p>
                <p className="tabular mt-1 text-xs text-cream-700">
                  {summary.visits === 0
                    ? 'No meals filed with them yet'
                    : `${summary.visits} ${summary.visits === 1 ? 'meal' : 'meals'} · last ${formatRecordedAt(summary.latestVisitAt ?? '')}`}
                </p>
              </div>
              {summary.visits > 0 && (
                <p className="tabular shrink-0 text-sm text-cream-500">
                  {formatPlates(summary.effectivePlates)} ·{' '}
                  <span className="text-ember-400">
                    {formatMoney(summary.retailValue, summary.money)}
                  </span>
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {unsaved.length > 0 && <UnsavedNote names={unsaved} />}
    </div>
  );
}

/**
 * People who appear on a filed roster but are not saved here.
 *
 * Reported rather than offered: a roster is a snapshot of who was at one table,
 * and re-creating a profile from one would put somebody back in a directory
 * they may have been deliberately removed from.
 */
function UnsavedNote({ names }: { names: readonly string[] }) {
  return (
    <p className="panel border-dashed p-4 text-xs leading-relaxed text-cream-700 sm:p-5">
      {names.length} {names.length === 1 ? 'name appears' : 'names appear'} on a filed roster
      without being saved here: {names.slice(0, 6).join(', ')}
      {names.length > 6 && ', and others'}. Those meals keep their own roster exactly as it was
      recorded; nothing is added back to this list on their behalf.
    </p>
  );
}
