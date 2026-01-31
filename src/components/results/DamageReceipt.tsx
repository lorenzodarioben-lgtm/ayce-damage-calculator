'use client';

import { getPlateSizeMeta, getQualityMeta } from '@/lib/constants';
import { usePricingProfile } from '@/components/session/PricingContext';
import { formatPlateQuantity } from '@/lib/consumption';
import {
  formatCalories,
  formatGrams,
  formatKg,
  formatMoney,
  formatPercent,
  formatRecordedAt,
} from '@/lib/formatting';
import type { Achievement } from '@/lib/achievements';
import type { Verdict } from '@/lib/verdicts';
import type { DamageReport, MealSession } from '@/types/meal';

interface DamageReceiptProps {
  report: DamageReport;
  session: MealSession;
  verdict: Verdict;
  achievements: readonly Achievement[];
  /** ISO timestamp the receipt is issued at. */
  issuedAt: string;
}

const RULE = '='.repeat(44);
const THIN_RULE = '-'.repeat(44);

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

/**
 * The report as a receipt, for paper.
 *
 * Hidden on screen and revealed only by the print stylesheet, which is why it
 * carries no interactive elements at all — a printed page cannot be clicked,
 * so every control would just be ink. Monospace and rules rather than the app's
 * display face: this is meant to read as a docket, not as a share card.
 */
export function DamageReceipt({
  report,
  session,
  verdict,
  achievements,
  issuedAt,
}: DamageReceiptProps) {
  const pricingProfile = usePricingProfile();
  return (
    <div
      className="print-receipt hidden font-mono text-[11px] leading-snug text-black"
      aria-hidden="true"
    >
      <div className="mx-auto max-w-[76ch]">
        <header className="text-center">
          <p className="text-[13px] font-bold tracking-[0.2em]">AYCE DAMAGE CALCULATOR</p>
          <p className="mt-1 tracking-[0.3em]">DAMAGE RECEIPT</p>
        </header>

        <p className="mt-4 whitespace-pre overflow-hidden">{RULE}</p>

        <div className="mt-2">
          <Row label="RESTAURANT" value={session.restaurantName || 'Not recorded'} />
          <Row label="ISSUED" value={formatRecordedAt(issuedAt)} />
          <Row
            label="TABLE"
            value={`${session.dinerCount} ${session.dinerCount === 1 ? 'diner' : 'diners'}`}
          />
        </div>

        <p className="mt-2 whitespace-pre overflow-hidden">{THIN_RULE}</p>

        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left">
              <th scope="col" className="w-10 font-bold">
                QTY
              </th>
              <th scope="col" className="font-bold">
                ITEM
              </th>
              <th scope="col" className="text-right font-bold">
                VALUE
              </th>
            </tr>
          </thead>
          <tbody>
            {report.lines.map((line) => (
              <tr key={line.item.id} className="align-top">
                <td className="pt-1">{line.plates}</td>
                <td className="pt-1">
                  {line.food.name}
                  <span className="block opacity-70">
                    {getQualityMeta(line.item.quality).label} ·{' '}
                    {getPlateSizeMeta(line.item.plateSize).label} · {line.weightG} g
                  </span>
                </td>
                <td className="pt-1 text-right">
                  {formatMoney(line.retailValue, pricingProfile.money)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-2 whitespace-pre overflow-hidden">{THIN_RULE}</p>

        <div className="mt-2">
          <Row label="TOTAL PLATES" value={String(report.totalPlates)} />
          <Row label="TOTAL WEIGHT" value={formatKg(report.totalWeightKg)} />
          <Row label="CALORIES" value={formatCalories(report.nutrition.calories)} />
          <Row label="PROTEIN" value={formatGrams(report.nutrition.protein)} />
          {report.linesWithoutNutrition > 0 && (
            <Row label="NOT RECORDED" value={`${report.linesWithoutNutrition} ITEM(S)`} />
          )}
        </div>

        <p className="mt-2 whitespace-pre overflow-hidden">{THIN_RULE}</p>

        <div className="mt-2">
          {report.totalUneatenPlates > 0 && (
            <Row
              label="ORDERED RETAIL VALUE"
              value={formatMoney(report.totalOrderedRetailValue, pricingProfile.money)}
            />
          )}
          <Row
            label={report.totalUneatenPlates > 0 ? 'EATEN RETAIL VALUE' : 'EST. RETAIL VALUE'}
            value={formatMoney(report.totalRetailValue, pricingProfile.money)}
          />
          {report.totalUneatenPlates > 0 && (
            <Row label="PLATES LEFT" value={formatPlateQuantity(report.totalUneatenPlates)} />
          )}
          {(report.adjustmentCharges > 0 || report.adjustmentDiscounts > 0) && (
            <>
              <Row
                label="ENTRY PRICE"
                value={formatMoney(report.baseAdmission, pricingProfile.money)}
              />
              {report.adjustmentCharges > 0 && (
                <Row
                  label="CHARGES"
                  value={`+${formatMoney(report.adjustmentCharges, pricingProfile.money)}`}
                />
              )}
              {report.adjustmentDiscounts > 0 && (
                <Row
                  label="DISCOUNTS"
                  value={`-${formatMoney(report.adjustmentDiscounts, pricingProfile.money)}`}
                />
              )}
            </>
          )}
          <Row
            label="TOTAL PAID"
            value={formatMoney(report.totalAdmission, pricingProfile.money)}
          />
          <Row
            label="EST. INGREDIENT COST"
            value={formatMoney(report.totalRestaurantCost, pricingProfile.money)}
          />
          <Row
            label="EST. INGREDIENT MARGIN"
            value={formatMoney(report.estimatedIngredientMargin, pricingProfile.money)}
          />
          <Row label="RETAIL RECOVERY" value={formatPercent(report.retailRecoveryPercent)} />
        </div>

        <p className="mt-2 whitespace-pre overflow-hidden">{RULE}</p>

        <div className="mt-3 text-center">
          <p className="tracking-[0.2em]">FINDING</p>
          <p className="mt-1 text-[15px] font-bold tracking-[0.05em]">
            {verdict.title.toUpperCase()}
          </p>
          <p className="mx-auto mt-1 max-w-[52ch]">{verdict.copy}</p>
        </div>

        {achievements.length > 0 && (
          <>
            <p className="mt-3 whitespace-pre overflow-hidden">{THIN_RULE}</p>
            <div className="mt-2">
              <p className="tracking-[0.2em]">COMMENDATIONS</p>
              <ul className="mt-1">
                {achievements.map((achievement) => (
                  <li key={achievement.id}>* {achievement.title}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        <p className="mt-3 whitespace-pre overflow-hidden">{RULE}</p>

        <footer className="mt-2 text-center">
          <p className="mx-auto max-w-[60ch]">
            Estimates only. Prices, portions and nutrition vary by supplier, restaurant and
            preparation. Estimated ingredient margin is not restaurant profit. This document has no
            standing of any kind.
          </p>
          <p className="mt-2 tracking-[0.2em]">THANK YOU FOR YOUR CUSTOM</p>
        </footer>
      </div>
    </div>
  );
}
