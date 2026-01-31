import { describe, expect, it } from 'vitest';
import {
  distributeCents,
  distributeMoney,
  fromCents,
  splitMoneyEvenly,
  toCents,
} from '@/lib/splitMoney';

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

describe('Settling to whole cents', () => {
  it('rounds half away from zero, matching the bill total', () => {
    expect(toCents(12.005)).toBe(1201);
    expect(toCents(12.004)).toBe(1200);
    expect(toCents(-12.005)).toBe(-1201);
  });

  it('treats anything that is not a number as nothing', () => {
    expect(toCents(Number.NaN)).toBe(0);
    expect(toCents(Number.POSITIVE_INFINITY)).toBe(0);
    expect(fromCents(Number.NaN)).toBe(0);
  });
});

describe('Dividing a total so the parts add back up to it', () => {
  it('places the leftover cents rather than losing them', () => {
    const parts = distributeCents(1000, [1, 1, 1]);
    expect(parts).toEqual([334, 333, 333]);
    expect(sum(parts)).toBe(1000);
  });

  it('gives the extra cent to the earlier seat, every time', () => {
    // The tie-break is arbitrary as fairness goes and deterministic as
    // arithmetic goes, which is the property that actually matters.
    expect(distributeCents(1000, [1, 1, 1])).toEqual(distributeCents(1000, [1, 1, 1]));
    // $1.00 seven ways is 14 cents each with two cents spare.
    expect(distributeCents(100, [1, 1, 1, 1, 1, 1, 1])).toEqual([15, 15, 14, 14, 14, 14, 14]);
  });

  it('divides by weight rather than evenly when the seats differ', () => {
    const parts = distributeCents(6000, [50, 10]);
    expect(parts).toEqual([5000, 1000]);
    expect(sum(parts)).toBe(6000);
  });

  it('reconciles a negative total the same way it reconciles a positive one', () => {
    const parts = distributeCents(-1000, [1, 1, 1]);
    expect(sum(parts)).toBe(-1000);
    expect(parts.every((part) => Number.isInteger(part))).toBe(true);
  });

  it('never invents or loses a cent, across many awkward divisors', () => {
    for (let seats = 1; seats <= 12; seats += 1) {
      for (const total of [1, 7, 99, 100, 1234, 5000, 99999, -1, -1234]) {
        const parts = distributeCents(total, new Array<number>(seats).fill(1));
        expect(sum(parts)).toBe(total);
        expect(parts).toHaveLength(seats);
      }
    }
  });

  it('falls back to an even division when nothing has a claim', () => {
    // The money was still paid, so refusing to place it would lose it.
    const parts = distributeCents(300, [0, 0, 0]);
    expect(sum(parts)).toBe(300);
    expect(parts).toEqual([100, 100, 100]);
  });

  it('ignores malformed weights rather than propagating them', () => {
    const parts = distributeCents(1000, [Number.NaN, 1, -5, Number.POSITIVE_INFINITY]);
    expect(sum(parts)).toBe(1000);
    expect(parts.every((part) => Number.isFinite(part))).toBe(true);
    // Only the one real claim can take anything.
    expect(parts[1]).toBe(1000);
  });

  it('has nothing to say about a table with no seats', () => {
    expect(distributeCents(1000, [])).toEqual([]);
    expect(splitMoneyEvenly(10, 0)).toEqual([]);
  });

  it('produces money that sums to the rounded total', () => {
    const parts = distributeMoney(10, [1, 1, 1]);
    expect(parts).toEqual([3.34, 3.33, 3.33]);
    expect(sum(parts.map(toCents))).toBe(1000);
  });

  it('emits no NaN, Infinity or negative phantom share from hostile input', () => {
    const parts = distributeMoney(Number.NaN, [1, 1]);
    expect(parts).toEqual([0, 0]);
    expect(splitMoneyEvenly(50, Number.NaN)).toEqual([]);
  });
});
