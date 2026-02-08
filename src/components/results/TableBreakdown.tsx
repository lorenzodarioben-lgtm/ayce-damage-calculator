'use client';

import { usePricingProfile } from '@/components/session/PricingContext';
import { calculateTableSplit } from '@/lib/calculations';
import {
  formatCalories,
  formatGrams,
  formatMoney,
  formatPercent,
  formatPlates,
} from '@/lib/formatting';
import type { DamageReport, MealSession } from '@/types/meal';

export function TableBreakdown({
  session,
  report,
}: {
  session: MealSession;
  report: DamageReport;
}) {
  const pricingProfile = usePricingProfile();
  const { diners, unnamed } = calculateTableSplit(
    session.items,
    session,
    pricingProfile,
    report.lines.map((line) => line.food),
  );
  if (diners.length === 0) return null;
  const hasAdjustments = diners.some((diner) => diner.adjustmentNet !== 0);
  return (
    <section aria-labelledby="table-breakdown-heading" className="panel overflow-x-auto p-4 sm:p-5">
      <h2 id="table-breakdown-heading" className="micro-label">
        Table breakdown
      </h2>
      <p className="mt-1 max-w-[70ch] text-xs leading-relaxed text-cream-700">
        Explicit plates are known ownership. Shared Table plates are estimated evenly across every
        seat the table was charged for.
        {hasAdjustments
          ? ' Charges and discounts follow the same rule: one named to a diner is theirs, and anything charged to the table is split evenly.'
          : ''}
        {unnamed
          ? ' Seats nobody named keep their own share rather than handing it to the people who were named.'
          : ''}
      </p>
      <table className="mt-4 w-full min-w-[580px] text-left text-sm">
        <thead className="text-xs text-cream-500">
          <tr>
            <th scope="col" className="pb-2 pr-3">
              Diner
            </th>
            <th scope="col" className="pb-2 pr-3">
              Plates
            </th>
            <th scope="col" className="pb-2 pr-3">
              {hasAdjustments ? 'Paid' : 'Admission'}
            </th>
            <th scope="col" className="pb-2 pr-3">
              Retail value
            </th>
            <th scope="col" className="pb-2 pr-3">
              Recovery
            </th>
            <th scope="col" className="pb-2">
              Nutrition
            </th>
          </tr>
        </thead>
        <tbody>
          {diners.map((diner) => (
            <tr key={diner.diner.id} className="border-t border-line-soft text-cream-200">
              <th scope="row" className="py-3 pr-3 text-left font-semibold text-cream-50">
                {diner.diner.displayName}
              </th>
              <td className="py-3 pr-3">{formatPlates(diner.effectivePlates)}</td>
              <td className="py-3 pr-3">
                {formatMoney(diner.admission, pricingProfile.money)}
                {diner.adjustmentNet !== 0 && (
                  <span className="block text-xs text-cream-700">
                    {formatMoney(diner.baseAdmission, pricingProfile.money)} entry{' '}
                    {diner.adjustmentNet > 0 ? '+' : '−'}
                    {formatMoney(Math.abs(diner.adjustmentNet), pricingProfile.money)}
                  </span>
                )}
              </td>
              <td className="py-3 pr-3 text-ember-400">
                {formatMoney(diner.retailValue, pricingProfile.money)}
              </td>
              <td className="py-3 pr-3">{formatPercent(diner.retailRecoveryPercent)}</td>
              <td className="py-3">
                {formatCalories(diner.nutrition.calories)} · {formatGrams(diner.nutrition.protein)}{' '}
                protein
              </td>
            </tr>
          ))}
          {unnamed && (
            <tr className="border-t border-line-soft text-cream-500">
              <th scope="row" className="py-3 pr-3 text-left font-semibold">
                {unnamed.seats === 1 ? '1 unnamed seat' : `${unnamed.seats} unnamed seats`}
              </th>
              <td className="py-3 pr-3">{formatPlates(unnamed.sharedPlates)}</td>
              <td className="py-3 pr-3">{formatMoney(unnamed.admission, pricingProfile.money)}</td>
              <td className="py-3 pr-3">
                {formatMoney(unnamed.retailValue, pricingProfile.money)}
              </td>
              <td className="py-3 pr-3">{formatPercent(unnamed.retailRecoveryPercent)}</td>
              <td className="py-3">
                {formatCalories(unnamed.nutrition.calories)} ·{' '}
                {formatGrams(unnamed.nutrition.protein)} protein
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
