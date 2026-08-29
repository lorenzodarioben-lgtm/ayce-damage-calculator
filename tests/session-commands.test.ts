import { describe, expect, it } from 'vitest';
import {
  EMPTY_SESSION_COMMAND_HISTORY,
  MAX_SESSION_COMMANDS,
  createSessionCommand,
  recordSessionCommand,
  takeRedo,
  takeUndo,
  type SessionCommand,
} from '@/lib/sessionCommands';
import { INITIAL_SESSION, sessionReducer, type SessionAction } from '@/lib/sessionReducer';
import type { MealSession } from '@/types/meal';

function meta(id: string) {
  return { id, at: '2026-08-29T12:00:00.000Z', source: 'builder' as const };
}

function replay(
  state: MealSession,
  actions: readonly SessionAction[],
  prefix: string,
): MealSession {
  return actions.reduce(
    (current, action, index) =>
      sessionReducer(current, {
        ...action,
        ...('meta' in action
          ? {}
          : {
              meta: meta(`${prefix}-${index}`),
            }),
      } as SessionAction),
    state,
  );
}

describe('session command history', () => {
  it('undoes a plate addition through a fresh line-removal event instead of rewinding the ledger', () => {
    const action: SessionAction = {
      type: 'add-item',
      payload: { foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular', quantity: 2 },
      meta: meta('add'),
    };
    const added = sessionReducer(INITIAL_SESSION, action);
    const command = createSessionCommand(INITIAL_SESSION, added, action);

    expect(command?.inverse).toEqual([
      { type: 'remove-item', id: 'beef-ribeye__standard__regular' },
    ]);
    const undone = replay(added, command?.inverse ?? [], 'undo');

    expect(undone.items).toEqual([]);
    expect(undone.events?.map((event) => event.type)).toEqual([
      'meal-started',
      'plates-added',
      'line-removed',
    ]);
    expect(undone.events?.at(-1)?.id).toBe('undo-0-0');
  });

  it('restores a quantity and its diner allocation through reversible domain actions', () => {
    let before = sessionReducer(INITIAL_SESSION, {
      type: 'add-diner',
      diner: { id: 'lorenzo', displayName: 'Lorenzo' },
      meta: meta('diner'),
    });
    before = sessionReducer(before, {
      type: 'add-item',
      payload: {
        foodId: 'beef-ribeye',
        quality: 'standard',
        plateSize: 'regular',
        quantity: 2,
        dinerId: 'lorenzo',
      },
      meta: meta('plates'),
    });
    const id = before.items[0]!.id;
    const action: SessionAction = { type: 'decrement-item', id, meta: meta('remove-one') };
    const after = sessionReducer(before, action);
    const command = createSessionCommand(before, after, action);

    const undone = replay(after, command?.inverse ?? [], 'undo');

    expect(undone.items[0]).toMatchObject({
      quantity: 2,
      allocations: [{ dinerId: 'lorenzo', quantity: 2 }],
    });
    expect(undone.events?.slice(-2).map((event) => event.type)).toEqual([
      'plates-added',
      'allocation-changed',
    ]);
  });

  it('undoes a safe roster addition with a fresh diner-left ledger event', () => {
    const action: SessionAction = {
      type: 'add-diner',
      diner: { id: 'maya', displayName: 'Maya' },
      meta: meta('join'),
    };
    const after = sessionReducer(INITIAL_SESSION, action);
    const command = createSessionCommand(INITIAL_SESSION, after, action);

    const undone = replay(after, command?.inverse ?? [], 'undo-diner');

    expect(undone.diners).toBeUndefined();
    expect(undone.events?.map((event) => event.type)).toEqual(['diner-joined', 'diner-left']);
  });

  it('bounds the undo buffer and clears redo after a new command', () => {
    const command: SessionCommand = {
      label: 'Add plate',
      forward: [],
      inverse: [],
    };
    let history = EMPTY_SESSION_COMMAND_HISTORY;
    for (let index = 0; index < MAX_SESSION_COMMANDS + 3; index += 1) {
      history = recordSessionCommand(history, { ...command, label: `Edit ${index}` });
    }

    expect(history.undo).toHaveLength(MAX_SESSION_COMMANDS);
    expect(history.undo[0]?.label).toBe('Edit 3');
    const undone = takeUndo(history);
    const redone = takeRedo(undone.history);
    expect(redone.command?.label).toBe(`Edit ${MAX_SESSION_COMMANDS + 2}`);
    expect(recordSessionCommand(undone.history, command).redo).toEqual([]);
  });
});
