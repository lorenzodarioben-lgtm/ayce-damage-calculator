import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { HISTORY_DEDUPE_WINDOW_MS, MAX_HISTORY_RECORDS, parseSavedSession } from '@/lib/history';
import type { SavedMealSession } from '@/types/history';

export const HISTORY_DB_NAME = 'ayce-damage';
export const HISTORY_DB_VERSION = 1;
export const HISTORY_STORE = 'sessions';

interface HistorySchema extends DBSchema {
  [HISTORY_STORE]: {
    key: string;
    value: SavedMealSession;
    indexes: { byCreatedAt: string };
  };
}

/**
 * Local history, stored in IndexedDB.
 *
 * Every method resolves rather than rejects. Storage can be missing entirely
 * (server rendering), blocked (private browsing, disabled site data) or full,
 * and none of those are reasons for the calculator itself to stop working.
 * Records read back are re-validated one by one, so a single corrupt row cannot
 * take the list down with it.
 */

function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

let connection: Promise<IDBPDatabase<HistorySchema>> | null = null;

function connect(): Promise<IDBPDatabase<HistorySchema>> | null {
  if (!isAvailable()) {
    return null;
  }
  connection ??= openDB<HistorySchema>(HISTORY_DB_NAME, HISTORY_DB_VERSION, {
    upgrade(db, oldVersion) {
      // Written as a fall-through ladder so future versions only add a step.
      if (oldVersion < 1) {
        const store = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
        store.createIndex('byCreatedAt', 'createdAt');
      }
    },
    blocked() {
      // Another tab is holding an older version open; that tab keeps working.
    },
    terminated() {
      // The browser dropped the connection, so the next call reopens it.
      connection = null;
    },
  }).catch((error: unknown) => {
    connection = null;
    throw error;
  });

  return connection;
}

/** Test seam: drops the memoised connection so a fresh database can be opened. */
export function resetHistoryConnection(): void {
  connection = null;
}

async function withDb<T>(
  operation: (db: IDBPDatabase<HistorySchema>) => Promise<T>,
  fallback: T,
): Promise<T> {
  const pending = connect();
  if (!pending) {
    return fallback;
  }
  try {
    return await operation(await pending);
  } catch {
    return fallback;
  }
}

/** Newest first. Invalid rows are dropped from the result and from the store. */
export async function listSessions(): Promise<SavedMealSession[]> {
  return withDb(async (db) => {
    const stored = await db.getAllFromIndex(HISTORY_STORE, 'byCreatedAt');

    const valid: SavedMealSession[] = [];
    const invalidKeys: string[] = [];

    for (const row of stored) {
      const parsed = parseSavedSession(row);
      if (parsed) {
        valid.push(parsed);
      } else if (row && typeof (row as { id?: unknown }).id === 'string') {
        invalidKeys.push((row as { id: string }).id);
      }
    }

    if (invalidKeys.length > 0) {
      // Unreadable rows are removed so they cannot be re-examined forever.
      const tx = db.transaction(HISTORY_STORE, 'readwrite');
      await Promise.all([...invalidKeys.map((key) => tx.store.delete(key)), tx.done]);
    }

    return valid.reverse();
  }, []);
}

export async function getSession(id: string): Promise<SavedMealSession | null> {
  return withDb(async (db) => parseSavedSession(await db.get(HISTORY_STORE, id)), null);
}

export type SaveOutcome = 'inserted' | 'updated' | 'unavailable';

/**
 * Saves a completed session, replacing a recent identical one instead of
 * stacking duplicates when the report is saved more than once.
 */
export async function saveSession(record: SavedMealSession): Promise<SaveOutcome> {
  return withDb<SaveOutcome>(async (db) => {
    const existing = await listSessions();
    const savedAt = Date.parse(record.createdAt);

    const duplicate = existing.find(
      (candidate) =>
        candidate.fingerprint === record.fingerprint &&
        Math.abs(savedAt - Date.parse(candidate.createdAt)) <= HISTORY_DEDUPE_WINDOW_MS,
    );

    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    // Keeping the original id and timestamp means the entry stays where the
    // user last saw it in the list rather than jumping to the top.
    await tx.store.put(
      duplicate ? { ...record, id: duplicate.id, createdAt: duplicate.createdAt } : record,
    );

    if (!duplicate) {
      const overflow = existing.length + 1 - MAX_HISTORY_RECORDS;
      if (overflow > 0) {
        const oldest = existing.slice(-overflow);
        await Promise.all(oldest.map((entry) => tx.store.delete(entry.id)));
      }
    }

    await tx.done;
    return duplicate ? 'updated' : 'inserted';
  }, 'unavailable');
}

/**
 * Writes records verbatim, without the dedupe pass `saveSession` applies.
 *
 * Used by a restore, where the caller has already decided what the resulting
 * set should be and the repository's own "is this the same meal again?" rule
 * would work against that intent.
 */
export async function putSessions(records: readonly SavedMealSession[]): Promise<boolean> {
  return withDb(async (db) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    await Promise.all([...records.map((record) => tx.store.put(record)), tx.done]);
    return true;
  }, false);
}

/** Replaces the whole store in one transaction, so it cannot half-apply. */
export async function replaceSessions(records: readonly SavedMealSession[]): Promise<boolean> {
  return withDb(async (db) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    await tx.store.clear();
    await Promise.all([...records.map((record) => tx.store.put(record)), tx.done]);
    return true;
  }, false);
}

export async function deleteSession(id: string): Promise<boolean> {
  return withDb(async (db) => {
    await db.delete(HISTORY_STORE, id);
    return true;
  }, false);
}

export async function clearSessions(): Promise<boolean> {
  return withDb(async (db) => {
    await db.clear(HISTORY_STORE);
    return true;
  }, false);
}
