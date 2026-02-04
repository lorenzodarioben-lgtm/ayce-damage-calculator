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
  note = '',
  tags: readonly string[] = [],
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
        note,
        tags,
      },
    ),
  );
}

async function seed() {
  await file('small', '2026-08-10T12:00:00.000Z', 'Little Seoul', [line('chicken-thigh', 1)]);
  await file(
    'huge',
    '2026-08-12T12:00:00.000Z',
    'Wagyu House',
    [line('beef-wagyu-short-rib', 9)],
    'Anniversary dinner',
  );
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

  it('narrows the file by restaurant and by note', async () => {
    const user = userEvent.setup();
    await seed();
    render(<HistoryList />);
    await screen.findAllByRole('listitem');

    const search = screen.getByLabelText(/find a session/i);

    await user.type(search, 'seoul');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(/2 of 3 sessions match/i)).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'anniversary');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Wagyu House' })).toBeInTheDocument();
  });

  it('says so plainly when a search matches nothing', async () => {
    const user = userEvent.setup();
    await seed();
    render(<HistoryList />);
    await screen.findAllByRole('listitem');

    await user.type(screen.getByLabelText(/find a session/i), 'tiramisu');

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText(/no session on file matches that/i)).toBeInTheDocument();
    // The records are filtered, never deleted.
    expect(screen.getByText(/0 of 3 sessions match/i)).toBeInTheDocument();
  });

  it('filters by a saved restaurant without changing records', async () => {
    const user = userEvent.setup();
    await seed();
    render(<HistoryList />);
    await screen.findAllByRole('listitem');

    await user.click(screen.getByText('Filter history'));
    await user.selectOptions(screen.getByLabelText('Restaurant filter'), 'Wagyu House');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Wagyu House' })).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 sessions match/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('restores the whole file when the search is cleared', async () => {
    const user = userEvent.setup();
    await seed();
    render(<HistoryList />);
    await screen.findAllByRole('listitem');

    const search = screen.getByLabelText(/find a session/i);
    await user.type(search, 'wagyu');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /clear the search/i }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('keeps the search out of the way of a short file', async () => {
    await file('only', '2026-08-16T12:00:00.000Z', 'Seoul Garden', [line('beef-ribeye', 1)]);
    render(<HistoryList />);
    await screen.findAllByRole('listitem');

    expect(screen.queryByLabelText(/find a session/i)).not.toBeInTheDocument();
  });

  it('names an unnamed restaurant rather than showing a blank row', async () => {
    await file('anon', '2026-08-16T12:00:00.000Z', '', [line('beef-ribeye', 1)]);
    render(<HistoryList />);

    expect(await screen.findByText('Unnamed restaurant')).toBeInTheDocument();
  });
});
