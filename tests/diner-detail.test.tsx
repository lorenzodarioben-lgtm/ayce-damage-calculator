import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DinerDetail } from '@/components/diners/DinerDetail';
import { DinerList } from '@/components/diners/DinerList';
import { buildDamageReport } from '@/lib/calculations';
import { createSavedSession } from '@/lib/history';
import { resetHistoryConnection, saveSession } from '@/lib/historyRepository';
import { REGULAR_DINERS_STORAGE_KEY, REGULAR_DINERS_VERSION } from '@/lib/regularDiners';
import { STORAGE_KEY, loadSession } from '@/lib/storage';
import { getVerdict } from '@/lib/verdicts';
import type { Diner, MealItem, MealSession } from '@/types/meal';

const ANA: Diner = { id: 'diner-ana', displayName: 'Ana' };
const BEN: Diner = { id: 'diner-ben', displayName: 'Ben' };

function line(foodId: string, quantity: number, allocations?: MealItem['allocations']): MealItem {
  return {
    id: `${foodId}__standard__regular`,
    foodId,
    quality: 'standard',
    plateSize: 'regular',
    quantity,
    ...(allocations ? { allocations } : {}),
  };
}

async function file(id: string, createdAt: string, overrides: Partial<MealSession> = {}) {
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 50,
    dinerCount: 2,
    items: [line('beef-ribeye', 4)],
    ...overrides,
  };
  const report = buildDamageReport(session.items, session);
  await saveSession(
    createSavedSession(
      session,
      report,
      getVerdict(report.totalRetailValue, report.totalAdmission),
      { id, createdAt },
    ),
  );
}

function saveDirectory(diners: readonly Diner[]) {
  window.localStorage.setItem(
    REGULAR_DINERS_STORAGE_KEY,
    JSON.stringify({ version: REGULAR_DINERS_VERSION, diners }),
  );
}

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

describe('The list of people', () => {
  it('explains its empty case without inventing anybody', async () => {
    render(<DinerList />);

    expect(await screen.findByText('Nobody on file.')).toBeInTheDocument();
    expect(screen.getByText(/Table Mode is optional/)).toBeInTheDocument();
  });

  it('lists a saved person with their meals', async () => {
    saveDirectory([ANA]);
    await file('a', '2026-08-16T12:00:00.000Z', { diners: [ANA, BEN] });
    render(<DinerList />);

    expect(await screen.findByRole('link', { name: /Ana/ })).toHaveAttribute(
      'href',
      '/diners/diner-ana',
    );
    expect(screen.getByText(/1 meal/)).toBeInTheDocument();
  });

  it('names people on a filed roster who are not saved here', async () => {
    saveDirectory([ANA]);
    await file('a', '2026-08-16T12:00:00.000Z', { diners: [ANA, BEN] });
    render(<DinerList />);

    // Reported, not offered: a roster is a snapshot, not a directory to restore.
    expect(await screen.findByText(/1 name appears on a filed roster/)).toBeInTheDocument();
    expect(screen.getByText(/Ben/)).toBeInTheDocument();
  });
});

describe('One person', () => {
  it('says plainly when no meal has been filed with them', async () => {
    saveDirectory([ANA]);
    render(<DinerDetail id="diner-ana" />);

    expect(await screen.findByText(/No meals filed with them yet/)).toBeInTheDocument();
    expect(screen.getByText(/nobody said who was there/)).toBeInTheDocument();
  });

  it('keeps explicit attribution apart from an estimated share', async () => {
    saveDirectory([ANA]);
    await file('a', '2026-08-16T12:00:00.000Z', {
      diners: [ANA, BEN],
      items: [line('beef-ribeye', 4, [{ dinerId: ANA.id, quantity: 3 }])],
    });
    render(<DinerDetail id="diner-ana" />);

    expect(await screen.findByText('How those plates were counted')).toBeInTheDocument();
    expect(screen.getByText('Explicitly theirs')).toBeInTheDocument();
    expect(screen.getByText('Estimated share')).toBeInTheDocument();
    expect(screen.getByText(/an assumption rather than a measurement/)).toBeInTheDocument();
  });

  it('offers a table beside the chart rather than only the bars', async () => {
    saveDirectory([ANA]);
    await file('a', '2026-08-16T12:00:00.000Z', { diners: [ANA] });
    render(<DinerDetail id="diner-ana" />);

    // Each row states its own figures, so the bar is decoration.
    expect(await screen.findByText('What they go for')).toBeInTheDocument();
    expect(screen.getByText(/plates ·/)).toBeInTheDocument();
  });

  it('links each recent meal back to its record', async () => {
    saveDirectory([ANA]);
    await file('a', '2026-08-16T12:00:00.000Z', { diners: [ANA] });
    render(<DinerDetail id="diner-ana" />);

    expect(await screen.findByRole('link', { name: /Seoul Garden/ })).toHaveAttribute(
      'href',
      '/history/a',
    );
  });

  it('explains a person this device does not have', async () => {
    render(<DinerDetail id="diner-nobody" />);
    expect(await screen.findByText('Nobody by that name here.')).toBeInTheDocument();
  });
});

describe('Putting someone on the current roster', () => {
  it('adds them to the meal in progress after a confirmation', async () => {
    saveDirectory([ANA]);
    const user = userEvent.setup();
    render(<DinerDetail id="diner-ana" />);

    await user.click(await screen.findByRole('button', { name: 'Add to the current meal' }));
    expect(screen.getByRole('heading', { name: 'Add them to the current meal?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Add them' }));

    expect(loadSession()?.diners?.map((diner) => diner.id)).toEqual([ANA.id]);
  });

  it('leaves the tab alone when the confirmation is declined', async () => {
    saveDirectory([ANA]);
    const user = userEvent.setup();
    render(<DinerDetail id="diner-ana" />);

    await user.click(await screen.findByRole('button', { name: 'Add to the current meal' }));
    await user.click(screen.getByRole('button', { name: 'Not now' }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('Removing a profile', () => {
  it('says exactly what it will and will not touch', async () => {
    saveDirectory([ANA]);
    const user = userEvent.setup();
    render(<DinerDetail id="diner-ana" />);

    await user.click(await screen.findByRole('button', { name: 'Remove this person' }));

    expect(screen.getByText(/keeps its own roster exactly as it was recorded/)).toBeInTheDocument();
    expect(screen.getByText(/no plate is reassigned/)).toBeInTheDocument();
  });
});
