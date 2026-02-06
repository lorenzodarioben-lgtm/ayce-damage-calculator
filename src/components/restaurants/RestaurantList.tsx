'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMealHistory } from '@/hooks/useMealHistory';
import { useRestaurants } from '@/hooks/useRestaurants';
import { formatMoney, formatPercent, formatRecordedAt } from '@/lib/formatting';
import { compareRestaurants, summariseRestaurants } from '@/lib/restaurantHub';

/**
 * The places on this device, with what the file says about each.
 *
 * Everything shown is derived from the diner's own records. There is no
 * directory behind this page, no address, no rating and no network call — a
 * restaurant exists here because someone typed its name.
 */
export function RestaurantList() {
  const { restaurants, hydrated } = useRestaurants();
  const { records, status } = useMealHistory();
  const [selected, setSelected] = useState<readonly string[]>([]);
  const summaries = summariseRestaurants(restaurants, records);
  const comparison = useMemo(() => {
    if (selected.length !== 2) return null;
    const [left, right] = selected.map((id) =>
      restaurants.find((restaurant) => restaurant.id === id),
    );
    return left && right ? compareRestaurants(left, right, records) : null;
  }, [records, restaurants, selected]);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : current.length === 2
          ? [current[1]!, id]
          : [...current, id],
    );
  };

  if (!hydrated || status === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-sm text-cream-700">
        Reading the file…
      </p>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="panel border-dashed px-6 py-14 text-center">
        <p className="display-type text-2xl text-cream-300">No places on file.</p>
        <p className="mx-auto mt-3 max-w-[46ch] text-sm leading-relaxed text-cream-700">
          Name a restaurant in the calculator, set its entry price, and save the setup. It appears
          here with every visit you file against it afterwards.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-[10px] border border-line-ember bg-ash-850 px-5 text-sm font-semibold uppercase tracking-[0.1em] text-ember-400 transition-colors duration-200 hover:bg-ash-800"
        >
          Back to the calculator
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {restaurants.length > 1 && (
        <p className="text-sm text-cream-700">
          Select two saved places to compare their explicitly linked local visits.
        </p>
      )}
      {comparison && <RestaurantComparison comparison={comparison} />}
      <ul className="space-y-3">
        {summaries.map((summary) => (
          <li key={summary.profile.id} className="flex gap-3">
            <input
              id={`compare-${summary.profile.id}`}
              type="checkbox"
              checked={selected.includes(summary.profile.id)}
              onChange={() => toggle(summary.profile.id)}
              aria-label={`Compare ${summary.profile.name}`}
              className="mt-5 size-5 accent-ember-500"
            />
            <Link
              href={`/restaurants/${summary.profile.id}`}
              className="panel flex flex-wrap items-baseline justify-between gap-3 p-4 transition-colors duration-200 hover:border-ember-700 hover:bg-ash-800 sm:p-5"
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-bold text-cream-50">
                  {summary.profile.name}
                </span>
                <span className="tabular block text-xs text-cream-500">
                  {formatMoney(summary.profile.pricePerDiner, summary.money)} per diner ·{' '}
                  {summary.profile.dinerCount}{' '}
                  {summary.profile.dinerCount === 1 ? 'diner' : 'diners'}
                </span>
              </span>
              <span className="text-right">
                <span className="tabular block text-sm font-bold text-ember-400">
                  {summary.visits === 0
                    ? 'No visits filed'
                    : `${summary.visits} ${summary.visits === 1 ? 'visit' : 'visits'}`}
                </span>
                <span className="tabular block text-xs text-cream-700">
                  {summary.visits === 0
                    ? 'Saved setup only'
                    : `${formatPercent(summary.averageRecoveryPercent)} average · last ${formatRecordedAt(summary.latestVisitAt ?? '')}`}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RestaurantComparison({
  comparison,
}: {
  comparison: ReturnType<typeof compareRestaurants>;
}) {
  const metrics = [
    ['Visits', (summary: (typeof comparison)['left']) => String(summary.visits)],
    [
      'Average admission',
      (summary: (typeof comparison)['left']) =>
        formatMoney(summary.averageAdmission, summary.money),
    ],
    [
      'Average recovery',
      (summary: (typeof comparison)['left']) => formatPercent(summary.averageRecoveryPercent),
    ],
    [
      'Best recovery',
      (summary: (typeof comparison)['left']) => formatPercent(summary.bestRecoveryPercent),
    ],
    ['Average plates', (summary: (typeof comparison)['left']) => summary.averagePlates.toFixed(1)],
    [
      'Average weight',
      (summary: (typeof comparison)['left']) => `${summary.averageWeightKg.toFixed(2)} kg`,
    ],
  ] as const;
  const foods = (summary: (typeof comparison)['left']) =>
    summary.analytics.topFoods.map((food) => food.name).join(', ') || 'No visits';
  const categories = (summary: (typeof comparison)['left']) =>
    summary.analytics.categories
      .filter((category) => category.plates > 0)
      .map((category) => category.label)
      .join(', ') || 'No visits';
  return (
    <section aria-labelledby="restaurant-comparison" className="panel p-4 sm:p-5">
      <h2 id="restaurant-comparison" className="micro-label mb-3">
        Restaurant comparison
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-cream-500">
              <th>Measure</th>
              <th>{comparison.left.profile.name}</th>
              <th>{comparison.right.profile.name}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(([label, value]) => (
              <tr key={label} className="border-t border-line-soft">
                <th className="py-2 font-medium text-cream-300">{label}</th>
                <td className="py-2 tabular">{value(comparison.left)}</td>
                <td className="py-2 tabular">{value(comparison.right)}</td>
              </tr>
            ))}
            <tr className="border-t border-line-soft">
              <th className="py-2 font-medium text-cream-300">Top foods</th>
              <td className="py-2">{foods(comparison.left)}</td>
              <td className="py-2">{foods(comparison.right)}</td>
            </tr>
            <tr className="border-t border-line-soft">
              <th className="py-2 font-medium text-cream-300">Category mix</th>
              <td className="py-2">{categories(comparison.left)}</td>
              <td className="py-2">{categories(comparison.right)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
