import { FOODS } from '@/data/foods';
import type { CustomFood } from '@/types/customFoods';
import type { FoodCategory, FoodItem } from '@/types/meal';

/** The menu a diner sees: curated cuts first, then their local additions. */
export function foodCatalogue(customFoods: readonly CustomFood[] = []): readonly FoodItem[] {
  return [...FOODS, ...customFoods];
}

export function findFoodInCatalogue(
  foods: readonly FoodItem[],
  foodId: string,
): FoodItem | undefined {
  return foods.find((food) => food.id === foodId);
}

export function foodsInCatalogueCategory(
  foods: readonly FoodItem[],
  category: FoodCategory,
): readonly FoodItem[] {
  return foods.filter((food) => food.category === category);
}

export function searchFoodCatalogue(
  foods: readonly FoodItem[],
  query: string,
): readonly FoodItem[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return [];
  }
  return foods.filter((food) => {
    const text =
      `${food.name} ${food.shortName} ${food.category} ${food.description}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
