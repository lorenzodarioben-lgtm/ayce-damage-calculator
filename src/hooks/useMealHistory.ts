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

  return { status, records, remove, clear };
}
