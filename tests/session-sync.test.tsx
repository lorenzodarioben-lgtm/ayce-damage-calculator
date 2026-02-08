import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalculatorApp } from '@/components/CalculatorApp';
import { parseStoredSessionState, STORAGE_KEY, STORAGE_VERSION } from '@/lib/storage';
import type { MealSession } from '@/types/meal';

const REMOTE_SESSION: MealSession = {
  restaurantName: 'Remote Grill',
  pricePerDiner: 55,
  dinerCount: 2,
  pricingProfileId: 'australian-kbbq',
  items: [
    {
      id: 'pork-belly__standard__regular',
      foodId: 'pork-belly',
      quality: 'standard',
      plateSize: 'regular',
      quantity: 2,
    },
  ],
};

function storedUpdate(session: MealSession, revision: number = 10) {
  return JSON.stringify({
    version: STORAGE_VERSION,
    revision,
    writerId: 'another-browser-tab',
    kind: 'session',
    session,
  });
}

function dispatchStorage(newValue: string | null) {
  act(() => {
    if (newValue === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, newValue);
    }
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue }));
  });
}

async function addRibeye(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /ribeye/i }));
  await user.click(screen.getByRole('button', { name: /add to my damage/i }));
}

beforeEach(() => {
  window.localStorage.clear();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn();
});

describe('concurrent active-session edits', () => {
  it('reconciles another tab’s newer meal when this tab has no local edit', async () => {
    render(<CalculatorApp />);
    await screen.findByRole('heading', { name: /build the meal/i });

    dispatchStorage(storedUpdate(REMOTE_SESSION));

    await waitFor(() => expect(screen.getByText('Pork Belly')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks before replacing a locally edited meal and can load the newer state', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);
    await addRibeye(user);

    dispatchStorage(storedUpdate(REMOTE_SESSION));

    expect(
      await screen.findByRole('alert', { name: /another tab changed this meal/i }),
    ).toBeVisible();
    expect(
      within(screen.getByRole('region', { name: /your tab/i })).getByText('Ribeye'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load newer meal' }));

    await waitFor(() => expect(screen.getByText('Pork Belly')).toBeInTheDocument());
    expect(
      within(screen.getByRole('region', { name: /your tab/i })).queryByText('Ribeye'),
    ).not.toBeInTheDocument();
  });

  it('keeps this tab’s complete meal instead of heuristically merging ledgers', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);
    await addRibeye(user);

    dispatchStorage(storedUpdate(REMOTE_SESSION, 20));
    await screen.findByRole('alert', { name: /another tab changed this meal/i });
    await user.click(screen.getByRole('button', { name: 'Keep this tab’s meal' }));

    const stored = parseStoredSessionState(window.localStorage.getItem(STORAGE_KEY));
    expect(stored).toMatchObject({ kind: 'session', revision: 21 });
    expect(stored?.session?.items.map((item) => item.foodId)).toEqual(['beef-ribeye']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('treats a reset from another tab as an explicit conflict when this tab has edits', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);
    await addRibeye(user);

    dispatchStorage(null);

    expect(
      await screen.findByRole('alert', { name: /another tab reset this meal/i }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Load the reset' }));

    await waitFor(() => expect(screen.getByText(/no damage yet/i)).toBeInTheDocument());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('keeps the existing tab readable while a conflict is presented', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);
    await addRibeye(user);
    dispatchStorage(storedUpdate(REMOTE_SESSION));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/will not merge two tabs/i)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: /your tab/i })).getByText('Ribeye'),
    ).toBeInTheDocument();
  });
});
