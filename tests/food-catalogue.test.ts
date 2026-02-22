import { describe, expect, it } from 'vitest';
import { FOODS, FOOD_COUNT } from '@/data/foods';
import { createCustomFood } from '@/lib/customFoods';
import {
  findFoodInCatalogue,
  foodCatalogue,
  foodsInCatalogueCategory,
  searchFoodCatalogue,
} from '@/lib/foodCatalogue';
import type { CustomFood } from '@/types/customFoods';

/*
 * The catalogue is the menu a diner actually sees: the bundled cuts plus
 * whatever they added themselves. These helpers are the only place the two
 * halves are joined, so they are also the only place an addition could shadow,
 * reorder or quietly drop a built-in cut.
 */

const KIMCHI: CustomFood = createCustomFood(
  {
    name: 'House Kimchi',
    category: 'sides',
    description: 'Sharp, cold and free of charge.',
    valuation: 'by-serving',
    retailPricePerServing: 4,
    restaurantCostPerServing: 1,
    gramsPerServing: 120,
  },
  'custom-food-house-kimchi',
)!;

const LAGER: CustomFood = createCustomFood(
  {
    name: 'House Lager',
    category: 'drinks',
    description: 'A cold schooner of lager.',
    valuation: 'by-serving',
    retailPricePerServing: 9,
    restaurantCostPerServing: 2,
    gramsPerServing: 425,
  },
  'custom-food-house-lager',
)!;

describe('foodCatalogue', () => {
  it('is the bundled catalogue when nothing has been added', () => {
    expect(foodCatalogue()).toEqual(FOODS);
    expect(foodCatalogue([])).toHaveLength(FOOD_COUNT);
  });

  it('keeps every built-in cut when local items are added', () => {
    const catalogue = foodCatalogue([KIMCHI, LAGER]);

    expect(catalogue).toHaveLength(FOOD_COUNT + 2);
    for (const food of FOODS) {
      expect(catalogue).toContain(food);
    }
  });

  it('puts the curated cuts first and the local additions after them', () => {
    const catalogue = foodCatalogue([KIMCHI, LAGER]);

    expect(catalogue.slice(0, FOOD_COUNT)).toEqual(FOODS);
    expect(catalogue.slice(FOOD_COUNT).map((food) => food.id)).toEqual([KIMCHI.id, LAGER.id]);
  });

  it('does not mutate the custom list it was handed', () => {
    const customFoods = [KIMCHI];

    foodCatalogue(customFoods);

    expect(customFoods).toEqual([KIMCHI]);
    expect(FOODS).toHaveLength(FOOD_COUNT);
  });
});

describe('findFoodInCatalogue', () => {
  const catalogue = foodCatalogue([KIMCHI]);

  it('resolves a built-in id back to its own record', () => {
    const first = FOODS[0]!;

    expect(findFoodInCatalogue(catalogue, first.id)).toBe(first);
  });

  it('resolves a locally added id just as readily', () => {
    expect(findFoodInCatalogue(catalogue, KIMCHI.id)).toBe(KIMCHI);
  });

  it('reports nothing for an id the menu does not carry', () => {
    expect(findFoodInCatalogue(catalogue, 'no-such-food')).toBeUndefined();
    expect(findFoodInCatalogue(catalogue, '')).toBeUndefined();
  });
});

describe('foodsInCatalogueCategory', () => {
  const catalogue = foodCatalogue([KIMCHI, LAGER]);

  it('returns only the cuts filed under the category asked for', () => {
    const beef = foodsInCatalogueCategory(catalogue, 'beef');

    expect(beef.length).toBeGreaterThan(0);
    for (const food of beef) {
      expect(food.category).toBe('beef');
    }
  });

  it('finds a locally added item under its own category', () => {
    expect(foodsInCatalogueCategory(catalogue, 'sides').map((food) => food.id)).toEqual([
      KIMCHI.id,
    ]);
    expect(foodsInCatalogueCategory(catalogue, 'drinks').map((food) => food.id)).toEqual([
      LAGER.id,
    ]);
  });

  it('returns nothing for a category nobody has filled', () => {
    expect(foodsInCatalogueCategory(FOODS, 'desserts')).toEqual([]);
  });

  it('does not mutate the catalogue it was given', () => {
    const given = [...catalogue];

    foodsInCatalogueCategory(given, 'beef');

    expect(given).toEqual(catalogue);
  });
});

describe('searchFoodCatalogue', () => {
  const catalogue = foodCatalogue([KIMCHI, LAGER]);

  it('matches a name whatever case it is typed in', () => {
    const lower = searchFoodCatalogue(catalogue, 'kimchi').map((food) => food.id);

    expect(lower).toContain(KIMCHI.id);
    expect(searchFoodCatalogue(catalogue, 'KIMCHI').map((food) => food.id)).toEqual(lower);
    expect(searchFoodCatalogue(catalogue, 'KiMcHi').map((food) => food.id)).toEqual(lower);
  });

  it('requires every word of a multi-word query, so more words narrow the list', () => {
    const one = searchFoodCatalogue(catalogue, 'house');
    const two = searchFoodCatalogue(catalogue, 'house lager');

    expect(one.map((food) => food.id)).toEqual(expect.arrayContaining([KIMCHI.id, LAGER.id]));
    expect(two.map((food) => food.id)).toEqual([LAGER.id]);
  });

  it('finds nothing when the words never appear together', () => {
    expect(searchFoodCatalogue(catalogue, 'kimchi lager')).toEqual([]);
  });

  it('tolerates surrounding and repeated whitespace', () => {
    expect(searchFoodCatalogue(catalogue, '   house    lager  ').map((food) => food.id)).toEqual([
      LAGER.id,
    ]);
  });

  it('returns nothing for an empty or whitespace-only query', () => {
    expect(searchFoodCatalogue(catalogue, '')).toEqual([]);
    expect(searchFoodCatalogue(catalogue, '   ')).toEqual([]);
    expect(searchFoodCatalogue(catalogue, '\t\n')).toEqual([]);
  });

  it('preserves the order the catalogue was in', () => {
    const matched = searchFoodCatalogue(catalogue, 'house').map((food) => food.id);

    expect(matched).toEqual(catalogue.filter((food) => matched.includes(food.id)).map((f) => f.id));
  });

  it('does not mutate the catalogue it was given', () => {
    const given = [...catalogue];

    searchFoodCatalogue(given, 'house');

    expect(given).toEqual(catalogue);
  });
});
