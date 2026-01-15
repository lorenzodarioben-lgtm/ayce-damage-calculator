import { describe, expect, it } from 'vitest';
import { mealItemId, mergeMealItems } from '@/lib/mealItems';

describe('mealItemId', () => {
  it('uses every choice that defines a tab line', () => {
    expect(mealItemId({ foodId: 'beef-ribeye', quality: 'premium', plateSize: 'large' })).toBe(
      'beef-ribeye__premium__large',
    );
  });

  it('changes when either quality or plate size differs', () => {
    const base = {
      foodId: 'beef-ribeye',
      quality: 'standard' as const,
      plateSize: 'regular' as const,
    };

    expect(mealItemId({ ...base, quality: 'house' })).not.toBe(mealItemId(base));
    expect(mealItemId({ ...base, plateSize: 'small' })).not.toBe(mealItemId(base));
  });
});

describe('mergeMealItems', () => {
  it('combines a repeated configuration without moving the line', () => {
    const merged = mergeMealItems([
      { id: 'one', foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular', quantity: 2 },
      { id: 'two', foodId: 'pork-belly', quality: 'house', plateSize: 'small', quantity: 1 },
      {
        id: 'three',
        foodId: 'beef-ribeye',
        quality: 'standard',
        plateSize: 'regular',
        quantity: 3,
      },
    ]);

    expect(merged).toEqual([
      {
        id: 'beef-ribeye__standard__regular',
        foodId: 'beef-ribeye',
        quality: 'standard',
        plateSize: 'regular',
        quantity: 5,
      },
      {
        id: 'pork-belly__house__small',
        foodId: 'pork-belly',
        quality: 'house',
        plateSize: 'small',
        quantity: 1,
      },
    ]);
  });
});
