import { describe, expect, it } from 'vitest';
import {
  createAdjustment,
  isAdjustmentId,
  normaliseAdjustmentAmount,
  normaliseAdjustmentLabel,
  parseAdjustments,
  reconcileAdjustments,
  settleTotal,
  totalAdjustments,
} from '@/lib/adjustments';
import {
  buildDamageReport,
  calculateAdmission,
  calculateBillTotals,
  calculateDinerTotals,
} from '@/lib/calculations';
import {
  MAX_ADJUSTMENT_AMOUNT,
  MAX_ADJUSTMENT_LABEL_LENGTH,
  MAX_BILL_ADJUSTMENTS,
} from '@/lib/constants';
import type { BillAdjustment, Diner, MealItem } from '@/types/meal';

const ROSTER: readonly Diner[] = [
  { id: 'diner-a', displayName: 'Ana' },
  { id: 'diner-b', displayName: 'Ben' },
];

function charge(id: string, amount: number, dinerId?: string): BillAdjustment {
  return {
    id,
    label: 'Card surcharge',
    amount,
    kind: 'charge',
    ...(dinerId === undefined ? {} : { dinerId }),
  };
}

function discount(id: string, amount: number, dinerId?: string): BillAdjustment {
  return {
    id,
    label: 'Voucher',
    amount,
    kind: 'discount',
    ...(dinerId === undefined ? {} : { dinerId }),
  };
}

const ITEMS: readonly MealItem[] = [
  {
    id: 'beef-ribeye__standard__regular',
    foodId: 'beef-ribeye',
    quality: 'standard',
    plateSize: 'regular',
    quantity: 4,
  },
];

describe('Normalising what someone typed', () => {
  it('collapses and caps a label', () => {
    expect(normaliseAdjustmentLabel('  Weekend   surcharge  ')).toBe('Weekend surcharge');
    expect(normaliseAdjustmentLabel('x'.repeat(200))).toHaveLength(MAX_ADJUSTMENT_LABEL_LENGTH);
    expect(normaliseAdjustmentLabel(42)).toBe('');
  });

  it('rounds money to the cent and takes the magnitude', () => {
    expect(normaliseAdjustmentAmount(12.005)).toBe(12.01);
    expect(normaliseAdjustmentAmount(12.004)).toBe(12);
    // The direction lives in `kind`, so a stored sign could only contradict it.
    expect(normaliseAdjustmentAmount(-8.5)).toBe(8.5);
  });

  it('refuses an amount that is not one', () => {
    for (const value of [0, 0.004, Number.NaN, Number.POSITIVE_INFINITY, '5', null, undefined]) {
      expect(normaliseAdjustmentAmount(value)).toBeNull();
    }
  });

  it('clamps an absurd amount rather than rejecting it', () => {
    expect(normaliseAdjustmentAmount(9_999_999)).toBe(MAX_ADJUSTMENT_AMOUNT);
  });

  it('accepts only an id-shaped id', () => {
    expect(isAdjustmentId('adj-abc123')).toBe(true);
    expect(isAdjustmentId('-leading')).toBe(false);
    expect(isAdjustmentId('has space')).toBe(false);
    expect(isAdjustmentId('a'.repeat(80))).toBe(false);
    expect(isAdjustmentId('')).toBe(false);
  });

  it('builds an adjustment, or nothing at all', () => {
    expect(createAdjustment({ label: 'Voucher', amount: 20, kind: 'discount' }, 'adj-1')).toEqual({
      id: 'adj-1',
      label: 'Voucher',
      amount: 20,
      kind: 'discount',
    });
    expect(createAdjustment({ label: '  ', amount: 20, kind: 'discount' }, 'adj-1')).toBeNull();
    expect(createAdjustment({ label: 'Voucher', amount: 0, kind: 'discount' }, 'adj-1')).toBeNull();
    expect(
      createAdjustment({ label: 'Voucher', amount: 20, kind: 'discount' }, 'bad id'),
    ).toBeNull();
  });
});

describe('Parsing a stored, shared or imported list', () => {
  it('keeps what is usable and drops what is not', () => {
    const parsed = parseAdjustments(
      [
        charge('adj-1', 5),
        { id: 'adj-2', label: '', amount: 5, kind: 'charge' },
        { id: 'adj-3', label: 'Voucher', amount: 5, kind: 'nonsense' },
        { id: 'bad id', label: 'Voucher', amount: 5, kind: 'discount' },
        null,
        'not an object',
        discount('adj-4', 12),
      ],
      ROSTER,
    );

    expect(parsed.map((entry) => entry.id)).toEqual(['adj-1', 'adj-4']);
  });

  it('refuses a duplicate id rather than double-counting the money', () => {
    const parsed = parseAdjustments([charge('adj-1', 5), charge('adj-1', 500)], ROSTER);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.amount).toBe(5);
  });

  it('stops at the ceiling', () => {
    const many = Array.from({ length: MAX_BILL_ADJUSTMENTS + 8 }, (_unused, index) =>
      charge(`adj-${index}`, 1),
    );
    expect(parseAdjustments(many, ROSTER)).toHaveLength(MAX_BILL_ADJUSTMENTS);
  });

  it('re-scopes a charge naming a diner who is not at this table', () => {
    const parsed = parseAdjustments([charge('adj-1', 9, 'diner-gone')], ROSTER);

    // The money was still spent, so the charge survives as the table's.
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.dinerId).toBeUndefined();
  });

  it('keeps a charge naming a diner who is', () => {
    expect(parseAdjustments([charge('adj-1', 9, 'diner-a')], ROSTER)[0]?.dinerId).toBe('diner-a');
  });

  it('returns an empty list for anything that is not a list', () => {
    for (const value of [null, undefined, 'nope', 42, {}]) {
      expect(parseAdjustments(value, ROSTER)).toEqual([]);
    }
  });

  it('re-scopes when a diner leaves the roster', () => {
    const reconciled = reconcileAdjustments([charge('adj-1', 9, 'diner-a')], [ROSTER[1]!]);
    expect(reconciled[0]?.dinerId).toBeUndefined();
    expect(reconciled[0]?.amount).toBe(9);
  });
});

describe('Totalling a bill', () => {
  it('sums charges and discounts separately, and nets them', () => {
    expect(
      totalAdjustments([charge('adj-1', 5), charge('adj-2', 2.5), discount('adj-3', 10)]),
    ).toEqual({
      charges: 7.5,
      discounts: 10,
      net: -2.5,
    });
  });

  it('is zero for an absent or empty list', () => {
    expect(totalAdjustments(undefined)).toEqual({ charges: 0, discounts: 0, net: 0 });
    expect(totalAdjustments([])).toEqual({ charges: 0, discounts: 0, net: 0 });
  });

  it('ignores an entry that has been hand-edited into nonsense', () => {
    const hostile = [
      charge('adj-1', 10),
      { id: 'adj-2', label: 'x', amount: Number.NaN, kind: 'charge' },
      { id: 'adj-3', label: 'x', amount: 5, kind: 'sideways' },
    ] as readonly BillAdjustment[];

    expect(totalAdjustments(hostile)).toEqual({ charges: 10, discounts: 0, net: 10 });
  });

  it('never settles below nothing', () => {
    expect(settleTotal(50, { charges: 0, discounts: 400, net: -400 })).toBe(0);
  });

  it('settles to the cent', () => {
    expect(settleTotal(59.9, { charges: 0.1, discounts: 0, net: 0.1 })).toBe(60);
  });

  it('survives a non-finite base or net', () => {
    expect(settleTotal(Number.NaN, { charges: 0, discounts: 0, net: 0 })).toBe(0);
    expect(settleTotal(50, { charges: 0, discounts: 0, net: Number.NaN })).toBe(50);
  });
});

describe('A meal with no adjustments is the meal it always was', () => {
  const config = { pricePerDiner: 59.9, dinerCount: 2 };

  it('settles to exactly its base admission', () => {
    const bill = calculateBillTotals(config);
    expect(bill.totalPaid).toBe(calculateAdmission(config));
    expect(bill.baseAdmission).toBe(calculateAdmission(config));
  });

  it('reports zeroes for every adjustment figure', () => {
    const report = buildDamageReport(ITEMS, config);
    expect(report.adjustmentCharges).toBe(0);
    expect(report.adjustmentDiscounts).toBe(0);
    expect(report.adjustmentNet).toBe(0);
    expect(report.totalAdmission).toBe(report.baseAdmission);
  });

  it('produces the identical report whether the list is absent or empty', () => {
    expect(buildDamageReport(ITEMS, { ...config, adjustments: [] })).toEqual(
      buildDamageReport(ITEMS, config),
    );
  });
});

describe('A meal with adjustments measures against what was paid', () => {
  const config = {
    pricePerDiner: 50,
    dinerCount: 2,
    adjustments: [charge('adj-1', 4), discount('adj-2', 24)],
  };

  it('settles the bill through to the final total', () => {
    const report = buildDamageReport(ITEMS, config);

    expect(report.baseAdmission).toBe(100);
    expect(report.adjustmentCharges).toBe(4);
    expect(report.adjustmentDiscounts).toBe(24);
    expect(report.adjustmentNet).toBe(-20);
    expect(report.totalAdmission).toBe(80);
  });

  it('divides recovery by the total paid, not the entry price', () => {
    const report = buildDamageReport(ITEMS, config);
    expect(report.retailRecoveryPercent).toBeCloseTo((report.totalRetailValue / 80) * 100, 6);
  });

  it('measures break-even against the total paid', () => {
    const withVoucher = buildDamageReport(ITEMS, config);
    const withoutVoucher = buildDamageReport(ITEMS, {
      pricePerDiner: 50,
      dinerCount: 2,
    });

    // A voucher lowers the bar, so the gap left to close can only shrink.
    expect(withVoucher.remainingRetailGap).toBeLessThanOrEqual(withoutVoucher.remainingRetailGap);
    expect(withVoucher.platesToBreakEven).toBeLessThanOrEqual(withoutVoucher.platesToBreakEven);
  });

  it('measures the ingredient margin against the total paid', () => {
    const report = buildDamageReport(ITEMS, config);
    expect(report.estimatedIngredientMargin).toBeCloseTo(80 - report.totalRestaurantCost, 6);
  });

  it('reports a bill wiped out by discounts without dividing by zero', () => {
    const report = buildDamageReport(ITEMS, {
      pricePerDiner: 50,
      dinerCount: 1,
      adjustments: [discount('adj-1', 400)],
    });

    expect(report.totalAdmission).toBe(0);
    expect(Number.isFinite(report.retailRecoveryPercent)).toBe(true);
    expect(report.retailRecoveryPercent).toBe(0);
    expect(report.remainingRetailGap).toBe(0);
    expect(report.platesToBreakEven).toBe(0);
  });

  it('keeps every figure finite under hostile amounts', () => {
    const report = buildDamageReport(ITEMS, {
      pricePerDiner: 50,
      dinerCount: 2,
      adjustments: [
        charge('adj-1', MAX_ADJUSTMENT_AMOUNT),
        discount('adj-2', MAX_ADJUSTMENT_AMOUNT),
      ],
    });

    for (const value of [
      report.baseAdmission,
      report.totalAdmission,
      report.retailRecoveryPercent,
      report.estimatedIngredientMargin,
      report.estimatedFoodCostPercent,
      report.remainingRetailGap,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(report.totalAdmission).toBeGreaterThanOrEqual(0);
  });
});

describe('Adjustments across a table', () => {
  const items: readonly MealItem[] = [
    {
      id: 'beef-ribeye__standard__regular',
      foodId: 'beef-ribeye',
      quality: 'standard',
      plateSize: 'regular',
      quantity: 4,
      allocations: [{ dinerId: 'diner-a', quantity: 4 }],
    },
  ];

  it('charges a named adjustment to that diner alone', () => {
    const totals = calculateDinerTotals(items, {
      pricePerDiner: 50,
      dinerCount: 2,
      diners: ROSTER,
      adjustments: [charge('adj-1', 10, 'diner-a')],
    });

    expect(totals[0]?.admission).toBe(60);
    expect(totals[0]?.adjustmentNet).toBe(10);
    expect(totals[1]?.admission).toBe(50);
    expect(totals[1]?.adjustmentNet).toBe(0);
  });

  it('splits a table-wide adjustment evenly', () => {
    const totals = calculateDinerTotals(items, {
      pricePerDiner: 50,
      dinerCount: 2,
      diners: ROSTER,
      adjustments: [discount('adj-1', 20)],
    });

    expect(totals[0]?.admission).toBe(40);
    expect(totals[1]?.admission).toBe(40);
  });

  it('keeps the diners summing to the table', () => {
    const config = {
      pricePerDiner: 50,
      dinerCount: 2,
      diners: ROSTER,
      adjustments: [charge('adj-1', 7, 'diner-b'), discount('adj-2', 15)],
    };
    const table = buildDamageReport(items, config);
    const totals = calculateDinerTotals(items, config);

    const summed = totals.reduce((sum, entry) => sum + entry.admission, 0);
    expect(summed).toBeCloseTo(table.totalAdmission, 6);
  });

  it('never gives a diner a negative share', () => {
    const totals = calculateDinerTotals(items, {
      pricePerDiner: 20,
      dinerCount: 2,
      diners: ROSTER,
      adjustments: [discount('adj-1', 500, 'diner-a')],
    });

    expect(totals[0]?.admission).toBe(0);
    expect(totals[0]?.retailRecoveryPercent).toBe(0);
  });

  it('reports the entry price alongside each share', () => {
    const totals = calculateDinerTotals(items, {
      pricePerDiner: 50,
      dinerCount: 2,
      diners: ROSTER,
      adjustments: [charge('adj-1', 10, 'diner-a')],
    });

    expect(totals[0]?.baseAdmission).toBe(50);
    expect(totals[0]?.admission).toBe(60);
  });
});
