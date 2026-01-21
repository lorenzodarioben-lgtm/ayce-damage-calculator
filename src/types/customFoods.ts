import type { FoodCategory, FoodItem, VisualVariant } from '@/types/meal';

/** A diner-authored menu item. It follows the same calculation contract as a built-in cut. */
export interface CustomFood extends FoodItem {
  readonly isCustom: true;
}

export interface CustomFoodDraft {
  readonly name: string;
  readonly shortName?: string;
  readonly category: FoodCategory;
  readonly description?: string;
  readonly retailPricePerKg: number;
  readonly restaurantCostPerKg: number;
  readonly caloriesPer100g?: number;
  readonly proteinPer100g?: number;
  readonly fatPer100g?: number;
  readonly carbsPer100g?: number;
}

export const CUSTOM_FOOD_VARIANT_BY_CATEGORY: Readonly<Record<FoodCategory, VisualVariant>> = {
  beef: 'brisket-slices',
  pork: 'pork-belly-layers',
  chicken: 'chicken-thigh-pieces',
  seafood: 'prawns',
};
