import { MAX_DINER_ID_LENGTH, MAX_DINER_NAME_LENGTH, MAX_LINE_QUANTITY } from '@/lib/constants';
import type { Diner, DinerAllocation, MealItem } from '@/types/meal';

/** IDs are local opaque identifiers, never display names or contact details. */
const DINER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

/**
 * How finely a plate can be explicitly attributed to one person.
 *
 * A hundredth of a plate: fine enough for the halves, thirds and quarters
 * people actually say, coarse enough that no stored figure carries precision
 * nobody has. Deliberately not the quarter-plate step consumption uses —
 * "how much of this went back" and "how much of this was mine" are different
 * questions, and there is no reason the second should inherit the first's
 * resolution.
 *
 * An even split between a named subset is *not* stored at this resolution, or
 * at any resolution: see `sharedAmong`. One plate between three is a third
 * each, a third does not survive being written down, and the three of them have
 * to add back up to the plate. So that division is kept as a division and
 * performed where it is used.
 */
export const ALLOCATION_STEP = 0.01;

function toStep(value: number): number {
  return Math.round(value / ALLOCATION_STEP) * ALLOCATION_STEP;
}

/** A non-negative, bounded quantity of plates, rounded to the stored step. */
function safeQuantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(MAX_LINE_QUANTITY, toStep(value)));
}

/** A whole number of plates, which is what a line quantity always is. */
function safeLineQuantity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_LINE_QUANTITY, Math.floor(value)))
    : 0;
}

export function isDinerId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_DINER_ID_LENGTH && DINER_ID.test(value);
}

export function normaliseDinerName(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_DINER_NAME_LENGTH)
    : '';
}

/**
 * Totals defensively, so hand-edited state can never make shared plates
 * negative even before a persistence boundary has normalised it.
 */
export function allocationSum(allocations: readonly DinerAllocation[] | undefined): number {
  if (!allocations) {
    return 0;
  }
  return allocations.reduce((sum, allocation) => sum + safeQuantity(allocation.quantity), 0);
}

/** The remainder is shared food; it is deliberately never negative. */
export function sharedQuantity(item: Pick<MealItem, 'quantity' | 'allocations'>): number {
  return Math.max(0, safeLineQuantity(item.quantity) - allocationSum(item.allocations));
}

/**
 * The diners who split this line's remainder, or null for the whole table.
 *
 * Null rather than an empty list on purpose: "everyone" and "nobody" are
 * opposite answers, and a subset that has been emptied — because the people in
 * it left the roster — means the line went back to the table rather than
 * belonging to no one.
 */
export function sharedAmongIds(
  item: Pick<MealItem, 'sharedAmong'>,
  diners: readonly Diner[] | undefined,
): readonly string[] | null {
  if (!item.sharedAmong?.length || !diners?.length) {
    return null;
  }
  const roster = new Set(diners.map((diner) => diner.id));
  const named = [...new Set(item.sharedAmong.filter((id) => isDinerId(id) && roster.has(id)))];
  return named.length > 0 ? named : null;
}

/**
 * One person's share of what nobody claimed outright on this line.
 *
 * The division is performed here rather than stored, which is what lets the
 * shares add back up to the remainder exactly. `seats` is the fallback when
 * nobody named a subset: the whole table shared it, unnamed seats included.
 */
export function sharedShareFor(
  item: Pick<MealItem, 'quantity' | 'allocations' | 'sharedAmong'>,
  dinerId: string,
  diners: readonly Diner[] | undefined,
  seats: number,
): number {
  const remainder = sharedQuantity(item);
  if (remainder <= 0) {
    return 0;
  }
  const subset = sharedAmongIds(item, diners);
  if (!subset) {
    return remainder / Math.max(1, seats);
  }
  // Nobody outside the subset gets any of it, which is the whole point.
  return subset.includes(dinerId) ? remainder / subset.length : 0;
}

/** The part of a line's remainder that no named seat is carrying. */
export function unclaimedSharedQuantity(
  item: Pick<MealItem, 'quantity' | 'allocations' | 'sharedAmong'>,
  diners: readonly Diner[] | undefined,
  seats: number,
  unnamedSeats: number,
): number {
  const remainder = sharedQuantity(item);
  if (remainder <= 0 || unnamedSeats <= 0) {
    return 0;
  }
  // A named subset shared it, so the seats nobody named had none of it.
  return sharedAmongIds(item, diners) ? 0 : (remainder / Math.max(1, seats)) * unnamedSeats;
}

/**
 * Renders a share of a plate without rounding it onto somebody else's grid.
 *
 * Consumption is recorded in quarters, and a third of a plate displayed on that
 * grid reads as a quarter — which is a different number from the one the report
 * is actually using. Shares get their own resolution for the same reason they
 * get their own step.
 */
export function formatSharePlates(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const rounded = toStep(Math.max(0, value));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, '');
}

/** Finds only an active, valid diner from the meal's own immutable roster. */
export function findDiner(
  diners: readonly Diner[] | undefined,
  dinerId: string | null | undefined,
): Diner | undefined {
  if (!isDinerId(dinerId)) {
    return undefined;
  }
  return diners?.find((diner) => diner.id === dinerId);
}

/**
 * Drops malformed or retired diner references, coalesces duplicate entries and
 * caps the running total at the line quantity. Keeping the first entries makes
 * a quantity reduction deterministic and immutable-friendly.
 */
export function normaliseAllocations(
  allocations: readonly DinerAllocation[] | undefined,
  lineQuantity: number,
  diners: readonly Diner[] | undefined,
): readonly DinerAllocation[] {
  if (!allocations || !diners?.length) {
    return [];
  }

  const activeIds = new Set(diners.map((diner) => diner.id).filter(isDinerId));
  const byDiner = new Map<string, number>();
  let remaining = safeLineQuantity(lineQuantity);

  for (const allocation of allocations) {
    if (!allocation || !isDinerId(allocation.dinerId) || !activeIds.has(allocation.dinerId)) {
      continue;
    }
    const amount = Math.min(safeQuantity(allocation.quantity), remaining);
    if (amount <= 0) {
      continue;
    }
    byDiner.set(allocation.dinerId, (byDiner.get(allocation.dinerId) ?? 0) + amount);
    remaining = toStep(remaining - amount);
    if (remaining <= 0) {
      break;
    }
  }

  return Array.from(byDiner, ([dinerId, quantity]) => ({ dinerId, quantity: toStep(quantity) }));
}

/** Keeps a subset to people who are actually on this meal's roster. */
export function normaliseSharedAmong(
  sharedAmong: readonly string[] | undefined,
  diners: readonly Diner[] | undefined,
): readonly string[] {
  if (!sharedAmong?.length || !diners?.length) {
    return [];
  }
  const roster = diners.map((diner) => diner.id);
  const named = new Set(sharedAmong.filter(isDinerId));
  // Kept in roster order rather than selection order, so the same subset always
  // serialises the same way whatever order it was tapped in.
  const kept = roster.filter((id) => named.has(id));
  // Naming everybody is the same statement as naming nobody, and the shorter
  // shape is the one every reader already understands.
  return kept.length > 0 && kept.length < roster.length ? kept : [];
}

/** Returns the same canonical line with its attribution reconciled to it. */
export function reconcileItemAllocations(
  item: MealItem,
  diners: readonly Diner[] | undefined,
): MealItem {
  const allocations = normaliseAllocations(item.allocations, item.quantity, diners);
  const sharedAmong = normaliseSharedAmong(item.sharedAmong, diners);
  const { allocations: _allocations, sharedAmong: _sharedAmong, ...bare } = item;
  return {
    ...bare,
    ...(allocations.length > 0 ? { allocations } : {}),
    // Dropped once there is nothing left for a subset to share, so a line that
    // is entirely accounted for does not carry a claim about a remainder that
    // no longer exists.
    ...(sharedAmong.length > 0 && sharedQuantity({ ...bare, allocations }) > 0
      ? { sharedAmong }
      : {}),
  };
}
