import { describe, expect, it } from 'vitest';
import { findFood } from '@/data/foods';
import {
  buildDamageReport,
  calculateBillTotals,
  calculateTableSplit,
  tableSeats,
} from '@/lib/calculations';
import { toCents } from '@/lib/splitMoney';
import type { BillAdjustment, Diner, MealItem } from '@/types/meal';

/**
 * The two properties that make a per-person figure worth showing at all.
 *
 * Plates are exhaustive: what every seat carries adds back up to what reached
 * the table, with nobody's share quietly donated to somebody else. Money is
 * exact: what every seat owes adds back up, in cents, to what the table paid.
 */

const ribeye = findFood('beef-ribeye')!;

function item(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 'line-1',
    foodId: ribeye.id,
    quality: 'standard',
    plateSize: 'regular',
    quantity: 1,
    ...overrides,
  };
}

function charge(amount: number, dinerId?: string): BillAdjustment {
  return {
    id: `charge-${amount}-${dinerId ?? 'table'}`,
    label: 'Service charge',
    amount,
    kind: 'charge',
    ...(dinerId ? { dinerId } : {}),
  };
}

function discount(amount: number, dinerId?: string): BillAdjustment {
  return {
    id: `discount-${amount}-${dinerId ?? 'table'}`,
    label: 'Voucher',
    amount,
    kind: 'discount',
    ...(dinerId ? { dinerId } : {}),
  };
}

const two: readonly Diner[] = [
  { id: 'lorenzo', displayName: 'Lorenzo' },
  { id: 'omar', displayName: 'Omar' },
];

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** Every seat's paid amount, named and unnamed alike. */
function seatAdmissions(split: ReturnType<typeof calculateTableSplit>): number[] {
  return [
    ...split.diners.map((diner) => diner.admission),
    ...(split.unnamed ? [split.unnamed.admission] : []),
  ];
}

describe('How many seats the shared food stretches across', () => {
  it('uses the headcount when the roster names fewer people', () => {
    expect(tableSeats({ dinerCount: 4, diners: two })).toBe(4);
  });

  it('uses the roster when it somehow names more people than were charged for', () => {
    expect(tableSeats({ dinerCount: 1, diners: two })).toBe(2);
  });

  it('is the headcount alone when there is no roster', () => {
    expect(tableSeats({ dinerCount: 3 })).toBe(3);
  });
});

describe('A partial roster', () => {
  const config = { pricePerDiner: 50, dinerCount: 4, diners: two };
  const items = [item({ quantity: 4 })];

  it('does not credit the unnamed seats’ food to the people who were named', () => {
    const split = calculateTableSplit(items, config);

    // Four shared plates across four seats, not two.
    expect(split.diners[0]?.sharedPlates).toBeCloseTo(1, 10);
    expect(split.diners[1]?.sharedPlates).toBeCloseTo(1, 10);
    expect(split.seats).toBe(4);
  });

  it('reports the unnamed seats explicitly rather than hiding them', () => {
    const split = calculateTableSplit(items, config);

    expect(split.unnamed).not.toBeNull();
    expect(split.unnamed?.seats).toBe(2);
    expect(split.unnamed?.sharedPlates).toBeCloseTo(2, 10);
  });

  it('reconciles plates exhaustively with what reached the table', () => {
    const split = calculateTableSplit(items, config);
    const report = buildDamageReport(items, config);

    const seated =
      sum(split.diners.map((diner) => diner.effectivePlates)) + (split.unnamed?.sharedPlates ?? 0);
    expect(seated).toBeCloseTo(report.totalPlates, 10);
  });

  it('reconciles retail value and nutrition exhaustively too', () => {
    const split = calculateTableSplit(items, config);
    const report = buildDamageReport(items, config);

    expect(
      sum(split.diners.map((diner) => diner.retailValue)) + (split.unnamed?.retailValue ?? 0),
    ).toBeCloseTo(report.totalRetailValue, 10);
    expect(
      sum(split.diners.map((diner) => diner.nutrition.calories)) +
        (split.unnamed?.nutrition.calories ?? 0),
    ).toBeCloseTo(report.nutrition.calories, 10);
  });

  it('keeps explicit attribution out of the even division', () => {
    const split = calculateTableSplit(
      [item({ quantity: 4, allocations: [{ dinerId: 'lorenzo', quantity: 2 }] })],
      config,
    );

    expect(split.diners[0]?.attributedPlates).toBe(2);
    // Two plates stay shared, across four seats.
    expect(split.diners[0]?.sharedPlates).toBeCloseTo(0.5, 10);
    expect(split.unnamed?.sharedPlates).toBeCloseTo(1, 10);
  });
});

describe('A complete roster', () => {
  it('is semantically unchanged: no unnamed seats, and an even split of what stayed shared', () => {
    const config = { pricePerDiner: 60, dinerCount: 2, diners: two };
    const split = calculateTableSplit([item({ quantity: 3 })], config);

    expect(split.unnamed).toBeNull();
    expect(split.seats).toBe(2);
    expect(split.diners[0]?.sharedPlates).toBeCloseTo(1.5, 10);
    expect(split.diners[1]?.sharedPlates).toBeCloseTo(1.5, 10);
    expect(split.diners[0]?.admission).toBe(60);
    expect(split.diners[1]?.admission).toBe(60);
  });

  it('has nothing to report for a table nobody named', () => {
    const split = calculateTableSplit([item()], { pricePerDiner: 60, dinerCount: 2 });
    expect(split.diners).toEqual([]);
    expect(split.unnamed).toBeNull();
  });
});

describe('What each seat owes', () => {
  /** The invariant: the parts reconcile with the receipt, to the cent. */
  function expectsExactSettlement(
    items: readonly MealItem[],
    config: Parameters<typeof calculateTableSplit>[1],
  ) {
    const split = calculateTableSplit(items, config);
    const paid = calculateBillTotals(config).totalPaid;
    expect(sum(seatAdmissions(split).map(toCents))).toBe(toCents(paid));
  }

  it('adds up exactly for an ordinary evenly-priced table', () => {
    expectsExactSettlement([item()], { pricePerDiner: 60, dinerCount: 2, diners: two });
  });

  it('adds up exactly when a table charge does not divide evenly', () => {
    // $10 across three seats is the case a plain division gets wrong: three
    // diners each shown $3.33 against a table total of $10.00.
    const three: readonly Diner[] = [...two, { id: 'ana', displayName: 'Ana' }];
    const config = {
      pricePerDiner: 50,
      dinerCount: 3,
      diners: three,
      adjustments: [charge(10)],
    };
    expectsExactSettlement([item()], config);

    const split = calculateTableSplit([item()], config);
    expect(seatAdmissions(split)).toEqual([53.34, 53.33, 53.33]);
  });

  it('adds up exactly across unnamed seats as well', () => {
    expectsExactSettlement([item()], {
      pricePerDiner: 50,
      dinerCount: 4,
      diners: two,
      adjustments: [charge(10)],
    });
  });

  it('adds up exactly when one diner’s discount would take them below nothing', () => {
    // The uneven case that plain flooring gets wrong: one seat clamps at zero
    // while the other absorbs the rest, and the two must still equal the bill.
    const uneven: readonly Diner[] = [
      { id: 'lorenzo', displayName: 'Lorenzo', admissionPrice: 5 },
      { id: 'omar', displayName: 'Omar', admissionPrice: 50 },
    ];
    expectsExactSettlement([item()], {
      pricePerDiner: 50,
      dinerCount: 2,
      diners: uneven,
      adjustments: [discount(30)],
    });
  });

  it('adds up exactly when a voucher settles the whole bill to nothing', () => {
    const config = {
      pricePerDiner: 20,
      dinerCount: 3,
      diners: [...two, { id: 'ana', displayName: 'Ana' }],
      adjustments: [discount(500)],
    };
    const split = calculateTableSplit([item()], config);

    expect(calculateBillTotals(config).totalPaid).toBe(0);
    expect(seatAdmissions(split)).toEqual([0, 0, 0]);
    // A zero denominator reports no recovery rather than an infinite one.
    split.diners.forEach((diner) => {
      expect(diner.retailRecoveryPercent).toBe(0);
    });
  });

  it('keeps a personal charge personal and splits the table’s evenly', () => {
    const config = {
      pricePerDiner: 50,
      dinerCount: 2,
      diners: two,
      adjustments: [charge(20, 'lorenzo'), charge(10)],
    };
    const split = calculateTableSplit([item()], config);

    expect(split.diners[0]?.adjustmentNet).toBeCloseTo(25, 10);
    expect(split.diners[1]?.adjustmentNet).toBeCloseTo(5, 10);
    expect(sum(seatAdmissions(split).map(toCents))).toBe(
      toCents(calculateBillTotals(config).totalPaid),
    );
  });

  it('reconciles across every awkward headcount and charge', () => {
    for (let dinerCount = 1; dinerCount <= 8; dinerCount += 1) {
      for (const amount of [0.01, 3.33, 10, 99.99]) {
        for (const adjustments of [[charge(amount)], [discount(amount)]]) {
          const config = { pricePerDiner: 49.9, dinerCount, diners: two, adjustments };
          const split = calculateTableSplit([item({ quantity: 3 })], config);
          expect(sum(seatAdmissions(split).map(toCents))).toBe(
            toCents(calculateBillTotals(config).totalPaid),
          );
        }
      }
    }
  });
});

describe('Hostile and malformed input', () => {
  it('emits no NaN, Infinity or negative phantom figure', () => {
    const split = calculateTableSplit(
      [item({ quantity: Number.NaN, allocations: [{ dinerId: 'omar', quantity: -5 }] })],
      {
        pricePerDiner: Number.NaN,
        dinerCount: Number.POSITIVE_INFINITY,
        diners: two,
        adjustments: [charge(Number.NaN)],
      },
    );

    [...split.diners.map((diner) => diner.admission), split.unnamed?.admission ?? 0].forEach(
      (value) => {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      },
    );
    split.diners.forEach((diner) => {
      expect(Number.isFinite(diner.effectivePlates)).toBe(true);
      expect(diner.effectivePlates).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(diner.retailRecoveryPercent)).toBe(true);
    });
  });

  it('is deterministic: the same table split twice reads the same way', () => {
    const config = {
      pricePerDiner: 33.33,
      dinerCount: 5,
      diners: two,
      adjustments: [charge(7.77)],
    };
    const first = calculateTableSplit([item({ quantity: 7 })], config);
    const second = calculateTableSplit([item({ quantity: 7 })], config);
    expect(first).toEqual(second);
  });
});
