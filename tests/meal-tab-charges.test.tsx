import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MealTab } from '@/components/summary/MealTab';
import { PricingProfileProvider } from '@/components/session/PricingContext';
import { calculateSessionTotals } from '@/lib/calculations';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import type { MealItem } from '@/types/meal';

const DESCRIPTOR = 'Ribeye, Standard, Regular';

function line(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 'beef-ribeye__standard__regular',
    foodId: 'beef-ribeye',
    quality: 'standard',
    plateSize: 'regular',
    quantity: 2,
    ...overrides,
  };
}

function setup(item: MealItem) {
  const handlers = {
    onIncrement: vi.fn(),
    onDecrement: vi.fn(),
    onConsumptionChange: vi.fn(),
    onChargeChange: vi.fn<(id: string, separate: boolean, charge?: number) => void>(),
    onRemove: vi.fn(),
  };
  render(
    <PricingProfileProvider profile={DEFAULT_PRICING_PROFILE}>
      <MealTab lines={calculateSessionTotals([item]).lines} {...handlers} />
    </PricingProfileProvider>,
  );
  return handlers;
}

describe('A line the buffet price covered', () => {
  it('says nothing about being charged separately', () => {
    setup(line());

    expect(screen.queryByLabelText(`Amount paid for ${DESCRIPTOR}`)).not.toBeInTheDocument();
    expect(screen.queryByText(/paid separately/)).not.toBeInTheDocument();
  });

  it('offers the control without pressing it', () => {
    setup(line());

    const toggle = screen.getByLabelText(`Charge ${DESCRIPTOR} separately from the buffet price`);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks the line as an extra when asked', async () => {
    const user = userEvent.setup();
    const { onChargeChange } = setup(line());

    await user.click(
      screen.getByLabelText(`Charge ${DESCRIPTOR} separately from the buffet price`),
    );

    expect(onChargeChange).toHaveBeenCalledWith('beef-ribeye__standard__regular', true);
  });
});

describe('A line charged on top of the buffet price', () => {
  it('asks what was actually paid rather than assuming', () => {
    setup(line({ separatelyCharged: true }));

    expect(screen.getByLabelText(`Amount paid for ${DESCRIPTOR}`)).toHaveValue(null);
    expect(screen.getByText(/paid separately/)).toBeInTheDocument();
    expect(screen.getByText(/kept out of the recovery figure/)).toBeInTheDocument();
  });

  it('shows the amount once it is known', () => {
    setup(line({ separatelyCharged: true, separateCharge: 12 }));

    expect(screen.getByLabelText(`Amount paid for ${DESCRIPTOR}`)).toHaveValue(12);
    expect(screen.getByText('$12.00 paid')).toBeInTheDocument();
  });

  it('records a price the diner types', async () => {
    const user = userEvent.setup();
    const { onChargeChange } = setup(line({ separatelyCharged: true }));

    await user.type(screen.getByLabelText(`Amount paid for ${DESCRIPTOR}`), '9');

    expect(onChargeChange).toHaveBeenLastCalledWith('beef-ribeye__standard__regular', true, 9);
  });

  it('puts the line back on the buffet when unpressed', async () => {
    const user = userEvent.setup();
    const { onChargeChange } = setup(line({ separatelyCharged: true, separateCharge: 12 }));

    await user.click(
      screen.getByLabelText(`Charge ${DESCRIPTOR} separately from the buffet price`),
    );

    expect(onChargeChange).toHaveBeenCalledWith('beef-ribeye__standard__regular', false);
  });
});
