'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { EMPTY_STATE_LINK } from '@/components/ui/Button';
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
  const [query, setQuery] = useState('');
  const summaries = summariseRestaurants(restaurants, records);
  const visibleSummaries = summaries.filter((summary) =>
    summary.profile.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
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
      <p role="status" className="py-16 text-center text-ui text-cream-600">
        Reading the file…
      </p>
    );
  }

  if (restaurants.length === 0) {
    return (
      <EmptyState
        mark="place"
        title="No places on file."
        action={
          <Link href="/" className={EMPTY_STATE_LINK}>
            Back to the calculator
          </Link>
        }
      >
        Name a restaurant in the calculator, set its entry price, and save the setup. It appears
        here with every visit you file against it afterwards.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      {restaurants.length > 1 && (
        <label className="block max-w-md">
          <span className="mb-2 block text-ui font-semibold text-cream-300">Find a saved place</span>
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
      {restaurants.length > 1 && (
        <p id="restaurant-comparison-help" className="text-ui text-cream-600">
          Select two saved places to compare their explicitly linked local visits.
        </p>
      )}
      {comparison && <RestaurantComparison comparison={comparison} />}
      <div
        {...(restaurants.length > 1
          ? {
              role: 'group',
              'aria-label': 'Restaurants to compare',
              'aria-describedby': 'restaurant-comparison-help',
            }
          : {})}
      >
      <ul className="space-y-3">
        {visibleSummaries.map((summary) => (
          <li key={summary.profile.id} className="flex gap-3">
            <label
              htmlFor={`compare-${summary.profile.id}`}
              className="mt-3 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-surface"
            >
              <input
                id={`compare-${summary.profile.id}`}
                type="checkbox"
                checked={selected.includes(summary.profile.id)}
                onChange={() => toggle(summary.profile.id)}
                aria-label={`Compare ${summary.profile.name}`}
                className="size-5 accent-ember-500"
              />
            </label>
            <Link
              href={`/restaurants/${summary.profile.id}`}
              className="panel lift-on-hover flex flex-wrap items-baseline justify-between gap-3 p-4 hover:border-line-strong hover:bg-ash-800 hover:elevate-raised sm:p-5"
            >
              <span className="min-w-0">
                <span className="block truncate text-body font-bold text-cream-50">
                  {summary.profile.name}
                </span>
                <span className="tabular block text-caption text-cream-500">
                  {formatMoney(summary.profile.pricePerDiner, summary.money)} per diner ·{' '}
                  {summary.profile.dinerCount}{' '}
                  {summary.profile.dinerCount === 1 ? 'diner' : 'diners'}
                </span>
              </span>
              <span className="text-right">
                <span className="tabular block text-ui font-bold text-cream-100">
                  {summary.visits === 0
                    ? 'No visits filed'
                    : `${summary.visits} ${summary.visits === 1 ? 'visit' : 'visits'}`}
                </span>
                <span className="tabular block text-caption text-cream-600">
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
      {visibleSummaries.length === 0 && (
        <p className="panel border-dashed p-4 text-ui text-cream-600">
          No saved places match “{query.trim()}”.
        </p>
      )}
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
      <h2 id="restaurant-comparison" className="display-type text-title text-cream-100 mb-3">
        Restaurant comparison
      </h2>
      <div
        role="group"
        aria-label="Restaurant comparison table"
        tabIndex={0}
        className="overflow-x-auto"
      >
        <table className="w-full text-left text-ui">
          {/* Every cell here is read against two headers at once — a measure and
              a place — so both axes have to be declared for a cell to mean
              anything out of visual order. */}
          <caption className="sr-only">
            {`${comparison.left.profile.name} and ${comparison.right.profile.name} compared across every recorded visit.`}
          </caption>
          <thead>
            <tr className="text-cream-500">
              <th scope="col">Measure</th>
              <th scope="col">{comparison.left.profile.name}</th>
              <th scope="col">{comparison.right.profile.name}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(([label, value]) => (
              <tr key={label} className="border-t border-line-soft">
                <th scope="row" className="py-2 font-medium text-cream-300">
                  {label}
                </th>
                <td className="py-2 tabular">{value(comparison.left)}</td>
                <td className="py-2 tabular">{value(comparison.right)}</td>
              </tr>
            ))}
            <tr className="border-t border-line-soft">
              <th scope="row" className="py-2 font-medium text-cream-300">
                Top foods
              </th>
              <td className="py-2">{foods(comparison.left)}</td>
              <td className="py-2">{foods(comparison.right)}</td>
            </tr>
            <tr className="border-t border-line-soft">
              <th scope="row" className="py-2 font-medium text-cream-300">
                Category mix
              </th>
              <td className="py-2">{categories(comparison.left)}</td>
              <td className="py-2">{categories(comparison.right)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
