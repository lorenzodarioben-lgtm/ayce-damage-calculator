import { describe, expect, it } from 'vitest';
import {
  INITIAL_SESSION,
  sessionReducer,
  type MealEventMeta,
  type SessionAction,
} from '@/lib/sessionReducer';
import { MAX_MEAL_EVENTS } from '@/lib/mealEvents';
import { buildDamageReport } from '@/lib/calculations';
import type { MealSession } from '@/types/meal';

let clock = Date.parse('2026-08-16T18:00:00.000Z');
let counter = 0;

function meta(offsetMs = 0, source: 'builder' | 'live' = 'builder'): MealEventMeta {
  clock += offsetMs;
  counter += 1;
  return { id: `meta-${counter}`, at: new Date(clock).toISOString(), source };
}

function at(minutes: number): string {
  return new Date(Date.parse('2026-08-16T18:00:00.000Z') + minutes * 60_000).toISOString();
}

const ribeye = {
  foodId: 'beef-ribeye',
  quality: 'standard',
  plateSize: 'regular',
  quantity: 1,
} as const;

const RIBEYE_ID = 'beef-ribeye__standard__regular';

function run(actions: readonly SessionAction[], from: MealSession = INITIAL_SESSION): MealSession {
  return actions.reduce(sessionReducer, from);
}

describe('the ledger records what actually happened', () => {
  it('records nothing when an action arrives without a moment to record it against', () => {
    const state = sessionReducer(INITIAL_SESSION, { type: 'add-item', payload: ribeye });

    expect(state.items).toHaveLength(1);
    expect(state.events).toBeUndefined();
    expect(state.lifecycle).toBeUndefined();
  });

  it('records a plate alongside the tab line it produced', () => {
    const state = sessionReducer(INITIAL_SESSION, {
      type: 'add-item',
      payload: { ...ribeye, quantity: 2 },
      meta: { id: 'add-1', at: at(0), source: 'live' },
    });

    expect(state.items[0]?.quantity).toBe(2);
    expect(state.events).toMatchObject([
      { type: 'meal-started', at: at(0), source: 'live' },
      {
        type: 'plates-added',
        quantity: 2,
        source: 'live',
        line: { foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular' },
      },
    ]);
  });

  it('gives every event in one transition a distinct identifier and sequence', () => {
    const state = sessionReducer(INITIAL_SESSION, {
      type: 'add-item',
      payload: ribeye,
      meta: { id: 'add-1', at: at(0), source: 'builder' },
    });

    const ids = (state.events ?? []).map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect((state.events ?? []).map((event) => event.seq)).toEqual([0, 1]);
  });

  it('keeps the sequence rising across separate actions', () => {
    const state = run([
      { type: 'add-item', payload: ribeye, meta: meta() },
      { type: 'increment-item', id: RIBEYE_ID, meta: meta(1000) },
      { type: 'decrement-item', id: RIBEYE_ID, meta: meta(1000) },
    ]);

    const seqs = (state.events ?? []).map((event) => event.seq);
    expect(seqs).toEqual([0, 1, 2, 3]);
  });

  it('records an increment as plates added and a decrement as plates reduced', () => {
    const state = run([
      { type: 'add-item', payload: ribeye, meta: meta() },
      { type: 'increment-item', id: RIBEYE_ID, meta: meta(1000) },
      { type: 'decrement-item', id: RIBEYE_ID, meta: meta(1000) },
    ]);

    expect((state.events ?? []).map((event) => event.type)).toEqual([
      'meal-started',
      'plates-added',
      'plates-added',
      'plates-reduced',
    ]);
  });

  it('records a removal and its undo as matching entries', () => {
    const added = run([{ type: 'add-item', payload: { ...ribeye, quantity: 3 }, meta: meta() }]);
    const line = added.items[0]!;
    const removed = sessionReducer(added, { type: 'remove-item', id: line.id, meta: meta(1000) });
    const restored = sessionReducer(removed, {
      type: 'restore-item',
      item: line,
      index: 0,
      meta: meta(1000),
    });

    expect(restored.events?.slice(-2)).toMatchObject([
      { type: 'line-removed', quantity: 3 },
      { type: 'line-restored', quantity: 3 },
    ]);
  });

  it('records nothing for an action that changed nothing', () => {
    const state = run([{ type: 'add-item', payload: ribeye, meta: meta() }]);
    const before = state.events?.length ?? 0;

    const noop = run(
      [
        { type: 'increment-item', id: 'no-such-line', meta: meta(1000) },
        { type: 'decrement-item', id: 'no-such-line', meta: meta(1000) },
        { type: 'remove-item', id: 'no-such-line', meta: meta(1000) },
      ],
      state,
    );

    expect(noop.events?.length ?? 0).toBe(before);
  });

  it('never reduces below a single plate, and records nothing when it cannot', () => {
    const state = run([
      { type: 'add-item', payload: ribeye, meta: meta() },
      { type: 'decrement-item', id: RIBEYE_ID, meta: meta(1000) },
    ]);

    expect(state.items[0]?.quantity).toBe(1);
    expect((state.events ?? []).some((event) => event.type === 'plates-reduced')).toBe(false);
  });
});

describe('the ledger and Table Mode', () => {
  const diner = { id: 'diner-a', displayName: 'Lorenzo' };

  it('records a diner joining and leaving by opaque identifier only', () => {
    const withDiner = sessionReducer(INITIAL_SESSION, { type: 'add-diner', diner, meta: meta() });
    const without = sessionReducer(withDiner, {
      type: 'remove-diner',
      id: diner.id,
      meta: meta(1000),
    });

    expect(without.events).toMatchObject([
      { type: 'diner-joined', dinerId: 'diner-a' },
      { type: 'diner-left', dinerId: 'diner-a' },
    ]);
    expect(JSON.stringify(without.events)).not.toContain('Lorenzo');
  });

  it('records who a plate was attributed to', () => {
    const state = run([
      { type: 'add-diner', diner, meta: meta() },
      { type: 'add-item', payload: { ...ribeye, dinerId: 'diner-a' }, meta: meta(1000) },
    ]);

    expect(state.events?.at(-1)).toMatchObject({ type: 'plates-added', dinerId: 'diner-a' });
  });

  it('does not attribute a plate to a diner who is not on the roster', () => {
    const state = run([
      { type: 'add-item', payload: { ...ribeye, dinerId: 'ghost' }, meta: meta() },
    ]);

    expect(state.events?.at(-1)).not.toHaveProperty('dinerId');
  });

  it('records an attribution change once, and not when nothing moved', () => {
    const state = run([
      { type: 'add-diner', diner, meta: meta() },
      { type: 'add-item', payload: { ...ribeye, quantity: 4 }, meta: meta(1000) },
      {
        type: 'set-item-allocations',
        id: RIBEYE_ID,
        allocations: [{ dinerId: 'diner-a', quantity: 3 }],
        meta: meta(1000),
      },
    ]);

    expect(state.events?.at(-1)).toMatchObject({
      type: 'allocation-changed',
      allocations: [{ dinerId: 'diner-a', quantity: 3 }],
    });

    const again = sessionReducer(state, {
      type: 'set-item-allocations',
      id: RIBEYE_ID,
      allocations: [{ dinerId: 'diner-a', quantity: 3 }],
      meta: meta(1000),
    });
    expect(again.events?.length).toBe(state.events?.length);
  });

  it('records the table being cleared', () => {
    const state = run([
      { type: 'add-diner', diner, meta: meta() },
      { type: 'clear-diners', meta: meta(1000) },
    ]);

    expect(state.events?.at(-1)).toMatchObject({ type: 'table-cleared' });
    expect(state.diners).toBeUndefined();
  });
});

describe('meal lifecycle', () => {
  it('stays idle while only configuration is edited', () => {
    const state = run([
      { type: 'set-restaurant-name', value: 'Seoul Garden' },
      { type: 'set-price-per-diner', value: 72 },
      { type: 'adjust-diner-count', delta: 2 },
      { type: 'add-diner', diner: { id: 'diner-a', displayName: 'Lorenzo' }, meta: meta() },
    ]);

    expect(state.lifecycle).toBeUndefined();
  });

  it('starts the meal from the first plate, not from setup', () => {
    const state = sessionReducer(INITIAL_SESSION, {
      type: 'add-item',
      payload: ribeye,
      meta: { id: 'add-1', at: at(0), source: 'builder' },
    });

    expect(state.lifecycle).toEqual({ status: 'active', startedAt: at(0), pausedMs: 0 });
    expect(state.events?.[0]).toMatchObject({ type: 'meal-started', at: at(0) });
  });

  it('starts the meal only once', () => {
    const state = run([
      { type: 'add-item', payload: ribeye, meta: { id: 'a', at: at(0), source: 'builder' } },
      { type: 'increment-item', id: RIBEYE_ID, meta: { id: 'b', at: at(5), source: 'builder' } },
    ]);

    expect(state.lifecycle?.startedAt).toBe(at(0));
    expect((state.events ?? []).filter((event) => event.type === 'meal-started')).toHaveLength(1);
  });

  it('accumulates paused time rather than counting a pause as eating', () => {
    const state = run([
      { type: 'add-item', payload: ribeye, meta: { id: 'a', at: at(0), source: 'builder' } },
      { type: 'pause-meal', meta: { id: 'b', at: at(10), source: 'builder' } },
      { type: 'resume-meal', meta: { id: 'c', at: at(25), source: 'builder' } },
    ]);

    expect(state.lifecycle).toEqual({
      status: 'active',
      startedAt: at(0),
      pausedMs: 15 * 60_000,
    });
    expect((state.events ?? []).map((event) => event.type)).toEqual([
      'meal-started',
      'plates-added',
      'meal-paused',
      'meal-resumed',
    ]);
  });

  it('ignores a pause on a meal that has not started', () => {
    const state = sessionReducer(INITIAL_SESSION, {
      type: 'pause-meal',
      meta: { id: 'a', at: at(0), source: 'builder' },
    });

    expect(state.lifecycle).toBeUndefined();
    expect(state.events).toBeUndefined();
  });

  it('ignores a resume on a meal that is not paused', () => {
    const running = run([
      { type: 'add-item', payload: ribeye, meta: { id: 'a', at: at(0), source: 'builder' } },
    ]);
    const resumed = sessionReducer(running, {
      type: 'resume-meal',
      meta: { id: 'b', at: at(5), source: 'builder' },
    });

    expect(resumed.events?.length).toBe(running.events?.length);
  });

  it('logging a plate while paused resumes the meal and closes the pause', () => {
    const state = run([
      { type: 'add-item', payload: ribeye, meta: { id: 'a', at: at(0), source: 'builder' } },
      { type: 'pause-meal', meta: { id: 'b', at: at(10), source: 'builder' } },
      { type: 'increment-item', id: RIBEYE_ID, meta: { id: 'c', at: at(20), source: 'live' } },
    ]);

    expect(state.lifecycle).toEqual({
      status: 'active',
      startedAt: at(0),
      pausedMs: 10 * 60_000,
    });
    expect((state.events ?? []).map((event) => event.type)).toEqual([
      'meal-started',
      'plates-added',
      'meal-paused',
      'meal-resumed',
      'plates-added',
    ]);
  });

  it('completes the meal, folding an open pause into the total first', () => {
    const state = run([
      { type: 'add-item', payload: ribeye, meta: { id: 'a', at: at(0), source: 'builder' } },
      { type: 'pause-meal', meta: { id: 'b', at: at(10), source: 'builder' } },
      { type: 'complete-meal', meta: { id: 'c', at: at(30), source: 'builder' } },
    ]);

    expect(state.lifecycle).toEqual({
      status: 'completed',
      startedAt: at(0),
      completedAt: at(30),
      pausedMs: 20 * 60_000,
    });
  });

  it('reopens a completed meal when the diner keeps eating', () => {
    const state = run([
      { type: 'add-item', payload: ribeye, meta: { id: 'a', at: at(0), source: 'builder' } },
      { type: 'complete-meal', meta: { id: 'b', at: at(30), source: 'builder' } },
      { type: 'increment-item', id: RIBEYE_ID, meta: { id: 'c', at: at(35), source: 'live' } },
    ]);

    expect(state.lifecycle).toEqual({ status: 'active', startedAt: at(0), pausedMs: 0 });
    expect(state.lifecycle).not.toHaveProperty('completedAt');
  });

  it('a reset leaves no ledger behind', () => {
    const state = run([
      { type: 'add-item', payload: ribeye, meta: meta() },
      { type: 'complete-meal', meta: meta(1000) },
      { type: 'reset' },
    ]);

    expect(state).toBe(INITIAL_SESSION);
    expect(state.events).toBeUndefined();
    expect(state.lifecycle).toBeUndefined();
  });
});

describe('the ledger never changes what the meal is worth', () => {
  it('produces the same report with and without recorded events', () => {
    const timed = run([
      { type: 'add-item', payload: { ...ribeye, quantity: 3 }, meta: meta() },
      { type: 'add-item', payload: { ...ribeye, foodId: 'pork-belly' }, meta: meta(1000) },
      { type: 'decrement-item', id: RIBEYE_ID, meta: meta(1000) },
    ]);
    const untimed = run([
      { type: 'add-item', payload: { ...ribeye, quantity: 3 } },
      { type: 'add-item', payload: { ...ribeye, foodId: 'pork-belly' } },
      { type: 'decrement-item', id: RIBEYE_ID },
    ]);

    expect(timed.events?.length).toBeGreaterThan(0);
    expect(untimed.events).toBeUndefined();
    expect(buildDamageReport(timed.items, timed)).toEqual(
      buildDamageReport(untimed.items, untimed),
    );
  });

  it('bounds the ledger without touching the tab', () => {
    let state = run([{ type: 'add-item', payload: ribeye, meta: meta() }]);
    for (let index = 0; index < MAX_MEAL_EVENTS + 20; index += 1) {
      state = sessionReducer(state, {
        type: index % 2 === 0 ? 'increment-item' : 'decrement-item',
        id: RIBEYE_ID,
        meta: meta(1000),
      });
    }

    expect(state.events?.length).toBe(MAX_MEAL_EVENTS);
    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.quantity).toBeGreaterThanOrEqual(1);
  });
});
