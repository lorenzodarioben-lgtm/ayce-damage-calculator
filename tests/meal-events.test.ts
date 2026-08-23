import { describe, expect, it } from 'vitest';
import {
  IDLE_LIFECYCLE,
  MAX_MEAL_EVENTS,
  appendMealEvents,
  compareMealEvents,
  hasStarted,
  isMealEventType,
  mealEventLine,
  nextEventSeq,
  parseMealEvent,
  parseMealEvents,
  parseMealLifecycle,
  sortMealEvents,
} from '@/lib/mealEvents';
import { FOODS } from '@/data/foods';
import type { MealEvent } from '@/types/mealEvents';

function event(overrides: Partial<MealEvent> = {}): MealEvent {
  return {
    id: 'event-1',
    at: '2026-08-16T12:00:00.000Z',
    seq: 0,
    source: 'builder',
    type: 'plates-added',
    line: { foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular' },
    quantity: 1,
    ...overrides,
  } as MealEvent;
}

describe('event ordering', () => {
  it('orders by timestamp first', () => {
    const later = event({ id: 'b', at: '2026-08-16T12:05:00.000Z', seq: 0 });
    const earlier = event({ id: 'a', at: '2026-08-16T12:00:00.000Z', seq: 9 });

    expect(sortMealEvents([later, earlier]).map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('breaks a same-millisecond tie by sequence number', () => {
    const second = event({ id: 'b', seq: 2 });
    const first = event({ id: 'a', seq: 1 });

    expect(compareMealEvents(first, second)).toBeLessThan(0);
    expect(sortMealEvents([second, first]).map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('falls back to the identifier so no two events compare equal', () => {
    const alpha = event({ id: 'alpha' });
    const beta = event({ id: 'beta' });

    expect(compareMealEvents(alpha, beta)).toBeLessThan(0);
    expect(compareMealEvents(beta, alpha)).toBeGreaterThan(0);
    expect(compareMealEvents(alpha, alpha)).toBe(0);
  });

  it('is a stable total order over a shuffled ledger', () => {
    const events = [3, 1, 4, 1, 5, 9, 2, 6].map((seq, index) =>
      event({ id: `event-${index}`, seq }),
    );
    const sorted = sortMealEvents(events).map((entry) => entry.seq);

    expect(sorted).toEqual([...sorted].sort((a, b) => a - b));
  });

  it('continues the sequence past the highest number already used', () => {
    expect(nextEventSeq(undefined)).toBe(0);
    expect(nextEventSeq([])).toBe(0);
    expect(nextEventSeq([event({ seq: 4 }), event({ id: 'b', seq: 11 })])).toBe(12);
  });
});

describe('appendMealEvents', () => {
  it('returns the existing ledger untouched when nothing is appended', () => {
    const existing = [event()];
    expect(appendMealEvents(existing, [])).toBe(existing);
  });

  it('keeps the newest events once the ledger is full', () => {
    const existing = Array.from({ length: MAX_MEAL_EVENTS }, (_unused, index) =>
      event({ id: `event-${index}`, seq: index }),
    );
    const appended = appendMealEvents(existing, [event({ id: 'newest', seq: MAX_MEAL_EVENTS })]);

    expect(appended).toHaveLength(MAX_MEAL_EVENTS);
    expect(appended[appended.length - 1]?.id).toBe('newest');
    expect(appended[0]?.id).toBe('event-1');
  });
});

describe('mealEventLine', () => {
  it('carries only the configuration that identifies a tab line', () => {
    expect(mealEventLine({ foodId: 'pork-belly', quality: 'house', plateSize: 'large' })).toEqual({
      foodId: 'pork-belly',
      quality: 'house',
      plateSize: 'large',
    });
  });
});

describe('parseMealEvent', () => {
  it('accepts an event the app itself would write', () => {
    expect(parseMealEvent(event())).toEqual(event());
  });

  it('rejects anything that is not an event record', () => {
    expect(parseMealEvent(null)).toBeNull();
    expect(parseMealEvent('event')).toBeNull();
    expect(parseMealEvent([])).toBeNull();
    expect(parseMealEvent({})).toBeNull();
  });

  it('rejects an unknown event type', () => {
    expect(parseMealEvent(event({ type: 'plates-teleported' } as never))).toBeNull();
  });

  it('rejects an identifier outside the safe alphabet', () => {
    expect(parseMealEvent(event({ id: 'event 1' }))).toBeNull();
    expect(parseMealEvent(event({ id: '' }))).toBeNull();
    expect(parseMealEvent(event({ id: 'x'.repeat(101) }))).toBeNull();
  });

  it('rejects a timestamp that is not a canonical UTC instant', () => {
    expect(parseMealEvent(event({ at: '2026-08-16' }))).toBeNull();
    expect(parseMealEvent(event({ at: 'yesterday' }))).toBeNull();
    expect(parseMealEvent(event({ at: '2026-13-99T12:00:00.000Z' }))).toBeNull();
  });

  it('rejects an unknown source', () => {
    expect(parseMealEvent(event({ source: 'server' } as never))).toBeNull();
  });

  it('rejects a negative or non-finite sequence number', () => {
    expect(parseMealEvent(event({ seq: -1 }))).toBeNull();
    expect(parseMealEvent(event({ seq: Number.NaN }))).toBeNull();
    expect(parseMealEvent(event({ seq: Number.POSITIVE_INFINITY }))).toBeNull();
  });

  it('rejects a line whose configuration the calculator could not produce', () => {
    expect(
      parseMealEvent(
        event({
          line: { foodId: 'beef-ribeye', quality: 'legendary', plateSize: 'regular' },
        } as never),
      ),
    ).toBeNull();
    expect(
      parseMealEvent(
        event({
          line: { foodId: 'beef-ribeye', quality: 'standard', plateSize: 'enormous' },
        } as never),
      ),
    ).toBeNull();
  });

  it('drops a line whose food is no longer in the supplied catalogue', () => {
    expect(parseMealEvent(event(), FOODS)).not.toBeNull();
    expect(
      parseMealEvent(
        event({ line: { foodId: 'custom-food-gone', quality: 'standard', plateSize: 'regular' } }),
        FOODS,
      ),
    ).toBeNull();
  });

  it('clamps an absurd quantity rather than rejecting a readable event', () => {
    const parsed = parseMealEvent(event({ quantity: 9_000_000 }));
    expect(parsed).toMatchObject({ type: 'plates-added', quantity: 99 });
  });

  it('rejects a quantity below a single plate', () => {
    expect(parseMealEvent(event({ quantity: 0 }))).toBeNull();
    expect(parseMealEvent(event({ quantity: -3 }))).toBeNull();
    expect(parseMealEvent(event({ quantity: Number.NaN }))).toBeNull();
  });

  it('keeps a diner reference only when it is a valid local identifier', () => {
    expect(parseMealEvent(event({ dinerId: 'diner-a' }))).toMatchObject({ dinerId: 'diner-a' });
    expect(parseMealEvent(event({ dinerId: 'not a diner id!' }))).not.toHaveProperty('dinerId');
  });

  it('requires a diner reference on roster events', () => {
    expect(parseMealEvent({ ...event(), type: 'diner-joined', dinerId: undefined })).toBeNull();
    expect(parseMealEvent({ ...event(), type: 'diner-left', dinerId: 'diner-a' })).toMatchObject({
      type: 'diner-left',
      dinerId: 'diner-a',
    });
  });

  it('reads lifecycle events, which carry nothing but their moment', () => {
    for (const type of ['meal-started', 'meal-paused', 'meal-resumed', 'meal-completed'] as const) {
      expect(parseMealEvent({ ...event(), type })).toMatchObject({ type });
    }
  });

  it('reads an attribution change and bounds its allocations', () => {
    const parsed = parseMealEvent({
      ...event(),
      type: 'allocation-changed',
      allocations: [
        { dinerId: 'diner-a', quantity: 2 },
        { dinerId: 'bad id', quantity: 1 },
        { dinerId: 'diner-b', quantity: 0 },
      ],
    });

    expect(parsed).toMatchObject({
      type: 'allocation-changed',
      allocations: [{ dinerId: 'diner-a', quantity: 2 }],
    });
  });
});

describe('parseMealEvents', () => {
  it('returns an empty ledger for anything that is not an array', () => {
    expect(parseMealEvents(undefined)).toEqual([]);
    expect(parseMealEvents({ events: [] })).toEqual([]);
  });

  it('drops unreadable entries without losing the readable ones', () => {
    const events = parseMealEvents([event({ id: 'a' }), 'nonsense', event({ id: 'b', seq: 1 })]);
    expect(events.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('drops a repeated identifier, keeping the first', () => {
    const events = parseMealEvents([
      event({ id: 'a', quantity: 1 }),
      event({ id: 'a', quantity: 5 }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ quantity: 1 });
  });

  it('returns the ledger in order regardless of how it was stored', () => {
    const events = parseMealEvents([event({ id: 'b', seq: 2 }), event({ id: 'a', seq: 1 })]);
    expect(events.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('refuses to grow past the ledger bound', () => {
    const stored = Array.from({ length: MAX_MEAL_EVENTS + 50 }, (_unused, index) =>
      event({ id: `event-${index}`, seq: index }),
    );
    expect(parseMealEvents(stored)).toHaveLength(MAX_MEAL_EVENTS);
  });
});

describe('parseMealLifecycle', () => {
  it('treats anything unreadable as a meal that has not started', () => {
    expect(parseMealLifecycle(undefined)).toEqual(IDLE_LIFECYCLE);
    expect(parseMealLifecycle({ status: 'eating' })).toEqual(IDLE_LIFECYCLE);
    expect(parseMealLifecycle([])).toEqual(IDLE_LIFECYCLE);
  });

  it('requires a start time before any other status means anything', () => {
    expect(parseMealLifecycle({ status: 'active', pausedMs: 0 })).toEqual(IDLE_LIFECYCLE);
  });

  it('restores a running meal', () => {
    expect(
      parseMealLifecycle({
        status: 'active',
        startedAt: '2026-08-16T12:00:00.000Z',
        pausedMs: 4000,
      }),
    ).toEqual({ status: 'active', startedAt: '2026-08-16T12:00:00.000Z', pausedMs: 4000 });
  });

  it('falls back to running when a paused meal has no pause time', () => {
    expect(
      parseMealLifecycle({ status: 'paused', startedAt: '2026-08-16T12:00:00.000Z', pausedMs: 0 }),
    ).toEqual({ status: 'active', startedAt: '2026-08-16T12:00:00.000Z', pausedMs: 0 });
  });

  it('falls back to running when a completed meal has no completion time', () => {
    expect(
      parseMealLifecycle({
        status: 'completed',
        startedAt: '2026-08-16T12:00:00.000Z',
        pausedMs: 0,
      }),
    ).toEqual({ status: 'active', startedAt: '2026-08-16T12:00:00.000Z', pausedMs: 0 });
  });

  it('never carries a negative or non-finite paused total', () => {
    expect(
      parseMealLifecycle({
        status: 'active',
        startedAt: '2026-08-16T12:00:00.000Z',
        pausedMs: -5000,
      }).pausedMs,
    ).toBe(0);
    expect(
      parseMealLifecycle({
        status: 'active',
        startedAt: '2026-08-16T12:00:00.000Z',
        pausedMs: Number.POSITIVE_INFINITY,
      }).pausedMs,
    ).toBe(0);
  });
});

describe('isMealEventType and hasStarted', () => {
  it('recognises only the declared event types', () => {
    expect(isMealEventType('plates-added')).toBe(true);
    expect(isMealEventType('plates-eaten')).toBe(false);
    expect(isMealEventType(7)).toBe(false);
  });

  it('reports an absent lifecycle as a meal that has not started', () => {
    expect(hasStarted(undefined)).toBe(false);
    expect(hasStarted(IDLE_LIFECYCLE)).toBe(false);
    expect(
      hasStarted({ status: 'active', startedAt: '2026-08-16T12:00:00.000Z', pausedMs: 0 }),
    ).toBe(true);
  });
});
