import { beforeEach, describe, expect, it } from 'vitest';
import {
  CUSTOM_FOODS_STORAGE_KEY,
  MAX_CUSTOM_FOODS,
  MAX_STORED_CUSTOM_FOODS_LENGTH,
  createCustomFood,
  loadCustomFoods,
  nextCustomFoodId,
  parseStoredCustomFoods,
  saveCustomFoods,
  upsertCustomFood,
} from '@/lib/customFoods';
import type { CustomFoodDraft } from '@/types/customFoods';

const DRAFT: CustomFoodDraft = {
  name: 'Cheese Corn',
  shortName: 'Cheese Corn',
  category: 'chicken',
  description: 'A dangerously easy side dish.',
  retailPricePerKg: 18,
  restaurantCostPerKg: 7,
  caloriesPer100g: 200,
  proteinPer100g: 6,
  fatPer100g: 10,
  carbsPer100g: 20,
};

function food(id = 'custom-food-cheese-corn') {
  const created = createCustomFood(DRAFT, id);
  if (!created) {
    throw new Error('Could not make the test food.');
  }
  return created;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('custom food catalogue', () => {
  it('creates a calculation-ready custom item with safe defaults', () => {
    expect(food()).toMatchObject({
      id: 'custom-food-cheese-corn',
      isCustom: true,
      category: 'chicken',
    });
    expect(
      createCustomFood({ ...DRAFT, name: '  ', retailPricePerKg: 18 }, 'custom-food-empty'),
    ).toBeNull();
    expect(createCustomFood({ ...DRAFT, retailPricePerKg: -1 }, 'custom-food-negative')).toBeNull();
  });

  it('allocates readable ids and keeps the personal menu bounded', () => {
    expect(nextCustomFoodId([], DRAFT.name)).toBe('custom-food-cheese-corn');
    expect(nextCustomFoodId([food()], DRAFT.name)).toBe('custom-food-cheese-corn-2');
    const many = Array.from({ length: MAX_CUSTOM_FOODS + 1 }, (_, index) =>
      food(`custom-food-${index}`),
    );
    expect(
      many.reduce<readonly ReturnType<typeof food>[]>(
        (foods, entry) => upsertCustomFood(foods, entry),
        [],
      ),
    ).toHaveLength(MAX_CUSTOM_FOODS);
  });
});

describe('custom food storage', () => {
  it('round-trips local custom menu items', () => {
    saveCustomFoods([food()]);
    expect(window.localStorage.getItem(CUSTOM_FOODS_STORAGE_KEY)).toContain('Cheese Corn');
    expect(loadCustomFoods()).toEqual([food()]);
  });

  it.each([null, '{ nope', 'x'.repeat(MAX_STORED_CUSTOM_FOODS_LENGTH + 1)])(
    'refuses unusable stored data',
    (raw) => {
      expect(parseStoredCustomFoods(raw)).toEqual([]);
    },
  );

  it('drops duplicate and malformed entries without losing good ones', () => {
    const raw = JSON.stringify({
      version: 1,
      foods: [food(), { ...food(), retailPricePerKg: 'free' }, food()],
    });
    expect(parseStoredCustomFoods(raw)).toEqual([food()]);
  });
});
