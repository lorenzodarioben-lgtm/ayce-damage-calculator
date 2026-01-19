import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalculatorApp } from '@/components/CalculatorApp';
import { PRICING_PROFILES_STORAGE_KEY } from '@/lib/pricingProfiles';
import { STORAGE_KEY } from '@/lib/storage';

// jsdom implements none of these, and all run on the stage transitions.
beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn();
  window.HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
  window.HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false;
  });
});

async function addPlates(user: ReturnType<typeof userEvent.setup>, foodName: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(foodName, 'i') }));
  await user.click(screen.getByRole('button', { name: /add to my damage/i }));
}

describe('CalculatorApp', () => {
  it('disables Calculate until the meal has an item', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    const calculate = screen.getByRole('button', { name: /calculate the damage/i });
    expect(calculate).toBeDisabled();

    await addPlates(user, 'Ribeye');
    expect(screen.getByRole('button', { name: /calculate the damage/i })).toBeEnabled();
  });

  it('adds a food to the tab, announces it, and updates totals', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    expect(screen.getByText(/no damage yet/i)).toBeInTheDocument();

    await addPlates(user, 'Ribeye');

    const tab = screen.getByRole('region', { name: /your tab/i });
    const line = within(tab).getByRole('listitem');
    expect(within(line).getByText('Ribeye')).toBeInTheDocument();
    // 155 g x $52/kg = $8.06
    expect(within(line).getByText('$8.06')).toBeInTheDocument();
    // The meter reads the same running total.
    expect(within(tab).getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '13% of admission recovered',
    );
    expect(screen.getByRole('status', { name: /session updates/i })).toHaveTextContent(
      /1 plate of Ribeye added/i,
    );
  });

  it('increments and removes tab items', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);
    await addPlates(user, 'Ribeye');

    const tab = screen.getByRole('region', { name: /your tab/i });
    await user.click(within(tab).getByRole('button', { name: /add one plate of Ribeye/i }));
    expect(within(tab).getByText('2 plates · 310 g')).toBeInTheDocument();

    await user.click(within(tab).getByRole('button', { name: /remove ribeye.*from your tab/i }));
    expect(screen.getByText(/no damage yet/i)).toBeInTheDocument();
  });

  it('offers an undo that puts a removed line back as it was', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);
    await addPlates(user, 'Ribeye');

    const tab = screen.getByRole('region', { name: /your tab/i });
    await user.click(within(tab).getByRole('button', { name: /add one plate of Ribeye/i }));
    await user.click(within(tab).getByRole('button', { name: /remove ribeye.*from your tab/i }));

    const updates = screen.getByRole('status', { name: /session updates/i });
    expect(updates).toHaveTextContent(/Ribeye removed from your tab/i);

    await user.click(within(updates).getByRole('button', { name: /undo/i }));

    // Two plates went in, so two plates must come back.
    const restored = screen.getByRole('region', { name: /your tab/i });
    expect(within(restored).getByText('2 plates · 310 g')).toBeInTheDocument();
    expect(updates).toHaveTextContent(/Ribeye put back/i);
  });

  it('reflects session configuration in total admission', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    await user.click(screen.getByRole('button', { name: /add a diner/i }));

    const setup = screen.getByRole('region', { name: /session setup/i });
    expect(within(setup).getByText('$119.80')).toBeInTheDocument();
  });

  it('recalculates a live tab when a different menu pricing profile is selected', async () => {
    window.localStorage.setItem(
      PRICING_PROFILES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        profiles: [
          {
            id: 'custom-downtown-lunch',
            name: 'Downtown lunch',
            money: { currency: 'USD', locale: 'en-US' },
            overrides: {
              'beef-ribeye': { retailPricePerKg: 80, restaurantCostPerKg: 45 },
            },
            builtIn: false,
          },
        ],
      }),
    );
    const user = userEvent.setup();
    render(<CalculatorApp />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: /^menu pricing$/i }),
      'custom-downtown-lunch',
    );
    await addPlates(user, 'Ribeye');

    const tab = screen.getByRole('region', { name: /your tab/i });
    expect(within(tab).getAllByText('$12.40')).toHaveLength(2);
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('custom-downtown-lunch');
  });

  it('clamps an absurd price rather than poisoning totals', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    const price = screen.getByLabelText(/price per diner/i);
    await user.clear(price);
    await user.type(price, '99999');

    const setup = screen.getByRole('region', { name: /session setup/i });
    expect(within(setup).getByText('$500.00')).toBeInTheDocument();
    expect(screen.getByText(/use a price between/i)).toBeInTheDocument();
  });

  it('shows the damage report and can return to the builder with state intact', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    await addPlates(user, 'Ribeye');
    await user.click(screen.getByRole('button', { name: /calculate the damage/i }));

    expect(screen.getByRole('heading', { name: /ayce damage report/i })).toBeInTheDocument();
    // Three times over: the verdict panel, the shareable card, and the
    // print-only receipt that sits in the DOM waiting for a print stylesheet.
    expect(screen.getAllByText(/corporate sponsor/i)).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: /edit meal/i }));

    const tab = screen.getByRole('region', { name: /your tab/i });
    expect(within(tab).getByText('Ribeye')).toBeInTheDocument();
  });

  it('returns to the builder from the top Back control with the meal intact', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    await user.click(screen.getByLabelText(/restaurant/i));
    await user.keyboard('Seoul Garden');
    await addPlates(user, 'Ribeye');
    await user.click(screen.getByRole('button', { name: /calculate the damage/i }));

    expect(screen.getByRole('heading', { name: /ayce damage report/i })).toBeInTheDocument();

    // The control sits above the verdict, so it is reachable without scrolling.
    await user.click(screen.getByRole('button', { name: /back to meal/i }));

    expect(screen.queryByRole('heading', { name: /ayce damage report/i })).not.toBeInTheDocument();
    const tab = screen.getByRole('region', { name: /your tab/i });
    expect(within(tab).getByText('Ribeye')).toBeInTheDocument();
    expect(screen.getByLabelText(/restaurant/i)).toHaveValue('Seoul Garden');
  });

  it('returns to the builder when the brand is activated from the report', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    await user.click(screen.getByLabelText(/price per diner/i));
    await user.keyboard('{Control>}a{/Control}75');
    await addPlates(user, 'Ribeye');
    await user.click(screen.getByRole('button', { name: /calculate the damage/i }));
    expect(screen.getByRole('heading', { name: /ayce damage report/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back to the meal builder/i }));

    expect(screen.queryByRole('heading', { name: /ayce damage report/i })).not.toBeInTheDocument();
    const tab = screen.getByRole('region', { name: /your tab/i });
    expect(within(tab).getByText('Ribeye')).toBeInTheDocument();
    expect(screen.getByLabelText(/price per diner/i)).toHaveValue(75);
  });

  it('keeps the brand keyboard operable and non-destructive in the builder', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);
    await addPlates(user, 'Ribeye');

    const brand = screen.getByRole('button', { name: /back to the top of the page/i });
    brand.focus();
    expect(brand).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(window.scrollTo).toHaveBeenCalled();
    const tab = screen.getByRole('region', { name: /your tab/i });
    expect(within(tab).getByText('Ribeye')).toBeInTheDocument();
  });

  it('requires confirmation before resetting and then clears storage', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    await addPlates(user, 'Ribeye');
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('beef-ribeye');

    await user.click(screen.getByRole('button', { name: /reset session/i }));
    await user.click(screen.getByRole('button', { name: /keep my tab/i }));
    expect(screen.queryByText(/no damage yet/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reset session/i }));
    await user.click(screen.getByRole('button', { name: /reset everything/i }));

    expect(screen.getByText(/no damage yet/i)).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('restores a persisted session on load without overwriting it', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        session: {
          restaurantName: 'Seoul Garden',
          pricePerDiner: 75,
          dinerCount: 2,
          items: [
            { id: 'a', foodId: 'pork-belly', quality: 'house', plateSize: 'large', quantity: 4 },
          ],
        },
      }),
    );

    render(<CalculatorApp />);

    expect(await screen.findByDisplayValue('Seoul Garden')).toBeInTheDocument();
    expect(screen.getByLabelText(/price per diner/i)).toHaveValue(75);

    const tab = screen.getByRole('region', { name: /your tab/i });
    expect(within(tab).getByText('Pork Belly')).toBeInTheDocument();
    expect(within(tab).getByText('4 plates · 880 g')).toBeInTheDocument();

    // The persist effect must not clobber the restored tab with initial state.
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('pork-belly');
  });

  it('switches food categories with the keyboard', async () => {
    const user = userEvent.setup();
    render(<CalculatorApp />);

    const beefTab = screen.getByRole('tab', { name: /beef/i });
    await user.click(beefTab);
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: /pork/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /pork belly/i })).toBeInTheDocument();
  });
});
