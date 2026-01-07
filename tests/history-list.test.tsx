import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryList } from '@/components/history/HistoryList';
import { buildDamageReport } from '@/lib/calculations';
import { createSavedSession } from '@/lib/history';
import { resetHistoryConnection, saveSession } from '@/lib/historyRepository';
import { getVerdict } from '@/lib/verdicts';
import type { MealItem, MealSession } from '@/types/meal';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetHistoryConnection();
  window.HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
  window.HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false;
  });
});

function line(foodId: string, quantity: number): MealItem {
  return {
    id: `${foodId}__standard__regular`,
    foodId,
    quality: 'standard',
    plateSize: 'regular',
    quantity,
  };
}

async function file(
  id: string,
  createdAt: string,
  restaurantName: string,
  items: readonly MealItem[],
) {
  const session: MealSession = { restaurantName, pricePerDiner: 59.9, dinerCount: 1, items };
  const report = buildDamageReport(session.items, session);
  await saveSession(
    createSavedSession(
      session,
      report,
      getVerdict(report.totalRetailValue, report.totalAdmission),
      {
        id,
        createdAt,
      },
    ),
  );
}

async function seed() {
  await file('small', '2026-08-10T12:00:00.000Z', 'Little Seoul', [line('chicken-thigh', 1)]);
  await file('huge', '2026-08-12T12:00:00.000Z', 'Wagyu House', [line('beef-wagyu-short-rib', 9)]);
  await file('recent', '2026-08-16T12:00:00.000Z', 'Seoul Garden', [line('beef-ribeye', 2)]);
}

describe('HistoryList', () => {
  it('shows an intentional empty state before anything is filed', async () => {
    render(<HistoryList />);

    expect(await screen.findByText('No prior incidents on record.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start a session/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear history/i })).not.toBeInTheDocument();
  });

  it('lists filed sessions newest first with their headline figures', async () => {
    await seed();
    render(<HistoryList />);

    const entries = await screen.findAllByRole('listitem');
    expect(entries).toHaveLength(3);
    expect(within(entries[0] as HTMLElement).getByText('Seoul Garden')).toBeInTheDocument();
    expect(within(entries[2] as HTMLElement).getByText('Little Seoul')).toBeInTheDocument();

    // Wagyu Short Rib x9 regular = 1.395 kg x $82/kg = $114.39
    expect(within(entries[1] as HTMLElement).getByText('$114.39')).toBeInTheDocument();
  });

  it('reorders by plates and by recovery', async () => {
    const user = userEvent.setup();
    await seed();
    render(<HistoryList />);
    await screen.findAllByRole('listitem');

    await user.click(screen.getByRole('button', { name: 'Plates' }));
    expect(
      within(screen.getAllByRole('listitem')[0] as HTMLElement).getByText('Wagyu House'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recovery' }));
    expect(
      within(screen.getAllByRole('listitem')[0] as HTMLElement).getByText('Wagyu House'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Newest' }));
    expect(
      within(screen.getAllByRole('listitem')[0] as HTMLElement).getByText('Seoul Garden'),
    ).toBeInTheDocument();
  });

  it('requires confirmation before deleting one record', async () => {
    const user = userEvent.setup();
    await seed();
    render(<HistoryList />);
    await screen.findAllByRole('listitem');

    await user.click(screen.getByRole('button', { name: /delete the record from Seoul Garden/i }));
    await user.click(screen.getByRole('button', { name: /keep it/i }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: /delete the record from Seoul Garden/i }));
    await user.click(screen.getByRole('button', { name: /delete record/i }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(screen.queryByText('Seoul Garden')).not.toBeInTheDocument();
  });

  it('requires confirmation before clearing the whole file', async () => {
    const user = userEvent.setup();
    await seed();
    render(<HistoryList />);
    await screen.findAllByRole('listitem');

    await user.click(screen.getByRole('button', { name: /clear history/i }));
    expect(screen.getByText(/permanently removes all 3 recorded sessions/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /keep it/i }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: /clear history/i }));
    await user.click(screen.getByRole('button', { name: /clear everything/i }));

    expect(await screen.findByText('No prior incidents on record.')).toBeInTheDocument();
  });

  it('names an unnamed restaurant rather than showing a blank row', async () => {
    await file('anon', '2026-08-16T12:00:00.000Z', '', [line('beef-ribeye', 1)]);
    render(<HistoryList />);

    expect(await screen.findByText('Unnamed restaurant')).toBeInTheDocument();
  });
});
