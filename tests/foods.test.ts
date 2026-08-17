import { describe, expect, it } from 'vitest';
import { FOODS, FOOD_COUNT, findFood, foodsInCategory } from '@/data/foods';
import { CATEGORY_META, FOOD_CATEGORIES } from '@/lib/constants';

/**
 * The dataset is the one place in the app where a typo is silent: every price,
 * macro and identifier is hand-written, and nothing else validates it. These
 * assertions are the guard rail for editing it.
 */

describe('food dataset', () => {
  it('reports its own size', () => {
    expect(FOOD_COUNT).toBe(FOODS.length);
    expect(FOOD_COUNT).toBeGreaterThan(0);
  });

  it('has a unique id for every cut', () => {
    const ids = FOODS.map((food) => food.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a unique name for every cut', () => {
    const names = FOODS.map((food) => food.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('resolves every id back to its own record', () => {
    for (const food of FOODS) {
      expect(findFood(food.id)).toBe(food);
    }
    expect(findFood('not-a-cut')).toBeUndefined();
  });

  it('files every cut under a known category', () => {
    for (const food of FOODS) {
      expect(FOOD_CATEGORIES).toContain(food.category);
    }
  });

  it('leaves no category empty', () => {
    for (const category of CATEGORY_META) {
      expect(foodsInCategory(category.id).length).toBeGreaterThan(0);
    }
  });

  it('accounts for every cut exactly once across the categories', () => {
    const listed = FOOD_CATEGORIES.flatMap((category) => foodsInCategory(category));
    expect(listed).toHaveLength(FOOD_COUNT);
    expect(new Set(listed.map((food) => food.id)).size).toBe(FOOD_COUNT);
  });

  it.each(FOODS.map((food) => [food.id, food] as const))('%s is priced sensibly', (_id, food) => {
    expect(food.retailPricePerKg).toBeGreaterThan(0);
    expect(food.restaurantCostPerKg).toBeGreaterThan(0);
    // Wholesale below supermarket is the premise the whole comparison rests on.
    expect(food.restaurantCostPerKg).toBeLessThan(food.retailPricePerKg);
  });

  it.each(FOODS.map((food) => [food.id, food] as const))('%s has usable macros', (_id, food) => {
    for (const value of [
      food.caloriesPer100g,
      food.proteinPer100g,
      food.fatPer100g,
      food.carbsPer100g,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }

    // Macros are per 100 g, so their combined mass cannot exceed the sample.
    expect(food.proteinPer100g + food.fatPer100g + food.carbsPer100g).toBeLessThanOrEqual(100);
  });

  it.each(FOODS.map((food) => [food.id, food] as const))('%s is presentable', (_id, food) => {
    expect(food.name.trim()).not.toBe('');
    expect(food.shortName.trim()).not.toBe('');
    expect(food.description.trim()).not.toBe('');
    // The short name is what the narrow surfaces render; a longer one is a bug.
    expect(food.shortName.length).toBeLessThanOrEqual(food.name.length);
  });
});
