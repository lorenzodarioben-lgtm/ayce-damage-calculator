import { describe, expect, it } from 'vitest';
import {
  createAdjustment,
  normaliseAdjustmentPercent,
  parseAdjustments,
  percentBaseOf,
  resolveAdjustmentAmounts,
  totalAdjustments,
} from '@/lib/adjustments';
import { calculateBillTotals, calculateTableSplit, resolvedAdjustments } from '@/lib/calculations';
import { fingerprintSession } from '@/lib/history';
import { toCents } from '@/lib/splitMoney';
import type { BillAdjustment, Diner, MealItem } from '@/types/meal';

/**
 * A percentage is a share of a bill, not an amount of one.
 *
 * The property under test throughout: a percentage resolves to money exactly
 * once, against a base that contains no percentage, and follows the bill when
 * the bill changes.
 */

/** Ids keep the diner id's alphabet, so a decimal amount cannot leak into one. */
function safeId(prefix: string, amount: number, overrides: Partial<BillAdjustment>): string {
  const digits = String(amount).replace(/[^0-9]/g, '') || '0';
  return `${prefix}-${digits}-${overrides.dinerId ?? 'table'}-${overrides.kind ?? 'charge'}`;
}

function percent(amount: number, overrides: Partial<BillAdjustment> = {}): BillAdjustment {
  return {
    id: safeId('pct', amount, overrides),
    label: 'Service charge',
    amount,
    kind: 'charge',
    basis: 'percent',
    percentBase: 'subtotal',
    ...overrides,
  };
}

function cash(amount: number, overrides: Partial<BillAdjustment> = {}): BillAdjustment {
  return {
    id: safeId('cash', amount, overrides),
    label: 'Drinks',
    amount,
    kind: 'charge',
    ...overrides,
  };
}

const two: readonly Diner[] = [
  { id: 'lorenzo', displayName: 'Lorenzo' },
  { id: 'omar', displayName: 'Omar' },
];

const items: readonly MealItem[] = [
  { id: 'line-1', foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular', quantity: 2 },
];

describe('Reading a percentage', () => {
  it('accepts a usable share and rounds it to two places', () => {
    expect(normaliseAdjustmentPercent(10)).toBe(10);
    expect(normaliseAdjustmentPercent(1.505)).toBe(1.51);
  });

  it('refuses a share that says nothing', () => {
    expect(normaliseAdjustmentPercent(0)).toBeNull();
    expect(normaliseAdjustmentPercent(0.001)).toBeNull();
    expect(normaliseAdjustmentPercent(Number.NaN)).toBeNull();
    expect(normaliseAdjustmentPercent('10')).toBeNull();
  });

  it('caps a share at the whole bill', () => {
    expect(normaliseAdjustmentPercent(500)).toBe(100);
  });

  it('defaults an unstated base to the subtotal rather than guessing', () => {
    const { percentBase: _percentBase, ...unstated } = percent(10);
    expect(percentBaseOf(unstated)).toBe('subtotal');
    expect(percentBaseOf({ ...percent(10), percentBase: 'admission' })).toBe('admission');
  });
});

describe('Building and storing one', () => {
  it('keeps the basis and the base it was quoted against', () => {
    const built = createAdjustment(
      { label: 'Service charge', amount: 10, kind: 'charge', basis: 'percent' },
      'adj-1',
    );
    expect(built).toMatchObject({ amount: 10, basis: 'percent', percentBase: 'subtotal' });
  });

  it('leaves a cash amount exactly as it always was, with no new keys', () => {
    const built = createAdjustment({ label: 'Voucher', amount: 20, kind: 'discount' }, 'adj-2');
    expect(built).toEqual({ id: 'adj-2', label: 'Voucher', amount: 20, kind: 'discount' });
  });

  it('rejects a percentage that is not a usable share', () => {
    expect(
      createAdjustment({ label: 'Service', amount: 0, kind: 'charge', basis: 'percent' }, 'adj-3'),
    ).toBeNull();
  });

  it('round-trips through the parser', () => {
    const parsed = parseAdjustments([percent(12.5, { percentBase: 'admission' })], two);
    expect(parsed[0]).toMatchObject({ amount: 12.5, basis: 'percent', percentBase: 'admission' });
  });

  it('reads a stored record with no basis as the cash amount it has always been', () => {
    const parsed = parseAdjustments(
      [{ id: 'a', label: 'Voucher', amount: 15, kind: 'discount' }],
      two,
    );
    expect(parsed[0]).toEqual({ id: 'a', label: 'Voucher', amount: 15, kind: 'discount' });
  });

  it('treats an unrecognised basis as a cash amount rather than trusting it', () => {
    const parsed = parseAdjustments(
      [{ id: 'a', label: 'Odd', amount: 15, kind: 'charge', basis: 'wat' }],
      two,
    );
    expect(parsed[0]).toEqual({ id: 'a', label: 'Odd', amount: 15, kind: 'charge' });
  });

  it('validates a stored percentage against the percentage bounds', () => {
    expect(parseAdjustments([percent(0)], two)).toEqual([]);
    expect(parseAdjustments([percent(9999)], two)[0]?.amount).toBe(100);
  });
});

describe('Resolving a percentage to money', () => {
  const context = { tableAdmission: 100 };

  it('is a share of the entry price plus the fixed charges already on the bill', () => {
    const resolved = resolveAdjustmentAmounts([cash(20), percent(10)], context);
    // 10% of ($100 entry + $20 drinks).
    expect(resolved[1]?.amount).toBe(12);
  });

  it('is a share of the entry price alone when that is what was stated', () => {
    const resolved = resolveAdjustmentAmounts(
      [cash(20), percent(10, { percentBase: 'admission' })],
      context,
    );
    expect(resolved[1]?.amount).toBe(10);
  });

  it('never compounds, whatever order they were entered in', () => {
    const forwards = resolveAdjustmentAmounts([percent(10), percent(5)], context);
    const backwards = resolveAdjustmentAmounts([percent(5), percent(10)], context);
    expect(forwards.map((entry) => entry.amount).sort()).toEqual(
      backwards.map((entry) => entry.amount).sort(),
    );
    // Each is a share of $100, not of $100 plus the other.
    expect(forwards.map((entry) => entry.amount)).toEqual([10, 5]);
  });

  it('leaves a percentage discount as a discount', () => {
    const resolved = resolveAdjustmentAmounts([percent(25, { kind: 'discount' })], context);
    expect(resolved[0]).toMatchObject({ kind: 'discount', amount: 25 });
  });

  it('hands back plain cash adjustments with no basis left on them', () => {
    const resolved = resolveAdjustmentAmounts([percent(10)], context);
    expect(resolved[0]).not.toHaveProperty('basis');
    expect(resolved[0]).not.toHaveProperty('percentBase');
  });

  it('measures a personal percentage against that person’s own entry price', () => {
    const resolved = resolveAdjustmentAmounts([percent(10, { dinerId: 'lorenzo' })], {
      tableAdmission: 100,
      dinerAdmission: { lorenzo: 40 },
    });
    expect(resolved[0]?.amount).toBe(4);
  });

  it('drops a share that rounds to less than a cent rather than inventing a line', () => {
    expect(resolveAdjustmentAmounts([percent(0.01)], { tableAdmission: 0.01 })).toEqual([]);
  });

  it('does nothing at all to a bill of cash amounts', () => {
    const bill = [cash(20), cash(5, { kind: 'discount' })];
    expect(resolveAdjustmentAmounts(bill, context)).toBe(bill);
  });

  it('emits no NaN or Infinity from a hostile base', () => {
    const resolved = resolveAdjustmentAmounts([percent(10)], {
      tableAdmission: Number.POSITIVE_INFINITY,
    });
    resolved.forEach((entry) => expect(Number.isFinite(entry.amount)).toBe(true));
  });
});

describe('A percentage on a real bill', () => {
  it('never counts a share as though it were dollars', () => {
    // The one wrong answer: reading a 10% service charge as $10.
    const config = { pricePerDiner: 50, dinerCount: 2, adjustments: [percent(10)] };
    expect(calculateBillTotals(config).totalPaid).toBe(110);
    // The raw list is deliberately not summable as money.
    expect(totalAdjustments([percent(10)]).charges).toBe(0);
  });

  it('follows the headcount, which is the whole point of storing a share', () => {
    const forTwo = { pricePerDiner: 50, dinerCount: 2, adjustments: [percent(10)] };
    const forFour = { ...forTwo, dinerCount: 4 };
    expect(calculateBillTotals(forTwo).totalPaid).toBe(110);
    expect(calculateBillTotals(forFour).totalPaid).toBe(220);
  });

  it('follows the entry price too', () => {
    const cheap = { pricePerDiner: 20, dinerCount: 2, adjustments: [percent(10)] };
    const dear = { ...cheap, pricePerDiner: 80 };
    expect(calculateBillTotals(cheap).totalPaid).toBe(44);
    expect(calculateBillTotals(dear).totalPaid).toBe(176);
  });

  it('cannot take the bill below nothing', () => {
    const config = {
      pricePerDiner: 50,
      dinerCount: 2,
      adjustments: [percent(100, { kind: 'discount' }), cash(500, { kind: 'discount' })],
    };
    expect(calculateBillTotals(config).totalPaid).toBe(0);
  });

  it('still settles every seat to the cent', () => {
    const config = {
      pricePerDiner: 50,
      dinerCount: 3,
      diners: two,
      adjustments: [percent(10)],
    };
    const split = calculateTableSplit(items, config);
    const seats = [
      ...split.diners.map((diner) => diner.admission),
      ...(split.unnamed ? [split.unnamed.admission] : []),
    ];
    expect(seats.reduce((sum, value) => sum + toCents(value), 0)).toBe(
      toCents(calculateBillTotals(config).totalPaid),
    );
  });

  it('leaves a bill with no percentages calculating exactly as before', () => {
    const config = {
      pricePerDiner: 59.9,
      dinerCount: 2,
      adjustments: [cash(20), cash(5, { kind: 'discount' })],
    };
    expect(calculateBillTotals(config).totalPaid).toBe(134.8);
    expect(resolvedAdjustments(config)).toBe(config.adjustments);
  });
});

describe('Filing a percentage away', () => {
  it('tells ten percent apart from ten dollars', () => {
    const base = { restaurantName: 'Seoul Garden', pricePerDiner: 50, dinerCount: 2, items: [] };
    const share = percent(10);
    // The same id, label, kind and number, differing only in what it means.
    const { basis: _basis, percentBase: _percentBase, ...asDollars } = share;

    const asShare = fingerprintSession({ ...base, adjustments: [share] });
    const asCash = fingerprintSession({ ...base, adjustments: [asDollars] });
    expect(asShare).not.toBe(asCash);
  });
});
