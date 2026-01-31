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

/**
 * Artwork for a diner-authored item, chosen by its category.
 *
 * The grill categories map to a cut arrangement, which the illustration then
 * replaces with a deliberately neutral plate: a handwritten description does
 * not tell us how somebody's brisket looks. The four custom-only categories map
 * to artwork that is genuinely about the category rather than about a specific
 * dish — three small bowls, a pot, a scoop, a glass — which is a truthful thing
 * to draw for "a side" without inventing what side it is.
 */
export const CUSTOM_FOOD_VARIANT_BY_CATEGORY: Readonly<Record<FoodCategory, VisualVariant>> = {
  beef: 'brisket-slices',
  pork: 'pork-belly-layers',
  chicken: 'chicken-thigh-pieces',
  seafood: 'prawns',
  sides: 'side-bowls',
  'hot-food': 'stew-pot',
  desserts: 'dessert-scoop',
  drinks: 'drink-glass',
};

/** The variants that describe a category rather than a cut, so they are drawn as themselves. */
export const CATEGORY_ARTWORK_VARIANTS: readonly VisualVariant[] = [
  'side-bowls',
  'stew-pot',
  'dessert-scoop',
  'drink-glass',
];
