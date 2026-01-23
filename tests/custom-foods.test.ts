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
import { calculateSessionTotals } from '@/lib/calculations';
import { foodCatalogue } from '@/lib/foodCatalogue';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import { parseStoredSession } from '@/lib/storage';
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

  it('participates in the shared calculation and session-persistence paths', () => {
    const custom = food();
    const items = [
      {
        id: 'custom-food-cheese-corn__standard__regular',
        foodId: custom.id,
        quality: 'standard' as const,
        plateSize: 'regular' as const,
        quantity: 1,
      },
    ];
    expect(
      calculateSessionTotals(items, DEFAULT_PRICING_PROFILE, foodCatalogue([custom]))
        .totalRetailValue,
    ).toBeCloseTo(0.155 * 18, 10);

    const restored = parseStoredSession(
      JSON.stringify({
        version: 2,
        session: { restaurantName: '', pricePerDiner: 59.9, dinerCount: 1, items },
      }),
      foodCatalogue([custom]),
    );
    expect(restored?.items[0]?.foodId).toBe(custom.id);
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
