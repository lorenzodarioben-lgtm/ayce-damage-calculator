'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { HistoryEntry } from '@/components/history/HistoryEntry';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useMealHistory } from '@/hooks/useMealHistory';
import { cn } from '@/lib/cn';
import { backupFilename, buildBackup, serialiseBackup } from '@/lib/backup';
import { formatRecordedAt } from '@/lib/formatting';
import { filterSessions, sortResolvedSessions } from '@/lib/history';
import { VERDICTS } from '@/lib/verdicts';
import type { HistorySortKey, SavedMealSession } from '@/types/history';

const SORTS: ReadonlyArray<{ key: HistorySortKey; label: string }> = [
  { key: 'newest', label: 'Newest' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'plates', label: 'Plates' },
];

function downloadSubset(records: readonly SavedMealSession[]) {
  const now = new Date();
  const contents = serialiseBackup(buildBackup(records, [], now.toISOString()));
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  link.download = backupFilename(now);
  link.click();
  URL.revokeObjectURL(link.href);
}

type PendingDeletion = { kind: 'one'; record: SavedMealSession } | { kind: 'all' } | null;

export function HistoryList() {
  const { status, records, remove, clear } = useMealHistory();
  const [sort, setSort] = useState<HistorySortKey>('newest');
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [restaurant, setRestaurant] = useState('');
  const [verdict, setVerdict] = useState('');
  const [tag, setTag] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<PendingDeletion>(null);
  const searchId = useId();

  const filtered = useMemo(() => {
    const start = fromDate ? Date.parse(`${fromDate}T00:00:00.000`) : Number.NEGATIVE_INFINITY;
    const end = toDate ? Date.parse(`${toDate}T23:59:59.999`) : Number.POSITIVE_INFINITY;
    return filterSessions(records, query).filter((record) => {
      const timestamp = Date.parse(record.createdAt);
      return (
        timestamp >= start &&
        timestamp <= end &&
        (!restaurant || record.restaurantName === restaurant) &&
        (!verdict || record.snapshot.verdictId === verdict) &&
        (!tag || record.tags.includes(tag))
      );
    });
  }, [fromDate, query, records, restaurant, tag, toDate, verdict]);
  const ordered = useMemo(() => sortResolvedSessions(filtered, sort), [filtered, sort]);
  const restaurants = useMemo(
    () => [...new Set(records.map((record) => record.restaurantName).filter(Boolean))].sort(),
    [records],
  );
  const tags = useMemo(
    () => [...new Set(records.flatMap((record) => record.tags))].sort(),
    [records],
  );
  const hasFilters = Boolean(fromDate || toDate || restaurant || verdict || tag);

  function clearFilters() {
    setFromDate('');
    setToDate('');
    setRestaurant('');
    setVerdict('');
    setTag('');
  }

  const selectedRecords = ordered.filter(({ record }) => selectedIds.has(record.id));
  function toggleSelection(id: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  async function confirmPending() {
    if (pending?.kind === 'one') {
      await remove(pending.record.id);
    } else if (pending?.kind === 'all') {
      if (selectionMode) {
        await Promise.all(selectedRecords.map(({ record }) => remove(record.id)));
        setSelectedIds(new Set());
      } else {
        await clear();
      }
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
      {/* Worth its space only once the file is long enough to lose things in. */}
      {records.length >= 3 && (
        <div className="mb-4">
          <label htmlFor={searchId} className="micro-label mb-2 block">
            Find a session
          </label>
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-700"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Restaurant name, or anything in a note…"
              autoComplete="off"
              className="min-h-11 w-full rounded-[10px] border border-line bg-ash-900 pl-9 pr-11 text-sm text-cream-100 placeholder:text-cream-700 focus:border-ember-600 focus:outline-none"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear the search"
                className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[8px] text-cream-500 transition-colors duration-200 hover:bg-ash-800 hover:text-cream-100"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>
          <p role="status" className="tabular mt-1.5 min-h-4 text-xs text-cream-700">
            {query.trim().length === 0 && !hasFilters
              ? ''
              : `${ordered.length} of ${records.length} sessions match`}
          </p>
        </div>
      )}

      <details className="panel mb-4 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-cream-300">
          Filter history
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-cream-300">
            From date
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-cream-100"
            />
          </label>
          <label className="text-sm text-cream-300">
            To date
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-cream-100"
            />
          </label>
          <label className="text-sm text-cream-300">
            Restaurant
            <select
              value={restaurant}
              onChange={(event) => setRestaurant(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-cream-100"
            >
              <option value="">All restaurants</option>
              {restaurants.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-cream-300">
            Outcome
            <select
              value={verdict}
              onChange={(event) => setVerdict(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-cream-100"
            >
              <option value="">All outcomes</option>
              {VERDICTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-cream-300">
            Tag
            <select
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-cream-100"
            >
              <option value="">All tags</option>
              {tags.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 text-sm font-semibold text-ember-400 hover:text-ember-300"
          >
            Clear all filters
          </button>
        )}
      </details>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectionMode((current) => !current);
              setSelectedIds(new Set());
            }}
            className="min-h-11 rounded-[10px] border border-line px-3 text-xs font-semibold uppercase tracking-[0.1em] text-cream-300 hover:bg-ash-800"
          >
            {selectionMode ? 'Done selecting' : 'Select'}
          </button>
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

      {ordered.length === 0 ? (
        <p className="panel border-dashed px-6 py-12 text-center text-sm text-cream-700">
          No session on file matches that. The records are still there — only the current filters
          are narrowing them.
        </p>
      ) : (
        <>
          {selectionMode && (
            <div
              className="panel mb-3 flex flex-wrap items-center gap-2 p-3"
              role="toolbar"
              aria-label="Selected records actions"
            >
              <span className="text-sm text-cream-300">{selectedRecords.length} selected</span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set(ordered.map(({ record }) => record.id)))}
                className="text-sm font-semibold text-ember-400"
              >
                Select filtered
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-sm font-semibold text-cream-300"
              >
                Clear selection
              </button>
              {selectedRecords.length === 2 && (
                <Link
                  href={`/history/compare?left=${selectedRecords[0]?.record.id}&right=${selectedRecords[1]?.record.id}`}
                  className="text-sm font-semibold text-ember-400"
                >
                  Compare selected
                </Link>
              )}
              {selectedRecords.length > 0 && (
                <button
                  type="button"
                  onClick={() => downloadSubset(selectedRecords.map(({ record }) => record))}
                  className="text-sm font-semibold text-ember-400"
                >
                  Export selected
                </button>
              )}
              {selectedRecords.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPending({ kind: 'all' })}
                  className="text-sm font-semibold text-char-500"
                >
                  Delete selected
                </button>
              )}
            </div>
          )}
          <ul className="space-y-3">
            {ordered.map((session) => (
              <HistoryEntry
                key={session.record.id}
                session={session}
                onDelete={(record) => setPending({ kind: 'one', record })}
                selected={selectedIds.has(session.record.id)}
                {...(selectionMode ? { onSelect: toggleSelection } : {})}
              />
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === 'all'
            ? selectionMode
              ? 'Delete selected records?'
              : 'Clear the entire file?'
            : 'Delete this record?'
        }
        body={
          pending?.kind === 'all'
            ? selectionMode
              ? `This permanently removes ${selectedRecords.length} selected records from this device. It cannot be undone.`
              : `This permanently removes all ${records.length} recorded sessions from this device. It cannot be undone.`
            : pending
              ? `This permanently removes the record from ${pending.record.restaurantName || 'an unnamed restaurant'} on ${formatRecordedAt(pending.record.createdAt)}. It cannot be undone.`
              : ''
        }
        confirmLabel={
          pending?.kind === 'all'
            ? selectionMode
              ? 'Delete selected'
              : 'Clear everything'
            : 'Delete record'
        }
        cancelLabel="Keep it"
        onConfirm={() => void confirmPending()}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
