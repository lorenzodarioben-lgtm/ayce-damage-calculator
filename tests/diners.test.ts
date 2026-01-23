import { describe, expect, it } from 'vitest';
import {
  allocationSum,
  findDiner,
  normaliseAllocations,
  reconcileItemAllocations,
  sharedQuantity,
} from '@/lib/diners';
import type { Diner, MealItem } from '@/types/meal';

const DINERS: readonly Diner[] = [
  { id: 'lorenzo', displayName: 'Lorenzo' },
  { id: 'omar', displayName: 'Omar' },
];

function item(quantity: number, allocations?: MealItem['allocations']): MealItem {
  return {
    id: 'beef-brisket__standard__regular',
    foodId: 'beef-brisket',
    quality: 'standard',
    plateSize: 'regular',
    quantity,
    ...(allocations ? { allocations } : {}),
  };
}

describe('Table Mode allocations', () => {
  it('keeps an empty roster as an entirely shared table', () => {
    expect(normaliseAllocations([{ dinerId: 'lorenzo', quantity: 1 }], 2, [])).toEqual([]);
    expect(findDiner([], 'lorenzo')).toBeUndefined();
    expect(sharedQuantity(item(2))).toBe(2);
  });

  it('attributes a whole line to one diner', () => {
    const allocations = normaliseAllocations([{ dinerId: 'lorenzo', quantity: 2 }], 2, DINERS);

    expect(allocations).toEqual([{ dinerId: 'lorenzo', quantity: 2 }]);
    expect(sharedQuantity(item(2, allocations))).toBe(0);
    expect(findDiner(DINERS, 'lorenzo')?.displayName).toBe('Lorenzo');
  });

  it('supports multiple diners while retaining a shared remainder', () => {
    const allocations = normaliseAllocations(
      [
        { dinerId: 'lorenzo', quantity: 1 },
        { dinerId: 'omar', quantity: 1 },
      ],
      3,
      DINERS,
    );

    expect(allocationSum(allocations)).toBe(2);
    expect(sharedQuantity(item(3, allocations))).toBe(1);
  });

  it('represents a fully allocated line without a separate table item', () => {
    const allocations = normaliseAllocations(
      [
        { dinerId: 'lorenzo', quantity: 1 },
        { dinerId: 'omar', quantity: 2 },
      ],
      3,
      DINERS,
    );

    expect(sharedQuantity(item(3, allocations))).toBe(0);
  });

  it('drops malformed references and caps an over-allocation at the line quantity', () => {
    const allocations = normaliseAllocations(
      [
        { dinerId: 'retired', quantity: 3 },
        { dinerId: 'lorenzo', quantity: -1 },
        { dinerId: 'omar', quantity: Number.POSITIVE_INFINITY },
        { dinerId: 'lorenzo', quantity: 5 },
        { dinerId: 'omar', quantity: 5 },
      ],
      3,
      DINERS,
    );

    expect(allocations).toEqual([{ dinerId: 'lorenzo', quantity: 3 }]);
    expect(allocationSum(allocations)).toBeLessThanOrEqual(3);
  });

  it('reconciles allocations predictably when a line quantity is reduced', () => {
    const reconciled = reconcileItemAllocations(
      item(1, [
        { dinerId: 'lorenzo', quantity: 1 },
        { dinerId: 'omar', quantity: 1 },
      ]),
      DINERS,
    );

    expect(reconciled.allocations).toEqual([{ dinerId: 'lorenzo', quantity: 1 }]);
    expect(sharedQuantity(reconciled)).toBe(0);
  });
});
