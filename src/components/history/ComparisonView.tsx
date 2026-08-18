'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useMealHistory } from '@/hooks/useMealHistory';
import { cn } from '@/lib/cn';
import { compareSessions, orderByRecordedAt, type MetricComparison } from '@/lib/comparison';
import { formatDelta, formatMetricValue, formatPercent, formatRecordedAt } from '@/lib/formatting';
import type { SavedMealSession } from '@/types/history';

const BACK_LINK =
  '-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-xs font-semibold ' +
  'uppercase tracking-[0.1em] text-cream-500 transition-colors duration-200 hover:bg-ash-850 hover:text-cream-100';

const SELECT =
  'h-12 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-sm text-cream-50 focus:border-ember-600';

function describe(record: SavedMealSession): string {
  return `${formatRecordedAt(record.createdAt)} — ${record.restaurantName || 'Unnamed restaurant'}`;
}

/** Amber for a neutral move, green or red only where "better" is meaningful. */
function deltaTone(metric: MetricComparison): string {
  if (metric.delta === null || metric.delta === 0) {
    return 'text-cream-700';
  }
  if (metric.bias === 'neutral') {
    return 'text-cream-300';
  }
  return metric.delta > 0 ? 'text-sesame-400' : 'text-char-500';
}

function MetricRow({ metric }: { metric: MetricComparison }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 border-b border-line-soft py-3 last:border-b-0 sm:grid-cols-[1fr_auto_auto]">
      <p className="micro-label col-span-2 sm:col-span-1 sm:!text-cream-300">{metric.label}</p>

      <p className="tabular text-sm text-cream-500">
        {formatMetricValue(metric.previous, metric.unit, metric.previousMoney)}
        <span aria-hidden="true" className="px-2 text-cream-700">
          →
        </span>
        <span className="font-bold text-cream-50">
          {formatMetricValue(metric.current, metric.unit, metric.currentMoney)}
        </span>
      </p>

      <p className={cn('tabular text-right text-sm font-semibold', deltaTone(metric))}>
        {metric.comparable && metric.delta !== null ? (
          <>
            {formatDelta(metric.delta, metric.unit, metric.currentMoney)}
            {metric.relativeChange !== null && metric.relativeChange !== 0 && (
              <span className="ml-1 text-xs font-normal text-cream-700">
                ({formatPercent(metric.relativeChange)})
              </span>
            )}
          </>
        ) : (
          <span className="text-xs font-normal text-cream-600">Different currencies</span>
        )}
      </p>
    </div>
  );
}

export function ComparisonView() {
  const { status, records } = useMealHistory();
  const previousId = useId();
  const currentId = useId();

  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);

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
          <section aria-labelledby="verdict-shift-heading" className="panel overflow-hidden">
            <div className="grill-texture border-b border-line px-5 py-4 text-center">
              <h2 id="verdict-shift-heading" className="micro-label !text-ember-400">
                Change in performance
              </h2>
            </div>
            <div className="grid gap-px bg-line sm:grid-cols-2">
              <div className="bg-ash-850 px-5 py-6 text-center">
                <p className="micro-label">Last visit</p>
                <p className="mt-1 text-xs text-cream-700">
                  {formatRecordedAt(comparison.previous.record.createdAt)}
                </p>
                <p className="display-type mt-3 text-2xl text-cream-300">
                  {comparison.previous.verdict.title}
                </p>
              </div>
              <div className="bg-ash-850 px-5 py-6 text-center">
                <p className="micro-label">This visit</p>
                <p className="mt-1 text-xs text-cream-700">
                  {formatRecordedAt(comparison.current.record.createdAt)}
                </p>
                <p className="display-type mt-3 text-2xl text-ember-400">
                  {comparison.current.verdict.title}
                </p>
              </div>
            </div>
            <p className="border-t border-line px-5 py-4 text-center text-sm text-cream-300">
              {comparison.summary}
            </p>
          </section>

          <section aria-labelledby="metric-shift-heading" className="panel p-4 sm:p-5">
            <h3 id="metric-shift-heading" className="micro-label mb-1">
              Line by line
            </h3>
            <div>
              {comparison.metrics.map((metric) => (
                <MetricRow key={metric.id} metric={metric} />
              ))}
            </div>
            {comparison.metrics.some((metric) => !metric.comparable) && (
              <p className="mt-3 text-xs leading-relaxed text-cream-700">
                Money figures are shown in the currency recorded for each visit. No currency delta
                is claimed without an exchange-rate assumption.
              </p>
            )}
          </section>

          <section aria-labelledby="category-shift-heading" className="panel p-4 sm:p-5">
            <h3 id="category-shift-heading" className="micro-label mb-3">
              Category mix, in plates
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {comparison.categories.map((category) => (
                <div
                  key={category.id}
                  className="rounded-[10px] border border-line-soft bg-ash-900 px-3 py-3"
                >
                  <p className="micro-label">{category.label}</p>
                  <p className="tabular mt-1 text-sm text-cream-500">
                    {category.previousPlates}
                    <span aria-hidden="true" className="px-1.5 text-cream-700">
                      →
                    </span>
                    <span className="font-bold text-cream-50">{category.currentPlates}</span>
                  </p>
                  <p
                    className={cn(
                      'tabular mt-0.5 text-xs font-semibold',
                      category.delta === 0
                        ? 'text-cream-700'
                        : category.delta > 0
                          ? 'text-sesame-400'
                          : 'text-char-500',
                    )}
                  >
                    {formatDelta(category.delta, 'count')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
