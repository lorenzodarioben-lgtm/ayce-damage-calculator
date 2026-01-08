import { describe, expect, it } from 'vitest';
import { FOODS, FOOD_COUNT, findFood, foodsInCategory, searchFoods, sortFoods } from '@/data/foods';
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

  it.each(FOODS.map((food) => [food.id, food] as const))('%s is findable by name', (_id, food) => {
    expect(searchFoods(food.name).map((match) => match.id)).toContain(food.id);
  });

  it.each(FOODS.map((food) => [food.id, food] as const))('%s is presentable', (_id, food) => {
    expect(food.name.trim()).not.toBe('');
    expect(food.shortName.trim()).not.toBe('');
    expect(food.description.trim()).not.toBe('');
    // The short name is what the narrow surfaces render; a longer one is a bug.
    expect(food.shortName.length).toBeLessThanOrEqual(food.name.length);
  });
});

describe('searchFoods', () => {
  function ids(query: string): string[] {
    return searchFoods(query).map((food) => food.id);
  }

  it('matches nothing for an empty or whitespace-only query', () => {
    expect(searchFoods('')).toHaveLength(0);
    expect(searchFoods('   ')).toHaveLength(0);
    expect(searchFoods('\t\n')).toHaveLength(0);
  });

  it('matches a name regardless of case', () => {
    expect(ids('BRISKET')).toContain('beef-brisket');
    expect(ids('brisket')).toContain('beef-brisket');
  });

  it('matches a partial word', () => {
    expect(ids('scal')).toContain('seafood-scallops');
  });

  it('reaches across every category from one query', () => {
    const spicy = ids('spicy');
    expect(spicy).toContain('pork-spicy');
    expect(spicy).toContain('chicken-spicy');
  });

  it('searches by category name', () => {
    expect(ids('seafood')).toEqual([
      'seafood-prawns',
      'seafood-squid',
      'seafood-salmon',
      'seafood-scallops',
    ]);
  });

  it('narrows rather than widens as words are added', () => {
    const broad = searchFoods('pork');
    const narrow = searchFoods('pork belly');
    expect(narrow.length).toBeLessThan(broad.length);
    expect(narrow.map((food) => food.id)).toContain('pork-belly');
  });

  it('ignores surrounding and repeated whitespace', () => {
    expect(ids('  short   rib  ')).toEqual(ids('short rib'));
  });

  it('returns nothing for a query no cut satisfies', () => {
    expect(searchFoods('brisket prawns')).toHaveLength(0);
    expect(searchFoods('tiramisu')).toHaveLength(0);
  });

  it('preserves the dataset order', () => {
    const matched = ids('beef');
    const canonical = FOODS.filter((food) => matched.includes(food.id)).map((food) => food.id);
    expect(matched).toEqual(canonical);
  });
});

describe('sortFoods', () => {
  it('leaves menu order exactly as given', () => {
    expect(sortFoods(FOODS, 'menu')).toBe(FOODS);
  });

  it('puts the dearest retail price per kilogram first', () => {
    const sorted = sortFoods(FOODS, 'value');
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      expect(previous!.retailPricePerKg).toBeGreaterThanOrEqual(current!.retailPricePerKg);
    }
  });

  it('keeps every cut when reordering', () => {
    const sorted = sortFoods(FOODS, 'value');
    expect(sorted).toHaveLength(FOOD_COUNT);
    expect(new Set(sorted.map((food) => food.id)).size).toBe(FOOD_COUNT);
  });

  it('does not mutate the list it was given', () => {
    const original = [...FOODS];
    sortFoods(FOODS, 'value');
    expect([...FOODS]).toEqual(original);
  });

  it('breaks ties on name, so the order is stable', () => {
    const first = sortFoods(FOODS, 'value').map((food) => food.id);
    const second = sortFoods([...FOODS].reverse(), 'value').map((food) => food.id);
    expect(second).toEqual(first);
  });

  it('sorts a filtered list as readily as the whole dataset', () => {
    const seafood = sortFoods(foodsInCategory('seafood'), 'value');
    expect(seafood).toHaveLength(foodsInCategory('seafood').length);
    expect(seafood[0]?.retailPricePerKg).toBe(
      Math.max(...foodsInCategory('seafood').map((food) => food.retailPricePerKg)),
    );
  });
});
