import type {
  FoodCategory,
  ServingValuedFood,
  ValuationModel,
  VisualVariant,
  WeightValuedFood,
} from '@/types/meal';

/**
 * A diner-authored menu item. It follows the same calculation contract as a
 * built-in cut, under either valuation model.
 */
export type CustomFood =
  | (WeightValuedFood & { readonly isCustom: true })
  | (ServingValuedFood & { readonly isCustom: true });

interface CustomFoodDraftBase {
  readonly name: string;
  readonly shortName?: string;
  readonly category: FoodCategory;
  readonly description?: string;
}

/** Priced by weight, like every built-in cut. */
export interface WeightValuedDraft extends CustomFoodDraftBase {
  readonly valuation?: 'by-weight';
  readonly retailPricePerKg: number;
  readonly restaurantCostPerKg: number;
  readonly caloriesPer100g?: number;
  readonly proteinPer100g?: number;
  readonly fatPer100g?: number;
  readonly carbsPer100g?: number;
}

/**
 * Priced by serving: one thing at one price.
 *
 * The serving weight is optional because a diner may genuinely not know it —
 * nobody weighs a bowl of soup — and an invented figure would be worse than an
 * absent one. Omitting it means the item contributes no weight, and the
 * interface says so rather than reporting a confident zero.
 */
export interface ServingValuedDraft extends CustomFoodDraftBase {
  readonly valuation: 'by-serving';
  readonly retailPricePerServing: number;
  readonly restaurantCostPerServing: number;
  readonly gramsPerServing?: number;
  readonly caloriesPerServing?: number;
  readonly proteinPerServing?: number;
  readonly fatPerServing?: number;
  readonly carbsPerServing?: number;
}

export type CustomFoodDraft = WeightValuedDraft | ServingValuedDraft;

export const VALUATION_MODELS: readonly ValuationModel[] = ['by-weight', 'by-serving'];

export const CUSTOM_FOOD_VARIANT_BY_CATEGORY: Readonly<Record<FoodCategory, VisualVariant>> = {
  beef: 'brisket-slices',
  pork: 'pork-belly-layers',
  chicken: 'chicken-thigh-pieces',
  seafood: 'prawns',
};
