import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableRoster } from '@/components/session/TableRoster';
import type { MealSession } from '@/types/meal';

beforeEach(() => {
  window.HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
  window.HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false;
  });
});

function renderRoster(session: MealSession, callbacks = {}) {
  const defaults = {
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onAdmissionPriceChange: vi.fn(),
    onRemove: vi.fn(),
    onMove: vi.fn(),
    onClear: vi.fn(),
    onSaveRegular: vi.fn(),
    onStatus: vi.fn(),
  };
  const props = { ...defaults, ...callbacks };
  render(
    <TableRoster
      session={session}
      regularDiners={[{ id: 'diner-omar', displayName: 'Omar' }]}
      {...props}
    />,
  );
  return props;
}

const EMPTY_SESSION: MealSession = {
  restaurantName: '',
  pricePerDiner: 59.9,
  dinerCount: 1,
  items: [],
};

describe('TableRoster', () => {
  it('adds a named diner, a reusable diner and an anonymous diner accessibly', async () => {
    const user = userEvent.setup();
    const props = renderRoster(EMPTY_SESSION);

    await user.type(screen.getByLabelText(/diner name/i), 'Lorenzo');
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    await user.click(screen.getByRole('button', { name: /\+ omar/i }));
    await user.click(screen.getByRole('button', { name: /add anonymous diner/i }));

    expect(props.onAdd).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ displayName: 'Lorenzo' }),
    );
    expect(props.onAdd).toHaveBeenNthCalledWith(2, { id: 'diner-omar', displayName: 'Omar' });
    expect(props.onAdd).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ displayName: 'Diner 1' }),
    );
  });

  it('confirms before returning allocated food to the shared table', async () => {
    const user = userEvent.setup();
    const session: MealSession = {
      ...EMPTY_SESSION,
      diners: [{ id: 'diner-lorenzo', displayName: 'Lorenzo' }],
      items: [
        {
          id: 'beef-ribeye__standard__regular',
          foodId: 'beef-ribeye',
          quality: 'standard',
          plateSize: 'regular',
          quantity: 1,
          allocations: [{ dinerId: 'diner-lorenzo', quantity: 1 }],
        },
      ],
    };
    const props = renderRoster(session);

    await user.click(screen.getByRole('button', { name: /remove lorenzo from this table/i }));
    expect(screen.getByRole('heading', { name: /move plates back to the table/i })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /remove diner/i }));

    expect(props.onRemove).toHaveBeenCalledWith('diner-lorenzo');
    expect(props.onStatus).toHaveBeenCalledWith("Lorenzo's plates are now shared by the table.");
  });
});
