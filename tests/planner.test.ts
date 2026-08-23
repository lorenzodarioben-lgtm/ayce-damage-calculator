import { describe, expect, it } from 'vitest';
import { FOODS } from '@/data/foods';
import { foodCatalogue } from '@/lib/foodCatalogue';
import { createCustomFood } from '@/lib/customFoods';
import {
  BALANCED_ITEM_CAP,
  MAX_PLAN_PLATES,
  MAX_TARGET_RECOVERY,
  MIN_TARGET_RECOVERY,
  PLAN_STRATEGIES,
  buildDamagePlan,
  clampPlanQuantity,
  clampTargetRecovery,
  type PlanConstraints,
} from '@/lib/planner';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import { createPricingProfile } from '@/lib/pricingProfiles';

function constraints(overrides: Partial<PlanConstraints> = {}): PlanConstraints {
  return {
    targetRecoveryPercent: 100,
    strategy: 'fewest-plates',
    admission: 59.9,
    includedFoodIds: [],
    qualities: ['house', 'standard', 'premium'],
    plateSizes: ['small', 'regular', 'large'],
    maxPerItem: 12,
    locked: [],
    ...overrides,
  };
}

function plan(overrides: Partial<PlanConstraints> = {}) {
  return buildDamagePlan(constraints(overrides), FOODS, DEFAULT_PRICING_PROFILE);
}

function platesIn(result: ReturnType<typeof plan>): number {
  return result.lines.reduce((sum, line) => sum + line.quantity, 0);
}

describe('clamping', () => {
  it('holds a target inside the range the simulation supports', () => {
    expect(clampTargetRecovery(120)).toBe(120);
    expect(clampTargetRecovery(0)).toBe(MIN_TARGET_RECOVERY);
    expect(clampTargetRecovery(10_000)).toBe(MAX_TARGET_RECOVERY);
    expect(clampTargetRecovery(Number.NaN)).toBe(100);
  });

  it('holds a per-item quantity inside its range', () => {
    expect(clampPlanQuantity(4)).toBe(4);
    expect(clampPlanQuantity(0)).toBe(1);
    expect(clampPlanQuantity(500)).toBe(12);
    // A value that is not a number at all falls back to the safe minimum.
    expect(clampPlanQuantity(Number.POSITIVE_INFINITY)).toBe(1);
    expect(clampPlanQuantity(Number.NaN)).toBe(1);
  });
});

describe('buildDamagePlan', () => {
  it('reaches the target it was asked for', () => {
    const result = plan();

    expect(result.feasible).toBe(true);
    expect(result.totals.totalRetailValue).toBeGreaterThanOrEqual(result.targetRetailValue);
    expect(result.recoveryPercent).toBeGreaterThanOrEqual(100);
  });

  it('is deterministic: the same request produces the same plan', () => {
    expect(plan()).toEqual(plan());
    expect(plan({ strategy: 'lowest-weight' })).toEqual(plan({ strategy: 'lowest-weight' }));
    expect(plan({ strategy: 'balanced' })).toEqual(plan({ strategy: 'balanced' }));
  });

  it('agrees with the calculation engine about its own totals', () => {
    const result = plan();
    const summed = result.totals.lines.reduce((sum, line) => sum + line.retailValue, 0);

    expect(result.totals.totalRetailValue).toBeCloseTo(summed, 6);
    expect(result.totals.totalPlates).toBe(platesIn(result));
  });

  it('spends fewer plates than the low-weight route, and less weight than the plate route', () => {
    const fewest = plan();
    const lightest = plan({ strategy: 'lowest-weight' });

    expect(fewest.totals.totalPlates).toBeLessThanOrEqual(lightest.totals.totalPlates);
    expect(lightest.totals.totalWeightG).toBeLessThanOrEqual(fewest.totals.totalWeightG);
  });

  it('never repeats one configuration past the cap on a balanced spread', () => {
    const result = plan({ strategy: 'balanced', targetRecoveryPercent: 150 });

    expect(result.feasible).toBe(true);
    for (const line of result.lines) {
      expect(line.quantity).toBeLessThanOrEqual(BALANCED_ITEM_CAP);
    }
    expect(result.lines.length).toBeGreaterThan(1);
  });

  it('honours a lower per-item cap than the strategy would otherwise use', () => {
    const result = plan({ maxPerItem: 2, targetRecoveryPercent: 150 });

    for (const line of result.lines) {
      expect(line.quantity).toBeLessThanOrEqual(2);
    }
  });

  it('plans only from the cuts it was allowed', () => {
    const result = plan({ includedFoodIds: ['pork-belly', 'chicken-thigh'] });

    expect(result.feasible).toBe(true);
    for (const line of result.lines) {
      expect(['pork-belly', 'chicken-thigh']).toContain(line.foodId);
    }
  });

  it('plans only within the serving sizes and quality tiers it was allowed', () => {
    const result = plan({ qualities: ['house'], plateSizes: ['small'] });

    expect(result.feasible).toBe(true);
    for (const line of result.lines) {
      expect(line.quality).toBe('house');
      expect(line.plateSize).toBe('small');
    }
  });

  it('keeps locked items and counts their value toward the target', () => {
    const locked = [
      { foodId: 'beef-wagyu-short-rib', quality: 'premium', plateSize: 'large', quantity: 2 },
    ] as const;
    const result = plan({ locked: [...locked] });

    const kept = result.lines.find((line) => line.foodId === 'beef-wagyu-short-rib');
    expect(kept?.quantity).toBeGreaterThanOrEqual(2);
    expect(result.rationale.join(' ')).toContain('locked');
  });

  it('adds nothing when the locked items already clear the target', () => {
    const result = plan({
      targetRecoveryPercent: 50,
      locked: [
        { foodId: 'beef-wagyu-short-rib', quality: 'premium', plateSize: 'large', quantity: 6 },
      ],
    });

    expect(result.lines).toHaveLength(1);
    expect(result.rationale.join(' ')).toContain('already clear the target');
    expect(result.evaluated).toBe(0);
  });

  it('drops a locked item the catalogue does not have', () => {
    const result = plan({
      locked: [{ foodId: 'not-a-food', quality: 'standard', plateSize: 'regular', quantity: 3 }],
    });

    expect(result.feasible).toBe(true);
    expect(result.lines.some((line) => line.foodId === 'not-a-food')).toBe(false);
  });

  it('refuses when there is nothing to plan with', () => {
    const result = plan({ includedFoodIds: ['not-a-food'] });

    expect(result.feasible).toBe(false);
    expect(result.failure).toBe('no-candidates');
    expect(result.lines).toEqual([]);
  });

  it('refuses when the locked items alone are past the plate limit', () => {
    const result = plan({
      locked: [
        { foodId: 'beef-brisket', quality: 'house', plateSize: 'small', quantity: 12 },
        { foodId: 'pork-belly', quality: 'house', plateSize: 'small', quantity: 12 },
        { foodId: 'chicken-thigh', quality: 'house', plateSize: 'small', quantity: 12 },
        { foodId: 'seafood-prawns', quality: 'house', plateSize: 'small', quantity: 12 },
      ],
    });

    expect(result.failure).toBe('locked-exceeds-cap');
  });

  it('refuses a target it cannot reach inside the plate limit', () => {
    const result = plan({
      admission: 500,
      targetRecoveryPercent: 250,
      includedFoodIds: ['chicken-thigh'],
      qualities: ['house'],
      plateSizes: ['small'],
    });

    expect(result.feasible).toBe(false);
    expect(result.failure).toBe('target-unreachable');
  });

  it('never proposes more plates than the simulation will describe', () => {
    for (const strategy of PLAN_STRATEGIES) {
      const result = buildDamagePlan(
        constraints({ strategy, admission: 200, targetRecoveryPercent: 200 }),
        FOODS,
      );
      if (result.feasible) {
        expect(platesIn(result)).toBeLessThanOrEqual(MAX_PLAN_PLATES);
      }
    }
  });

  it('keeps the search inside its declared bounds', () => {
    const result = plan({ admission: 500, targetRecoveryPercent: 250 });
    // Candidates x per-item cap x states, the three constants the module declares.
    expect(result.evaluated).toBeLessThanOrEqual(480 * 12 * 2401);
  });

  it('emits no NaN or Infinity anywhere in a plan', () => {
    const result = plan({ targetRecoveryPercent: 175 });
    const numbers = [
      result.recoveryPercent,
      result.targetRetailValue,
      result.totals.totalRetailValue,
      result.totals.totalWeightG,
      result.totals.nutrition.calories,
      result.totals.nutrition.protein,
    ];
    for (const value of numbers) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('plans nothing at all when there is no admission to recover', () => {
    const result = plan({ admission: 0 });

    expect(result.feasible).toBe(true);
    expect(result.lines).toEqual([]);
    expect(result.recoveryPercent).toBe(0);
  });

  it('clamps a target outside the supported range rather than honouring it', () => {
    const absurd = plan({ targetRecoveryPercent: 10_000 });
    const capped = plan({ targetRecoveryPercent: MAX_TARGET_RECOVERY });

    expect(absurd).toEqual(capped);
  });

  it('follows the active pricing profile rather than the built-in figures', () => {
    const profile = createPricingProfile(
      {
        name: 'Cheap chicken',
        currency: 'AUD',
        overrides: {
          'chicken-thigh': { retailPricePerKg: 200, restaurantCostPerKg: 10 },
        },
      },
      'custom-cheap-chicken',
    );
    expect(profile).not.toBeNull();

    const result = buildDamagePlan(constraints(), FOODS, profile!);

    // At $200/kg the chicken thigh becomes the most efficient plate available.
    expect(result.lines.some((line) => line.foodId === 'chicken-thigh')).toBe(true);
  });

  it('plans with a diner-authored food like any other', () => {
    const custom = createCustomFood(
      {
        name: 'House special',
        category: 'beef',
        retailPricePerKg: 400,
        restaurantCostPerKg: 40,
      },
      'custom-food-house-special',
    );
    expect(custom).not.toBeNull();

    const result = buildDamagePlan(
      constraints(),
      foodCatalogue([custom!]),
      DEFAULT_PRICING_PROFILE,
    );

    expect(result.lines.some((line) => line.foodId === 'custom-food-house-special')).toBe(true);
  });

  it('always says what the plan is, and what it is not', () => {
    expect(plan().rationale.join(' ')).toContain('menu simulation');
    expect(plan().rationale.join(' ')).toContain('not a suggestion about what to eat');
  });

  it('reaches a bigger target with more plates, never fewer', () => {
    const modest = plan({ targetRecoveryPercent: 100 });
    const ambitious = plan({ targetRecoveryPercent: 200 });

    expect(ambitious.totals.totalRetailValue).toBeGreaterThan(modest.totals.totalRetailValue);
    expect(ambitious.totals.totalPlates).toBeGreaterThanOrEqual(modest.totals.totalPlates);
  });

  it('finishes a worst-case search promptly', () => {
    const started = Date.now();
    buildDamagePlan(constraints({ admission: 500, targetRecoveryPercent: 250 }), FOODS);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
