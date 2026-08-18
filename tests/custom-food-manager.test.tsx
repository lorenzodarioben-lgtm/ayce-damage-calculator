import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomFoodManager } from '@/components/session/CustomFoodManager';
import { useCustomFoods } from '@/hooks/useCustomFoods';
import { CUSTOM_FOODS_STORAGE_KEY } from '@/lib/customFoods';

beforeEach(() => {
  window.HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
  window.HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false;
  });
});

function ManagerHarness({ onStatus }: { onStatus: (message: string) => void }) {
  const foods = useCustomFoods();
  return (
    <CustomFoodManager
      foods={foods.foods}
      onSave={foods.save}
      onRemove={foods.remove}
      onStatus={onStatus}
    />
  );
}

describe('CustomFoodManager', () => {
  it('saves a diner-authored menu item locally', async () => {
    const user = userEvent.setup();
    const onStatus = vi.fn();
    render(<ManagerHarness onStatus={onStatus} />);

    await user.click(screen.getByRole('button', { name: /add food/i }));
    await user.type(screen.getByLabelText(/^name$/i), 'Cheese corn');
    await user.type(screen.getByLabelText(/retail price per kg/i), '18');
    await user.type(screen.getByLabelText(/restaurant cost per kg/i), '7');
    await user.click(screen.getByRole('button', { name: /save to my menu/i }));

    expect(screen.getByText('Cheese corn')).toBeInTheDocument();
    expect(window.localStorage.getItem(CUSTOM_FOODS_STORAGE_KEY)).toContain(
      'custom-food-cheese-corn',
    );
    expect(onStatus).toHaveBeenCalledWith('Cheese corn saved to your menu.');
  });
});
