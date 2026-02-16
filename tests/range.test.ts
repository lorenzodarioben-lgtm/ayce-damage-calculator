import { describe, expect, it } from 'vitest';
import { clampToRange } from '@/lib/range';
import { clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import { clampMealDuration } from '@/lib/pacing';
import { clampPlanQuantity, clampTargetRecovery } from '@/lib/planner';
import { MAX_DINERS, MAX_PRICE_PER_DINER, MIN_DINERS, MIN_PRICE_PER_DINER } from '@/lib/constants';

describe('clampToRange', () => {
  it('leaves a value already inside the range alone', () => {
    expect(clampToRange(5, 1, 10, 1)).toBe(5);
    expect(clampToRange(1, 1, 10, 1)).toBe(1);
    expect(clampToRange(10, 1, 10, 1)).toBe(10);
  });

  it('pulls a value back to the nearest bound', () => {
    expect(clampToRange(-40, 1, 10, 1)).toBe(1);
    expect(clampToRange(4000, 1, 10, 1)).toBe(10);
  });

  it('takes the fallback for anything that is not a finite number', () => {
    // Unreadable is a different answer from too small, so it does not simply
    // land on the minimum unless that is what the caller chose.
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(clampToRange(value, 1, 10, 7)).toBe(7);
    }
  });

  it('keeps fractions, leaving any rounding to the caller', () => {
    expect(clampToRange(2.5, 1, 10, 1)).toBe(2.5);
  });
});

describe('the clamps built on it', () => {
  it('bounds a price without losing its cents', () => {
    expect(clampPricePerDiner(59.95)).toBe(59.95);
    expect(clampPricePerDiner(0)).toBe(MIN_PRICE_PER_DINER);
    expect(clampPricePerDiner(9_999)).toBe(MAX_PRICE_PER_DINER);
    expect(clampPricePerDiner(Number.NaN)).toBe(MIN_PRICE_PER_DINER);
  });

  it('rounds a diner count to a whole seat', () => {
    expect(clampDinerCount(2.4)).toBe(2);
    expect(clampDinerCount(2.6)).toBe(3);
    expect(clampDinerCount(0)).toBe(MIN_DINERS);
    expect(clampDinerCount(999)).toBe(MAX_DINERS);
    expect(clampDinerCount(Number.NaN)).toBe(MIN_DINERS);
  });

  it('rounds a booked meal length to whole minutes', () => {
    expect(clampMealDuration(90.4)).toBe(90);
    expect(clampMealDuration(1)).toBe(15);
    expect(clampMealDuration(10_000)).toBe(300);
    expect(clampMealDuration(Number.NaN)).toBe(15);
  });

  it('falls back to the default target rather than the minimum', () => {
    // The one clamp whose unreadable case is not its lower bound.
    expect(clampTargetRecovery(Number.NaN)).toBe(100);
    expect(clampTargetRecovery(120.6)).toBe(121);
  });

  it('floors a plan quantity, because half a plate cannot be ordered', () => {
    expect(clampPlanQuantity(3.9)).toBe(3);
    expect(clampPlanQuantity(0)).toBe(1);
    expect(clampPlanQuantity(Number.NaN)).toBe(1);
  });
});
