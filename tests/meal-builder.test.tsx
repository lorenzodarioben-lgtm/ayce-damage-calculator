import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MealBuilder } from '@/components/meal/MealBuilder';
import { createCustomFood } from '@/lib/customFoods';

describe('MealBuilder menu changes', () => {
  it('returns to beef when the selected custom category is removed', async () => {
    const drink = createCustomFood(
      { name: 'House drink', category: 'drinks', retailPricePerKg: 10, restaurantCostPerKg: 4 },
      'custom-food-house-drink',
    )!;
    const onAdd = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<MealBuilder onAdd={onAdd} customFoods={[drink]} />);

    await user.click(screen.getByRole('tab', { name: 'Drinks' }));
    await user.click(screen.getByRole('button', { name: /House drink/ }));
    expect(screen.getByRole('button', { name: 'Add to my damage' })).toBeEnabled();

    rerender(<MealBuilder onAdd={onAdd} customFoods={[]} />);

    expect(screen.queryByRole('tab', { name: 'Drinks' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Beef' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Beef' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add to my damage' })).not.toBeInTheDocument();

    rerender(<MealBuilder onAdd={onAdd} customFoods={[drink]} />);

    expect(screen.getByRole('tab', { name: 'Beef' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Add to my damage' })).not.toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });
});
