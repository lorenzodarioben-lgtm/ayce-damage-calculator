import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuantityStepper } from '@/components/meal/QuantityStepper';

function setup(overrides: Partial<Parameters<typeof QuantityStepper>[0]> = {}) {
  const onIncrement = vi.fn();
  const onDecrement = vi.fn();

  render(
    <QuantityStepper
      value={2}
      min={1}
      max={5}
      onIncrement={onIncrement}
      onDecrement={onDecrement}
      label="Plates"
      {...overrides}
    />,
  );

  return { onIncrement, onDecrement };
}

describe('QuantityStepper', () => {
  it('presents itself as one named control rather than two loose buttons', () => {
    setup();

    expect(screen.getByRole('group', { name: 'Plates' })).toBeInTheDocument();
  });

  it('names each control after what it does to the thing being counted', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Decrease Plates' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increase Plates' })).toBeInTheDocument();
  });

  it('takes more specific control labels when the caller has them', () => {
    setup({
      decrementLabel: 'Remove one plate of Ribeye',
      incrementLabel: 'Add one plate of Ribeye',
    });

    expect(screen.getByRole('button', { name: 'Add one plate of Ribeye' })).toBeInTheDocument();
  });

  it('reports the direction rather than a value, so batched taps cannot go stale', async () => {
    const user = userEvent.setup();
    const { onIncrement, onDecrement } = setup();

    await user.click(screen.getByRole('button', { name: 'Increase Plates' }));
    await user.click(screen.getByRole('button', { name: 'Increase Plates' }));
    await user.click(screen.getByRole('button', { name: 'Decrease Plates' }));

    expect(onIncrement).toHaveBeenCalledTimes(2);
    expect(onDecrement).toHaveBeenCalledTimes(1);
  });

  it('refuses to go below the floor', async () => {
    const user = userEvent.setup();
    const { onDecrement } = setup({ value: 1 });

    const decrease = screen.getByRole('button', { name: 'Decrease Plates' });
    expect(decrease).toBeDisabled();

    await user.click(decrease);
    expect(onDecrement).not.toHaveBeenCalled();
  });

  it('refuses to go past the ceiling', async () => {
    const user = userEvent.setup();
    const { onIncrement } = setup({ value: 5 });

    const increase = screen.getByRole('button', { name: 'Increase Plates' });
    expect(increase).toBeDisabled();

    await user.click(increase);
    expect(onIncrement).not.toHaveBeenCalled();
  });

  it('announces the count through a live region rather than silently redrawing it', () => {
    setup({ value: 3 });

    // `output` is a polite live region by default, so the new count is spoken
    // after either control is pressed.
    expect(screen.getByRole('status')).toHaveTextContent('3');
  });
});
