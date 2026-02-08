import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuImport } from '@/components/session/MenuImport';
import { createCustomFood } from '@/lib/customFoods';
import { IMPORT_COLUMNS, MAX_IMPORT_BYTES } from '@/lib/menuImport';
import type { CustomFood } from '@/types/customFoods';

const HEADER = IMPORT_COLUMNS.join(',');

const EXISTING: readonly CustomFood[] = [
  createCustomFood(
    { name: 'Cheese corn', category: 'sides', retailPricePerKg: 14, restaurantCostPerKg: 6 },
    'custom-food-cheese-corn',
  )!,
];

function file(body: string, name = 'menu.csv'): File {
  return new File([`${HEADER}\n${body}\n`], name, { type: 'text/csv' });
}

function setup(foods: readonly CustomFood[] = []) {
  const handlers = { onApply: vi.fn(), onStatus: vi.fn() };
  render(<MenuImport foods={foods} {...handlers} />);
  return handlers;
}

async function choose(user: ReturnType<typeof userEvent.setup>, csv: File) {
  await user.upload(screen.getByLabelText('Menu CSV file'), csv);
}

describe('Choosing a file', () => {
  it('offers a template and an upload, and writes nothing on its own', () => {
    const handlers = setup();

    expect(screen.getByRole('button', { name: 'Download the template' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a CSV file' })).toBeInTheDocument();
    expect(handlers.onApply).not.toHaveBeenCalled();
  });

  it('previews the rows before anything is written', async () => {
    const user = userEvent.setup();
    const handlers = setup();

    await choose(user, file('Kimchi,sides,by-weight,,,18,6,,,,,'));

    await screen.findByText(/1 row is ready to import/);
    expect(screen.getByText('Kimchi')).toBeInTheDocument();
    // The whole point of a preview: still nothing written.
    expect(handlers.onApply).not.toHaveBeenCalled();
  });

  it('writes the whole resulting menu in one call when asked', async () => {
    const user = userEvent.setup();
    const handlers = setup();

    await choose(user, file('Kimchi,sides,by-weight,,,18,6,,,,,'));
    await screen.findByText(/ready to import/);
    await user.click(screen.getByRole('button', { name: 'Import this menu' }));

    expect(handlers.onApply).toHaveBeenCalledTimes(1);
    expect(handlers.onApply.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it('discards the preview on cancel without writing', async () => {
    const user = userEvent.setup();
    const handlers = setup();

    await choose(user, file('Kimchi,sides,by-weight,,,18,6,,,,,'));
    await screen.findByText(/ready to import/);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/ready to import/)).not.toBeInTheDocument();
    expect(handlers.onApply).not.toHaveBeenCalled();
  });
});

describe('Reporting what it could not read', () => {
  it('names the row and the reason', async () => {
    const user = userEvent.setup();
    setup();

    await choose(user, file('Broken,nowhere,by-weight,,,18,6,,,,,'));

    await screen.findByText(/could not be read/);
    expect(screen.getByText(/Row 2, Broken/)).toBeInTheDocument();
    expect(screen.getByText(/Category must be one of/)).toBeInTheDocument();
  });

  it('keeps the good rows alongside the bad one', async () => {
    const user = userEvent.setup();
    setup();

    await choose(
      user,
      file('Kimchi,sides,by-weight,,,18,6,,,,,\nBroken,nowhere,by-weight,,,18,6,,,,,'),
    );

    await screen.findByText(/1 row is ready to import/);
    expect(screen.getByText('Kimchi')).toBeInTheDocument();
    expect(screen.getByText(/Row 3, Broken/)).toBeInTheDocument();
  });

  it('explains a file that is not a menu at all', async () => {
    const user = userEvent.setup();
    setup();

    await choose(user, new File(['nothing here'], 'notes.txt', { type: 'text/csv' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/did not look like a menu|Nothing/);
  });

  it('refuses a file too large to be a menu', async () => {
    const user = userEvent.setup();
    setup();

    const huge = new File(['x'.repeat(MAX_IMPORT_BYTES + 1)], 'huge.csv', { type: 'text/csv' });
    await choose(user, huge);

    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/);
  });
});

describe('Deciding what to do about a collision', () => {
  it('starts on keeping the local item', async () => {
    const user = userEvent.setup();
    setup(EXISTING);

    await choose(user, file('Cheese corn,sides,by-weight,,,22,9,,,,,'));

    await screen.findByText(/need a decision/);
    // Replacing something already on the menu is a decision, never a default.
    expect(screen.getByRole('radio', { name: 'Keep mine' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Replace mine' })).not.toBeChecked();
  });

  it('keeps the local item when nothing is changed', async () => {
    const user = userEvent.setup();
    const handlers = setup(EXISTING);

    await choose(user, file('Cheese corn,sides,by-weight,,,22,9,,,,,'));
    await screen.findByText(/need a decision/);
    await user.click(screen.getByRole('button', { name: 'Import this menu' }));

    const menu = handlers.onApply.mock.calls[0]?.[0] as readonly CustomFood[];
    expect(menu).toHaveLength(1);
    expect(menu[0]?.valuation === 'by-weight' ? menu[0].retailPricePerKg : null).toBe(14);
  });

  it('keeps both when asked to', async () => {
    const user = userEvent.setup();
    const handlers = setup(EXISTING);

    await choose(user, file('Cheese corn,sides,by-weight,,,22,9,,,,,'));
    await screen.findByText(/need a decision/);
    await user.click(screen.getByRole('radio', { name: 'Keep both' }));
    await user.click(screen.getByRole('button', { name: 'Import this menu' }));

    const menu = handlers.onApply.mock.calls[0]?.[0] as readonly CustomFood[];
    expect(menu).toHaveLength(2);
    expect(new Set(menu.map((food) => food.id)).size).toBe(2);
  });

  it('replaces only after the choice is made', async () => {
    const user = userEvent.setup();
    const handlers = setup(EXISTING);

    await choose(user, file('Cheese corn,sides,by-weight,,,22,9,,,,,'));
    await screen.findByText(/need a decision/);
    await user.click(screen.getByRole('radio', { name: 'Replace mine' }));
    await user.click(screen.getByRole('button', { name: 'Import this menu' }));

    const menu = handlers.onApply.mock.calls[0]?.[0] as readonly CustomFood[];
    expect(menu).toHaveLength(1);
    expect(menu[0]?.valuation === 'by-weight' ? menu[0].retailPricePerKg : null).toBe(22);
  });

  it('names the row a collision came from', async () => {
    const user = userEvent.setup();
    setup(EXISTING);

    await choose(user, file('Cheese corn,sides,by-weight,,,22,9,,,,,'));

    await screen.findByText(/need a decision/);
    expect(screen.getByText(/\(row 2\)/)).toBeInTheDocument();
  });
});
