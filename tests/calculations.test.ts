import { describe, expect, it } from 'vitest';
import { findFood } from '@/data/foods';
import {
  adjustedRestaurantCostPerKg,
  adjustedRetailPricePerKg,
  buildDamageReport,
  calculateAdmission,
  calculateLineItem,
  calculateSessionTotals,
  clampDinerCount,
  clampPricePerDiner,
  perDinerTotals,
} from '@/lib/calculations';
import { KG_TO_LB } from '@/lib/constants';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import type { PricingProfile } from '@/types/pricing';
import type { MealItem } from '@/types/meal';

const ribeye = findFood('beef-ribeye')!;
const porkBelly = findFood('pork-belly')!;
const prawns = findFood('seafood-prawns')!;
const marketPricing: PricingProfile = {
  ...DEFAULT_PRICING_PROFILE,
  id: 'sydney-market',
  name: 'Sydney market estimates',
  overrides: {
    [ribeye.id]: { retailPricePerKg: 80, restaurantCostPerKg: 43 },
  },
};

function item(overrides: Partial<MealItem> & Pick<MealItem, 'foodId'>): MealItem {
  return {
    id: `${overrides.foodId}-line`,
    quality: 'standard',
    plateSize: 'regular',
    quantity: 1,
    ...overrides,
  };
}

describe('line item weight', () => {
  it('multiplies plate weight by quantity', () => {
    const line = calculateLineItem(
      item({ foodId: ribeye.id, plateSize: 'regular', quantity: 3 }),
      ribeye,
    );
    expect(line.weightG).toBe(465);
    expect(line.weightKg).toBeCloseTo(0.465, 10);
    expect(line.plates).toBe(3);
  });

  it('uses the configured grams for each plate size', () => {
    expect(calculateLineItem(item({ foodId: ribeye.id, plateSize: 'small' }), ribeye).weightG).toBe(
      100,
    );
    expect(calculateLineItem(item({ foodId: ribeye.id, plateSize: 'large' }), ribeye).weightG).toBe(
      220,
    );
  });
});

describe('line item retail value', () => {
  it('converts grams to kilograms before pricing', () => {
    const line = calculateLineItem(
      item({ foodId: ribeye.id, plateSize: 'regular', quantity: 3 }),
      ribeye,
    );
    // 0.465 kg x $52/kg
    expect(line.retailValue).toBeCloseTo(24.18, 10);
  });

  it('applies the retail quality multiplier', () => {
    expect(adjustedRetailPricePerKg(ribeye, 'house')).toBeCloseTo(52 * 0.85, 10);
    expect(adjustedRetailPricePerKg(ribeye, 'standard')).toBeCloseTo(52, 10);
    expect(adjustedRetailPricePerKg(ribeye, 'premium')).toBeCloseTo(52 * 1.35, 10);
  });

  it('uses the active profile override without changing the catalogue item', () => {
    expect(adjustedRetailPricePerKg(ribeye, 'standard', marketPricing)).toBe(80);
    expect(ribeye.retailPricePerKg).toBe(52);
  });
});

describe('line item restaurant cost', () => {
  it('applies the restaurant quality multiplier, which differs from retail', () => {
    expect(adjustedRestaurantCostPerKg(ribeye, 'house')).toBeCloseTo(29 * 0.85, 10);
    expect(adjustedRestaurantCostPerKg(ribeye, 'standard')).toBeCloseTo(29, 10);
    expect(adjustedRestaurantCostPerKg(ribeye, 'premium')).toBeCloseTo(29 * 1.25, 10);
  });

  it('scales cost by weight', () => {
    const line = calculateLineItem(
      item({ foodId: porkBelly.id, plateSize: 'large', quantity: 2 }),
      porkBelly,
    );
    // 0.44 kg x $12/kg
    expect(line.restaurantCost).toBeCloseTo(5.28, 10);
  });

  it('uses profile restaurant-cost assumptions independently', () => {
    expect(adjustedRestaurantCostPerKg(ribeye, 'standard', marketPricing)).toBe(43);
  });
});

describe('quality ordering', () => {
  it('ranks house below standard below premium for both prices', () => {
    const base = { foodId: ribeye.id, plateSize: 'regular', quantity: 2 } as const;
    const house = calculateLineItem(item({ ...base, quality: 'house' }), ribeye);
    const standard = calculateLineItem(item({ ...base, quality: 'standard' }), ribeye);
    const premium = calculateLineItem(item({ ...base, quality: 'premium' }), ribeye);

    expect(house.retailValue).toBeLessThan(standard.retailValue);
    expect(standard.retailValue).toBeLessThan(premium.retailValue);
    expect(house.restaurantCost).toBeLessThan(standard.restaurantCost);
    expect(standard.restaurantCost).toBeLessThan(premium.restaurantCost);
  });

  it('leaves nutrition untouched across tiers', () => {
    const base = { foodId: ribeye.id, plateSize: 'regular', quantity: 2 } as const;
    const house = calculateLineItem(item({ ...base, quality: 'house' }), ribeye);
    const premium = calculateLineItem(item({ ...base, quality: 'premium' }), ribeye);
    expect(house.nutrition).toEqual(premium.nutrition);
  });
});

describe('nutrition', () => {
  it('scales per-100 g values by total grams', () => {
    const line = calculateLineItem(
      item({ foodId: porkBelly.id, plateSize: 'regular', quantity: 2 }),
      porkBelly,
    );
    // 310 g = 3.1 x per-100g values
    expect(line.nutrition.calories).toBeCloseTo(3.1 * 450, 10);
    expect(line.nutrition.protein).toBeCloseTo(3.1 * 13, 10);
    expect(line.nutrition.fat).toBeCloseTo(3.1 * 44, 10);
    expect(line.nutrition.carbs).toBe(0);
  });

  it('handles fractional per-100 g values', () => {
    const line = calculateLineItem(
      item({ foodId: prawns.id, plateSize: 'small', quantity: 1 }),
      prawns,
    );
    expect(line.nutrition.fat).toBeCloseTo(0.3, 10);
    expect(line.nutrition.carbs).toBeCloseTo(0.2, 10);
  });
});

describe('session totals', () => {
  it('aggregates multiple different foods', () => {
    const totals = calculateSessionTotals([
      item({ id: 'a', foodId: ribeye.id, plateSize: 'regular', quantity: 2 }),
      item({ id: 'b', foodId: porkBelly.id, plateSize: 'large', quantity: 3 }),
    ]);

    expect(totals.totalPlates).toBe(5);
    expect(totals.totalWeightG).toBe(310 + 660);
    expect(totals.totalWeightKg).toBeCloseTo(0.97, 10);
    expect(totals.totalWeightLb).toBeCloseTo(0.97 * KG_TO_LB, 10);
    expect(totals.totalRetailValue).toBeCloseTo(0.31 * 52 + 0.66 * 24, 10);
    expect(totals.totalRestaurantCost).toBeCloseTo(0.31 * 29 + 0.66 * 12, 10);
    expect(totals.nutrition.protein).toBeCloseTo(3.1 * 24 + 6.6 * 13, 10);
  });

  it('returns zeroed totals for an empty meal', () => {
    const totals = calculateSessionTotals([]);
    expect(totals.totalPlates).toBe(0);
    expect(totals.totalRetailValue).toBe(0);
    expect(totals.nutrition.calories).toBe(0);
    expect(totals.lines).toHaveLength(0);
  });

  it('skips items whose food no longer exists', () => {
    const totals = calculateSessionTotals([
      item({ id: 'ghost', foodId: 'beef-does-not-exist' }),
      item({ id: 'real', foodId: ribeye.id }),
    ]);
    expect(totals.lines).toHaveLength(1);
    expect(Number.isFinite(totals.totalRetailValue)).toBe(true);
  });

  it('resolves profile prices across the session', () => {
    const totals = calculateSessionTotals(
      [item({ foodId: ribeye.id, plateSize: 'regular', quantity: 2 })],
      marketPricing,
    );
    expect(totals.totalRetailValue).toBeCloseTo(0.31 * 80, 10);
    expect(totals.totalRestaurantCost).toBeCloseTo(0.31 * 43, 10);
  });
});

describe('admission', () => {
  it('multiplies price by diner count', () => {
    expect(calculateAdmission({ pricePerDiner: 59.9, dinerCount: 3 })).toBeCloseTo(179.7, 10);
    expect(calculateAdmission({ pricePerDiner: 59.9, dinerCount: 2 })).toBeCloseTo(119.8, 10);
  });

  it('uses explicit diner admission overrides while defaults retain the table price', () => {
    expect(
      calculateAdmission({
        pricePerDiner: 60,
        dinerCount: 3,
        diners: [
          { id: 'adult', displayName: 'Adult', admissionPrice: 72 },
          { id: 'child', displayName: 'Child', admissionPrice: 30 },
          { id: 'guest', displayName: 'Guest' },
        ],
      }),
    ).toBe(162);
  });

  it('falls back safely when a persisted override is invalid or a diner is removed', () => {
    expect(
      calculateAdmission({
        pricePerDiner: 60,
        dinerCount: 2,
        diners: [
          { id: 'adult', displayName: 'Adult', admissionPrice: Number.NaN },
          { id: 'guest', displayName: 'Guest', admissionPrice: 0 },
        ],
      }),
    ).toBe(120);
    expect(
      calculateAdmission({
        pricePerDiner: 60,
        dinerCount: 1,
        diners: [{ id: 'guest', displayName: 'Guest', admissionPrice: 30 }],
      }),
    ).toBe(30);
  });

  it('clamps out-of-range and malformed configuration', () => {
    expect(clampPricePerDiner(Number.NaN)).toBe(1);
    expect(clampPricePerDiner(-40)).toBe(1);
    expect(clampPricePerDiner(0)).toBe(1);
    expect(clampPricePerDiner(9000)).toBe(500);
    expect(clampDinerCount(0)).toBe(1);
    expect(clampDinerCount(99)).toBe(12);
    expect(clampDinerCount(2.6)).toBe(3);
    expect(clampDinerCount(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('damage report', () => {
  const config = { pricePerDiner: 59.9, dinerCount: 1 };

  it('reports a positive difference once retail value exceeds admission', () => {
    const report = buildDamageReport(
      [item({ foodId: ribeye.id, plateSize: 'large', quantity: 8 })],
      config,
    );
    // 1.76 kg x $52 = $91.52
    expect(report.totalRetailValue).toBeCloseTo(91.52, 10);
    expect(report.retailValueDifference).toBeCloseTo(91.52 - 59.9, 10);
    expect(report.retailValueDifference).toBeGreaterThan(0);
    expect(report.hasBeatenBuffet).toBe(true);
  });

  it('carries the selected profile through the report calculation', () => {
    const report = buildDamageReport(
      [item({ foodId: ribeye.id, plateSize: 'regular', quantity: 2 })],
      config,
      marketPricing,
    );
    expect(report.totalRetailValue).toBeCloseTo(0.31 * 80, 10);
  });

  it('reports a negative difference below admission', () => {
    const report = buildDamageReport(
      [item({ foodId: prawns.id, plateSize: 'small', quantity: 2 })],
      config,
    );
    expect(report.retailValueDifference).toBeLessThan(0);
    expect(report.hasBeatenBuffet).toBe(false);
  });

  it('computes retail recovery percentage', () => {
    const report = buildDamageReport(
      [item({ foodId: ribeye.id, plateSize: 'regular', quantity: 2 })],
      { pricePerDiner: 32.24, dinerCount: 1 },
    );
    // 0.31 kg x $52 = $16.12 against $32.24 admission
    expect(report.retailRecoveryPercent).toBeCloseTo(50, 6);
  });

  it('computes the estimated food-cost ratio', () => {
    const report = buildDamageReport(
      [item({ foodId: porkBelly.id, plateSize: 'large', quantity: 5 })],
      { pricePerDiner: 26.4, dinerCount: 1 },
    );
    // 1.1 kg x $12 = $13.20 of $26.40 admission
    expect(report.estimatedFoodCostPercent).toBeCloseTo(50, 6);
    expect(report.estimatedIngredientMargin).toBeCloseTo(13.2, 10);
  });

  it('allows a negative ingredient margin when cost exceeds admission', () => {
    const report = buildDamageReport(
      [item({ foodId: ribeye.id, plateSize: 'large', quantity: 20 })],
      { pricePerDiner: 20, dinerCount: 1 },
    );
    expect(report.estimatedIngredientMargin).toBeLessThan(0);
    expect(report.estimatedFoodCostPercent).toBeGreaterThan(100);
  });
});

describe('per-diner split', () => {
  const meal = [item({ foodId: ribeye.id, plateSize: 'large', quantity: 8 })];

  it('carries the clamped diner count on the report', () => {
    expect(buildDamageReport(meal, { pricePerDiner: 50, dinerCount: 4 }).dinerCount).toBe(4);
    expect(buildDamageReport(meal, { pricePerDiner: 50, dinerCount: 99 }).dinerCount).toBe(12);
    expect(buildDamageReport(meal, { pricePerDiner: 50, dinerCount: 0 }).dinerCount).toBe(1);
    expect(buildDamageReport(meal, { pricePerDiner: 50, dinerCount: 2.4 }).dinerCount).toBe(2);
  });

  it('divides the table evenly by head', () => {
    const report = buildDamageReport(meal, { pricePerDiner: 50, dinerCount: 4 });
    const each = perDinerTotals(report);

    expect(each.dinerCount).toBe(4);
    expect(each.admission).toBeCloseTo(50, 10);
    expect(each.retailValue).toBeCloseTo(report.totalRetailValue / 4, 10);
    expect(each.weightG).toBeCloseTo(report.totalWeightG / 4, 10);
    expect(each.plates).toBeCloseTo(2, 10);
    expect(each.nutrition.protein).toBeCloseTo(report.nutrition.protein / 4, 10);
  });

  it('returns the table itself for a single diner', () => {
    const report = buildDamageReport(meal, { pricePerDiner: 50, dinerCount: 1 });
    const each = perDinerTotals(report);

    expect(each.retailValue).toBeCloseTo(report.totalRetailValue, 10);
    expect(each.admission).toBeCloseTo(report.totalAdmission, 10);
  });

  it('adds back up to the totals it came from', () => {
    const report = buildDamageReport(meal, { pricePerDiner: 42.5, dinerCount: 3 });
    const each = perDinerTotals(report);

    expect(each.retailValue * 3).toBeCloseTo(report.totalRetailValue, 10);
    expect(each.admission * 3).toBeCloseTo(report.totalAdmission, 10);
    expect(each.nutrition.calories * 3).toBeCloseTo(report.nutrition.calories, 10);
  });

  it('splits an empty meal without producing NaN', () => {
    const each = perDinerTotals(buildDamageReport([], { pricePerDiner: 60, dinerCount: 5 }));

    expect(each.retailValue).toBe(0);
    expect(each.plates).toBe(0);
    expect(each.weightG).toBe(0);
    expect(each.nutrition.fat).toBe(0);
    expect(each.admission).toBeCloseTo(60, 10);
  });
});

describe('break-even estimate', () => {
  it('estimates remaining plates while below admission', () => {
    const report = buildDamageReport(
      [item({ foodId: ribeye.id, plateSize: 'regular', quantity: 2 })],
      { pricePerDiner: 59.9, dinerCount: 1 },
    );
    // $16.12 eaten, $43.78 short, $8.06 average per plate -> 6 plates
    expect(report.averageRetailValuePerPlate).toBeCloseTo(8.06, 10);
    expect(report.remainingRetailGap).toBeCloseTo(43.78, 10);
    expect(report.platesToBreakEven).toBe(6);
  });

  it('returns zero once the buffet has been beaten', () => {
    const report = buildDamageReport(
      [item({ foodId: ribeye.id, plateSize: 'large', quantity: 10 })],
      { pricePerDiner: 59.9, dinerCount: 1 },
    );
    expect(report.remainingRetailGap).toBe(0);
    expect(report.platesToBreakEven).toBe(0);
  });

  it('returns zero at exact break-even', () => {
    const report = buildDamageReport(
      [item({ foodId: ribeye.id, plateSize: 'regular', quantity: 2 })],
      { pricePerDiner: 16.12, dinerCount: 1 },
    );
    expect(report.remainingRetailGap).toBe(0);
    expect(report.platesToBreakEven).toBe(0);
    expect(report.hasBeatenBuffet).toBe(true);
  });
});

describe('zero-division safety', () => {
  it('produces finite values for an empty meal', () => {
    const report = buildDamageReport([], { pricePerDiner: 59.9, dinerCount: 1 });

    for (const value of [
      report.retailRecoveryPercent,
      report.averageRetailValuePerPlate,
      report.estimatedFoodCostPercent,
      report.platesToBreakEven,
      report.retailValueDifference,
      report.estimatedIngredientMargin,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
    }

    expect(report.averageRetailValuePerPlate).toBe(0);
    expect(report.platesToBreakEven).toBe(0);
    expect(report.hasBeatenBuffet).toBe(false);
  });

  it('produces finite values when the configuration is malformed', () => {
    const report = buildDamageReport([item({ foodId: ribeye.id })], {
      pricePerDiner: Number.NaN,
      dinerCount: Number.NaN,
    });
    expect(Number.isFinite(report.totalAdmission)).toBe(true);
    expect(Number.isFinite(report.retailRecoveryPercent)).toBe(true);
    expect(report.totalAdmission).toBe(1);
  });

  it('ignores negative quantities rather than producing negative weight', () => {
    const line = calculateLineItem(item({ foodId: ribeye.id, quantity: -5 }), ribeye);
    expect(line.plates).toBe(0);
    expect(line.weightG).toBe(0);
    expect(line.retailValue).toBe(0);
  });
});

describe('extreme meals', () => {
  it('stays finite at very large volumes', () => {
    const report = buildDamageReport(
      [
        item({ id: 'a', foodId: ribeye.id, plateSize: 'large', quantity: 99, quality: 'premium' }),
        item({ id: 'b', foodId: porkBelly.id, plateSize: 'large', quantity: 99 }),
      ],
      { pricePerDiner: 1, dinerCount: 1 },
    );
    expect(report.totalPlates).toBe(198);
    expect(report.retailRecoveryPercent).toBeGreaterThan(400);
    expect(Number.isFinite(report.retailRecoveryPercent)).toBe(true);
    expect(report.platesToBreakEven).toBe(0);
  });
});
