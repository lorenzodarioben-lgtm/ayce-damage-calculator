import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSaveToHistory } from '@/hooks/useSaveToHistory';
import { buildDamageReport } from '@/lib/calculations';
import { listSessions, resetHistoryConnection } from '@/lib/historyRepository';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import { getVerdict } from '@/lib/verdicts';
import type { MealItem, MealSession } from '@/types/meal';

/*
 * Filing a meal is an action the diner takes, so the control has to say what
 * happened and then be usable again. The interesting case is the second press
 * on an edited tab: the confirmation from the first is stale, and the meal is
 * a new record rather than an overwrite of the old one.
 */

function line(foodId: string, quantity: number): MealItem {
  return {
    id: `${foodId}__standard__regular`,
    foodId,
    quality: 'standard',
    plateSize: 'regular',
    quantity,
  };
}

function build(items: readonly MealItem[]): MealSession {
  return { restaurantName: 'Seoul Garden', pricePerDiner: 59.9, dinerCount: 1, items };
}

function setup(session: MealSession) {
  return renderHook(
    ({ current }: { current: MealSession }) => {
      const built = buildDamageReport(current.items, current);
      return useSaveToHistory(
        current,
        built,
        getVerdict(built.totalRetailValue, built.totalAdmission),
        DEFAULT_PRICING_PROFILE,
      );
    },
    { initialProps: { current: session } },
  );
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetHistoryConnection();
});

describe('useSaveToHistory', () => {
  it('starts idle, with nothing written until it is asked', async () => {
    const { result } = setup(build([line('beef-ribeye', 2)]));

    expect(result.current.state).toBe('idle');
    expect(await listSessions()).toEqual([]);
  });

  it('files the meal and confirms it was a new record', async () => {
    const { result } = setup(build([line('beef-ribeye', 2)]));

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.state).toBe('inserted');
    const records = await listSessions();
    expect(records).toHaveLength(1);
    expect(records[0]?.restaurantName).toBe('Seoul Garden');
  });

  it('keeps the note the diner wrote on the record', async () => {
    const { result } = setup(build([line('beef-ribeye', 2)]));

    await act(async () => {
      await result.current.save('Birthday dinner');
    });

    const [record] = await listSessions();
    expect(record?.note).toBe('Birthday dinner');
  });

  it('updates the same record when the identical meal is filed twice', async () => {
    const { result } = setup(build([line('beef-ribeye', 2)]));

    await act(async () => {
      await result.current.save();
    });
    await act(async () => {
      await result.current.save();
    });

    expect(result.current.state).toBe('updated');
    expect(await listSessions()).toHaveLength(1);
  });

  it('returns to its resting state once the tab is edited after saving', async () => {
    const session = build([line('beef-ribeye', 2)]);
    const { result, rerender } = setup(session);

    await act(async () => {
      await result.current.save();
    });
    expect(result.current.state).toBe('inserted');

    rerender({ current: build([line('beef-ribeye', 3)]) });

    await waitFor(() => expect(result.current.state).toBe('idle'));
  });

  it('files an edited tab as its own record rather than overwriting the first', async () => {
    const { result, rerender } = setup(build([line('beef-ribeye', 2)]));

    await act(async () => {
      await result.current.save();
    });

    rerender({ current: build([line('beef-ribeye', 2), line('pork-belly', 1)]) });
    await act(async () => {
      await result.current.save();
    });

    expect(result.current.state).toBe('inserted');
    expect(await listSessions()).toHaveLength(2);
  });

  it('reports that history is unavailable rather than failing the report', async () => {
    // No IndexedDB is the private-mode case; the meal on screen is untouched.
    const original = globalThis.indexedDB;
    Reflect.deleteProperty(globalThis, 'indexedDB');
    resetHistoryConnection();

    const { result } = setup(build([line('beef-ribeye', 2)]));
    await act(async () => {
      await result.current.save();
    });

    expect(result.current.state).toBe('unavailable');
    globalThis.indexedDB = original;
  });
});
