import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalculatorApp } from '@/components/CalculatorApp';
import { STORAGE_KEY } from '@/lib/storage';

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn();
  // Each test starts from the bare calculator URL; jsdom keeps one session
  // history for the whole file, so the entry is replaced rather than pushed.
  window.history.replaceState(null, '', '/');
});

function storeSession(items: unknown[]) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      session: { restaurantName: '', pricePerDiner: 59.9, dinerCount: 1, items },
    }),
  );
}

const RIBEYE = {
  id: 'beef-ribeye__standard__regular',
  foodId: 'beef-ribeye',
  quality: 'standard',
  plateSize: 'regular',
  quantity: 2,
};

async function addRibeye(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /ribeye/i }));
  await user.click(screen.getByRole('button', { name: /add to my damage/i }));
}

function reportHeading() {
  return screen.queryByRole('heading', { name: /ayce damage report/i });
}

describe('Stage history', () => {
  it('marks the report in the URL and restores the builder on browser Back', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    await addRibeye(user);
    await user.click(screen.getByRole('button', { name: /calculate the damage/i }));

    expect(reportHeading()).toBeInTheDocument();
    expect(window.location.search).toBe('?stage=report');

    window.history.back();

    await waitFor(() => expect(reportHeading()).not.toBeInTheDocument());
    expect(window.location.search).toBe('');
    const tab = screen.getByRole('region', { name: /your tab/i });
    expect(within(tab).getByText('Ribeye')).toBeInTheDocument();
  });

  it('returns to the report on browser Forward without losing the meal', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    await addRibeye(user);
    await user.click(screen.getByRole('button', { name: /calculate the damage/i }));

    window.history.back();
    await waitFor(() => expect(reportHeading()).not.toBeInTheDocument());

    window.history.forward();

    await waitFor(() => expect(reportHeading()).toBeInTheDocument());
    expect(window.location.search).toBe('?stage=report');
  });

  it('clears the report from the URL when the in-app Back control is used', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    await addRibeye(user);
    await user.click(screen.getByRole('button', { name: /calculate the damage/i }));
    await user.click(screen.getByRole('button', { name: /back to meal/i }));

    await waitFor(() => expect(window.location.search).toBe(''));
    expect(reportHeading()).not.toBeInTheDocument();
  });

  it('does not add history entries while the meal is being edited', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    const before = window.history.length;

    await addRibeye(user);
    await user.click(screen.getByRole('button', { name: /add a diner/i }));
    const tab = screen.getByRole('region', { name: /your tab/i });
    await user.click(within(tab).getByRole('button', { name: /add one plate of ribeye/i }));

    expect(window.history.length).toBe(before);
  });

  it('restores the report after a reload onto the report URL', async () => {
    storeSession([RIBEYE]);
    window.history.replaceState(null, '', '/?stage=report');

    render(<CalculatorApp />);

    expect(await screen.findByRole('heading', { name: /ayce damage report/i })).toBeInTheDocument();
  });

  it('falls back to the builder when the report URL has no meal to report on', async () => {
    window.history.replaceState(null, '', '/?stage=report');

    render(<CalculatorApp />);

    await waitFor(() => expect(window.location.search).toBe(''));
    expect(reportHeading()).not.toBeInTheDocument();
    expect(screen.getByText(/no damage yet/i)).toBeInTheDocument();
  });

  it('keeps the user on the site when Back is used on a directly loaded report', async () => {
    storeSession([RIBEYE]);
    window.history.replaceState(null, '', '/?stage=report');
    const user = userEvent.setup();

    render(<CalculatorApp />);
    await screen.findByRole('heading', { name: /ayce damage report/i });

    const back = vi.spyOn(window.history, 'back');
    await user.click(screen.getByRole('button', { name: /back to meal/i }));

    // Nothing of ours is behind this entry, so history must not be traversed.
    expect(back).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
    expect(reportHeading()).not.toBeInTheDocument();
    back.mockRestore();
  });
});
