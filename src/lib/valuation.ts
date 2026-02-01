import {
  MAX_PLATE_GRAMS,
  MIN_PLATE_GRAMS,
  REGULAR_PLATE_GRAMS,
  getPlateSizeMeta,
  getQualityMeta,
} from '@/lib/constants';
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
  /**
   * False when the item has no macros on file. Distinguished from all-zero
   * because "we do not know" and "it contains nothing" are different claims,
   * and only one of them is ever true of food.
   */
  readonly hasNutrition: boolean;
}

/** True when any macro was actually recorded for this item. */
function anyRecorded(values: readonly (number | undefined)[]): boolean {
  return values.some((value) => typeof value === 'number' && Number.isFinite(value));
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
 * A declared regular-plate weight, or undefined for the nominal one.
 *
 * The trust boundary for a figure that arrives from storage, a share token and
 * a CSV somebody else wrote. Anything outside the plausible range is not
 * clamped into it but ignored: a plate weight of a million grams is not a
 * two-kilogram plate, it is a mistake, and falling back to the stated nominal
 * weight says something true instead of something merely bounded.
 */
export function normalisePlateGrams(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  const rounded = Math.round(value);
  return rounded >= MIN_PLATE_GRAMS && rounded <= MAX_PLATE_GRAMS ? rounded : undefined;
}

/**
 * What one plate of this size weighs.
 *
 * The other two sizes keep their proportion to the regular one, so a place that
 * serves 250 g regular plates serves a small at the same fraction of it that a
 * small has always been. Rounded to the gram, because a plate is not measured
 * to the milligram and the figure is displayed as a whole number anyway.
 */
export function plateGrams(plateSize: PlateSize, declaredRegularGrams?: number): number {
  const nominal = getPlateSizeMeta(plateSize).grams;
  if (declaredRegularGrams === undefined) {
    return nominal;
  }
  return Math.max(1, Math.round(declaredRegularGrams * (nominal / REGULAR_PLATE_GRAMS)));
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
      hasNutrition: anyRecorded([
        food.caloriesPerServing,
        food.proteinPerServing,
        food.fatPerServing,
        food.carbsPerServing,
      ]),
    };
  }

  const priced = override?.valuation === 'by-weight' ? override : undefined;
  const retailPerKg = nonNegative(priced?.retailPricePerKg) ?? food.retailPricePerKg;
  const costPerKg = nonNegative(priced?.restaurantCostPerKg) ?? food.restaurantCostPerKg;
  // A profile's declared plate wins over the item's own, which wins over the
  // app's nominal one. Every figure below is weight times a price, so this is
  // the number a restaurant's real portions have to be able to correct.
  const grams = plateGrams(
    plateSize,
    normalisePlateGrams(priced?.gramsPerPlate) ?? normalisePlateGrams(food.gramsPerPlate),
  );
  const kg = grams / 1000;
  const per100g = grams / 100;

  return {
    model: 'by-weight',
    retailPerUnit: kg * Math.max(0, retailPerKg) * tier.retailMultiplier,
    restaurantCostPerUnit: kg * Math.max(0, costPerKg) * tier.restaurantMultiplier,
    gramsPerUnit: grams,
    nutritionPerUnit: {
      calories: per100g * Math.max(0, nonNegative(food.caloriesPer100g) ?? 0),
      protein: per100g * Math.max(0, nonNegative(food.proteinPer100g) ?? 0),
      fat: per100g * Math.max(0, nonNegative(food.fatPer100g) ?? 0),
      carbs: per100g * Math.max(0, nonNegative(food.carbsPer100g) ?? 0),
    },
    hasWeight: true,
    hasNutrition: anyRecorded([
      food.caloriesPer100g,
      food.proteinPer100g,
      food.fatPer100g,
      food.carbsPer100g,
    ]),
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
