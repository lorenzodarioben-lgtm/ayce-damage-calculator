import type { DinerAllocation, MealItem, MealSession } from '@/types/meal';
import type { SessionAction } from '@/lib/sessionReducer';

/** A small cap keeps local recovery useful without retaining an unbounded meal history in memory. */
export const MAX_SESSION_COMMANDS = 40;

export interface SessionCommand {
  readonly label: string;
  /** Replays the diner’s original change. Event metadata is refreshed by the caller. */
  readonly forward: readonly SessionAction[];
  /** Applies valid inverse domain actions; this is never a state snapshot rewind. */
  readonly inverse: readonly SessionAction[];
}

export interface SessionCommandHistory {
  readonly undo: readonly SessionCommand[];
  readonly redo: readonly SessionCommand[];
}

export const EMPTY_SESSION_COMMAND_HISTORY: SessionCommandHistory = { undo: [], redo: [] };

function allocationsEqual(
  left: readonly DinerAllocation[] | undefined,
  right: readonly DinerAllocation[] | undefined,
): boolean {
  const a = left ?? [];
  const b = right ?? [];
  return (
    a.length === b.length &&
    a.every(
      (allocation, index) =>
        allocation.dinerId === b[index]?.dinerId && allocation.quantity === b[index]?.quantity,
    )
  );
}

function lineAt(
  session: MealSession,
  id: string,
): { readonly item: MealItem; readonly index: number } | null {
  const index = session.items.findIndex((item) => item.id === id);
  const item = index >= 0 ? session.items[index] : undefined;
  return item ? { item, index } : null;
}

/** Restores one line’s previous canonical shape using ordinary reducer actions. */
function restoreLineActions(
  before: MealSession,
  after: MealSession,
  id: string,
): readonly SessionAction[] {
  const previous = lineAt(before, id);
  const current = lineAt(after, id);

  if (!previous && current) {
    return [{ type: 'remove-item', id }];
  }
  if (previous && !current) {
    return [{ type: 'restore-item', item: previous.item, index: previous.index }];
  }
  if (!previous || !current) {
    return [];
  }

  const actions: SessionAction[] = [];
  if (previous.item.quantity !== current.item.quantity) {
    actions.push({ type: 'set-item-quantity', id, quantity: previous.item.quantity });
  }
  if (!allocationsEqual(previous.item.allocations, current.item.allocations)) {
    actions.push({
      type: 'set-item-allocations',
      id,
      allocations: previous.item.allocations ?? [],
    });
  }
  return actions;
}

function commandForLineEdit(
  before: MealSession,
  after: MealSession,
  action: Extract<
    SessionAction,
    | { type: 'add-item' }
    | { type: 'increment-item' }
    | { type: 'decrement-item' }
    | { type: 'remove-item' }
    | { type: 'restore-item' }
  >,
): SessionCommand | null {
  const id =
    action.type === 'add-item'
      ? `${action.payload.foodId}__${action.payload.quality}__${action.payload.plateSize}`
      : action.type === 'restore-item'
        ? action.item.id
        : action.id;
  const inverse = restoreLineActions(before, after, id);
  return inverse.length > 0
    ? {
        label:
          action.type === 'remove-item'
            ? 'Remove line'
            : action.type === 'restore-item'
              ? 'Restore line'
              : action.type === 'decrement-item'
                ? 'Remove plate'
                : 'Add plate',
        forward: [action],
        inverse,
      }
    : null;
}

/**
 * Captures an inverse only for edits that can be replayed safely and honestly.
 * Lifecycle transitions, resets and destructive roster clearing intentionally
 * stay outside this recovery buffer.
 */
export function createSessionCommand(
  before: MealSession,
  after: MealSession,
  action: SessionAction,
): SessionCommand | null {
  switch (action.type) {
    case 'add-item':
    case 'increment-item':
    case 'decrement-item':
    case 'remove-item':
    case 'restore-item':
      return commandForLineEdit(before, after, action);

    case 'set-item-allocations': {
      const previous = lineAt(before, action.id);
      const current = lineAt(after, action.id);
      return previous &&
        current &&
        !allocationsEqual(previous.item.allocations, current.item.allocations)
        ? {
            label: 'Change plate allocation',
            forward: [action],
            inverse: [
              {
                type: 'set-item-allocations',
                id: action.id,
                allocations: previous.item.allocations ?? [],
              },
            ],
          }
        : null;
    }

    case 'add-diner':
      return !before.diners?.some((diner) => diner.id === action.diner.id) &&
        after.diners?.some((diner) => diner.id === action.diner.id)
        ? {
            label: 'Add diner',
            forward: [action],
            inverse: [{ type: 'remove-diner', id: action.diner.id }],
          }
        : null;

    case 'remove-diner': {
      const previous = before.diners?.find((diner) => diner.id === action.id);
      const wasAllocated = before.items.some((item) =>
        item.allocations?.some((allocation) => allocation.dinerId === action.id),
      );
      return previous && !wasAllocated && !after.diners?.some((diner) => diner.id === action.id)
        ? {
            label: 'Remove diner',
            forward: [action],
            inverse: [{ type: 'add-diner', diner: previous }],
          }
        : null;
    }

    case 'rename-diner': {
      const previous = before.diners?.find((diner) => diner.id === action.id);
      const current = after.diners?.find((diner) => diner.id === action.id);
      return previous && current && previous.displayName !== current.displayName
        ? {
            label: 'Rename diner',
            forward: [action],
            inverse: [{ type: 'rename-diner', id: action.id, displayName: previous.displayName }],
          }
        : null;
    }

    case 'set-diner-admission-price': {
      const previous = before.diners?.find((diner) => diner.id === action.id);
      const current = after.diners?.find((diner) => diner.id === action.id);
      return previous && current && previous.admissionPrice !== current.admissionPrice
        ? {
            label: 'Change diner admission',
            forward: [action],
            inverse: [
              { type: 'set-diner-admission-price', id: action.id, value: previous.admissionPrice },
            ],
          }
        : null;
    }

    case 'move-diner': {
      const previous = before.diners?.findIndex((diner) => diner.id === action.id) ?? -1;
      const current = after.diners?.findIndex((diner) => diner.id === action.id) ?? -1;
      return previous >= 0 && current >= 0 && previous !== current
        ? {
            label: 'Reorder diners',
            forward: [action],
            inverse: [
              { type: 'move-diner', id: action.id, direction: action.direction === 1 ? -1 : 1 },
            ],
          }
        : null;
    }

    default:
      return null;
  }
}

export function recordSessionCommand(
  history: SessionCommandHistory,
  command: SessionCommand,
): SessionCommandHistory {
  return {
    undo: [...history.undo, command].slice(-MAX_SESSION_COMMANDS),
    // A new local action diverges from anything that was available to redo.
    redo: [],
  };
}

export function takeUndo(history: SessionCommandHistory): {
  readonly command: SessionCommand | null;
  readonly history: SessionCommandHistory;
} {
  const command = history.undo.at(-1) ?? null;
  return command
    ? {
        command,
        history: { undo: history.undo.slice(0, -1), redo: [...history.redo, command] },
      }
    : { command: null, history };
}

export function takeRedo(history: SessionCommandHistory): {
  readonly command: SessionCommand | null;
  readonly history: SessionCommandHistory;
} {
  const command = history.redo.at(-1) ?? null;
  return command
    ? {
        command,
        history: { undo: [...history.undo, command], redo: history.redo.slice(0, -1) },
      }
    : { command: null, history };
}
