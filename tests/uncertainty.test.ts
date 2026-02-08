import { describe, expect, it } from 'vitest';
import { FOODS } from '@/data/foods';
import { buildDamageReport } from '@/lib/calculations';
import { createCustomFood } from '@/lib/customFoods';
import { foodCatalogue } from '@/lib/foodCatalogue';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import { createPricingProfile } from '@/lib/pricingProfiles';
import {
  UNCERTAINTY_ASSUMPTIONS,
  buildUncertaintyAnalysis,
  scenarioSpreadPercent,
} from '@/lib/uncertainty';
import type { MealItem } from '@/types/meal';

function item(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 'beef-ribeye__standard__regular',
    foodId: 'beef-ribeye',
    quality: 'standard',
    plateSize: 'regular',
    quantity: 8,
    ...overrides,
  };
}

function analyse(items: readonly MealItem[], pricePerDiner = 59.9, dinerCount = 1) {
  return buildUncertaintyAnalysis(items, { pricePerDiner, dinerCount });
}

describe('the stated assumptions', () => {
  it('bracket the base estimate on both sides', () => {
    for (const assumption of UNCERTAINTY_ASSUMPTIONS) {
      expect(assumption.low).toBeLessThan(assumption.base);
      expect(assumption.high).toBeGreaterThan(assumption.base);
      expect(assumption.base).toBe(1);
    }
  });

  it('names what each one actually moves', () => {
    const byId = Object.fromEntries(
      UNCERTAINTY_ASSUMPTIONS.map((assumption) => [assumption.id, assumption.effect]),
    );
    expect(byId['serving-weight']).toBe('recovery');
    expect(byId['retail-price']).toBe('recovery');
    expect(byId['ingredient-cost']).toBe('ingredient-margin');
  });
});

describe('buildUncertaintyAnalysis', () => {
  it('leaves the base scenario identical to the ordinary report', () => {
    const items = [item()];
    const report = buildDamageReport(items, { pricePerDiner: 59.9, dinerCount: 1 });
    const analysis = analyse(items);

    expect(analysis.base.retailValue).toBeCloseTo(report.totalRetailValue, 6);
    expect(analysis.base.recoveryPercent).toBeCloseTo(report.retailRecoveryPercent, 6);
    expect(analysis.base.restaurantCost).toBeCloseTo(report.totalRestaurantCost, 6);
    expect(analysis.base.weightG).toBe(report.totalWeightG);
    expect(analysis.admission).toBe(report.totalAdmission);
  });

  it('orders the three scenarios by the value they recover', () => {
    const analysis = analyse([item()]);

    expect(analysis.conservative.retailValue).toBeLessThan(analysis.base.retailValue);
    expect(analysis.base.retailValue).toBeLessThan(analysis.optimistic.retailValue);
    expect(analysis.conservative.recoveryPercent).toBeLessThan(analysis.base.recoveryPercent);
    expect(analysis.base.recoveryPercent).toBeLessThan(analysis.optimistic.recoveryPercent);
  });

  it('applies both multipliers to the conservative retail value', () => {
    const analysis = analyse([item()]);
    // Serving weight 0.8 and retail price 0.85 compound to 0.68 of the base.
    expect(analysis.conservative.retailValue).toBeCloseTo(analysis.base.retailValue * 0.68, 6);
    expect(analysis.optimistic.retailValue).toBeCloseTo(analysis.base.retailValue * 1.38, 6);
  });

  it('reports each scenario weight under its own serving assumption', () => {
    const analysis = analyse([item()]);

    expect(analysis.conservative.weightG).toBeCloseTo(analysis.base.weightG * 0.8, 6);
    expect(analysis.optimistic.weightG).toBeCloseTo(analysis.base.weightG * 1.2, 6);
  });

  it('is conservative about the ingredient margin as well as the recovery', () => {
    const analysis = analyse([item()]);
    // Highest plausible cost in the conservative scenario, lowest in the upper one.
    expect(analysis.conservative.restaurantCost).toBeGreaterThan(
      analysis.optimistic.restaurantCost,
    );
  });

  it('calls a comfortable win robust', () => {
    const analysis = analyse([item({ quantity: 20, quality: 'premium', plateSize: 'large' })]);

    expect(analysis.base.beatsAdmission).toBe(true);
    expect(analysis.conservative.beatsAdmission).toBe(true);
    expect(analysis.robust).toBe(true);
    expect(analysis.headline).toBe(
      'Even under the conservative assumptions, estimated retail value stays above admission.',
    );
  });

  it('calls a comfortable loss robust too, from the other side', () => {
    const analysis = analyse([item({ quantity: 1, quality: 'house', plateSize: 'small' })]);

    expect(analysis.optimistic.beatsAdmission).toBe(false);
    expect(analysis.robust).toBe(true);
    expect(analysis.headline).toBe(
      'Admission stays ahead even under the most generous assumptions here.',
    );
  });

  it('says so plainly when the verdict depends on the assumptions', () => {
    // Tuned so the base estimate clears admission and the conservative one does not.
    const analysis = analyse([item({ quantity: 8 })], 60);

    expect(analysis.base.beatsAdmission).toBe(true);
    expect(analysis.conservative.beatsAdmission).toBe(false);
    expect(analysis.robust).toBe(false);
    expect(analysis.headline).toContain('depends on the assumptions');
  });

  it('reports nothing to test for an empty tab, without dividing by zero', () => {
    const analysis = analyse([]);

    expect(analysis.robust).toBe(false);
    expect(analysis.headline).toBe('There is nothing on the tab to test yet.');
    expect(Number.isFinite(analysis.base.recoveryPercent)).toBe(true);
    expect(scenarioSpreadPercent(analysis)).toBe(0);
  });

  it('emits no NaN or Infinity when admission is at its floor', () => {
    const analysis = buildUncertaintyAnalysis([item()], { pricePerDiner: 0, dinerCount: 1 });

    for (const scenario of [analysis.conservative, analysis.base, analysis.optimistic]) {
      expect(Number.isFinite(scenario.recoveryPercent)).toBe(true);
      expect(Number.isFinite(scenario.retailValue)).toBe(true);
    }
  });

  it('follows the active pricing profile', () => {
    const profile = createPricingProfile(
      {
        name: 'Expensive ribeye',
        currency: 'AUD',
        overrides: {
          'beef-ribeye': {
            valuation: 'by-weight' as const,
            retailPricePerKg: 500,
            restaurantCostPerKg: 50,
          },
        },
      },
      'custom-expensive-ribeye',
    );
    const analysis = buildUncertaintyAnalysis(
      [item()],
      { pricePerDiner: 59.9, dinerCount: 1 },
      profile!,
    );
    const baseline = analyse([item()]);

    expect(analysis.base.retailValue).toBeGreaterThan(baseline.base.retailValue);
    // The scenarios scale from the profile's own figures, not the catalogue's.
    expect(analysis.conservative.retailValue).toBeCloseTo(analysis.base.retailValue * 0.68, 6);
  });

  it('handles a diner-authored food like any other', () => {
    const custom = createCustomFood(
      { name: 'House special', category: 'beef', retailPricePerKg: 90, restaurantCostPerKg: 20 },
      'custom-food-house-special',
    );
    const analysis = buildUncertaintyAnalysis(
      [item({ id: 'x', foodId: 'custom-food-house-special' })],
      { pricePerDiner: 59.9, dinerCount: 1 },
      DEFAULT_PRICING_PROFILE,
      foodCatalogue([custom!]),
    );

    expect(analysis.base.retailValue).toBeGreaterThan(0);
    expect(analysis.conservative.retailValue).toBeLessThan(analysis.base.retailValue);
  });

  it('respects a per-diner admission override', () => {
    const analysis = buildUncertaintyAnalysis([item()], {
      pricePerDiner: 59.9,
      dinerCount: 2,
      diners: [
        { id: 'lorenzo', displayName: 'Lorenzo', admissionPrice: 30 },
        { id: 'omar', displayName: 'Omar' },
      ],
    });

    expect(analysis.admission).toBeCloseTo(89.9, 6);
  });

  it('accounts for the entire table when there is more than one diner', () => {
    const one = analyse([item()], 59.9, 1);
    const two = analyse([item()], 59.9, 2);

    expect(two.admission).toBeCloseTo(one.admission * 2, 6);
    expect(two.base.recoveryPercent).toBeCloseTo(one.base.recoveryPercent / 2, 6);
  });
});

describe('sensitivity analysis', () => {
  it('ranks the assumptions by how much they move the recovery', () => {
    const analysis = analyse([item()]);
    const swings = analysis.sensitivity.map((entry) => entry.swingPoints);

    expect(swings).toEqual([...swings].sort((a, b) => b - a));
    // Serving weight has the wider band, so it moves the result more.
    expect(analysis.sensitivity[0]?.assumptionId).toBe('serving-weight');
    expect(analysis.sensitivity[1]?.assumptionId).toBe('retail-price');
  });

  it('is deterministic for a meal where two assumptions matter equally', () => {
    const analysis = analyse([item()]);
    expect(analyse([item()]).sensitivity).toEqual(analysis.sensitivity);
  });

  it('never gives a negative swing', () => {
    for (const entry of analyse([item()]).sensitivity) {
      expect(entry.swingPoints).toBeGreaterThanOrEqual(0);
      expect(entry.marginSwing).toBeGreaterThanOrEqual(0);
    }
  });

  it('leaves the recovery untouched by the ingredient-cost assumption', () => {
    const cost = analyse([item()]).sensitivity.find(
      (entry) => entry.assumptionId === 'ingredient-cost',
    );

    expect(cost?.swingPoints).toBe(0);
    expect(cost?.changesOutcome).toBe(false);
    // It does move the figure it is actually about.
    expect(cost?.marginSwing).toBeGreaterThan(0);
  });

  it('flags the assumption that decides the outcome on its own', () => {
    const analysis = analyse([item({ quantity: 8 })], 60);
    const decisive = analysis.sensitivity.filter((entry) => entry.changesOutcome);

    expect(decisive.length).toBeGreaterThan(0);
    expect(decisive[0]?.assumptionId).toBe('serving-weight');
  });

  it('flags nothing as decisive when the result is not close', () => {
    const analysis = analyse([item({ quantity: 30, quality: 'premium', plateSize: 'large' })]);

    expect(analysis.sensitivity.every((entry) => !entry.changesOutcome)).toBe(true);
  });

  it('brackets the base estimate at both ends of every assumption', () => {
    const analysis = analyse([item()]);

    for (const entry of analysis.sensitivity) {
      expect(entry.lowRecoveryPercent).toBeLessThanOrEqual(analysis.base.recoveryPercent + 1e-9);
      expect(entry.highRecoveryPercent).toBeGreaterThanOrEqual(
        analysis.base.recoveryPercent - 1e-9,
      );
    }
  });
});

describe('scenarioSpreadPercent', () => {
  it('states the range as a share of the base estimate', () => {
    const analysis = analyse([item()]);
    // 1.38 - 0.68 of the base.
    expect(scenarioSpreadPercent(analysis)).toBeCloseTo(70, 6);
  });

  it('is zero rather than NaN with nothing recorded', () => {
    expect(scenarioSpreadPercent(analyse([]))).toBe(0);
  });
});

describe('the catalogue itself', () => {
  it('scales every food in the catalogue, not just the ones on the tab', () => {
    const analysis = buildUncertaintyAnalysis(
      [item()],
      { pricePerDiner: 59.9, dinerCount: 1 },
      DEFAULT_PRICING_PROFILE,
      FOODS,
    );
    expect(analysis.base.retailValue).toBeGreaterThan(0);
  });
});
