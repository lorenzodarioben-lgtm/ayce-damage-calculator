import {
  formatCalories,
  formatGrams,
  formatKg,
  formatMoney,
  formatPercent,
  formatSignedMoney,
} from '@/lib/formatting';
import type { Verdict } from '@/lib/verdicts';
import type { DamageReport } from '@/types/meal';

export const CARD_COLOURS = {
  bg: '#0D0C0A',
  panel: '#171411',
  line: '#2A241D',
  cream: '#F3E8D0',
  muted: '#A99B84',
  faint: '#8F8271',
  ember: '#C99557',
  green: '#8FB37A',
  red: '#C4694E',
} as const;

export type StatTone = 'cream' | 'ember' | 'green' | 'red';

export interface CardStat {
  readonly label: string;
  readonly value: string;
  readonly tone: StatTone;
}

export interface ResultCardModel {
  readonly restaurantName: string;
  readonly verdictTitle: string;
  readonly verdictCopy: string;
  readonly volume: readonly [CardStat, CardStat];
  readonly money: readonly [CardStat, CardStat];
  readonly outcome: readonly [CardStat, CardStat];
  readonly nutrition: readonly [CardStat, CardStat];
}

/**
 * The single source of truth for what appears on the shareable card. The DOM
 * preview and the canvas exporter both render this model, so they cannot drift.
 */
export function buildResultCardModel(
  report: DamageReport,
  verdict: Verdict,
  restaurantName: string,
): ResultCardModel {
  const extracted = report.retailValueDifference >= 0;

  return {
    restaurantName,
    verdictTitle: verdict.title,
    verdictCopy: verdict.copy,
    volume: [
      { label: 'Plates', value: String(report.totalPlates), tone: 'cream' },
      { label: 'Eaten', value: formatKg(report.totalWeightKg), tone: 'cream' },
    ],
    money: [
      { label: 'Retail value', value: formatMoney(report.totalRetailValue), tone: 'cream' },
      {
        // Named for what it is: with a voucher or a surcharge on the bill, the
        // entry price is no longer the number this compares against.
        label:
          report.adjustmentCharges > 0 || report.adjustmentDiscounts > 0
            ? 'Total paid'
            : 'Entry price',
        value: formatMoney(report.totalAdmission),
        tone: 'cream',
      },
    ],
    outcome: [
      {
        label: extracted ? 'Value extracted' : 'Value gap',
        value: formatSignedMoney(report.retailValueDifference),
        tone: extracted ? 'green' : 'red',
      },
      {
        label: 'Retail recovered',
        value: formatPercent(report.retailRecoveryPercent),
        tone: 'ember',
      },
    ],
    nutrition: [
      { label: 'Calories', value: formatCalories(report.nutrition.calories), tone: 'cream' },
      { label: 'Protein', value: formatGrams(report.nutrition.protein), tone: 'cream' },
    ],
  };
}

export const CARD_FOOTER = 'Estimates only · AYCE Damage Calculator';
