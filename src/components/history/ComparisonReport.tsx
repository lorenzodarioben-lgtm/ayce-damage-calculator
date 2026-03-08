'use client';

import { cn } from '@/lib/cn';
import { formatDelta, formatMetricValue, formatPercent, formatRecordedAt } from '@/lib/formatting';
import type { MetricComparison, SessionComparison } from '@/lib/comparison';

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

interface ComparisonReportProps {
  comparison: SessionComparison;
  /** Names the two sides. A challenge reads differently from a return visit. */
  previousLabel?: string;
  currentLabel?: string;
}

/**
 * One comparison, rendered.
 *
 * Shared by the history comparison page and a received challenge, so the two
 * cannot disagree about what a difference means — and so percentage points
 * stay percentage points in both.
 */
export function ComparisonReport({
  comparison,
  previousLabel = 'Last visit',
  currentLabel = 'This visit',
}: ComparisonReportProps) {
  return (
    <>
      <section aria-labelledby="verdict-shift-heading" className="panel overflow-hidden">
        <div className="grill-texture border-b border-line px-5 py-4 text-center">
          <h2 id="verdict-shift-heading" className="micro-label !text-ember-400">
            Change in performance
          </h2>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-2">
          <div className="bg-ash-850 px-5 py-6 text-center">
            <p className="micro-label">{previousLabel}</p>
            <p className="mt-1 text-xs text-cream-700">
              {formatRecordedAt(comparison.previous.record.createdAt)}
            </p>
            <p className="tabular display-type mt-2 text-3xl text-cream-100">
              {formatPercent(comparison.previous.report.retailRecoveryPercent)}
            </p>
            <p className="display-type mt-2 text-2xl text-cream-300">
              {comparison.previous.verdict.title}
            </p>
          </div>
          <div className="bg-ash-850 px-5 py-6 text-center">
            <p className="micro-label">{currentLabel}</p>
            <p className="mt-1 text-xs text-cream-700">
              {formatRecordedAt(comparison.current.record.createdAt)}
            </p>
            <p className="tabular display-type mt-2 text-3xl text-ember-300">
              {formatPercent(comparison.current.report.retailRecoveryPercent)}
            </p>
            <p className="display-type mt-2 text-2xl text-ember-400">
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
            Money figures are shown in the currency recorded for each visit. No currency delta is
            claimed without an exchange-rate assumption.
          </p>
        )}
      </section>

      <section aria-labelledby="category-shift-heading" className="panel p-4 sm:p-5">
        <h3 id="category-shift-heading" className="micro-label mb-3">
          Category mix, in plates
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {comparison.categories.map((category) => (
            <div key={category.id} className="well px-3 py-3">
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

      <section aria-labelledby="achievement-shift-heading" className="panel p-4 sm:p-5">
        <h3 id="achievement-shift-heading" className="micro-label mb-3">
          Commendations
        </h3>
        {comparison.achievements.previous.length === 0 &&
        comparison.achievements.current.length === 0 ? (
          <p className="text-sm text-cream-700">Neither side earned one.</p>
        ) : (
          <dl className="space-y-3">
            <AchievementGroup label="Newly earned" achievements={comparison.achievements.gained} />
            <AchievementGroup label="Held on to" achievements={comparison.achievements.kept} />
            <AchievementGroup label="Not repeated" achievements={comparison.achievements.lost} />
          </dl>
        )}
      </section>
    </>
  );
}

function AchievementGroup({
  label,
  achievements,
}: {
  label: string;
  achievements: SessionComparison['achievements']['gained'];
}) {
  return (
    <div className="border-t border-line-soft pt-3 first:border-t-0 first:pt-0">
      <dt className="micro-label">{label}</dt>
      <dd className="mt-1 text-sm text-cream-300">
        {achievements.length === 0
          ? '—'
          : achievements.map((achievement) => achievement.title).join(', ')}
      </dd>
    </div>
  );
}
