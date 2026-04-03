'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
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
  const [query, setQuery] = useState('');

  if (!hydrated || status === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-ui text-cream-600">
        Reading the file…
      </p>
    );
  }

  const summaries = summariseDiners(diners, records);
  const unsaved = unsavedDinerNames(records, diners);
  const visibleSummaries = summaries.filter((summary) =>
    summary.diner.displayName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  if (summaries.length === 0) {
    return (
      <EmptyState
        mark="people"
        title="Nobody on file."
        action={
          <>
            <Link href="/" className={EMPTY_STATE_LINK}>
              Back to the calculator
            </Link>
            {unsaved.length > 0 && <UnsavedNote names={unsaved} />}
          </>
        }
      >
        People appear here when you save them from a table roster. Table Mode is optional — the
        calculator works perfectly well as one shared tab, and nobody is added without you saying
        so.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {summaries.length > 1 && (
        <label className="block max-w-md">
          <span className="mb-2 block text-ui font-semibold text-cream-300">Find a diner</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query.length > 0) {
                event.preventDefault();
                setQuery('');
              }
            }}
            placeholder="Search by name"
            className="min-h-11 w-full rounded-surface border border-line-strong bg-ash-900 px-3 text-ui text-cream-50 placeholder:text-cream-600"
          />
        </label>
      )}
      {query.trim() && (
        <p role="status" className="text-caption text-cream-600">
          {visibleSummaries.length} {visibleSummaries.length === 1 ? 'diner' : 'diners'} found.
        </p>
      )}
      <ul className="space-y-2">
        {visibleSummaries.map((summary) => (
          <li key={summary.diner.id}>
            <Link
              href={`/diners/${summary.diner.id}`}
              className="panel lift-on-hover flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4 hover:border-line-ember hover:elevate-raised sm:p-5"
            >
              <div className="min-w-0">
                <p className="display-type truncate text-title text-cream-50">
                  {summary.diner.displayName}
                </p>
                <p className="tabular mt-1 text-caption text-cream-600">
                  {summary.visits === 0
                    ? 'No meals filed with them yet'
                    : `${summary.visits} ${summary.visits === 1 ? 'meal' : 'meals'} · last ${formatRecordedAt(summary.latestVisitAt ?? '')}`}
                </p>
              </div>
              {summary.visits > 0 && (
                <p className="tabular shrink-0 text-ui text-cream-500">
                  {formatPlates(summary.effectivePlates)} ·{' '}
                  <span className="text-cream-100">
                    {formatMoney(summary.retailValue, summary.money)}
                  </span>
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {visibleSummaries.length === 0 && (
        <p className="panel border-dashed p-4 text-ui text-cream-600">
          No diners match “{query.trim()}”.
        </p>
      )}

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
    <p className="panel border-dashed p-4 text-caption leading-relaxed text-cream-600 sm:p-5">
      {names.length} {names.length === 1 ? 'name appears' : 'names appear'} on a filed roster
      without being saved here: {names.slice(0, 6).join(', ')}
      {names.length > 6 && ', and others'}. Those meals keep their own roster exactly as it was
      recorded; nothing is added back to this list on their behalf.
    </p>
  );
}
