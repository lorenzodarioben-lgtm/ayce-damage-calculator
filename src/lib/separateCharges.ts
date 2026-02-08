import { MAX_ADJUSTMENT_AMOUNT } from '@/lib/constants';
import type { MealItem } from '@/types/meal';

/**
 * Food the buffet price did not cover.
 *
 * An all-you-can-eat table rarely pays one number. A beer is extra, a premium
 * cut is a surcharge, the menu charges for a dessert the deal does not include.
 * Until now every one of those had to be logged as though the entry price had
 * bought it, which quietly credited the diner with retail value they had
 * already paid for separately — and made "did we beat the buffet?" a question
 * about a bill that was never a buffet bill.
 *
 * So a line can say two things it could not say before: that it was charged
 * separately, and what was actually paid for it. Both are recorded, never
 * inferred. What a restaurant charges for a beer has no relationship to what
 * the same beer costs at a supermarket, and deriving the one from the other
 * would put a number in the diner's mouth that they never paid.
 *
 * The headline recovery figure stays what it always was: buffet food measured
 * against buffet money. Extras sit beside it in their own terms.
 */

/** True when this line was bought outside the all-you-can-eat price. */
export function isSeparatelyCharged(item: Pick<MealItem, 'separatelyCharged'>): boolean {
  return item.separatelyCharged === true;
}

/**
 * What a line's separate charge should store, or undefined for "not said".
 *
 * Bounded like every other money field that arrives from storage, a token or an
 * imported file. Zero is a real answer — a comped drink was charged nothing —
 * so it is kept rather than collapsed into absence.
 */
export function normaliseSeparateCharge(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.min(MAX_ADJUSTMENT_AMOUNT, Math.round(value * 100) / 100);
}

/** What was paid for this line. Zero for anything included in admission. */
export function separateCharge(
  item: Pick<MealItem, 'separatelyCharged' | 'separateCharge'>,
): number {
  return isSeparatelyCharged(item) ? (normaliseSeparateCharge(item.separateCharge) ?? 0) : 0;
}

/** True when a line is an extra whose price nobody has stated yet. */
export function hasUnpricedCharge(
  item: Pick<MealItem, 'separatelyCharged' | 'separateCharge'>,
): boolean {
  return isSeparatelyCharged(item) && normaliseSeparateCharge(item.separateCharge) === undefined;
}

/**
 * Marks a line as included or separately charged, at a stated price.
 *
 * The single place that decides the stored shape, so a reducer, a parser and an
 * importer cannot disagree about what "included in admission" looks like on
 * disk — which is: nothing at all, exactly as it always was.
 */
export function withSeparateCharge(item: MealItem, separate: boolean, charge?: number): MealItem {
  if (!separate) {
    const { separatelyCharged: _separate, separateCharge: _charge, ...included } = item;
    return included;
  }
  const amount = normaliseSeparateCharge(charge);
  const { separateCharge: _existing, ...rest } = item;
  return {
    ...rest,
    separatelyCharged: true,
    ...(amount === undefined ? {} : { separateCharge: amount }),
  };
}
