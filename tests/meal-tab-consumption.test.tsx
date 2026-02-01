import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MealTab } from '@/components/summary/MealTab';
import { PricingProfileProvider } from '@/components/session/PricingContext';
import { calculateSessionTotals } from '@/lib/calculations';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import type { MealItem } from '@/types/meal';

function line(quantity: number, consumed?: number): MealItem {
  return {
    id: 'beef-ribeye__standard__regular',
    foodId: 'beef-ribeye',
    quality: 'standard',
    plateSize: 'regular',
    quantity,
    ...(consumed === undefined ? {} : { consumedQuantity: consumed }),
  };
}

function setup(item: MealItem) {
  const handlers = {
    onIncrement: vi.fn(),
    onDecrement: vi.fn(),
    onConsumptionChange: vi.fn(),
    onChargeChange: vi.fn(),
    onRemove: vi.fn(),
  };
  render(
    <PricingProfileProvider profile={DEFAULT_PRICING_PROFILE}>
      <MealTab lines={calculateSessionTotals([item]).lines} {...handlers} />
    </PricingProfileProvider>,
  );
  return handlers;
}

describe('The tab, when the plate went clean', () => {
  it('says nothing about consumption at all', () => {
    setup(line(4));

    // The fast journey is untouched: a plate you logged is a plate you ate.
    expect(screen.queryByLabelText(/Plates of Ribeye.*eaten/)).not.toBeInTheDocument();
    expect(screen.queryByText(/left/)).not.toBeInTheDocument();
  });

  it('offers the control behind a deliberate action', async () => {
    const user = userEvent.setup();
    const handlers = setup(line(4));

    const toggle = screen.getByRole('button', {
      name: /Record how much of Ribeye.*was eaten/,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText(/Plates of Ribeye.*eaten/)).toHaveValue('4');
    expect(handlers.onConsumptionChange).not.toHaveBeenCalled();
  });

  it('reports a reduced amount when the slider moves', async () => {
    const user = userEvent.setup();
    const handlers = setup(line(4));

    await user.click(screen.getByRole('button', { name: /Record how much of Ribeye/ }));
    // Driven by a change event rather than arrow keys: jsdom does not implement
    // a range input's own keyboard stepping, so pressing a key here would test
    // nothing. The keyboard path is covered end to end, in a real browser.
    fireEvent.change(screen.getByLabelText(/Plates of Ribeye.*eaten/), {
      target: { value: '2.25' },
    });

    expect(handlers.onConsumptionChange).toHaveBeenCalledWith(
      'beef-ribeye__standard__regular',
      2.25,
    );
  });
});

describe('The tab, when something was left', () => {
  it('states ordered, eaten and left without editorialising', () => {
    setup(line(4, 2.5));

    expect(screen.getByText('4 plates', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/2.5 eaten · 1.5 left/)).toBeInTheDocument();
  });

  it('shows the eaten value alongside what reached the table', () => {
    setup(line(4, 2));

    const eaten = calculateSessionTotals([line(4, 2)]).lines[0]!;
    expect(
      screen.getByText(`$${eaten.retailValue.toFixed(2)}`, { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ordered$/)).toBeInTheDocument();
  });

  it('leaves the control open, because there is something to see', () => {
    setup(line(4, 2));

    expect(screen.getByLabelText(/Plates of Ribeye.*eaten/)).toHaveValue('2');
    // No need to offer to open what is already open.
    expect(
      screen.queryByRole('button', { name: /Record how much of Ribeye/ }),
    ).not.toBeInTheDocument();
  });

  it('bounds the slider by what was actually ordered', () => {
    setup(line(3, 1));

    const slider = screen.getByLabelText(/Plates of Ribeye.*eaten/);
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '3');
    expect(slider).toHaveAttribute('step', '0.25');
  });
});
