'use client';

import { useMemo } from 'react';
import { usePricingProfile } from '@/components/session/PricingContext';
import { cn } from '@/lib/cn';
import { formatMoney, formatPercent, formatWeight } from '@/lib/formatting';
import {
  UNCERTAINTY_ASSUMPTIONS,
  buildUncertaintyAnalysis,
  scenarioSpreadPercent,
  type ScenarioOutcome,
} from '@/lib/uncertainty';
import type { Diner, MealItem } from '@/types/meal';
import type { FoodItem } from '@/types/meal';

interface UncertaintyPanelProps {
  items: readonly MealItem[];
  pricePerDiner: number;
  dinerCount: number;
  diners?: readonly Diner[] | undefined;
  foods: readonly FoodItem[];
  headingId: string;
}

/**
 * The range behind the headline figure.
 *
 * Collapsed by design. The point estimate stays the report's answer — this is
 * for the reader who wants to know how much that answer depends on assumptions
 * the project chose, and it says out loud that these are scenarios rather than
 * confidence intervals, because they are.
 */
export function UncertaintyPanel({
  items,
  pricePerDiner,
  dinerCount,
  diners,
  foods,
  headingId,
}: UncertaintyPanelProps) {
  const profile = usePricingProfile();

  const analysis = useMemo(
    () =>
      buildUncertaintyAnalysis(
        items,
        { pricePerDiner, dinerCount, ...(diners ? { diners } : {}) },
        profile,
        foods,
      ),
    [items, pricePerDiner, dinerCount, diners, profile, foods],
  );

  if (items.length === 0) {
    return null;
  }

  const scenarios: readonly ScenarioOutcome[] = [
    analysis.conservative,
    analysis.base,
    analysis.optimistic,
  ];

  return (
    <section aria-labelledby={headingId} className="panel p-4 sm:p-5">
      <h3 id={headingId} className="micro-label">
        How firm is this number?
      </h3>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-cream-300">
        {analysis.headline}
      </p>

      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ember-500 underline-offset-4 hover:underline">
          Show the range and what moves it
        </summary>

        <p className="mt-3 max-w-[62ch] text-xs leading-relaxed text-cream-700">
          These are three named scenarios, not confidence intervals. Nothing here was sampled and no
          distribution was estimated — each one simply re-runs the same calculation with the
          assumptions moved to the ends of a range this project chose and states below.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <caption className="sr-only">
              Estimated retail value, recovery and verdict under the conservative, base and upper
              assumptions.
            </caption>
            <thead className="text-xs text-cream-500">
              <tr>
                <th scope="col" className="pb-2 pr-3">
                  Scenario
                </th>
                <th scope="col" className="pb-2 pr-3">
                  Retail value
                </th>
                <th scope="col" className="pb-2 pr-3">
                  Recovery
                </th>
                <th scope="col" className="pb-2 pr-3">
                  Food weight
                </th>
                <th scope="col" className="pb-2">
                  Verdict
                </th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((entry) => (
                <tr
                  key={entry.id}
                  className={cn(
                    'border-t border-line-soft text-cream-200',
                    entry.id === 'base' && 'bg-ash-900',
                  )}
                >
                  <th scope="row" className="py-2 pr-3 text-left font-semibold text-cream-50">
                    {entry.label}
                  </th>
                  <td className="tabular py-2 pr-3 text-ember-400">
                    {formatMoney(entry.retailValue, profile.money)}
                  </td>
                  <td className="tabular py-2 pr-3">{formatPercent(entry.recoveryPercent)}</td>
                  <td className="tabular py-2 pr-3">{formatWeight(entry.weightG)}</td>
                  <td className="py-2 text-xs">{entry.verdictTitle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="tabular mt-2 text-xs text-cream-700">
          The stated range spans {formatPercent(scenarioSpreadPercent(analysis))} of the base
          estimate.{' '}
          {analysis.verdictHolds
            ? 'The verdict is the same at every end of it.'
            : 'The verdict is not the same at every end of it.'}
        </p>

        <h4 className="micro-label mt-5 mb-2">What moves the result most</h4>
        <ul className="space-y-2">
          {analysis.sensitivity.map((entry) => {
            const assumption = UNCERTAINTY_ASSUMPTIONS.find(
              (candidate) => candidate.id === entry.assumptionId,
            );
            return (
              <li key={entry.assumptionId} className="border-t border-line-soft pt-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-cream-50">{entry.label}</span>
                  <span className="tabular text-xs text-cream-500">
                    {entry.effect === 'recovery'
                      ? `${formatPercent(entry.lowRecoveryPercent)} – ${formatPercent(entry.highRecoveryPercent)} recovery`
                      : `${formatMoney(entry.marginSwing, profile.money)} of ingredient cost`}
                  </span>
                </div>
                <p className="mt-1 max-w-[62ch] text-xs leading-relaxed text-cream-700">
                  {assumption?.detail}
                  {entry.changesOutcome
                    ? ' On its own, this assumption decides whether admission was beaten.'
                    : ''}
                </p>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 max-w-[62ch] text-xs leading-relaxed text-cream-700">
          Estimated ingredient margin is still not restaurant profit under any of these scenarios.
          It excludes labour, rent, utilities, tax, waste, sides and every other operating cost.
        </p>
      </details>
    </section>
  );
}
