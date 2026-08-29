import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillAdjustments } from '@/components/session/BillAdjustments';
import { PricingProfileProvider } from '@/components/session/PricingContext';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import { MAX_BILL_ADJUSTMENTS } from '@/lib/constants';
import type { AdjustmentDraft } from '@/lib/adjustments';
import type { BillAdjustment, MealSession } from '@/types/meal';

const BASE: MealSession = {
  restaurantName: 'Seoul Garden',
  pricePerDiner: 50,
  dinerCount: 2,
  items: [],
};

interface Handlers {
  onAdd: (draft: AdjustmentDraft, id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onStatus: (message: string) => void;
}

function setup(session: MealSession = BASE, totalPaid = 100) {
  const handlers: Handlers = {
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onClear: vi.fn(),
    onStatus: vi.fn(),
  };
  render(
    <PricingProfileProvider profile={DEFAULT_PRICING_PROFILE}>
      <BillAdjustments session={session} baseAdmission={100} totalPaid={totalPaid} {...handlers} />
    </PricingProfileProvider>,
  );
  return handlers;
}

beforeEach(() => {
  window.HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
  window.HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false;
  });
});

describe('The charges and discounts editor', () => {
  it('stays out of the way of a bill that is just the entry price', () => {
    setup();

    expect(screen.getByText(/Leave it empty and nothing changes/)).toBeInTheDocument();
    // Nothing is listed, and nothing is totalled, until there is something to
    // list — a plain tab sees the calculator it always saw.
    expect(screen.queryByText('Paid in total')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear them all' })).not.toBeInTheDocument();
  });

  it('adds a charge with what the diner typed', async () => {
    const user = userEvent.setup();
    const handlers = setup();

    await user.type(screen.getByLabelText('What was it'), 'Weekend surcharge');
    await user.type(screen.getByLabelText('Amount'), '8.5');
    await user.click(screen.getByRole('button', { name: 'Add to the bill' }));

    expect(handlers.onAdd).toHaveBeenCalledWith(
      { label: 'Weekend surcharge', amount: 8.5, kind: 'charge' },
      expect.stringMatching(/^adj-/),
    );
  });

  it('adds a discount when the direction is switched', async () => {
    const user = userEvent.setup();
    const handlers = setup();

    await user.click(screen.getByRole('radio', { name: 'Discount' }));
    await user.type(screen.getByLabelText('What was it'), 'Voucher');
    await user.type(screen.getByLabelText('Amount'), '25');
    await user.click(screen.getByRole('button', { name: 'Add to the bill' }));

    expect(handlers.onAdd).toHaveBeenCalledWith(
      { label: 'Voucher', amount: 25, kind: 'discount' },
      expect.any(String),
    );
  });

  it('says what is missing rather than adding nothing silently', async () => {
    const user = userEvent.setup();
    const handlers = setup();

    await user.click(screen.getByRole('button', { name: 'Add to the bill' }));
    expect(handlers.onAdd).not.toHaveBeenCalled();
    expect(handlers.onStatus).toHaveBeenCalledWith('Give the charge or discount a name first.');

    await user.type(screen.getByLabelText('What was it'), 'Voucher');
    await user.click(screen.getByRole('button', { name: 'Add to the bill' }));
    expect(handlers.onAdd).not.toHaveBeenCalled();
    expect(handlers.onStatus).toHaveBeenCalledWith(expect.stringContaining('Enter an amount'));
  });

  it('does not ask who a charge belongs to when there is no roster', () => {
    setup();
    expect(screen.queryByLabelText('Who it belongs to')).not.toBeInTheDocument();
  });

  it('charges an adjustment to the diner who was chosen', async () => {
    const user = userEvent.setup();
    const handlers = setup({
      ...BASE,
      diners: [
        { id: 'diner-a', displayName: 'Ana' },
        { id: 'diner-b', displayName: 'Ben' },
      ],
    });

    await user.selectOptions(screen.getByLabelText('Who it belongs to'), 'diner-b');
    await user.type(screen.getByLabelText('What was it'), 'Drinks');
    await user.type(screen.getByLabelText('Amount'), '12');
    await user.click(screen.getByRole('button', { name: 'Add to the bill' }));

    expect(handlers.onAdd).toHaveBeenCalledWith(
      { label: 'Drinks', amount: 12, kind: 'charge', dinerId: 'diner-b' },
      expect.any(String),
    );
  });

  it('defaults to the whole table even when a roster exists', async () => {
    const user = userEvent.setup();
    const handlers = setup({ ...BASE, diners: [{ id: 'diner-a', displayName: 'Ana' }] });

    await user.type(screen.getByLabelText('What was it'), 'Card surcharge');
    await user.type(screen.getByLabelText('Amount'), '2');
    await user.click(screen.getByRole('button', { name: 'Add to the bill' }));

    expect(handlers.onAdd).toHaveBeenCalledWith(
      { label: 'Card surcharge', amount: 2, kind: 'charge' },
      expect.any(String),
    );
  });

  it('lists what is on the bill and totals it honestly', () => {
    const adjustments: readonly BillAdjustment[] = [
      { id: 'adj-1', label: 'Weekend surcharge', amount: 6, kind: 'charge' },
      { id: 'adj-2', label: 'Voucher', amount: 25, kind: 'discount' },
    ];
    setup({ ...BASE, adjustments }, 81);

    expect(screen.getByText('Weekend surcharge')).toBeInTheDocument();
    expect(screen.getByText('Voucher')).toBeInTheDocument();
    expect(screen.getByText('Entry price')).toBeInTheDocument();
    expect(screen.getByText('Charges')).toBeInTheDocument();
    expect(screen.getByText('Discounts')).toBeInTheDocument();
    expect(screen.getByText('Paid in total')).toBeInTheDocument();
    expect(screen.getByText('$81.00')).toBeInTheDocument();
  });

  it('names the whole table when nothing narrower was chosen', () => {
    setup({
      ...BASE,
      adjustments: [{ id: 'adj-1', label: 'Card surcharge', amount: 2, kind: 'charge' }],
    });

    expect(screen.getByText(/Added to · The whole table/)).toBeInTheDocument();
  });

  it('names the diner a charge belongs to', () => {
    setup({
      ...BASE,
      diners: [{ id: 'diner-a', displayName: 'Ana' }],
      adjustments: [
        { id: 'adj-1', label: 'Drinks', amount: 12, kind: 'charge', dinerId: 'diner-a' },
      ],
    });

    expect(screen.getByText(/Added to · Ana/)).toBeInTheDocument();
  });

  it('removes one on request', async () => {
    const user = userEvent.setup();
    const handlers = setup({
      ...BASE,
      adjustments: [{ id: 'adj-1', label: 'Voucher', amount: 25, kind: 'discount' }],
    });

    await user.click(screen.getByRole('button', { name: 'Remove Voucher' }));
    expect(handlers.onRemove).toHaveBeenCalledWith('adj-1');
  });

  it('confirms before clearing them all', async () => {
    const user = userEvent.setup();
    const handlers = setup({
      ...BASE,
      adjustments: [{ id: 'adj-1', label: 'Voucher', amount: 25, kind: 'discount' }],
    });

    await user.click(screen.getByRole('button', { name: 'Clear them all' }));
    expect(screen.getByRole('heading', { name: 'Clear every charge and discount?' })).toBeVisible();
    expect(handlers.onClear).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Clear them' }));
    expect(handlers.onClear).toHaveBeenCalledTimes(1);
  });

  it('says plainly when the discounts covered everything', () => {
    setup(
      {
        ...BASE,
        adjustments: [{ id: 'adj-1', label: 'Voucher', amount: 400, kind: 'discount' }],
      },
      0,
    );

    expect(screen.getByText(/no recovery percentage to report/)).toBeInTheDocument();
  });

  it('stops offering to add once the bill is full', () => {
    const adjustments = Array.from({ length: MAX_BILL_ADJUSTMENTS }, (_unused, index) => ({
      id: `adj-${index}`,
      label: `Drinks ${index}`,
      amount: 1,
      kind: 'charge' as const,
    }));
    setup({ ...BASE, adjustments });

    expect(screen.getByRole('button', { name: 'Add to the bill' })).toBeDisabled();
    expect(screen.getByText(/as many as a bill can carry here/)).toBeInTheDocument();
  });
});
