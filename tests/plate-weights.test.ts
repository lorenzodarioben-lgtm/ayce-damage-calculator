import { describe, expect, it } from 'vitest';
import { findFood } from '@/data/foods';
import { buildDamageReport } from '@/lib/calculations';
import { MAX_PLATE_GRAMS, REGULAR_PLATE_GRAMS } from '@/lib/constants';
import { createCustomFood, parseCustomFood } from '@/lib/customFoods';
import { planCsvImport } from '@/lib/menuImport';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import { normalisePlateGrams, plateGrams, resolveValuation } from '@/lib/valuation';
import type { PricingProfile } from '@/types/pricing';
import type { MealItem, WeightValuedFood } from '@/types/meal';

/**
 * What a plate actually weighs.
 *
 * Retail value is weight times price per kilogram, so this one number moves
 * every figure the report prints. The property under test throughout: a
 * declared weight is used, an absent one keeps the nominal 155 g exactly, and
 * nothing a stranger could write into a file can make a plate implausible.
 */

const ribeye = findFood('beef-ribeye')! as WeightValuedFood;

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

describe('Reading a declared plate weight', () => {
  it('accepts a plausible one, to the gram', () => {
    expect(normalisePlateGrams(250)).toBe(250);
    expect(normalisePlateGrams(249.6)).toBe(250);
  });

  it('ignores an implausible one rather than clamping it into range', () => {
    // A million-gram plate is a mistake, not a two-kilogram plate. Falling back
    // to the nominal weight says something true; clamping says something merely
    // bounded.
    expect(normalisePlateGrams(1_000_000)).toBeUndefined();
    expect(normalisePlateGrams(MAX_PLATE_GRAMS + 1)).toBeUndefined();
    expect(normalisePlateGrams(0)).toBeUndefined();
    expect(normalisePlateGrams(-200)).toBeUndefined();
    expect(normalisePlateGrams(Number.NaN)).toBeUndefined();
    expect(normalisePlateGrams('250')).toBeUndefined();
  });
});

describe('What a plate of each size weighs', () => {
  it('is the nominal weight when nothing was declared', () => {
    expect(plateGrams('small')).toBe(100);
    expect(plateGrams('regular')).toBe(REGULAR_PLATE_GRAMS);
    expect(plateGrams('large')).toBe(220);
  });

  it('is the declared weight for a regular plate', () => {
    expect(plateGrams('regular', 250)).toBe(250);
  });

  it('keeps the other sizes in the proportion they always had', () => {
    // A small has always been 100/155 of a regular, and still is.
    expect(plateGrams('small', 310)).toBe(200);
    expect(plateGrams('large', 310)).toBe(440);
  });
});

describe('Valuing a cut against a real plate', () => {
  it('is unchanged for a cut that declares nothing', () => {
    const unit = resolveValuation(ribeye, 'standard', 'regular');
    expect(unit.gramsPerUnit).toBe(REGULAR_PLATE_GRAMS);
    expect(unit.retailPerUnit).toBeCloseTo(
      (REGULAR_PLATE_GRAMS / 1000) * ribeye.retailPricePerKg,
      10,
    );
  });

  it('uses the weight the item itself declares', () => {
    const heavy: WeightValuedFood = { ...ribeye, gramsPerPlate: 310 };
    const unit = resolveValuation(heavy, 'standard', 'regular');

    expect(unit.gramsPerUnit).toBe(310);
    // Twice the plate is twice the value, which is the whole point.
    expect(unit.retailPerUnit).toBeCloseTo((310 / 1000) * ribeye.retailPricePerKg, 10);
  });

  it('lets a pricing profile override what the item declares', () => {
    const profile: PricingProfile = {
      ...DEFAULT_PRICING_PROFILE,
      overrides: {
        [ribeye.id]: {
          valuation: 'by-weight',
          retailPricePerKg: ribeye.retailPricePerKg,
          restaurantCostPerKg: ribeye.restaurantCostPerKg,
          gramsPerPlate: 200,
        },
      },
    };
    const heavy: WeightValuedFood = { ...ribeye, gramsPerPlate: 310 };

    expect(resolveValuation(heavy, 'standard', 'regular', profile).gramsPerUnit).toBe(200);
  });

  it('ignores a malformed override and keeps the nominal plate', () => {
    const profile: PricingProfile = {
      ...DEFAULT_PRICING_PROFILE,
      overrides: {
        [ribeye.id]: {
          valuation: 'by-weight',
          retailPricePerKg: ribeye.retailPricePerKg,
          restaurantCostPerKg: ribeye.restaurantCostPerKg,
          gramsPerPlate: Number.NaN,
        },
      },
    };

    expect(resolveValuation(ribeye, 'standard', 'regular', profile).gramsPerUnit).toBe(
      REGULAR_PLATE_GRAMS,
    );
  });

  it('scales nutrition with the plate, not just the price', () => {
    const heavy: WeightValuedFood = { ...ribeye, gramsPerPlate: 310 };
    const nominal = resolveValuation(ribeye, 'standard', 'regular');
    const declared = resolveValuation(heavy, 'standard', 'regular');

    expect(declared.nutritionPerUnit.calories).toBeCloseTo(
      nominal.nutritionPerUnit.calories * 2,
      8,
    );
  });
});

describe('A real plate on a real report', () => {
  it('moves weight, value and recovery together', () => {
    const config = { pricePerDiner: 50, dinerCount: 1 };
    const nominal = buildDamageReport([item({ quantity: 4 })], config);
    const heavy = buildDamageReport([item({ quantity: 4 })], config, DEFAULT_PRICING_PROFILE, [
      { ...ribeye, gramsPerPlate: 310 },
    ]);

    expect(heavy.totalWeightG).toBeCloseTo(nominal.totalWeightG * 2, 8);
    expect(heavy.totalRetailValue).toBeCloseTo(nominal.totalRetailValue * 2, 8);
    expect(heavy.retailRecoveryPercent).toBeCloseTo(nominal.retailRecoveryPercent * 2, 8);
  });
});

describe('A diner-authored cut', () => {
  it('keeps a declared plate weight', () => {
    const food = createCustomFood(
      {
        name: 'House brisket',
        category: 'beef',
        valuation: 'by-weight',
        retailPricePerKg: 40,
        restaurantCostPerKg: 20,
        gramsPerPlate: 250,
      },
      'custom-food-house-brisket',
    );
    expect(food).toMatchObject({ valuation: 'by-weight', gramsPerPlate: 250 });
  });

  it('omits the key entirely when nobody declared one', () => {
    const food = createCustomFood(
      {
        name: 'House brisket',
        category: 'beef',
        valuation: 'by-weight',
        retailPricePerKg: 40,
        restaurantCostPerKg: 20,
      },
      'custom-food-house-brisket',
    );
    expect(food).not.toHaveProperty('gramsPerPlate');
  });

  it('drops an implausible weight rather than storing it', () => {
    const food = createCustomFood(
      {
        name: 'House brisket',
        category: 'beef',
        valuation: 'by-weight',
        retailPricePerKg: 40,
        restaurantCostPerKg: 20,
        gramsPerPlate: 99_999,
      },
      'custom-food-house-brisket',
    );
    expect(food).not.toHaveProperty('gramsPerPlate');
  });

  it('round-trips through storage', () => {
    const stored = {
      id: 'custom-food-house-brisket',
      name: 'House brisket',
      category: 'beef',
      valuation: 'by-weight',
      retailPricePerKg: 40,
      restaurantCostPerKg: 20,
      gramsPerPlate: 250,
    };
    expect(parseCustomFood(stored)).toMatchObject({ gramsPerPlate: 250 });
  });
});

describe('Importing a menu that states its plate weights', () => {
  const header =
    'name,category,valuation,short_name,description,retail_price,restaurant_cost,grams_per_serving';

  it('honours the grams column for a plated cut instead of discarding it', () => {
    const plan = planCsvImport(`${header}\nHouse brisket,beef,by-weight,,,40,20,250`, []);

    expect(plan.accepted).toHaveLength(1);
    expect(plan.accepted[0]).toMatchObject({ valuation: 'by-weight', gramsPerPlate: 250 });
  });

  it('still keeps a blank column meaning the nominal plate', () => {
    const plan = planCsvImport(`${header}\nHouse brisket,beef,by-weight,,,40,20,`, []);

    expect(plan.accepted[0]).not.toHaveProperty('gramsPerPlate');
  });

  it('accepts a row whose weight is out of range, without the weight', () => {
    // The prices are still usable, so the row is not thrown away over a figure
    // the importer can safely decline to believe.
    const plan = planCsvImport(`${header}\nHouse brisket,beef,by-weight,,,40,20,99999`, []);

    expect(plan.accepted).toHaveLength(1);
    expect(plan.accepted[0]).not.toHaveProperty('gramsPerPlate');
  });

  it('leaves a per-serving row reading its own serving weight', () => {
    const plan = planCsvImport(`${header}\nHouse lager,drinks,by-serving,,,9,2.5,330`, []);

    expect(plan.accepted[0]).toMatchObject({ valuation: 'by-serving', gramsPerServing: 330 });
  });
});
