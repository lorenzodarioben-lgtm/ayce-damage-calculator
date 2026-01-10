import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryDetail } from '@/components/history/HistoryDetail';
import { buildDamageReport } from '@/lib/calculations';
import { createSavedSession } from '@/lib/history';
import { resetHistoryConnection, saveSession } from '@/lib/historyRepository';
import { loadSession, saveSession as saveActiveSession } from '@/lib/storage';
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

const RECORD_ID = 'filed-session';

function line(foodId: string, quantity: number): MealItem {
  return {
    id: `${foodId}__standard__regular`,
    foodId,
    quality: 'standard',
    plateSize: 'regular',
    quantity,
  };
}

async function fileSession(note = '') {
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 72,
    dinerCount: 2,
    items: [line('beef-ribeye', 3), line('pork-belly', 2)],
  };
  const report = buildDamageReport(session.items, session);
  await saveSession(
    createSavedSession(
      session,
      report,
      getVerdict(report.totalRetailValue, report.totalAdmission),
      {
        id: RECORD_ID,
        createdAt: '2026-08-16T12:00:00.000Z',
        note,
      },
    ),
  );
}

describe('HistoryDetail', () => {
  it('says so plainly when the record is not on this device', async () => {
    render(<HistoryDetail id="nothing-here" />);
    expect(await screen.findByText('No such record.')).toBeInTheDocument();
  });

  it('shows a note when one was filed, and nothing when one was not', async () => {
    await fileSession('Anniversary. The short rib carried the evening.');
    const { unmount } = render(<HistoryDetail id={RECORD_ID} />);

    expect(await screen.findByRole('heading', { name: /note on file/i })).toBeInTheDocument();
    expect(screen.getByText(/the short rib carried the evening/i)).toBeInTheDocument();
    unmount();

    globalThis.indexedDB = new IDBFactory();
    resetHistoryConnection();
    await fileSession();
    render(<HistoryDetail id={RECORD_ID} />);

    await screen.findByRole('heading', { name: /filed damage report/i });
    expect(screen.queryByRole('heading', { name: /note on file/i })).not.toBeInTheDocument();
  });

  it('loads a filed meal straight into an empty calculator', async () => {
    const user = userEvent.setup();
    await fileSession();
    render(<HistoryDetail id={RECORD_ID} />);

    await user.click(await screen.findByRole('button', { name: /order this again/i }));

    const restored = loadSession();
    expect(restored?.restaurantName).toBe('Seoul Garden');
    expect(restored?.pricePerDiner).toBe(72);
    expect(restored?.dinerCount).toBe(2);
    expect(restored?.items.map((item) => item.foodId)).toEqual(['beef-ribeye', 'pork-belly']);
  });

  it('asks before replacing a meal already in progress', async () => {
    const user = userEvent.setup();
    await fileSession();

    const inProgress: MealSession = {
      restaurantName: 'Somewhere else',
      pricePerDiner: 40,
      dinerCount: 1,
      items: [line('chicken-thigh', 1)],
    };
    saveActiveSession(inProgress);

    render(<HistoryDetail id={RECORD_ID} />);
    await user.click(await screen.findByRole('button', { name: /order this again/i }));

    expect(screen.getByText(/replace the meal in progress/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /keep my tab/i }));
    expect(loadSession()?.restaurantName).toBe('Somewhere else');

    await user.click(screen.getByRole('button', { name: /order this again/i }));
    await user.click(screen.getByRole('button', { name: /load this meal/i }));
    expect(loadSession()?.restaurantName).toBe('Seoul Garden');
  });
});
