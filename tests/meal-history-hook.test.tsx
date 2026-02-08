import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useMealHistory } from '@/hooks/useMealHistory';
import { buildDamageReport } from '@/lib/calculations';
import { createSavedSession } from '@/lib/history';
import { resetHistoryConnection, saveSession } from '@/lib/historyRepository';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { MealSession } from '@/types/meal';

function build(id: string, createdAt: string, restaurantName: string): SavedMealSession {
  const session: MealSession = {
    restaurantName,
    pricePerDiner: 59.9,
    dinerCount: 1,
    items: [
      {
        id: 'beef-ribeye__standard__regular',
        foodId: 'beef-ribeye',
        quality: 'standard',
        plateSize: 'regular',
        quantity: 2,
      },
    ],
  };
  const report = buildDamageReport(session.items, session);
  return createSavedSession(
    session,
    report,
    getVerdict(report.totalRetailValue, report.totalAdmission),
    { id, createdAt },
  );
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetHistoryConnection();
});

describe('useMealHistory', () => {
  it('reads the file once and reports when it is ready', async () => {
    await saveSession(build('a', '2026-08-16T12:00:00.000Z', 'Seoul Garden'));

    const { result } = renderHook(() => useMealHistory());
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.records.map((entry) => entry.id)).toEqual(['a']);
  });

  it('folds a written record back into the list it is holding', async () => {
    await saveSession(build('a', '2026-08-16T12:00:00.000Z', 'Seoul Garden'));
    const { result } = renderHook(() => useMealHistory());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const linked: SavedMealSession = {
      ...build('a', '2026-08-16T12:00:00.000Z', 'Seoul Garden'),
      restaurantId: 'seoul-garden',
    };
    act(() => result.current.applyWritten([linked]));

    expect(result.current.records[0]?.restaurantId).toBe('seoul-garden');
    expect(result.current.records).toHaveLength(1);
  });

  it('replaces records in place, so a link cannot reorder the list', async () => {
    await saveSession(build('old', '2026-08-10T12:00:00.000Z', 'Little Seoul'));
    await saveSession(build('new', '2026-08-16T12:00:00.000Z', 'Seoul Garden'));

    const { result } = renderHook(() => useMealHistory());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.records.map((entry) => entry.id)).toEqual(['new', 'old']);

    const older: SavedMealSession = {
      ...build('old', '2026-08-10T12:00:00.000Z', 'Little Seoul'),
      restaurantId: 'little-seoul',
    };
    act(() => result.current.applyWritten([older]));

    expect(result.current.records.map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  it('appends a record the list has never seen', async () => {
    const { result } = renderHook(() => useMealHistory());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() =>
      result.current.applyWritten([build('a', '2026-08-16T12:00:00.000Z', 'Seoul Garden')]),
    );

    expect(result.current.records.map((entry) => entry.id)).toEqual(['a']);
  });

  it('ignores an empty batch rather than re-rendering for nothing', async () => {
    await saveSession(build('a', '2026-08-16T12:00:00.000Z', 'Seoul Garden'));
    const { result } = renderHook(() => useMealHistory());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const before = result.current.records;
    act(() => result.current.applyWritten([]));

    expect(result.current.records).toBe(before);
  });

  it('drops a removed record from the list', async () => {
    await saveSession(build('a', '2026-08-16T12:00:00.000Z', 'Seoul Garden'));
    const { result } = renderHook(() => useMealHistory());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.remove('a');
    });

    expect(result.current.records).toEqual([]);
  });
});
