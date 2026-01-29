'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ChallengeShareActions } from '@/components/history/ChallengeShareActions';
import { ComparisonReport } from '@/components/history/ComparisonReport';
import { StatusToast } from '@/components/ui/StatusToast';
import { useStatusMessage } from '@/hooks/useStatusMessage';
import { useMealHistory } from '@/hooks/useMealHistory';
import { compareSessions, orderByRecordedAt } from '@/lib/comparison';
import { formatRecordedAt } from '@/lib/formatting';
import type { SavedMealSession } from '@/types/history';

const BACK_LINK =
  '-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-xs font-semibold ' +
  'uppercase tracking-[0.1em] text-cream-500 transition-colors duration-200 hover:bg-ash-850 hover:text-cream-100';

const SELECT =
  'h-12 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-sm text-cream-50 focus:border-ember-600';

function describe(record: SavedMealSession): string {
  return `${formatRecordedAt(record.createdAt)} — ${record.restaurantName || 'Unnamed restaurant'}`;
}

export function ComparisonView() {
  const { status, records } = useMealHistory();
  const previousId = useId();
  const currentId = useId();

  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [status_, announce] = useStatusMessage();

  // Default to the two most recent sessions once history has loaded.
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  if (!defaultsApplied && status === 'ready' && records.length >= 2) {
    setDefaultsApplied(true);
    setLeftId(records[1]?.id ?? null);
    setRightId(records[0]?.id ?? null);
  }

  const comparison = useMemo(() => {
    const left = records.find((record) => record.id === leftId);
    const right = records.find((record) => record.id === rightId);
    if (!left || !right || left.id === right.id) {
      return null;
    }
    const [earlier, later] = orderByRecordedAt(left, right);
    return compareSessions(earlier, later);
  }, [records, leftId, rightId]);

  if (status === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-sm text-cream-700">
        Retrieving the file…
      </p>
    );
  }

  if (records.length < 2) {
    return (
      <div className="panel border-dashed px-6 py-14 text-center">
        <p className="display-type text-2xl text-cream-300">Insufficient evidence.</p>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-cream-700">
          Two filed sessions are needed before a comparison means anything. Currently on file:{' '}
          {records.length}.
        </p>
        <Link
          href="/history"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-[10px] border border-line-ember bg-ash-850 px-5 text-sm font-semibold uppercase tracking-[0.1em] text-ember-400 transition-colors duration-200 hover:bg-ash-800"
        >
          Back to the file
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/history" className={BACK_LINK}>
        <ArrowLeft size={15} aria-hidden="true" />
        Back to the file
      </Link>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={previousId} className="mb-1.5 block text-sm font-semibold text-cream-300">
            Earlier session
          </label>
          <select
            id={previousId}
            value={leftId ?? ''}
            onChange={(event) => setLeftId(event.target.value)}
            className={SELECT}
          >
            {records.map((record) => (
              <option key={record.id} value={record.id}>
                {describe(record)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={currentId} className="mb-1.5 block text-sm font-semibold text-cream-300">
            Later session
          </label>
          <select
            id={currentId}
            value={rightId ?? ''}
            onChange={(event) => setRightId(event.target.value)}
            className={SELECT}
          >
            {records.map((record) => (
              <option key={record.id} value={record.id}>
                {describe(record)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {comparison === null ? (
        <p
          role="status"
          className="panel border-dashed px-6 py-10 text-center text-sm text-cream-700"
        >
          Choose two different sessions to compare.
        </p>
      ) : (
        <>
          <ComparisonReport comparison={comparison} />
          <ChallengeShareActions
            previous={comparison.previous.record}
            current={comparison.current.record}
            onStatus={announce}
          />
        </>
      )}

      <StatusToast message={status_} />
    </div>
  );
}
