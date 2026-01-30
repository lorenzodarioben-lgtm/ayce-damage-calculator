import { getPlateSizeMeta, getQualityMeta } from '@/lib/constants';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import type { PricingProfile } from '@/types/pricing';
import type { FoodItem, Nutrition, PlateSize, QualityTier, ValuationModel } from '@/types/meal';

/**
 * One unit of a menu item, whichever way it is priced.
 *
 * This is the whole point of the refactor. Two valuation models meet here and
 * become the same four numbers, so the calculation engine below has one code
 * path rather than a branch it would have to keep in step forever. Everything
 * model-specific — what a plate size means, what quality multiplies, whether a
 * weight was ever recorded — is decided once, in this file.
 *
 * "Unit" means a plate for a weight-valued cut and a serving for a
 * serving-valued item. The tab counts units either way, which is why a line's
 * quantity has needed no change at all.
 */
export interface UnitValuation {
  readonly model: ValuationModel;
  /** Retail value of one unit, with the quality tier already applied. */
  readonly retailPerUnit: number;
  /** Estimated ingredient cost of one unit, quality already applied. */
  readonly restaurantCostPerUnit: number;
  /** Weight of one unit. Zero for a serving nobody weighed. */
  readonly gramsPerUnit: number;
  readonly nutritionPerUnit: Nutrition;
  /**
   * False when the item is priced by serving and no weight was declared, so a
   * surface can say "not weighed" instead of reporting a confident zero.
   */
  readonly hasWeight: boolean;
}

function positive(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function nonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function isServingValued(
  food: FoodItem,
): food is Extract<FoodItem, { valuation: 'by-serving' }> {
  return food.valuation === 'by-serving';
}

/**
 * Applies a profile's per-item assumptions without ever mutating the catalogue.
 *
 * An override written for the wrong valuation model is ignored rather than
 * coerced: a price per kilogram says nothing usable about a bowl of soup, and
 * silently treating one as the other would produce a confident wrong number.
 */
export function resolveValuation(
  food: FoodItem,
  quality: QualityTier,
  plateSize: PlateSize,
  profile: Pick<PricingProfile, 'overrides'> = DEFAULT_PRICING_PROFILE,
): UnitValuation {
  const tier = getQualityMeta(quality);
  const override = profile.overrides[food.id];

  if (food.valuation === 'by-serving') {
    const priced = override?.valuation === 'by-serving' ? override : undefined;
    const retail = nonNegative(priced?.retailPricePerServing) ?? food.retailPricePerServing;
    const cost = nonNegative(priced?.restaurantCostPerServing) ?? food.restaurantCostPerServing;
    const grams = positive(food.gramsPerServing);

    return {
      model: 'by-serving',
      // Plate size is deliberately absent from all of this: a serving is
      // whatever the restaurant serves, and scaling it by a plate size the
      // diner never chose would be an invention.
      retailPerUnit: Math.max(0, retail) * tier.retailMultiplier,
      restaurantCostPerUnit: Math.max(0, cost) * tier.restaurantMultiplier,
      gramsPerUnit: grams,
      nutritionPerUnit: {
        calories: Math.max(0, nonNegative(food.caloriesPerServing) ?? 0),
        protein: Math.max(0, nonNegative(food.proteinPerServing) ?? 0),
        fat: Math.max(0, nonNegative(food.fatPerServing) ?? 0),
        carbs: Math.max(0, nonNegative(food.carbsPerServing) ?? 0),
      },
      hasWeight: grams > 0,
    };
  }

  const priced = override?.valuation === 'by-weight' ? override : undefined;
  const retailPerKg = nonNegative(priced?.retailPricePerKg) ?? food.retailPricePerKg;
  const costPerKg = nonNegative(priced?.restaurantCostPerKg) ?? food.restaurantCostPerKg;
  const grams = getPlateSizeMeta(plateSize).grams;
  const kg = grams / 1000;
  const per100g = grams / 100;

  return {
    model: 'by-weight',
    retailPerUnit: kg * Math.max(0, retailPerKg) * tier.retailMultiplier,
    restaurantCostPerUnit: kg * Math.max(0, costPerKg) * tier.restaurantMultiplier,
    gramsPerUnit: grams,
    nutritionPerUnit: {
      calories: per100g * Math.max(0, food.caloriesPer100g),
      protein: per100g * Math.max(0, food.proteinPer100g),
      fat: per100g * Math.max(0, food.fatPer100g),
      carbs: per100g * Math.max(0, food.carbsPer100g),
    },
    hasWeight: true,
  };
}

/** What a unit of this item is called, for a label that has to name one. */
export function unitNoun(food: FoodItem, plural = false): string {
  if (food.valuation === 'by-serving') {
    return plural ? 'servings' : 'serving';
  }
  return plural ? 'plates' : 'plate';
}

/** True when the plate-size control has anything to say about this item. */
export function usesPlateSize(food: FoodItem): boolean {
  return food.valuation === 'by-weight';
}
