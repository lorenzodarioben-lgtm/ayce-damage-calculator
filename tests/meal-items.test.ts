import { describe, expect, it } from 'vitest';
import { mealItemId } from '@/lib/mealItems';

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
