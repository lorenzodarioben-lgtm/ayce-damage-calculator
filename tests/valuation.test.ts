import { describe, expect, it } from 'vitest';
import { FOODS } from '@/data/foods';
import { buildDamageReport, calculateLineItem, calculateSessionTotals } from '@/lib/calculations';
import { PLATE_SIZES, QUALITY_TIERS } from '@/lib/constants';
import { createCustomFood, parseCustomFood } from '@/lib/customFoods';
import { foodCatalogue } from '@/lib/foodCatalogue';
import { DEFAULT_PRICING_PROFILE, resolveFoodPricing } from '@/lib/pricing';
import { resolveValuation, unitNoun, usesPlateSize } from '@/lib/valuation';
import type { CustomFood } from '@/types/customFoods';
import type { MealItem } from '@/types/meal';
import type { PricingProfile as Profile } from '@/types/pricing';

/**
 * Two valuation models, one engine.
 *
 * The first block is the load-bearing one. Refactoring how food is valued is
 * only safe if it is provably a refactor, so every built-in cut is recomputed
 * against arithmetic written out by hand from the dataset — deliberately not
 * through the code under test.
 */

const SOUP: CustomFood = createCustomFood(
  {
    name: 'Kimchi jjigae',
    category: 'pork',
    valuation: 'by-serving',
    retailPricePerServing: 12,
    restaurantCostPerServing: 4,
    gramsPerServing: 400,
    caloriesPerServing: 320,
    proteinPerServing: 18,
    fatPerServing: 20,
    carbsPerServing: 12,
  },
  'custom-food-kimchi-jjigae',
)!;

const UNWEIGHED: CustomFood = createCustomFood(
  {
    name: 'House beer',
    category: 'seafood',
    valuation: 'by-serving',
    retailPricePerServing: 9,
    restaurantCostPerServing: 2.5,
  },
  'custom-food-house-beer',
)!;

function line(foodId: string, overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: `${foodId}__standard__regular`,
    foodId,
    quality: 'standard',
    plateSize: 'regular',
    quantity: 1,
    ...overrides,
  };
}

describe('Every weight-valued fixture is unchanged', () => {
  it.each(
    FOODS.flatMap((food) =>
      QUALITY_TIERS.flatMap((tier) =>
        PLATE_SIZES.map((size) => [`${food.id} ${tier.id} ${size.id}`, food, tier, size] as const),
      ),
    ),
  )('%s values exactly as the dataset says', (_label, food, tier, size) => {
    if (food.valuation !== 'by-weight') {
      throw new Error('every built-in cut is priced by weight');
    }

    const totals = calculateLineItem(line(food.id, { quality: tier.id, plateSize: size.id }), food);
    const kg = size.grams / 1000;
    const per100g = size.grams / 100;

    // Written out longhand from the dataset, so this cannot agree with the
    // engine merely by sharing its bugs.
    expect(totals.retailValue).toBeCloseTo(kg * food.retailPricePerKg * tier.retailMultiplier, 10);
    expect(totals.restaurantCost).toBeCloseTo(
      kg * food.restaurantCostPerKg * tier.restaurantMultiplier,
      10,
    );
    expect(totals.weightG).toBe(size.grams);
    expect(totals.nutrition.calories).toBeCloseTo(per100g * food.caloriesPer100g!, 10);
    expect(totals.nutrition.protein).toBeCloseTo(per100g * food.proteinPer100g!, 10);
    expect(totals.nutrition.fat).toBeCloseTo(per100g * food.fatPer100g!, 10);
    expect(totals.nutrition.carbs).toBeCloseTo(per100g * food.carbsPer100g!, 10);
    expect(totals.hasNutrition).toBe(true);
    expect(totals.hasWeight).toBe(true);
  });

  it('scales with quantity exactly as it always did', () => {
    const food = FOODS[2]!;
    const one = calculateLineItem(line(food.id), food);
    const four = calculateLineItem(line(food.id, { quantity: 4 }), food);

    expect(four.retailValue).toBeCloseTo(one.retailValue * 4, 10);
    expect(four.weightG).toBe(one.weightG * 4);
  });

  it('still uses plate size, which is what makes it weight-valued', () => {
    for (const food of FOODS) {
      expect(usesPlateSize(food)).toBe(true);
      expect(unitNoun(food)).toBe('plate');
    }
  });
});

describe('A serving-valued item', () => {
  it('is one thing at one price, whatever plate size is stored', () => {
    for (const size of PLATE_SIZES) {
      const totals = calculateLineItem(line(SOUP.id, { plateSize: size.id }), SOUP);
      // A serving is whatever the restaurant serves; scaling it by a control
      // the diner never saw would be an invention.
      expect(totals.retailValue).toBe(12);
      expect(totals.weightG).toBe(400);
    }
  });

  it('applies the quality tier to its serving price', () => {
    const house = calculateLineItem(line(SOUP.id, { quality: 'house' }), SOUP);
    const premium = calculateLineItem(line(SOUP.id, { quality: 'premium' }), SOUP);

    expect(house.retailValue).toBeCloseTo(12 * 0.85, 10);
    expect(premium.retailValue).toBeCloseTo(12 * 1.35, 10);
    expect(premium.restaurantCost).toBeCloseTo(4 * 1.25, 10);
  });

  it('carries its nutrition per serving, not per hundred grams', () => {
    const totals = calculateLineItem(line(SOUP.id, { quantity: 3 }), SOUP);

    expect(totals.nutrition.calories).toBe(960);
    expect(totals.nutrition.protein).toBe(54);
  });

  it('counts servings, not plates', () => {
    expect(usesPlateSize(SOUP)).toBe(false);
    expect(unitNoun(SOUP)).toBe('serving');
    expect(unitNoun(SOUP, true)).toBe('servings');
  });

  it('says it was never weighed rather than reporting nothing', () => {
    const totals = calculateLineItem(line(UNWEIGHED.id, { quantity: 2 }), UNWEIGHED);

    expect(totals.hasWeight).toBe(false);
    expect(totals.weightG).toBe(0);
    // The value is real even though the weight is unknown.
    expect(totals.retailValue).toBe(18);
  });

  it('honours what was eaten, exactly as a plate does', () => {
    const totals = calculateLineItem(line(SOUP.id, { quantity: 2, consumedQuantity: 1 }), SOUP);

    expect(totals.retailValue).toBe(12);
    expect(totals.orderedRetailValue).toBe(24);
    expect(totals.weightG).toBe(400);
    expect(totals.orderedWeightG).toBe(800);
    // Ingredient cost follows what arrived, whichever model prices it.
    expect(totals.restaurantCost).toBe(8);
  });
});

describe('The two models sit in one meal', () => {
  const catalogue = foodCatalogue([SOUP, UNWEIGHED]);

  it('totals a mixed tab without either model leaking into the other', () => {
    const items = [line('beef-ribeye', { quantity: 2 }), line(SOUP.id, { quantity: 1 })];
    const totals = calculateSessionTotals(items, DEFAULT_PRICING_PROFILE, catalogue);

    const ribeye = calculateLineItem(items[0]!, FOODS.find((f) => f.id === 'beef-ribeye')!);
    expect(totals.totalRetailValue).toBeCloseTo(ribeye.retailValue + 12, 10);
    expect(totals.totalWeightG).toBe(ribeye.weightG + 400);
    expect(totals.totalPlates).toBe(3);
  });

  it('keeps every figure finite with an unweighed item on the tab', () => {
    const report = buildDamageReport(
      [line(UNWEIGHED.id, { quantity: 3 })],
      { pricePerDiner: 50, dinerCount: 1 },
      DEFAULT_PRICING_PROFILE,
      catalogue,
    );

    for (const value of [
      report.totalRetailValue,
      report.totalWeightG,
      report.totalWeightKg,
      report.retailRecoveryPercent,
      report.averageRetailValuePerPlate,
      report.platesToBreakEven,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Pricing overrides respect the model', () => {
  const perServing: Profile = {
    ...DEFAULT_PRICING_PROFILE,
    id: 'custom-late-night',
    name: 'Late night',
    builtIn: false,
    overrides: {
      [SOUP.id]: {
        valuation: 'by-serving',
        retailPricePerServing: 18,
        restaurantCostPerServing: 6,
      },
    },
  };

  it('applies an override written in the model the item uses', () => {
    expect(resolveValuation(SOUP, 'standard', 'regular', perServing).retailPerUnit).toBe(18);
  });

  it('ignores an override written in the wrong model', () => {
    const mismatched: Profile = {
      ...perServing,
      overrides: {
        [SOUP.id]: { valuation: 'by-weight', retailPricePerKg: 900, restaurantCostPerKg: 400 },
      },
    };

    // A price per kilogram says nothing usable about a bowl of soup, so the
    // catalogue estimate stands rather than a confident wrong number.
    expect(resolveValuation(SOUP, 'standard', 'regular', mismatched).retailPerUnit).toBe(12);
  });

  it('reports pricing back in the model the item uses', () => {
    const soupPricing = resolveFoodPricing(SOUP, perServing);
    expect(soupPricing.valuation).toBe('by-serving');
    expect(soupPricing.valuation === 'by-serving' ? soupPricing.retailPricePerServing : null).toBe(
      18,
    );

    const cutPricing = resolveFoodPricing(FOODS[0]!);
    expect(cutPricing.valuation).toBe('by-weight');
  });
});

describe('Custom items round trip through storage', () => {
  it('keeps the model and figures of a serving-valued item', () => {
    const parsed = parseCustomFood(JSON.parse(JSON.stringify(SOUP)));

    expect(parsed).toEqual(SOUP);
  });

  it('reads an item with no valuation key as priced by weight', () => {
    // Exactly the shape every custom food had before this model existed.
    const legacy = {
      id: 'custom-food-cheese-corn',
      name: 'Cheese corn',
      shortName: 'Cheese corn',
      category: 'chicken',
      description: 'A custom chicken menu item.',
      retailPricePerKg: 14,
      restaurantCostPerKg: 6,
      caloriesPer100g: 180,
      proteinPer100g: 4,
      fatPer100g: 9,
      carbsPer100g: 18,
      visualVariant: 'chicken-thigh-pieces',
      isCustom: true,
    };
    const parsed = parseCustomFood(legacy);

    expect(parsed?.valuation).toBe('by-weight');
    expect(parsed?.valuation === 'by-weight' ? parsed.retailPricePerKg : null).toBe(14);
    // And it values exactly as it always did.
    expect(calculateLineItem(line(parsed!.id), parsed!).retailValue).toBeCloseTo(0.155 * 14, 10);
  });

  it('refuses a serving-valued draft with no price', () => {
    expect(
      createCustomFood(
        {
          name: 'Nothing',
          category: 'beef',
          valuation: 'by-serving',
          retailPricePerServing: Number.NaN,
          restaurantCostPerServing: 1,
        },
        'custom-food-nothing',
      ),
    ).toBeNull();
  });

  it('treats an absent serving weight as unweighed rather than rejecting it', () => {
    expect(UNWEIGHED.valuation === 'by-serving' ? UNWEIGHED.gramsPerServing : null).toBe(0);
    expect(resolveValuation(UNWEIGHED, 'standard', 'regular').hasWeight).toBe(false);
  });
});
