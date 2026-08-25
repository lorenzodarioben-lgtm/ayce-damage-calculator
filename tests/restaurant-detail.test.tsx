import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RestaurantDetail } from '@/components/restaurants/RestaurantDetail';
import { buildDamageReport } from '@/lib/calculations';
import { createSavedSession } from '@/lib/history';
import * as repository from '@/lib/historyRepository';
import { RESTAURANTS_STORAGE_KEY, RESTAURANTS_VERSION } from '@/lib/restaurants';
import { getVerdict } from '@/lib/verdicts';
import type { MealItem, MealSession } from '@/types/meal';

/**
 * The linking workflow, exercised against a real (faked) IndexedDB.
 *
 * These assertions are about ordering as much as outcome: the point of the
 * feature is that nothing is announced, closed or recounted until the write has
 * actually landed, so a test that merely checked the end state would pass on
 * the optimistic version this replaced.
 */

const PROFILE = {
  id: 'friday-kbbq',
  name: 'Friday KBBQ',
  pricePerDiner: 42,
  dinerCount: 1,
  pricingProfileId: 'default',
  note: '',
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
};

function line(foodId: string, quantity: number): MealItem {
  return {
    id: `${foodId}__standard__regular`,
    foodId,
    quality: 'standard',
    plateSize: 'regular',
    quantity,
  };
}

/** Files a visit that names the place but is deliberately not linked to it. */
async function fileUnlinkedVisit(id: string, createdAt: string) {
  const session: MealSession = {
    restaurantName: 'Friday KBBQ',
    pricePerDiner: 42,
    dinerCount: 1,
    items: [line('beef-ribeye', 2)],
  };
  const report = buildDamageReport(session.items, session);
  await repository.saveSession(
    createSavedSession(
      session,
      report,
      getVerdict(report.totalRetailValue, report.totalAdmission),
      { id, createdAt },
    ),
  );
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  repository.resetHistoryConnection();
  window.localStorage.setItem(
    RESTAURANTS_STORAGE_KEY,
    JSON.stringify({ version: RESTAURANTS_VERSION, restaurants: [PROFILE] }),
  );
  window.HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
    this.open = true;
  });
  window.HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
    this.open = false;
  });
});

async function openLinkDialog(user: ReturnType<typeof userEvent.setup>) {
  render(<RestaurantDetail id="friday-kbbq" />);
  await screen.findByText(/Older visits that might belong here/);
  await user.click(screen.getByRole('button', { name: 'Link these visits' }));
  await screen.findByRole('heading', { name: 'Link these visits?' });
}

describe('Linking older visits', () => {
  it('counts the visit without a reload once the write lands', async () => {
    await fileUnlinkedVisit('older', '2026-08-10T12:00:00.000Z');
    const user = userEvent.setup();
    await openLinkDialog(user);

    expect(screen.getByText(/No visits filed here yet/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Link them' }));

    // The summary recomputes from the records the hook is now holding.
    await screen.findByText('Recent visits');
    expect(screen.getByText('Average recovery')).toBeInTheDocument();
    expect(screen.queryByText(/No visits filed here yet/)).not.toBeInTheDocument();
    // And the candidate section is gone, because there is nothing left to offer.
    expect(screen.queryByText(/Older visits that might belong here/)).not.toBeInTheDocument();
  });

  it('persists the link, so a fresh read of the file agrees', async () => {
    await fileUnlinkedVisit('older', '2026-08-10T12:00:00.000Z');
    const user = userEvent.setup();
    await openLinkDialog(user);

    await user.click(screen.getByRole('button', { name: 'Link them' }));
    await screen.findByText('Recent visits');

    const stored = await repository.listSessions();
    expect(stored.map((entry) => entry.restaurantId)).toEqual(['friday-kbbq']);
  });

  it('holds the dialog open and inert until the transaction commits', async () => {
    await fileUnlinkedVisit('older', '2026-08-10T12:00:00.000Z');

    let release = () => {};
    const gate = new Promise<boolean>((resolve) => {
      release = () => resolve(true);
    });
    const put = vi.spyOn(repository, 'putSessions').mockReturnValue(gate);

    const user = userEvent.setup();
    await openLinkDialog(user);
    await user.click(screen.getByRole('button', { name: 'Link them' }));

    // Mid-write: the workflow has neither closed nor claimed anything.
    const confirm = screen.getByRole('button', { name: 'Linking…' });
    expect(confirm).toBeDisabled();
    expect(screen.getByText('Writing the link to this device…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave them unlinked' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Link these visits?' })).toBeVisible();
    expect(screen.queryByText('Recent visits')).not.toBeInTheDocument();

    await act(async () => {
      release();
      await gate;
    });

    await screen.findByText('Recent visits');
    // A second write was never attempted, and the disabled button saw to it.
    expect(put).toHaveBeenCalledTimes(1);
    put.mockRestore();
  });

  it('keeps the records as they were when the device refuses the write', async () => {
    await fileUnlinkedVisit('older', '2026-08-10T12:00:00.000Z');
    const put = vi.spyOn(repository, 'putSessions').mockResolvedValue(false);

    const user = userEvent.setup();
    await openLinkDialog(user);
    await user.click(screen.getByRole('button', { name: 'Link them' }));

    await screen.findByText(/could not be linked/);
    // Nothing is counted, and the offer stands so it can be tried again.
    expect(screen.getByText(/No visits filed here yet/)).toBeInTheDocument();
    expect(screen.getByText(/Older visits that might belong here/)).toBeInTheDocument();

    put.mockRestore();
  });

  it('links every candidate in one go', async () => {
    await fileUnlinkedVisit('older', '2026-08-10T12:00:00.000Z');
    await fileUnlinkedVisit('newer', '2026-08-12T12:00:00.000Z');

    const user = userEvent.setup();
    await openLinkDialog(user);
    await user.click(screen.getByRole('button', { name: 'Link them' }));

    await screen.findByText('Recent visits');
    await waitFor(async () => {
      const stored = await repository.listSessions();
      expect(stored.every((entry) => entry.restaurantId === 'friday-kbbq')).toBe(true);
    });
    expect(screen.getByText('2 visits linked to Friday KBBQ.')).toBeInTheDocument();
  });
});
