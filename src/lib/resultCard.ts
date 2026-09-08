import {
  formatCalories,
  formatGrams,
  formatKg,
  formatMoney,
  formatPercent,
  formatSignedMoney,
} from '@/lib/formatting';
import { bandForPercent, type Band } from '@/lib/bands';
import type { Verdict } from '@/lib/verdicts';
import type { DamageReport } from '@/types/meal';

/*
 * The palette, written out rather than read from the stylesheet.
 *
 * These values are consumed by the DOM preview, by a hand-written canvas
 * painter and by three `opengraph-image` routes, none of which can see a CSS
 * custom property — so this is where the app's colours have to be restated,
 * and it has to move whenever they do. It is what other people see.
 */
export const CARD_COLOURS = {
  bg: '#0D0C0A',
  panel: '#171411',
  line: '#63564B',
  cream: '#F3E8D0',
  muted: '#A99B84',
  faint: '#9C8E7A',
  ember: '#E0B47C',
  green: '#8FB37A',
  flame: '#F0855A',
  red: '#D68872',
} as const;

export type StatTone = 'cream' | 'ember' | 'green' | 'flame' | 'red';

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
        // The same three bands the app itself reads by, so the card a diner
        // posts cannot disagree with the screen they read it from.
        label: 'Retail recovered',
        value: formatPercent(report.retailRecoveryPercent),
        tone: CARD_BAND[bandForPercent(report.retailRecoveryPercent)],
      },
    ],
    nutrition: [
      { label: 'Calories', value: formatCalories(report.nutrition.calories), tone: 'cream' },
      { label: 'Protein', value: formatGrams(report.nutrition.protein), tone: 'cream' },
    ],
  };
}

const CARD_BAND: Record<Band, StatTone> = {
  behind: 'ember',
  recovered: 'green',
  runaway: 'flame',
};

export const CARD_FOOTER = 'Estimates only · AYCE Damage Calculator';
