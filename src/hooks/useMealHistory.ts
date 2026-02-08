'use client';

import { useCallback, useEffect, useState } from 'react';
import { clearSessions, deleteSession, listSessions } from '@/lib/historyRepository';
import type { SavedMealSession } from '@/types/history';

export type HistoryStatus = 'loading' | 'ready';

export interface UseMealHistoryResult {
  status: HistoryStatus;
  records: readonly SavedMealSession[];
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  /**
   * Folds already-persisted records back into the list this hook is holding.
   *
   * Called after a write the repository has confirmed, never before: the list
   * is the screen's view of what is on disk, so moving it ahead of the
   * transaction would show a link that might never have been written.
   */
  applyWritten: (records: readonly SavedMealSession[]) => void;
}

/**
 * Reads history once on mount and keeps the list in React state afterwards.
 *
 * Deletions update the list optimistically. The repository never rejects, so a
 * storage failure simply leaves the record where it was on the next visit
 * rather than putting the page into an error state.
 */
export function useMealHistory(): UseMealHistoryResult {
  const [status, setStatus] = useState<HistoryStatus>('loading');
  const [records, setRecords] = useState<readonly SavedMealSession[]>([]);

  useEffect(() => {
    let cancelled = false;

    void listSessions().then((stored) => {
      if (cancelled) {
        return;
      }
      setRecords(stored);
      setStatus('ready');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const remove = useCallback(async (id: string) => {
    setRecords((current) => current.filter((record) => record.id !== id));
    await deleteSession(id);
  }, []);

  const clear = useCallback(async () => {
    setRecords([]);
    await clearSessions();
  }, []);

  const applyWritten = useCallback((written: readonly SavedMealSession[]) => {
    if (written.length === 0) {
      return;
    }
    setRecords((current) => {
      const byId = new Map(written.map((record) => [record.id, record]));
      // Known records are replaced where they already sit, so a link cannot
      // reorder a list the diner is currently reading. Genuinely new records
      // are appended; the callers that have them sort for themselves.
      const merged = current.map((record) => byId.get(record.id) ?? record);
      const seen = new Set(current.map((record) => record.id));
      return [...merged, ...written.filter((record) => !seen.has(record.id))];
    });
  }, []);

  return { status, records, remove, clear, applyWritten };
}
