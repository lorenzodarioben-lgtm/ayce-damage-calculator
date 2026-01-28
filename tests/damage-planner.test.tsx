import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DamagePlanner } from '@/components/planner/DamagePlanner';
import { STORAGE_KEY } from '@/lib/storage';

beforeEach(() => {
  window.HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
  window.HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false;
  });
});

function planned() {
  return screen.getByRole('region', { name: 'The proposed configuration' });
}

async function runSimulation() {
  await userEvent.setup().click(screen.getByRole('button', { name: 'Run the simulation' }));
}

describe('DamagePlanner', () => {
  it('opens with assumptions and produces nothing until asked', () => {
    render(<DamagePlanner />);

    expect(screen.getByLabelText('Admission per diner')).toHaveValue(59.9);
    expect(screen.getByRole('button', { name: 'Run the simulation' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'The proposed configuration' })).toBeNull();
  });

  it('seeds itself from the session without disturbing it', () => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 5,
        session: {
          restaurantName: 'Seoul Garden',
          pricePerDiner: 75,
          dinerCount: 3,
          pricingProfileId: 'australian-kbbq',
          items: [],
        },
      }),
    );

    render(<DamagePlanner />);

    expect(screen.getByLabelText('Admission per diner')).toHaveValue(75);
    expect(screen.getByLabelText('Diners')).toHaveValue(3);
    // Reading the session must not rewrite it.
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBe(stored);
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').session.restaurantName,
    ).toBe('Seoul Garden');
  });

  it('proposes a configuration that reaches the target', async () => {
    render(<DamagePlanner />);
    await runSimulation();

    expect(planned()).toBeVisible();
    expect(within(planned()).getByText('Est. retail value')).toBeInTheDocument();
    expect(within(planned()).getByRole('table')).toBeInTheDocument();
  });

  it('explains why the configuration was chosen', async () => {
    render(<DamagePlanner />);
    await runSimulation();

    expect(within(planned()).getByText('Why this one')).toBeInTheDocument();
    expect(within(planned()).getByText(/menu simulation/i)).toBeInTheDocument();
    expect(within(planned()).getByText(/not a suggestion about what to eat/i)).toBeInTheDocument();
  });

  it('honours the target the diner set', async () => {
    render(<DamagePlanner />);

    fireEvent.change(screen.getByLabelText(/Target recovery/), { target: { value: '150' } });
    await runSimulation();

    expect(screen.getByLabelText(/Target recovery: 150%/)).toBeInTheDocument();
    const recovery = within(planned()).getByText('Recovery').nextElementSibling;
    expect(Number.parseInt(recovery?.textContent ?? '0', 10)).toBeGreaterThanOrEqual(150);
  });

  it('plans only from the cuts left included', async () => {
    const user = userEvent.setup();
    render(<DamagePlanner />);

    // Everything but the ribeye is excluded, so the plan can only be ribeye.
    for (const box of screen.getAllByRole('checkbox')) {
      if (box.getAttribute('aria-label') !== null) continue;
      const label = box.closest('label')?.textContent ?? '';
      if (label.trim() !== 'Ribeye') {
        await user.click(box);
      }
    }
    await runSimulation();

    const rows = within(planned()).getAllByRole('rowheader');
    expect(rows.every((row) => row.textContent === 'Ribeye')).toBe(true);
  });

  it('refuses honestly when nothing is available to plan with', async () => {
    const user = userEvent.setup();
    render(<DamagePlanner />);

    for (const tier of ['House', 'Standard', 'Premium']) {
      await user.click(
        within(screen.getByRole('group', { name: 'Quality tiers' })).getByRole('button', {
          name: tier,
        }),
      );
    }
    await runSimulation();

    expect(screen.getByRole('region', { name: 'No plan' })).toBeVisible();
    expect(screen.getByText(/include at least one cut/i)).toBeInTheDocument();
  });

  it('offers a balanced spread as an explicit strategy', async () => {
    const user = userEvent.setup();
    render(<DamagePlanner />);

    await user.click(screen.getByRole('radio', { name: /Balanced spread/ }));
    await runSimulation();

    expect(screen.getByRole('radio', { name: /Balanced spread/ })).toBeChecked();
    expect(within(planned()).getByText(/no single configuration repeated/i)).toBeInTheDocument();
  });

  it('never writes a plan into the meal without an explicit confirmation', async () => {
    const user = userEvent.setup();
    render(<DamagePlanner />);
    await runSimulation();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Load as a meal' }));

    expect(screen.getByRole('heading', { name: 'Load this plan as a meal?' })).toBeVisible();
    expect(screen.getByText(/a plan is a menu simulation, not a record/i)).toBeInTheDocument();
    // Still nothing written until the diner says so.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Keep it a plan' }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('writes the plan into the meal once the diner confirms', async () => {
    const user = userEvent.setup();
    render(<DamagePlanner />);
    await runSimulation();

    await user.click(screen.getByRole('button', { name: 'Load as a meal' }));
    await user.click(screen.getByRole('button', { name: 'Log these plates' }));

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.session.items.length).toBeGreaterThan(0);
    // Loading a plan is not a recorded meal timeline: nothing was eaten yet.
    expect(stored.session.events).toBeUndefined();
    expect(stored.session.lifecycle).toBeUndefined();
  });

  it('locks a cut into every plan when asked', async () => {
    const user = userEvent.setup();
    render(<DamagePlanner />);

    await user.click(screen.getByRole('button', { name: 'Lock Prawns into every plan' }));
    await runSimulation();

    const rows = within(planned()).getAllByRole('rowheader');
    expect(rows.some((row) => row.textContent === 'Prawns')).toBe(true);
  });
});
