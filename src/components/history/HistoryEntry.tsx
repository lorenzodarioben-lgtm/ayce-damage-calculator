'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  formatKg,
  formatMoney,
  formatPercent,
  formatPlates,
  formatRecordedAt,
} from '@/lib/formatting';
import type { ResolvedSavedSession } from '@/lib/history';
import type { SavedMealSession } from '@/types/history';

interface HistoryEntryProps {
  /** Already resolved by the list, which had to compute it to sort anyway. */
  session: ResolvedSavedSession;
  onDelete: (record: SavedMealSession) => void;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
}

const TONE = {
  diner: 'text-sesame-400',
  even: 'text-ember-400',
  house: 'text-cream-100',
} as const;

export function HistoryEntry({ session, onDelete, selected = false, onSelect }: HistoryEntryProps) {
  const { record, report, verdict } = session;

  const label = record.restaurantName || 'Unnamed restaurant';

  return (
    <li className="panel relative p-4 transition-colors duration-200 hover:border-line-ember">
      <div className="flex items-start justify-between gap-3">
        {onSelect && (
          <input
            type="checkbox"
            aria-label={`Select ${label}`}
            checked={selected}
            onChange={(event) => onSelect(record.id, event.target.checked)}
            className="relative z-10 mt-1 size-5 accent-ember-500"
          />
        )}
        <div className="min-w-0">
          <p className="micro-label">{formatRecordedAt(record.createdAt)}</p>
          {/* The whole card is the link target; the delete button sits above it. */}
          <h3 className="mt-1 break-words text-sm font-bold text-cream-50">
            <Link href={`/history/${record.id}`} className="after:absolute after:inset-0">
              {label}
            </Link>
          </h3>
          <p className={cn('display-type mt-1.5 text-xl', TONE[verdict.tone])}>{verdict.title}</p>
          {/* Clamped rather than truncated in code, so the full note is still
              in the DOM for anyone reading the card with a screen reader. */}
          {record.note && (
            <p className="mt-1.5 line-clamp-2 break-words text-xs leading-snug text-cream-500">
              {record.note}
            </p>
          )}
          {record.tags.length > 0 && (
            <ul aria-label="Session tags" className="mt-2 flex flex-wrap gap-1.5">
              {record.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-line-ember bg-ash-900 px-2 py-0.5 text-xs font-semibold text-ember-400"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDelete(record)}
          aria-label={`Delete the record from ${label} on ${formatRecordedAt(record.createdAt)}`}
          className="relative z-10 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-transparent text-cream-700 transition-colors duration-200 hover:border-char-700 hover:bg-char-700/20 hover:text-char-500"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>

      <dl className="tabular mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-line-soft pt-3 sm:grid-cols-4">
        <div>
          <dt className="micro-label">Recovery</dt>
          <dd className="text-base font-bold text-ember-400">
            {formatPercent(report.retailRecoveryPercent)}
          </dd>
        </div>
        <div>
          <dt className="micro-label">Retail</dt>
          <dd className="text-base font-bold text-cream-50">
            {formatMoney(report.totalRetailValue)}
          </dd>
        </div>
        <div>
          <dt className="micro-label">Admission</dt>
          <dd className="text-base font-bold text-cream-50">
            {formatMoney(report.totalAdmission)}
          </dd>
        </div>
        <div>
          <dt className="micro-label">Volume</dt>
          <dd className="text-base font-bold text-cream-50">
            {formatPlates(report.totalPlates)}{' '}
            {/* The separator is a real character, so this does not read as
                "3 plates0.47 kg" to a screen reader. */}
            <span className="text-xs font-normal text-cream-700">
              {formatKg(report.totalWeightKg)}
            </span>
          </dd>
        </div>
      </dl>
    </li>
  );
}
