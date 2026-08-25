import { MAX_LINE_QUANTITY } from '@/lib/constants';
import type { MealItem } from '@/types/meal';

/**
 * What was ordered, and what was actually eaten.
 *
 * These are two different facts and the calculator has always recorded only the
 * first. That is fine while the plate goes clean, and quietly wrong the moment
 * it does not: an untouched plate of wagyu still counted its full retail value
 * towards beating the buffet, and its full calorie load towards the diner's
 * evening. Both figures were confident and neither was true.
 *
 * So a line may carry a consumed quantity alongside its ordered one. Absence is
 * meaningful and is the default: a line with no consumed quantity was eaten in
 * full, which is what every session recorded before this existed is saying, and
 * what ordinary logging keeps saying without anyone touching a control.
 *
 * Nothing here is framed as a failing. The interface reports ordered, eaten and
 * left, and the arithmetic follows; how much someone eats is not the
 * calculator's business to have an opinion about.
 */

/**
 * Consumption is recorded in quarter plates.
 *
 * Finer than that is false precision — nobody knows they ate three-eighths of a
 * plate of brisket — and coarser cannot express the common case of leaving a
 * little. Quarters divide a plate the way a person actually describes one.
 */
export const CONSUMPTION_STEP = 0.25;

/** Rounds to the nearest recordable increment, without drifting off the cent. */
function toStep(value: number): number {
  return Math.round(value / CONSUMPTION_STEP) * CONSUMPTION_STEP;
}

/**
 * The consumed quantity a line should store, or undefined for "all of it".
 *
 * Returning undefined rather than the ordered quantity is deliberate: an absent
 * value and a full one mean the same thing, and collapsing them to one shape is
 * what keeps an ordinary tab serialising to exactly the bytes it always did.
 */
export function normaliseConsumedQuantity(
  value: unknown,
  orderedQuantity: number,
): number | undefined {
  const ordered = Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(orderedQuantity)));
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  const stepped = toStep(Math.max(0, Math.min(ordered, value)));
  return stepped >= ordered ? undefined : stepped;
}

/**
 * How much of this line was eaten.
 *
 * The invariant every caller relies on: never negative, never more than was
 * ordered, always a finite number.
 */
export function consumedQuantity(item: Pick<MealItem, 'quantity' | 'consumedQuantity'>): number {
  const ordered = Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(item.quantity)));
  if (typeof item.consumedQuantity !== 'number' || !Number.isFinite(item.consumedQuantity)) {
    return ordered;
  }
  return Math.max(0, Math.min(ordered, toStep(item.consumedQuantity)));
}

/** How much of this line was left. Never negative. */
export function uneatenQuantity(item: Pick<MealItem, 'quantity' | 'consumedQuantity'>): number {
  const ordered = Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(item.quantity)));
  return Math.max(0, ordered - consumedQuantity(item));
}

/** True when any of this line was left on the table. */
export function hasUneaten(item: Pick<MealItem, 'quantity' | 'consumedQuantity'>): boolean {
  return uneatenQuantity(item) > 0;
}

/** The share of a line that was eaten, 0–1. Guarded against an empty line. */
export function consumedFraction(item: Pick<MealItem, 'quantity' | 'consumedQuantity'>): number {
  const ordered = Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(item.quantity)));
  return ordered > 0 ? consumedQuantity(item) / ordered : 0;
}

/**
 * Attaches a consumed quantity, dropping the key when the line went clean.
 *
 * The single place that decides the stored shape, so a reducer, a parser and an
 * importer cannot disagree about what "all of it" looks like on disk.
 */
export function withConsumedQuantity(item: MealItem, value: number | undefined): MealItem {
  const consumed = normaliseConsumedQuantity(value, item.quantity);
  if (consumed === undefined) {
    const { consumedQuantity: _consumedQuantity, ...whole } = item;
    return whole;
  }
  return { ...item, consumedQuantity: consumed };
}

/**
 * Keeps a line's consumed quantity inside its ordered quantity.
 *
 * Reducing an order below what was recorded as eaten has to bring the eaten
 * figure down with it — otherwise the tab would claim more was eaten than ever
 * arrived, which is the one thing this model must never say.
 */
export function reconcileConsumption(item: MealItem): MealItem {
  return withConsumedQuantity(item, item.consumedQuantity);
}

/** Formats a quantity of plates that may be a fraction, without false precision. */
export function formatPlateQuantity(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const rounded = toStep(Math.max(0, value));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, '');
}
