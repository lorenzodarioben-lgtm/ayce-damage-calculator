import { describe, expect, it } from 'vitest';
import { buildDamageReport } from '@/lib/calculations';
import { consumedQuantity, uneatenQuantity } from '@/lib/consumption';
import { historyToCsv } from '@/lib/csv';
import {
  SAVED_SESSION_VERSION,
  createSavedSession,
  fingerprintSession,
  parseSavedSession,
  reportFromSaved,
} from '@/lib/history';
import { INITIAL_SESSION, sessionReducer } from '@/hooks/useMealSession';
import { buildMealReplay } from '@/lib/replay';
import { STORAGE_VERSION, parseStoredSession } from '@/lib/storage';
import { decodeSharePayload, encodeSharePayload } from '@/lib/shareLink';
import {
  challengeSideFromRecord,
  decodeChallengePayload,
  encodeChallengePayload,
} from '@/lib/challengeShare';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { MealItem, MealSession } from '@/types/meal';

/**
 * Consumption across every boundary it has to survive.
 *
 * The migration claim is the load-bearing one: an absent consumed quantity
 * means the plate went clean, so every session, record, link and backup written
 * before this existed has to keep reporting exactly the figures it always did.
 */

function line(quantity: number, consumed?: number): MealItem {
  return {
    id: 'beef-ribeye__standard__regular',
    foodId: 'beef-ribeye',
    quality: 'standard',
    plateSize: 'regular',
    quantity,
    ...(consumed === undefined ? {} : { consumedQuantity: consumed }),
  };
}

function session(items: readonly MealItem[]): MealSession {
  return {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 50,
    dinerCount: 1,
    pricingProfileId: 'australian-kbbq',
    items,
  };
}

function envelope(value: MealSession, version = STORAGE_VERSION): string {
  return JSON.stringify(
    version === STORAGE_VERSION
      ? { version, revision: 1, writerId: 'consumption-test', kind: 'session', session: value }
      : { version, session: value },
  );
}

function file(value: MealSession): SavedMealSession {
  const report = buildDamageReport(value.items, value);
  return createSavedSession(
    value,
    report,
    getVerdict(report.totalRetailValue, report.totalAdmission),
    { id: 'rec-1', createdAt: '2026-08-16T12:00:00.000Z' },
  );
}

describe('The in-progress tab', () => {
  it('round trips a partially eaten line', () => {
    const restored = parseStoredSession(envelope(session([line(4, 2.5)])));
    expect(restored?.items[0]?.consumedQuantity).toBe(2.5);
  });

  it('stores nothing at all for a clean plate', () => {
    expect(parseStoredSession(envelope(session([line(4)])))?.items[0]).not.toHaveProperty(
      'consumedQuantity',
    );
    expect(parseStoredSession(envelope(session([line(4, 4)])))?.items[0]).not.toHaveProperty(
      'consumedQuantity',
    );
  });

  it('reads a version 7 tab as fully eaten', () => {
    // The key predates version 8, so whatever sits in it was not written here.
    const legacy = parseStoredSession(envelope(session([line(4, 1)]), 7));
    expect(legacy?.items[0]).not.toHaveProperty('consumedQuantity');
    expect(consumedQuantity(legacy!.items[0]!)).toBe(4);
  });

  it('clamps a stored value that claims more was eaten than arrived', () => {
    const restored = parseStoredSession(envelope(session([line(2, 99)])));
    expect(consumedQuantity(restored!.items[0]!)).toBe(2);
    expect(uneatenQuantity(restored!.items[0]!)).toBe(0);
  });

  it('clamps a stored value below nothing', () => {
    const restored = parseStoredSession(envelope(session([line(2, -8)])));
    expect(consumedQuantity(restored!.items[0]!)).toBe(0);
  });

  it('ignores a stored value that is not a number', () => {
    const hostile = envelope({
      ...session([]),
      items: [{ ...line(4), consumedQuantity: 'most of it' } as unknown as MealItem],
    });
    expect(consumedQuantity(parseStoredSession(hostile)!.items[0]!)).toBe(4);
  });
});

describe('A filed record', () => {
  it('keeps what was left behind', () => {
    const record = file(session([line(4, 2)]));

    expect(record.version).toBe(SAVED_SESSION_VERSION);
    expect(record.items[0]?.consumedQuantity).toBe(2);
    expect(parseSavedSession(record)?.items[0]?.consumedQuantity).toBe(2);
  });

  it('recomputes to the eaten value when read back', () => {
    const left = reportFromSaved(parseSavedSession(file(session([line(4, 2)])))!);
    const whole = reportFromSaved(parseSavedSession(file(session([line(4)])))!);

    expect(left.totalRetailValue).toBeCloseTo(whole.totalRetailValue / 2, 6);
    expect(left.totalOrderedRetailValue).toBeCloseTo(whole.totalRetailValue, 6);
  });

  it('reads a version 10 record as fully eaten', () => {
    const legacy = { ...file(session([line(4, 1)])), version: 10 };
    const parsed = parseSavedSession(legacy);

    expect(parsed?.items[0]).not.toHaveProperty('consumedQuantity');
    expect(reportFromSaved(parsed!).totalUneatenPlates).toBe(0);
  });

  it('treats a meal that was left as a different meal from one that was eaten', () => {
    expect(fingerprintSession(session([line(4)]))).not.toBe(
      fingerprintSession(session([line(4, 2)])),
    );
  });
});

describe('A shared report', () => {
  it('carries what was left, so the recipient sees the same recovery', () => {
    const decoded = decodeSharePayload(encodeSharePayload(session([line(4, 2)]))!);

    expect(decoded?.items[0]?.consumedQuantity).toBe(2);
    expect(buildDamageReport(decoded!.items, decoded!).totalUneatenPlates).toBe(2);
  });

  it('leaves a clean meal without the key', () => {
    const decoded = decodeSharePayload(encodeSharePayload(session([line(4)]))!);
    expect(decoded?.items[0]).not.toHaveProperty('consumedQuantity');
  });

  it('clamps a hand-edited token that overstates what was eaten', () => {
    const sent = session([line(2, 1)]);
    const decoded = decodeSharePayload(encodeSharePayload(sent)!)!;
    expect(consumedQuantity(decoded.items[0]!)).toBeLessThanOrEqual(decoded.items[0]!.quantity);
  });
});

describe('A shared challenge', () => {
  it('carries each side at what was actually eaten', () => {
    const record = parseSavedSession(file(session([line(4, 1)])))!;
    const side = challengeSideFromRecord(record);
    const decoded = decodeChallengePayload(
      encodeChallengePayload({ previous: side, current: side })!,
    );

    expect(decoded?.previous.items[0]?.consumedQuantity).toBe(1);
  });
});

describe('The ledger and the replay', () => {
  const meta = (id: string, at: string) => ({ id, at, source: 'live' as const });

  it('records a consumption change as a timed event', () => {
    let state = sessionReducer(INITIAL_SESSION, {
      type: 'add-item',
      payload: { foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular', quantity: 4 },
      meta: meta('e1', '2026-08-16T12:00:00.000Z'),
    });
    state = sessionReducer(state, {
      type: 'set-item-consumption',
      id: 'beef-ribeye__standard__regular',
      consumed: 2,
      meta: meta('e2', '2026-08-16T12:30:00.000Z'),
    });

    const event = state.events?.at(-1);
    expect(event?.type).toBe('consumption-changed');
    expect(event).toMatchObject({ consumedQuantity: 2, quantity: 4 });
  });

  it('records nothing when the amount did not change', () => {
    let state = sessionReducer(INITIAL_SESSION, {
      type: 'add-item',
      payload: { foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular', quantity: 4 },
      meta: meta('e1', '2026-08-16T12:00:00.000Z'),
    });
    const before = state.events?.length ?? 0;
    state = sessionReducer(state, {
      type: 'set-item-consumption',
      id: 'beef-ribeye__standard__regular',
      consumed: 4,
      meta: meta('e2', '2026-08-16T12:30:00.000Z'),
    });

    expect(state.events?.length ?? 0).toBe(before);
  });

  it('replays a meal down to what was eaten', () => {
    let state = sessionReducer(INITIAL_SESSION, {
      type: 'add-item',
      payload: { foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular', quantity: 4 },
      meta: meta('e1', '2026-08-16T12:00:00.000Z'),
    });
    state = sessionReducer(state, {
      type: 'set-item-consumption',
      id: 'beef-ribeye__standard__regular',
      consumed: 2,
      meta: meta('e2', '2026-08-16T12:30:00.000Z'),
    });

    const record = file({ ...session([]), items: state.items, events: state.events ?? [] });
    const replay = buildMealReplay({ ...record, events: state.events ?? [] });

    expect(replay.available).toBe(true);
    // The last point agrees with the report it sits beside, which is the whole
    // reason the change is in the ledger at all.
    const last = replay.points.at(-1);
    expect(last?.retailValue).toBeCloseTo(reportFromSaved(record).totalRetailValue, 4);
  });

  it('shows no consumption on a record that never had a ledger', () => {
    const record = parseSavedSession(file(session([line(4)])))!;
    expect(buildMealReplay(record).available).toBe(false);
  });
});

describe('The spreadsheet export', () => {
  it('separates ordered, eaten and left', () => {
    const csv = historyToCsv([parseSavedSession(file(session([line(4, 2.5)])))!]);
    const [header, firstRow] = csv.split('\n') as [string, string];

    expect(header).toContain('plates,plates_eaten,plates_left');
    expect(header).toContain('line_retail_value,line_ordered_retail_value');
    expect(firstRow).toContain('"4","2.5","1.5"');
  });

  it('reports a clean plate as fully eaten with nothing left', () => {
    const csv = historyToCsv([parseSavedSession(file(session([line(4)])))!]);
    expect(csv.split('\n')[1]).toContain('"4","4","0"');
  });
});
