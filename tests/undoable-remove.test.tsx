import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useUndoableRemove } from '@/hooks/useUndoableRemove';
import type { Announce } from '@/hooks/useStatusMessage';
import type { MealItem } from '@/types/meal';

/*
 * A tab line carries a quality, a plate size and a running count, so the offer
 * to undo has to restore the whole line — including where it sat, since the tab
 * is read in order.
 */

function line(id: string, foodId: string, quantity = 2): MealItem {
  return { id, foodId, quality: 'standard', plateSize: 'regular', quantity };
}

const ITEMS: readonly MealItem[] = [
  line('a', 'beef-brisket'),
  line('b', 'beef-ribeye'),
  line('c', 'beef-short-rib'),
];

function setup(items: readonly MealItem[] = ITEMS) {
  const removeItem = vi.fn();
  const restoreItem = vi.fn();
  const announce = vi.fn<Announce>();

  const { result } = renderHook(() =>
    useUndoableRemove({ items, removeItem, restoreItem, announce, location: 'the tab' }),
  );

  return { remove: result.current, removeItem, restoreItem, announce };
}

describe('useUndoableRemove', () => {
  it('removes the line and names it in the confirmation', () => {
    const { remove, removeItem, announce } = setup();

    remove('b');

    expect(removeItem).toHaveBeenCalledWith('b');
    expect(announce).toHaveBeenCalledWith('Ribeye removed from the tab.', expect.anything());
  });

  it('offers the line back at the position it came from', () => {
    const { remove, restoreItem, announce } = setup();

    remove('c');
    const [, action] = announce.mock.calls[0]!;
    action!.onAction();

    expect(restoreItem).toHaveBeenCalledWith(ITEMS[2], 2);
  });

  it('confirms the line is back once it has been put back', () => {
    const { remove, announce } = setup();

    remove('a');
    announce.mock.calls[0]![1]!.onAction();

    expect(announce).toHaveBeenLastCalledWith('Brisket put back.');
  });

  it('offers nothing back when the removal matched nothing', () => {
    const { remove, removeItem, announce } = setup();

    remove('missing');

    // The removal was already a no-op, so an undo would have nothing to undo.
    expect(removeItem).toHaveBeenCalledWith('missing');
    expect(announce).not.toHaveBeenCalled();
  });

  it('still offers a way back for a cut that is no longer in the catalogue', () => {
    const stale = line('z', 'beef-retired-cut');
    const { remove, restoreItem, announce } = setup([stale]);

    remove('z');
    const [text, action] = announce.mock.calls[0]!;
    action!.onAction();

    expect(text).toBe('That line removed from the tab.');
    expect(restoreItem).toHaveBeenCalledWith(stale, 0);
  });
});
