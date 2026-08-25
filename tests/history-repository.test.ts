// `auto` installs the whole IndexedDB global surface (IDBRequest, IDBKeyRange
// and friends), which the idb wrapper reaches for directly.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDamageReport } from '@/lib/calculations';
import { HISTORY_DEDUPE_WINDOW_MS, createSavedSession } from '@/lib/history';
import {
  HISTORY_DB_NAME,
  HISTORY_DB_VERSION,
  HISTORY_STORE,
  clearSessions,
  deleteSession,
  getSession,
  listSessions,
  putSessions,
  resetHistoryConnection,
  saveSession,
} from '@/lib/historyRepository';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { MealItem, MealSession } from '@/types/meal';

function meal(overrides: Partial<MealSession> = {}): MealSession {
  return {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 59.9,
    dinerCount: 1,
    items: [
      {
        id: 'beef-ribeye__standard__regular',
        foodId: 'beef-ribeye',
        quality: 'standard',
        plateSize: 'regular',
        quantity: 2,
      } satisfies MealItem,
    ],
    ...overrides,
  };
}

function record(
  id: string,
  createdAt: string,
  overrides: Partial<MealSession> = {},
): SavedMealSession {
  const session = meal(overrides);
  const report = buildDamageReport(session.items, session);
  return createSavedSession(
    session,
    report,
    getVerdict(report.totalRetailValue, report.totalAdmission),
    { id, createdAt },
  );
}

/** Writes straight past the repository, to plant rows it would refuse to create. */
async function putRaw(value: unknown): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(HISTORY_DB_NAME, HISTORY_DB_VERSION);
    // Mirrors the repository's own schema, for the tests where nothing has
    // opened the database yet.
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(HISTORY_STORE)) {
        const store = request.result.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
        store.createIndex('byCreatedAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    tx.objectStore(HISTORY_STORE).put(value as never);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

beforeEach(() => {
  // A brand-new factory per test, so no state leaks between them.
  globalThis.indexedDB = new IDBFactory();
  resetHistoryConnection();
});

describe('History repository', () => {
  it('round-trips a saved session', async () => {
    const written = record('a', '2026-08-16T12:00:00.000Z');

    expect(await saveSession(written)).toBe('inserted');
    expect(await getSession('a')).toEqual(written);
  });

  it('lists sessions newest first', async () => {
    await saveSession(record('old', '2026-08-14T12:00:00.000Z'));
    await saveSession(record('mid', '2026-08-15T12:00:00.000Z', { dinerCount: 2 }));
    await saveSession(record('new', '2026-08-16T12:00:00.000Z', { dinerCount: 3 }));

    expect((await listSessions()).map((entry) => entry.id)).toEqual(['new', 'mid', 'old']);
  });

  it('returns an empty list before anything has been saved', async () => {
    expect(await listSessions()).toEqual([]);
  });

  it('deletes one session without touching the rest', async () => {
    await saveSession(record('a', '2026-08-15T12:00:00.000Z'));
    await saveSession(record('b', '2026-08-16T12:00:00.000Z', { dinerCount: 2 }));

    expect(await deleteSession('a')).toBe(true);
    expect((await listSessions()).map((entry) => entry.id)).toEqual(['b']);
  });

  it('clears every session', async () => {
    await saveSession(record('a', '2026-08-15T12:00:00.000Z'));
    await saveSession(record('b', '2026-08-16T12:00:00.000Z', { dinerCount: 2 }));

    expect(await clearSessions()).toBe(true);
    expect(await listSessions()).toEqual([]);
  });

  it('reports a miss for an unknown id', async () => {
    expect(await getSession('never-existed')).toBeNull();
  });
});

describe('Duplicate handling', () => {
  it('updates the existing record when the same meal is saved again', async () => {
    const first = record('first', '2026-08-16T12:00:00.000Z');
    expect(await saveSession(first)).toBe('inserted');

    // The same meal, saved a minute later under a fresh id.
    const again = record('second', '2026-08-16T12:01:00.000Z');
    expect(await saveSession(again)).toBe('updated');

    const stored = await listSessions();
    expect(stored).toHaveLength(1);
    // The original identity is kept so the entry does not move in the list.
    expect(stored[0]?.id).toBe('first');
    expect(stored[0]?.createdAt).toBe('2026-08-16T12:00:00.000Z');
  });

  it('records the same meal again once the dedupe window has passed', async () => {
    const first = record('first', '2026-08-16T12:00:00.000Z');
    await saveSession(first);

    const later = new Date(
      Date.parse(first.createdAt) + HISTORY_DEDUPE_WINDOW_MS + 1000,
    ).toISOString();
    expect(await saveSession(record('second', later))).toBe('inserted');

    expect(await listSessions()).toHaveLength(2);
  });

  it('treats a changed meal as a new session', async () => {
    await saveSession(record('first', '2026-08-16T12:00:00.000Z'));
    await saveSession(record('second', '2026-08-16T12:05:00.000Z', { dinerCount: 4 }));

    expect(await listSessions()).toHaveLength(2);
  });
});

describe('Writing records verbatim', () => {
  it('reports success only once the transaction has committed', async () => {
    const filed = record('a', '2026-08-16T12:00:00.000Z');
    await saveSession(filed);

    const written = await putSessions([{ ...filed, restaurantId: 'friday-kbbq' }]);

    // The resolved promise is the whole contract callers rely on: by the time
    // it is true, a reload can already read the link back.
    expect(written).toBe(true);
    expect((await getSession('a'))?.restaurantId).toBe('friday-kbbq');
  });

  it('applies every record in the batch or none of them', async () => {
    await saveSession(record('a', '2026-08-16T12:00:00.000Z'));
    await saveSession(record('b', '2026-08-16T12:30:00.000Z', { dinerCount: 2 }));

    const stored = await listSessions();
    await putSessions(stored.map((entry) => ({ ...entry, restaurantId: 'friday-kbbq' })));

    expect((await listSessions()).map((entry) => entry.restaurantId)).toEqual([
      'friday-kbbq',
      'friday-kbbq',
    ]);
  });

  it('skips the dedupe pass, so identical records keep their own rows', async () => {
    const first = record('a', '2026-08-16T12:00:00.000Z');
    const twin = { ...first, id: 'b' };

    expect(await putSessions([first, twin])).toBe(true);
    expect((await listSessions()).map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('writes nothing and says so when storage is unavailable', async () => {
    // @ts-expect-error deliberately removing the API the way a locked-down
    // browser would.
    delete globalThis.indexedDB;
    resetHistoryConnection();

    expect(await putSessions([record('a', '2026-08-16T12:00:00.000Z')])).toBe(false);
  });
});

describe('Resilience', () => {
  it('skips a corrupt row and keeps the readable ones', async () => {
    await saveSession(record('good', '2026-08-16T12:00:00.000Z'));
    await putRaw({ id: 'corrupt', version: 1, createdAt: 'not a date' });

    const stored = await listSessions();

    expect(stored.map((entry) => entry.id)).toEqual(['good']);
  });

  it('removes unreadable rows so they are not re-examined forever', async () => {
    await putRaw({ id: 'corrupt', version: 1, createdAt: 'not a date' });

    await listSessions();

    expect(await getSession('corrupt')).toBeNull();
  });

  it('drops a record written by a newer schema version', async () => {
    await putRaw({ ...record('future', '2026-08-16T12:00:00.000Z'), version: 99 });

    expect(await listSessions()).toEqual([]);
  });

  it('degrades to an empty list when IndexedDB is unavailable', async () => {
    // @ts-expect-error deliberately removing the API the way a locked-down
    // browser would.
    delete globalThis.indexedDB;
    resetHistoryConnection();

    expect(await listSessions()).toEqual([]);
    expect(await getSession('a')).toBeNull();
    expect(await saveSession(record('a', '2026-08-16T12:00:00.000Z'))).toBe('unavailable');
    expect(await deleteSession('a')).toBe(false);
    expect(await clearSessions()).toBe(false);
  });
});

afterEach(() => {
  resetHistoryConnection();
});
