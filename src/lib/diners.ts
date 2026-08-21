import { MAX_DINER_ID_LENGTH, MAX_DINER_NAME_LENGTH, MAX_LINE_QUANTITY } from '@/lib/constants';
import type { Diner, DinerAllocation, MealItem } from '@/types/meal';

/** IDs are local opaque identifiers, never display names or contact details. */
const DINER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

function safeWhole(value: unknown): number {
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
  return allocations.reduce((sum, allocation) => sum + safeWhole(allocation.quantity), 0);
}

/** The remainder is shared-table food; it is deliberately never negative. */
export function sharedQuantity(item: Pick<MealItem, 'quantity' | 'allocations'>): number {
  return Math.max(0, safeWhole(item.quantity) - allocationSum(item.allocations));
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
  let remaining = safeWhole(lineQuantity);

  for (const allocation of allocations) {
    if (!allocation || !isDinerId(allocation.dinerId) || !activeIds.has(allocation.dinerId)) {
      continue;
    }
    const amount = Math.min(safeWhole(allocation.quantity), remaining);
    if (amount <= 0) {
      continue;
    }
    byDiner.set(allocation.dinerId, (byDiner.get(allocation.dinerId) ?? 0) + amount);
    remaining -= amount;
    if (remaining === 0) {
      break;
    }
  }

  return Array.from(byDiner, ([dinerId, quantity]) => ({ dinerId, quantity }));
}

/** Returns the same canonical line with allocations reconciled to its quantity. */
export function reconcileItemAllocations(
  item: MealItem,
  diners: readonly Diner[] | undefined,
): MealItem {
  const allocations = normaliseAllocations(item.allocations, item.quantity, diners);
  if (allocations.length > 0) {
    return { ...item, allocations };
  }
  const { allocations: _allocations, ...sharedItem } = item;
  return sharedItem;
}
