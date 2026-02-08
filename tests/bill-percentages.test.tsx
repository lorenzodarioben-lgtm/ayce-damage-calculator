import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillAdjustments } from '@/components/session/BillAdjustments';
import { PricingProfileProvider } from '@/components/session/PricingContext';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import type { AdjustmentDraft } from '@/lib/adjustments';
import type { BillAdjustment, MealSession } from '@/types/meal';

const BASE: MealSession = {
  restaurantName: 'Seoul Garden',
  pricePerDiner: 50,
  dinerCount: 2,
  items: [],
};

function setup(session: MealSession = BASE, totalPaid = 100) {
  const onAdd = vi.fn<(draft: AdjustmentDraft, id: string) => void>();
  const handlers = { onAdd, onRemove: vi.fn(), onClear: vi.fn(), onStatus: vi.fn() };
  render(
    <PricingProfileProvider profile={DEFAULT_PRICING_PROFILE}>
      <BillAdjustments session={session} baseAdmission={100} totalPaid={totalPaid} {...handlers} />
    </PricingProfileProvider>,
  );
  return handlers;
}

const servicePercent: BillAdjustment = {
  id: 'adj-service',
  label: 'Service charge',
  amount: 10,
  kind: 'charge',
  basis: 'percent',
  percentBase: 'subtotal',
};

beforeEach(() => {
  window.HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
  window.HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false;
  });
});

describe('Charging a percentage', () => {
  it('offers a cash amount by default, so an ordinary bill is unchanged', () => {
    setup();

    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.queryByLabelText('Percent')).not.toBeInTheDocument();
    expect(screen.queryByText(/Percentages never compound/)).not.toBeInTheDocument();
  });

  it('asks for a share once the diner says it is one', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('radio', { name: 'Share' }));

    expect(screen.getByLabelText('Percent')).toBeInTheDocument();
    // The base is stated on screen rather than left for the reader to infer.
    expect(screen.getByText(/entry price plus any fixed charges/)).toBeInTheDocument();
  });

  it('records the basis and the base it was quoted against', async () => {
    const user = userEvent.setup();
    const { onAdd } = setup();

    await user.click(screen.getByRole('radio', { name: 'Share' }));
    await user.type(screen.getByLabelText('What was it'), 'Service charge');
    await user.type(screen.getByLabelText('Percent'), '10');
    await user.click(screen.getByRole('button', { name: 'Add to the bill' }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Service charge',
        amount: 10,
        kind: 'charge',
        basis: 'percent',
        percentBase: 'subtotal',
      }),
      expect.any(String),
    );
  });

  it('refuses a share that says nothing, and says so in its own terms', async () => {
    const user = userEvent.setup();
    const { onAdd, onStatus } = setup();

    await user.click(screen.getByRole('radio', { name: 'Share' }));
    await user.type(screen.getByLabelText('What was it'), 'Service charge');
    await user.type(screen.getByLabelText('Percent'), '0');
    await user.click(screen.getByRole('button', { name: 'Add to the bill' }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith(expect.stringContaining('%'));
  });

  it('lists a percentage as the share it is and the money it came to', () => {
    setup({ ...BASE, adjustments: [servicePercent] }, 110);

    // 10% of a $100 entry price, on the line and again in the total.
    expect(screen.getAllByText('+$10.00')).toHaveLength(2);
    expect(screen.getByText(/10% of the subtotal/)).toBeInTheDocument();
  });

  it('totals a percentage as money rather than as a bare number', () => {
    setup({ ...BASE, adjustments: [servicePercent] }, 110);

    // The wrong answer would be no charge at all, from summing a share as cash.
    expect(screen.getByText('Charges')).toBeInTheDocument();
    expect(screen.getAllByText('+$10.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Paid in total')).toBeInTheDocument();
  });

  it('works the share out against the fixed charges already on the bill', () => {
    setup(
      {
        ...BASE,
        adjustments: [
          { id: 'adj-drinks', label: 'Drinks', amount: 20, kind: 'charge' },
          servicePercent,
        ],
      },
      132,
    );

    // 10% of ($100 entry + $20 drinks) is $12, not $10.
    expect(screen.getByText('+$12.00')).toBeInTheDocument();
  });
});
