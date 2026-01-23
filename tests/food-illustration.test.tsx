import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { FoodIllustration } from '@/components/meal/FoodIllustration';
import { createCustomFood } from '@/lib/customFoods';

describe('FoodIllustration', () => {
  it('uses the neutral custom-food artwork for a diner-authored menu item', () => {
    const food = createCustomFood(
      {
        name: 'Cheese corn',
        category: 'chicken',
        retailPricePerKg: 18,
        restaurantCostPerKg: 7,
      },
      'custom-food-cheese-corn',
    );
    const { container } = render(<FoodIllustration food={food!} />);

    expect(container.querySelector('[data-custom-food-artwork="true"]')).toBeInTheDocument();
  });
});
