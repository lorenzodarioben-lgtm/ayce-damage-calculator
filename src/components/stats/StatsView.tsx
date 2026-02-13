'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { EMPTY_STATE_LINK } from '@/components/ui/Button';
import { RecoveryTrend } from '@/components/stats/RecoveryTrend';
import { ShareBars } from '@/components/stats/ShareBars';
import { useMealHistory } from '@/hooks/useMealHistory';
import {
  buildHistoryAnalytics,
  compareRecentMealTrends,
  recordsInAnalyticsRange,
  type AnalyticsRange,
} from '@/lib/analytics';
import {
  formatCount,
  formatGrams,
  formatKg,
  formatMoney,
  formatPercent,
  formatPlates,
  formatRecordedAt,
} from '@/lib/formatting';

function Figure({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="panel p-4">
      <p className="micro-label">{label}</p>
      <p className="tabular display-type mt-1 text-3xl text-cream-50">{value}</p>
      {detail && <p className="mt-1 text-xs text-cream-700">{detail}</p>}
    </div>
  );
}

export function StatsView() {
  const { status, records } = useMealHistory();
  const [range, setRange] = useState<AnalyticsRange>('all');
  const rangedRecords = useMemo(() => {
    return recordsInAnalyticsRange(records, range);
  }, [range, records]);
  const analytics = useMemo(() => buildHistoryAnalytics(rangedRecords), [rangedRecords]);
  const mealTrends = useMemo(() => compareRecentMealTrends(rangedRecords), [rangedRecords]);

  if (status === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-sm text-cream-700">
        Reviewing the file…
      </p>
    );
  }

  if (records.length === 0) {
    return (
      <div className="panel border-dashed px-6 py-14 text-center">
        <p className="display-type text-2xl text-cream-300">Nothing to analyse yet.</p>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-cream-700">
          These figures are derived from sessions you have filed. Nothing is estimated and nothing
          is collected — file a report and the analysis appears.
        </p>
        <Link href="/" className={EMPTY_STATE_LINK}>
          Start a session
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section aria-label="Analytics range" className="flex flex-wrap gap-2">
        {(
          [
            ['30', 'Last 30 days'],
            ['90', 'Last 90 days'],
            ['365', 'Last 12 months'],
            ['all', 'All time'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={range === value}
            onClick={() => setRange(value)}
            className={
              range === value
                ? 'rounded-[10px] bg-ember-500 px-3 py-2 text-sm font-semibold text-ash-950'
                : 'rounded-[10px] border border-line px-3 py-2 text-sm font-semibold text-cream-300'
            }
          >
            {label}
          </button>
        ))}
      </section>
      {analytics.sessionCount === 0 ? (
        <p className="panel border-dashed px-6 py-10 text-center text-sm text-cream-700">
          No filed sessions fall within this period.
        </p>
      ) : (
        <>
          <section aria-labelledby="totals-heading">
            <h2 id="totals-heading" className="micro-label mb-3">
              On record
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Figure
                label="Sessions"
                value={formatCount(analytics.sessionCount)}
                detail={`${analytics.sessionsAtBreakEven} at or past break-even`}
              />
              <Figure label="Plates" value={formatCount(analytics.totalPlates)} />
              <Figure
                label="Food"
                value={formatKg(analytics.totalWeightKg)}
                detail={`${formatKg(analytics.averageWeightKg)} average`}
              />
              <Figure label="Protein" value={formatGrams(analytics.totalProteinG)} />
            </div>
          </section>

          <section aria-labelledby="recovery-heading">
            <h2 id="recovery-heading" className="micro-label mb-3">
              Retail recovery
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Figure label="Average" value={formatPercent(analytics.averageRecoveryPercent)} />
              <Figure
                label="Best"
                value={formatPercent(analytics.bestRecoveryPercent)}
                {...(analytics.best
                  ? {
                      detail: `${analytics.best.label} · ${formatRecordedAt(analytics.best.recordedAt)}`,
                    }
                  : {})}
              />
            </div>

            <div className="panel mt-3 p-4 sm:p-5">
              <h3 className="micro-label mb-3">Recent sessions</h3>
              <RecoveryTrend points={analytics.trend} headingId="recovery-trend" />
            </div>
          </section>

          <section aria-labelledby="mix-heading">
            <h2 id="mix-heading" className="micro-label mb-3">
              What gets ordered
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="panel p-4 sm:p-5">
                <h3 className="micro-label mb-3">By category</h3>
                <ShareBars tallies={analytics.categories} unitLabel="plates" />
              </div>
              <div className="panel p-4 sm:p-5">
                <h3 className="micro-label mb-3">By grade</h3>
                <ShareBars tallies={analytics.qualities} unitLabel="plates" />
              </div>
            </div>

            <div className="panel mt-3 p-4 sm:p-5">
              <h3 className="micro-label mb-3">Most ordered cuts</h3>
              <ol className="space-y-2">
                {analytics.topFoods.map((food, index) => (
                  <li
                    key={food.foodId}
                    className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-2 last:border-b-0 last:pb-0"
                  >
                    <span className="flex min-w-0 items-baseline gap-3">
                      <span className="tabular text-xs text-cream-700">{index + 1}</span>
                      <span className="truncate text-sm font-semibold text-cream-100">
                        {food.name}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm text-ember-400">
                      {formatPlates(food.plates)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {analytics.mostPlates && (
            <section aria-labelledby="standout-heading" className="panel p-4 sm:p-5">
              <h2 id="standout-heading" className="micro-label mb-2">
                Largest recorded session
              </h2>
              <p className="text-sm text-cream-300">
                {formatPlates(analytics.mostPlates.value)} at{' '}
                <Link
                  href={`/history/${analytics.mostPlates.id}`}
                  className="text-ember-400 underline-offset-4 hover:underline"
                >
                  {analytics.mostPlates.label}
                </Link>
                , {formatRecordedAt(analytics.mostPlates.recordedAt)}.
              </p>
            </section>
          )}
          {mealTrends.recent.count > 0 && (
            <section aria-labelledby="meal-trends-heading" className="panel p-4 sm:p-5">
              <h2 id="meal-trends-heading" className="micro-label mb-2">
                Recent meal trends
              </h2>
              <p className="mb-4 text-sm text-cream-700">
                Latest {mealTrends.recent.count} filed meal
                {mealTrends.recent.count === 1 ? '' : 's'}
                {mealTrends.previous.count > 0
                  ? ` compared with the immediately previous ${mealTrends.previous.count}.`
                  : '. File at least six meals to compare periods.'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <TrendFigure
                  label="Average recovery"
                  current={formatPercent(mealTrends.recent.averageRecoveryPercent)}
                  previous={mealTrends.previous.averageRecoveryPercent}
                  currentValue={mealTrends.recent.averageRecoveryPercent}
                  unit="pp"
                />
                <TrendFigure
                  label="Break-even frequency"
                  current={formatPercent(mealTrends.recent.breakEvenFrequency)}
                  previous={mealTrends.previous.breakEvenFrequency}
                  currentValue={mealTrends.recent.breakEvenFrequency}
                  unit="pp"
                />
                <TrendFigure
                  label="Average admission"
                  current={formatMoney(mealTrends.recent.averageAdmission)}
                  previous={mealTrends.previous.averageAdmission}
                  currentValue={mealTrends.recent.averageAdmission}
                  unit="%"
                />
                <TrendFigure
                  label="Average plates"
                  current={formatCount(mealTrends.recent.averagePlates)}
                  previous={mealTrends.previous.averagePlates}
                  currentValue={mealTrends.recent.averagePlates}
                  unit="%"
                />
                <TrendFigure
                  label="Average food diversity"
                  current={formatCount(mealTrends.recent.averageDiversity)}
                  previous={mealTrends.previous.averageDiversity}
                  currentValue={mealTrends.recent.averageDiversity}
                  unit="%"
                />
              </div>
              <p className="mt-4 text-xs text-cream-700">
                Changes describe recorded behaviour only; more consumption is not inherently better.
                Recovery and break-even changes are percentage points; the other changes are
                percentages relative to the previous period.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TrendFigure({
  label,
  current,
  previous,
  currentValue,
  unit,
}: {
  label: string;
  current: string;
  previous: number;
  currentValue: number;
  unit: 'pp' | '%';
}) {
  const change =
    unit === 'pp'
      ? currentValue - previous
      : previous === 0
        ? null
        : ((currentValue - previous) / previous) * 100;
  return (
    <Figure
      label={label}
      value={current}
      detail={
        change === null
          ? 'No previous baseline'
          : `${change >= 0 ? '+' : ''}${change.toFixed(1)}${unit} vs previous 5`
      }
    />
  );
}
