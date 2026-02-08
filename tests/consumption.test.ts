import { describe, expect, it } from 'vitest';
import {
  CONSUMPTION_STEP,
  consumedFraction,
  consumedQuantity,
  formatPlateQuantity,
  hasUneaten,
  normaliseConsumedQuantity,
  reconcileConsumption,
  uneatenQuantity,
  withConsumedQuantity,
} from '@/lib/consumption';
import {
  buildDamageReport,
  calculateDinerTotals,
  calculateSessionTotals,
} from '@/lib/calculations';
import { mergeMealItems } from '@/lib/mealItems';
import { MAX_LINE_QUANTITY } from '@/lib/constants';
import type { Diner, MealItem } from '@/types/meal';

function line(quantity: number, consumed?: number): MealItem {
  return {
    id: 'beef-ribeye__standard__regular',
    foodId: 'beef-ribeye',
    quality: 'standard',
    plateSize: 'regular',
    quantity,
    ...(consumed === undefined ? {} : { consumedQuantity: consumed }),
  };
}

describe('What was eaten, when nobody said', () => {
  it('is all of it', () => {
    expect(consumedQuantity(line(4))).toBe(4);
    expect(uneatenQuantity(line(4))).toBe(0);
    expect(hasUneaten(line(4))).toBe(false);
    expect(consumedFraction(line(4))).toBe(1);
  });

  it('stays all of it for a value that is not a number', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
      expect(consumedQuantity({ quantity: 4, consumedQuantity: value as number })).toBe(4);
    }
  });

  it('is zero-safe for an empty line', () => {
    expect(consumedFraction(line(0))).toBe(0);
    expect(consumedQuantity(line(0))).toBe(0);
  });
});

describe('Recording what was left', () => {
  it('splits an order into eaten and left', () => {
    expect(consumedQuantity(line(4, 2.5))).toBe(2.5);
    expect(uneatenQuantity(line(4, 2.5))).toBe(1.5);
    expect(hasUneaten(line(4, 2.5))).toBe(true);
  });

  it('rounds to the nearest quarter plate', () => {
    expect(normaliseConsumedQuantity(1.1, 4)).toBe(1);
    expect(normaliseConsumedQuantity(1.13, 4)).toBe(1.25);
    expect(normaliseConsumedQuantity(1.4, 4)).toBe(1.5);
    expect(normaliseConsumedQuantity(CONSUMPTION_STEP, 4)).toBe(0.25);
  });

  it('collapses "all of it" back to nothing stored', () => {
    // An absent value and a full one mean the same thing, so only one shape
    // ever reaches disk.
    expect(normaliseConsumedQuantity(4, 4)).toBeUndefined();
    expect(normaliseConsumedQuantity(9, 4)).toBeUndefined();
    expect(withConsumedQuantity(line(4, 1), 4)).not.toHaveProperty('consumedQuantity');
  });

  it('never records more than was ordered', () => {
    expect(consumedQuantity(line(2, 99))).toBe(2);
    expect(uneatenQuantity(line(2, 99))).toBe(0);
  });

  it('never records less than nothing', () => {
    expect(consumedQuantity(line(2, -50))).toBe(0);
    expect(normaliseConsumedQuantity(-50, 2)).toBe(0);
    expect(uneatenQuantity(line(2, -50))).toBe(2);
  });

  it('brings consumption down when the order shrinks', () => {
    const trimmed = reconcileConsumption({ ...line(1), consumedQuantity: 3 });
    // A tab must never claim more was eaten than ever arrived.
    expect(consumedQuantity(trimmed)).toBe(1);
    expect(trimmed).not.toHaveProperty('consumedQuantity');
  });

  it('formats a fractional plate count without false precision', () => {
    expect(formatPlateQuantity(2)).toBe('2');
    expect(formatPlateQuantity(2.5)).toBe('2.5');
    expect(formatPlateQuantity(2.25)).toBe('2.25');
    expect(formatPlateQuantity(Number.NaN)).toBe('0');
    expect(formatPlateQuantity(-3)).toBe('0');
  });
});

describe('A meal nobody trimmed calculates exactly as before', () => {
  it('produces identical totals whether consumption is absent or full', () => {
    // Compared without the echoed input line, which is the only thing that
    // differs: the two describe the same meal in two ways, and every derived
    // figure has to agree.
    const { lines: statedLines, ...stated } = calculateSessionTotals([line(4, 4)]);
    const { lines: absentLines, ...absent } = calculateSessionTotals([line(4)]);

    expect(stated).toEqual(absent);
    expect(statedLines).toHaveLength(absentLines.length);
    expect(statedLines[0]?.retailValue).toBe(absentLines[0]?.retailValue);
    expect(statedLines[0]?.consumedPlates).toBe(absentLines[0]?.consumedPlates);
    expect(statedLines[0]?.uneatenPlates).toBe(absentLines[0]?.uneatenPlates);
  });

  it('reports eaten equal to ordered', () => {
    const totals = calculateSessionTotals([line(4)]);

    expect(totals.totalConsumedPlates).toBe(totals.totalPlates);
    expect(totals.totalUneatenPlates).toBe(0);
    expect(totals.totalWeightG).toBe(totals.totalOrderedWeightG);
    expect(totals.totalRetailValue).toBe(totals.totalOrderedRetailValue);
  });
});

describe('A meal with food left behind', () => {
  const totals = calculateSessionTotals([line(4, 2)]);
  const whole = calculateSessionTotals([line(4)]);

  it('values only what was eaten', () => {
    expect(totals.totalRetailValue).toBeCloseTo(whole.totalRetailValue / 2, 6);
    expect(totals.totalWeightG).toBeCloseTo(whole.totalWeightG / 2, 6);
    expect(totals.nutrition.calories).toBeCloseTo(whole.nutrition.calories / 2, 6);
  });

  it('still says what reached the table', () => {
    expect(totals.totalPlates).toBe(4);
    expect(totals.totalOrderedRetailValue).toBeCloseTo(whole.totalRetailValue, 6);
    expect(totals.totalOrderedWeightG).toBe(whole.totalWeightG);
    expect(totals.totalUneatenPlates).toBe(2);
    expect(totals.totalConsumedPlates).toBe(2);
  });

  it('keeps the estimated ingredient cost on what was ordered', () => {
    // The restaurant bought the plate whether or not it went back.
    expect(totals.totalRestaurantCost).toBeCloseTo(whole.totalRestaurantCost, 6);
  });

  it('measures recovery on what was eaten', () => {
    const left = buildDamageReport([line(4, 2)], { pricePerDiner: 50, dinerCount: 1 });
    const eaten = buildDamageReport([line(4)], { pricePerDiner: 50, dinerCount: 1 });

    expect(left.retailRecoveryPercent).toBeCloseTo(eaten.retailRecoveryPercent / 2, 6);
    expect(left.remainingRetailGap).toBeGreaterThanOrEqual(eaten.remainingRetailGap);
  });

  it('keeps every figure finite and non-negative', () => {
    const report = buildDamageReport([line(4, 0)], { pricePerDiner: 50, dinerCount: 1 });

    for (const value of [
      report.totalRetailValue,
      report.totalWeightG,
      report.totalOrderedRetailValue,
      report.totalConsumedPlates,
      report.totalUneatenPlates,
      report.retailRecoveryPercent,
      report.nutrition.calories,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('reports nothing eaten when the whole order went back', () => {
    const report = buildDamageReport([line(4, 0)], { pricePerDiner: 50, dinerCount: 1 });

    expect(report.totalRetailValue).toBe(0);
    expect(report.totalConsumedPlates).toBe(0);
    expect(report.totalUneatenPlates).toBe(4);
    expect(report.totalOrderedRetailValue).toBeGreaterThan(0);
    expect(report.hasBeatenBuffet).toBe(false);
  });
});

describe('Merging lines', () => {
  it('adds eaten amounts alongside the plates', () => {
    const merged = mergeMealItems([line(2, 1), line(2, 0.5)]);

    expect(merged[0]?.quantity).toBe(4);
    expect(consumedQuantity(merged[0]!)).toBe(1.5);
  });

  it('leaves a merged clean line clean', () => {
    const merged = mergeMealItems([line(2), line(2)]);

    expect(merged[0]?.quantity).toBe(4);
    expect(merged[0]).not.toHaveProperty('consumedQuantity');
  });

  it('treats a half-trimmed merge honestly', () => {
    const merged = mergeMealItems([line(2), line(2, 0)]);
    // Two eaten, two left: neither half is allowed to speak for the other.
    expect(consumedQuantity(merged[0]!)).toBe(2);
    expect(uneatenQuantity(merged[0]!)).toBe(2);
  });

  it('cannot exceed the line ceiling', () => {
    const merged = mergeMealItems([line(MAX_LINE_QUANTITY), line(MAX_LINE_QUANTITY)]);
    expect(merged[0]?.quantity).toBe(MAX_LINE_QUANTITY);
    expect(consumedQuantity(merged[0]!)).toBeLessThanOrEqual(MAX_LINE_QUANTITY);
  });
});

describe('Consumption across a table', () => {
  const roster: readonly Diner[] = [
    { id: 'diner-a', displayName: 'Ana' },
    { id: 'diner-b', displayName: 'Ben' },
  ];

  it('gives each diner their proportion of what was eaten', () => {
    const items = [{ ...line(4, 2), allocations: [{ dinerId: 'diner-a', quantity: 4 }] }];
    const totals = calculateDinerTotals(items, {
      pricePerDiner: 50,
      dinerCount: 2,
      diners: roster,
    });

    // The whole line is Ana's, so the whole of what was eaten from it is too.
    expect(totals[0]?.consumedPlates).toBeCloseTo(2, 6);
    expect(totals[1]?.consumedPlates).toBe(0);
  });

  it('splits an untrimmed shared line evenly', () => {
    const totals = calculateDinerTotals([line(4, 2)], {
      pricePerDiner: 50,
      dinerCount: 2,
      diners: roster,
    });

    expect(totals[0]?.consumedPlates).toBeCloseTo(1, 6);
    expect(totals[1]?.consumedPlates).toBeCloseTo(1, 6);
  });

  it('keeps the diners summing to the table', () => {
    const items = [{ ...line(4, 2.5), allocations: [{ dinerId: 'diner-b', quantity: 3 }] }];
    const config = { pricePerDiner: 50, dinerCount: 2, diners: roster };
    const table = buildDamageReport(items, config);
    const totals = calculateDinerTotals(items, config);

    const summed = totals.reduce((sum, entry) => sum + entry.consumedPlates, 0);
    expect(summed).toBeCloseTo(table.totalConsumedPlates, 6);
    expect(totals.reduce((sum, entry) => sum + entry.retailValue, 0)).toBeCloseTo(
      table.totalRetailValue,
      6,
    );
  });

  it('never gives a diner more than was eaten', () => {
    const totals = calculateDinerTotals([line(4, 1)], {
      pricePerDiner: 50,
      dinerCount: 2,
      diners: roster,
    });

    for (const entry of totals) {
      expect(entry.consumedPlates).toBeLessThanOrEqual(entry.effectivePlates);
      expect(entry.consumedPlates).toBeGreaterThanOrEqual(0);
    }
  });
});
