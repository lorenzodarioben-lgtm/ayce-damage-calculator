import { describe, expect, it } from 'vitest';
import { buildDamageReport } from '@/lib/calculations';
import { createSavedSession } from '@/lib/history';
import { BURST_WINDOW_MS, EMPTY_REPLAY, buildMealReplay, replayAt } from '@/lib/replay';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { MealItem, MealSession } from '@/types/meal';
import type { MealEvent, MealEventLine } from '@/types/mealEvents';

const START = Date.parse('2026-08-16T18:00:00.000Z');

function at(minutes: number): string {
  return new Date(START + minutes * 60_000).toISOString();
}

const RIBEYE: MealEventLine = { foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular' };
const PORK: MealEventLine = { foodId: 'pork-belly', quality: 'standard', plateSize: 'regular' };

/** Strips the ledger, which is how a record filed before it existed reads. */
function withoutLedger(filed: SavedMealSession): SavedMealSession {
  const { events: _events, lifecycle: _lifecycle, ...untimed } = filed;
  return untimed;
}

let sequence = 0;

function added(minutes: number, quantity = 1, dinerId?: string, line = RIBEYE): MealEvent {
  sequence += 1;
  return {
    id: `event-${sequence}`,
    at: at(minutes),
    seq: sequence,
    source: 'live',
    type: 'plates-added',
    line,
    quantity,
    ...(dinerId ? { dinerId } : {}),
  };
}

function lifecycleEvent(
  minutes: number,
  type: 'meal-started' | 'meal-completed' | 'meal-paused' | 'meal-resumed',
): MealEvent {
  sequence += 1;
  return { id: `event-${sequence}`, at: at(minutes), seq: sequence, source: 'live', type };
}

function record(
  events: readonly MealEvent[],
  overrides: Partial<MealSession> = {},
  id = 'record-1',
): SavedMealSession {
  const plates = events.reduce(
    (sum, event) => (event.type === 'plates-added' ? sum + event.quantity : sum),
    0,
  );
  const items: readonly MealItem[] = [
    {
      id: 'beef-ribeye__standard__regular',
      foodId: 'beef-ribeye',
      quality: 'standard',
      plateSize: 'regular',
      quantity: Math.max(1, plates),
    },
  ];
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 59.9,
    dinerCount: 1,
    items,
    events,
    ...overrides,
  };
  const report = buildDamageReport(session.items, session);
  return createSavedSession(session, report, getVerdict(1, 1), { id, createdAt: at(0) });
}

describe('buildMealReplay', () => {
  it('reports nothing to replay for a record with no ledger', () => {
    const legacy = record([]);
    expect(buildMealReplay(withoutLedger(legacy))).toEqual(EMPTY_REPLAY);
    expect(buildMealReplay(legacy).available).toBe(false);
  });

  it('produces one point per event, in time order', () => {
    const replay = buildMealReplay(record([added(0), added(5), added(12)]));

    expect(replay.available).toBe(true);
    expect(replay.points).toHaveLength(3);
    expect(replay.points.map((point) => point.offsetMs)).toEqual([0, 5 * 60_000, 12 * 60_000]);
    expect(replay.durationMs).toBe(12 * 60_000);
  });

  it('accumulates plates, weight, value and recovery as the meal goes on', () => {
    const replay = buildMealReplay(record([added(0), added(10), added(20)]));

    expect(replay.points.map((point) => point.plates)).toEqual([1, 2, 3]);
    const values = replay.points.map((point) => point.retailValue);
    expect(values[0]).toBeLessThan(values[1]!);
    expect(values[1]).toBeLessThan(values[2]!);
    const recoveries = replay.points.map((point) => point.recoveryPercent);
    expect(recoveries[2]).toBeGreaterThan(recoveries[0]!);
    expect(replay.points[2]?.weightG).toBe(465);
  });

  it('is deterministic: the same record replays identically every time', () => {
    const filed = record([added(0), added(4), added(9, 2)]);
    expect(buildMealReplay(filed)).toEqual(buildMealReplay(filed));
  });

  it('orders a ledger that was stored out of order before replaying it', () => {
    const events = [added(20), added(0), added(10)];
    const replay = buildMealReplay(record([...events].reverse()));

    expect(replay.points.map((point) => point.offsetMs)).toEqual([0, 10 * 60_000, 20 * 60_000]);
  });

  it('agrees with the calculation engine at the end of the meal', () => {
    const filed = record([added(0, 2), added(10, 1)]);
    const replay = buildMealReplay(filed);
    const report = buildDamageReport(filed.items, filed, filed.pricingProfile);

    expect(replay.points[replay.points.length - 1]?.plates).toBe(report.totalPlates);
    expect(replay.points[replay.points.length - 1]?.retailValue).toBeCloseTo(
      report.totalRetailValue,
      6,
    );
  });

  it('takes plates back off when a line is reduced, removed and restored', () => {
    sequence += 1;
    const reduced: MealEvent = {
      id: `event-${sequence}`,
      at: at(10),
      seq: sequence,
      source: 'live',
      type: 'plates-reduced',
      line: RIBEYE,
      quantity: 1,
    };
    sequence += 1;
    const removed: MealEvent = {
      id: `event-${sequence}`,
      at: at(15),
      seq: sequence,
      source: 'live',
      type: 'line-removed',
      line: RIBEYE,
      quantity: 2,
    };
    sequence += 1;
    const restored: MealEvent = {
      id: `event-${sequence}`,
      at: at(20),
      seq: sequence,
      source: 'live',
      type: 'line-restored',
      line: RIBEYE,
      quantity: 2,
    };

    const replay = buildMealReplay(record([added(0, 3), reduced, removed, restored]));

    expect(replay.points.map((point) => point.plates)).toEqual([3, 2, 0, 2]);
    expect(replay.points[2]?.retailValue).toBe(0);
    expect(replay.points[2]?.recoveryPercent).toBe(0);
  });

  it('never lets plates go negative, however the ledger was edited', () => {
    sequence += 1;
    const overReduced: MealEvent = {
      id: `event-${sequence}`,
      at: at(5),
      seq: sequence,
      source: 'live',
      type: 'plates-reduced',
      line: RIBEYE,
      quantity: 99,
    };

    const replay = buildMealReplay(record([added(0), overReduced]));
    expect(replay.points[1]?.plates).toBe(0);
  });

  it('keeps separate lines separate', () => {
    const replay = buildMealReplay(
      record([added(0, 1, undefined, RIBEYE), added(5, 1, undefined, PORK)]),
    );

    expect(replay.points[1]?.plates).toBe(2);
    expect(replay.points[1]?.retailValue).toBeGreaterThan(replay.points[0]!.retailValue);
  });

  it('tracks diner contributions where Table Mode data exists', () => {
    const diners = [
      { id: 'lorenzo', displayName: 'Lorenzo' },
      { id: 'omar', displayName: 'Omar' },
    ];
    const replay = buildMealReplay(
      record([added(0, 2, 'lorenzo'), added(6, 1, 'omar'), added(9, 1, 'lorenzo')], {
        diners,
        dinerCount: 2,
      }),
    );

    expect(replay.dinerIds).toEqual(['lorenzo', 'omar']);
    expect(replay.points[2]?.dinerPlates).toEqual({ lorenzo: 3, omar: 1 });
  });

  it('names no diners at all for a shared-table meal', () => {
    const replay = buildMealReplay(record([added(0), added(5)]));

    expect(replay.dinerIds).toEqual([]);
    expect(replay.points[0]?.dinerPlates).toEqual({});
  });

  it('never attributes more plates than the line holds', () => {
    sequence += 1;
    const overAllocated: MealEvent = {
      id: `event-${sequence}`,
      at: at(5),
      seq: sequence,
      source: 'live',
      type: 'allocation-changed',
      line: RIBEYE,
      allocations: [
        { dinerId: 'lorenzo', quantity: 9 },
        { dinerId: 'omar', quantity: 9 },
      ],
    };
    const replay = buildMealReplay(
      record([added(0, 2), overAllocated], {
        diners: [
          { id: 'lorenzo', displayName: 'Lorenzo' },
          { id: 'omar', displayName: 'Omar' },
        ],
        dinerCount: 2,
      }),
    );

    expect(replay.points[1]?.dinerPlates).toEqual({ lorenzo: 2 });
  });

  it('says plainly when the ledger no longer reaches the start of the meal', () => {
    const filed = record([added(0), added(5)]);
    const trimmed: SavedMealSession = {
      ...filed,
      items: [{ ...filed.items[0]!, quantity: 20 }],
    };

    expect(buildMealReplay(trimmed).truncated).toBe(true);
    expect(buildMealReplay(filed).truncated).toBe(false);
  });

  it('refuses a ledger whose first instant is unreadable rather than guessing', () => {
    const broken = record([{ ...added(0), at: 'not a time' } as MealEvent]);
    expect(buildMealReplay(broken)).toEqual(EMPTY_REPLAY);
  });
});

describe('replay moments', () => {
  it('marks the first plate and the last', () => {
    const replay = buildMealReplay(record([added(0), added(30), added(52)]));
    const ids = replay.moments.map((moment) => moment.id);

    expect(ids).toContain('first-plate');
    expect(ids).toContain('last-plate');
    expect(replay.moments.find((moment) => moment.id === 'last-plate')?.offsetMs).toBe(52 * 60_000);
  });

  it('does not name a last plate when there was only one', () => {
    const replay = buildMealReplay(record([added(0)]));
    expect(replay.moments.map((moment) => moment.id)).not.toContain('last-plate');
  });

  it('marks the moment retail value first reached admission', () => {
    // Nine regular ribeye plates clear $59.90 of admission.
    const events = Array.from({ length: 9 }, (_unused, index) => added(index * 5));
    const replay = buildMealReplay(record(events));
    const breakEven = replay.moments.find((moment) => moment.id === 'break-even');

    expect(breakEven).toBeDefined();
    const point = replay.points.find((entry) => entry.offsetMs === breakEven?.offsetMs);
    expect(point?.recoveryPercent).toBeGreaterThanOrEqual(100);
  });

  it('never marks break-even on a meal that did not reach it', () => {
    const replay = buildMealReplay(record([added(0), added(5)]));
    expect(replay.moments.map((moment) => moment.id)).not.toContain('break-even');
  });

  it('names the heaviest window of the meal', () => {
    const quiet = [added(0), added(40), added(80)];
    const burst = [added(120, 4), added(122, 4)];
    const replay = buildMealReplay(record([...quiet, ...burst]));
    const busiest = replay.moments.find((moment) => moment.id === 'busiest-window');

    expect(busiest?.offsetMs).toBe(122 * 60_000);
  });

  it('resolves two equally heavy windows to the earlier one, every time', () => {
    const events = [added(0, 3), added(2, 3), added(60, 3), added(62, 3)];
    const replay = buildMealReplay(record(events));
    const busiest = replay.moments.find((moment) => moment.id === 'busiest-window');

    expect(busiest?.offsetMs).toBe(2 * 60_000);
    expect(BURST_WINDOW_MS).toBeGreaterThan(2 * 60_000);
  });

  it('names a long lull, and ignores an ordinary pause between plates', () => {
    const long = buildMealReplay(record([added(0), added(35), added(40)]));
    const lull = long.moments.find((moment) => moment.id === 'longest-gap');
    expect(lull?.detail).toBe('35 minutes without a plate');

    const brisk = buildMealReplay(record([added(0), added(2), added(4)]));
    expect(brisk.moments.map((moment) => moment.id)).not.toContain('longest-gap');
  });

  it('marks the meal being called when the table said so', () => {
    const replay = buildMealReplay(
      record([lifecycleEvent(0, 'meal-started'), added(1), lifecycleEvent(75, 'meal-completed')]),
    );

    expect(replay.moments.find((moment) => moment.id === 'completed')?.offsetMs).toBe(75 * 60_000);
    expect(replay.finishedAt).toBe(at(75));
  });

  it('lists moments in the order they happened', () => {
    const replay = buildMealReplay(
      record([
        ...Array.from({ length: 9 }, (_unused, index) => added(index * 6)),
        lifecycleEvent(70, 'meal-completed'),
      ]),
    );
    const offsets = replay.moments.map((moment) => moment.offsetMs);

    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });
});

describe('replayAt', () => {
  it('returns the state as of a scrub position', () => {
    const replay = buildMealReplay(record([added(0), added(10), added(20)]));

    expect(replayAt(replay, 0)?.plates).toBe(1);
    expect(replayAt(replay, 9 * 60_000)?.plates).toBe(1);
    expect(replayAt(replay, 10 * 60_000)?.plates).toBe(2);
    expect(replayAt(replay, 999 * 60_000)?.plates).toBe(3);
  });

  it('clamps a position before the meal to its first recorded state', () => {
    const replay = buildMealReplay(record([added(0), added(10)]));
    expect(replayAt(replay, -5000)?.plates).toBe(1);
  });

  it('has nothing to return for a record with no ledger', () => {
    expect(replayAt(EMPTY_REPLAY, 0)).toBeNull();
  });
});
