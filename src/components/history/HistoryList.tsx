'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { HistoryEntry } from '@/components/history/HistoryEntry';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useMealHistory } from '@/hooks/useMealHistory';
import { cn } from '@/lib/cn';
import { formatRecordedAt } from '@/lib/formatting';
import { sortResolvedSessions } from '@/lib/history';
import type { HistorySortKey, SavedMealSession } from '@/types/history';

const SORTS: ReadonlyArray<{ key: HistorySortKey; label: string }> = [
  { key: 'newest', label: 'Newest' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'plates', label: 'Plates' },
];

type PendingDeletion = { kind: 'one'; record: SavedMealSession } | { kind: 'all' } | null;

export function HistoryList() {
  const { status, records, remove, clear } = useMealHistory();
  const [sort, setSort] = useState<HistorySortKey>('newest');
  const [pending, setPending] = useState<PendingDeletion>(null);

  const ordered = useMemo(() => sortResolvedSessions(records, sort), [records, sort]);

  async function confirmPending() {
    if (pending?.kind === 'one') {
      await remove(pending.record.id);
    } else if (pending?.kind === 'all') {
      await clear();
    }
    setPending(null);
  }

  if (status === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-sm text-cream-700">
        Retrieving the file…
      </p>
    );
  }

  if (records.length === 0) {
    return (
      <div className="panel border-dashed px-6 py-14 text-center">
        <p className="display-type text-2xl text-cream-300">No prior incidents on record.</p>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-cream-700">
          Completed damage reports can be filed here from the report screen. Nothing is uploaded —
          the file stays on this device.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-[10px] border border-line-ember bg-ash-850 px-5 text-sm font-semibold uppercase tracking-[0.1em] text-ember-400 transition-colors duration-200 hover:bg-ash-800"
          >
            Start a session
          </Link>
          {/* An empty file is exactly when someone arrives with a backup. */}
          <Link
            href="/history/data"
            className="inline-flex min-h-12 items-center justify-center rounded-[10px] border border-line bg-ash-850 px-5 text-sm font-semibold uppercase tracking-[0.1em] text-cream-300 transition-colors duration-200 hover:bg-ash-800 hover:text-cream-50"
          >
            Restore a backup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span id="history-sort-label" className="micro-label">
            Order by
          </span>
          <div
            role="group"
            aria-labelledby="history-sort-label"
            className="flex gap-1 rounded-[10px] border border-line bg-ash-900 p-1"
          >
            {SORTS.map((option) => {
              const selected = option.key === sort;
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSort(option.key)}
                  className={cn(
                    'min-h-9 cursor-pointer rounded-[7px] px-3 text-xs font-semibold uppercase tracking-[0.08em] transition-colors duration-200',
                    selected
                      ? 'bg-ember-500 text-ash-950'
                      : 'text-cream-500 hover:bg-ash-800 hover:text-cream-100',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* A comparison needs two sides, so the entry point only appears once
              there is something to compare against. */}
          {records.length >= 2 && (
            <Link
              href="/history/compare"
              className="flex min-h-11 items-center rounded-[10px] border border-line-ember px-3 text-xs font-semibold uppercase tracking-[0.1em] text-ember-400 transition-colors duration-200 hover:bg-ash-800"
            >
              Compare
            </Link>
          )}
          <Link
            href="/history/data"
            className="flex min-h-11 items-center rounded-[10px] border border-line px-3 text-xs font-semibold uppercase tracking-[0.1em] text-cream-300 transition-colors duration-200 hover:bg-ash-800 hover:text-cream-50"
          >
            Backup
          </Link>
          <button
            type="button"
            onClick={() => setPending({ kind: 'all' })}
            className="min-h-11 cursor-pointer rounded-[10px] border border-char-700 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-char-500 transition-colors duration-200 hover:bg-char-700/25 hover:text-cream-100"
          >
            Clear history
          </button>
        </div>
      </div>

      <ul className="space-y-3">
        {ordered.map((session) => (
          <HistoryEntry
            key={session.record.id}
            session={session}
            onDelete={(record) => setPending({ kind: 'one', record })}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === 'all' ? 'Clear the entire file?' : 'Delete this record?'}
        body={
          pending?.kind === 'all'
            ? `This permanently removes all ${records.length} recorded sessions from this device. It cannot be undone.`
            : pending
              ? `This permanently removes the record from ${pending.record.restaurantName || 'an unnamed restaurant'} on ${formatRecordedAt(pending.record.createdAt)}. It cannot be undone.`
              : ''
        }
        confirmLabel={pending?.kind === 'all' ? 'Clear everything' : 'Delete record'}
        cancelLabel="Keep it"
        onConfirm={() => void confirmPending()}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
