'use client';

import { useCallback } from 'react';
import { findFood } from '@/data/foods';
import type { Announce } from '@/hooks/useStatusMessage';
import type { MealItem } from '@/types/meal';

export interface UndoableRemoveOptions {
  /** The tab as it stands, needed to remember what is about to be dropped. */
  items: readonly MealItem[];
  removeItem: (id: string) => void;
  restoreItem: (item: MealItem, index: number) => void;
  announce: Announce;
  /** Where the line is being removed from, for the confirmation copy. */
  location: string;
}

/**
 * Removal with a way back.
 *
 * A tab line carries a quality, a plate size and a running count, so rebuilding
 * one by hand after a mis-tap costs several taps. The undo keeps the whole line
 * — quantity and position included — rather than the diner's memory of it.
 */
export function useUndoableRemove({
  items,
  removeItem,
  restoreItem,
  announce,
  location,
}: UndoableRemoveOptions): (id: string) => void {
  return useCallback(
    (id: string) => {
      const index = items.findIndex((item) => item.id === id);
      const removed = index >= 0 ? items[index] : undefined;

      removeItem(id);

      // Nothing matched, so there is nothing to offer back. The removal itself
      // was already a no-op.
      if (!removed) {
        return;
      }

      const name = findFood(removed.foodId)?.name ?? 'That line';
      announce(`${name} removed from ${location}.`, {
        label: 'Undo',
        onAction: () => {
          restoreItem(removed, index);
          announce(`${name} put back.`);
        },
      });
    },
    [items, removeItem, restoreItem, announce, location],
  );
}
