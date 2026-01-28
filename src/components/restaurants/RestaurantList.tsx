'use client';

import Link from 'next/link';
import { useMealHistory } from '@/hooks/useMealHistory';
import { useRestaurants } from '@/hooks/useRestaurants';
import { formatMoney, formatPercent, formatRecordedAt } from '@/lib/formatting';
import { summariseRestaurants } from '@/lib/restaurantHub';

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

  const summaries = summariseRestaurants(restaurants, records);

  return (
    <ul className="space-y-3">
      {summaries.map((summary) => (
        <li key={summary.profile.id}>
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
                {summary.profile.dinerCount} {summary.profile.dinerCount === 1 ? 'diner' : 'diners'}
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
  );
}
