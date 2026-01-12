import { describe, expect, it } from 'vitest';
import { buildDamageReport } from '@/lib/calculations';
import {
  MAX_HISTORY_RECORDS,
  SAVED_SESSION_VERSION,
  createSavedSession,
  filterSessions,
  fingerprintSession,
  parseSavedSession,
  reportFromSaved,
  sortResolvedSessions,
} from '@/lib/history';
import { MAX_SESSION_NOTE_LENGTH } from '@/lib/constants';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { MealItem, MealSession } from '@/types/meal';

function item(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 'beef-ribeye__standard__regular',
    foodId: 'beef-ribeye',
    quality: 'standard',
    plateSize: 'regular',
    quantity: 2,
    ...overrides,
  };
}

function session(overrides: Partial<MealSession> = {}): MealSession {
  return {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 59.9,
    dinerCount: 1,
    items: [item()],
    ...overrides,
  };
}

function saved(overrides: Partial<MealSession> = {}, id = 'record-1'): SavedMealSession {
  const meal = session(overrides);
  const report = buildDamageReport(meal.items, meal);
  const verdict = getVerdict(report.totalRetailValue, report.totalAdmission);
  return createSavedSession(meal, report, verdict, {
    id,
    createdAt: '2026-08-16T12:00:00.000Z',
  });
}

describe('fingerprintSession', () => {
  it('is stable regardless of the order items were added in', () => {
    const first = session({ items: [item(), item({ id: 'b', foodId: 'pork-belly' })] });
    const second = session({ items: [item({ id: 'b', foodId: 'pork-belly' }), item()] });

    expect(fingerprintSession(first)).toBe(fingerprintSession(second));
  });

  it('ignores the restaurant name, which does not change the meal', () => {
    expect(fingerprintSession(session({ restaurantName: 'A' }))).toBe(
      fingerprintSession(session({ restaurantName: 'B' })),
    );
  });

  it('changes when the meal, the price or the diner count changes', () => {
    const base = fingerprintSession(session());

    expect(fingerprintSession(session({ pricePerDiner: 70 }))).not.toBe(base);
    expect(fingerprintSession(session({ dinerCount: 2 }))).not.toBe(base);
    expect(fingerprintSession(session({ items: [item({ quantity: 3 })] }))).not.toBe(base);
  });
});

describe('createSavedSession', () => {
  it('captures the canonical meal alongside the totals that were shown', () => {
    const record = saved();

    expect(record.version).toBe(SAVED_SESSION_VERSION);
    expect(record.items).toHaveLength(1);
    expect(record.snapshot.totalPlates).toBe(2);
    expect(record.snapshot.verdictId).toBe('corporate-sponsor');
    expect(record.snapshot.totalRetailValue).toBeCloseTo(16.12, 2);
  });

  it('clamps hostile configuration rather than storing it', () => {
    const record = saved({ pricePerDiner: 99999, dinerCount: 400 });

    expect(record.pricePerDiner).toBe(500);
    expect(record.dinerCount).toBe(12);
  });

  it('trims and collapses the restaurant name', () => {
    const record = saved({ restaurantName: '  Seoul    Garden  ' });

    expect(record.restaurantName).toBe('Seoul Garden');
  });
});

describe('parseSavedSession', () => {
  it('accepts a record it produced itself', () => {
    const record = saved();

    expect(parseSavedSession(JSON.parse(JSON.stringify(record)))).toEqual(record);
  });

  it.each([
    ['not an object', 'nonsense'],
    ['null', null],
    ['an array', []],
    ['a record with no id', { ...saved(), id: '' }],
    ['a record from a future schema', { ...saved(), version: 99 }],
    ['a record with an unparseable timestamp', { ...saved(), createdAt: 'whenever' }],
    ['a record with a non-finite price', { ...saved(), pricePerDiner: Number.POSITIVE_INFINITY }],
    ['a record with no snapshot', { ...saved(), snapshot: undefined }],
    ['a record with an unknown verdict', { ...saved(), snapshot: { verdictId: 'invented' } }],
  ])('rejects %s', (_label, value) => {
    expect(parseSavedSession(value)).toBeNull();
  });

  it('drops individual items that reference foods which no longer exist', () => {
    const record = saved();
    const parsed = parseSavedSession({
      ...record,
      items: [{ ...item(), foodId: 'beef-unicorn' }, item()],
    });

    expect(parsed?.items).toHaveLength(1);
    expect(parsed?.items[0]?.foodId).toBe('beef-ribeye');
  });

  it('rejects a record whose every item was invalid', () => {
    const record = saved();

    expect(
      parseSavedSession({ ...record, items: [{ ...item(), foodId: 'beef-unicorn' }] }),
    ).toBeNull();
  });

  it('clamps an absurd stored quantity instead of trusting it', () => {
    const record = saved();
    const parsed = parseSavedSession({ ...record, items: [{ ...item(), quantity: 10_000 }] });

    expect(parsed?.items[0]?.quantity).toBe(99);
  });

  it('rebuilds a missing fingerprint so old records still deduplicate', () => {
    const record = saved();
    const parsed = parseSavedSession({ ...record, fingerprint: undefined });

    expect(parsed?.fingerprint).toBe(record.fingerprint);
  });

  it('never lets a corrupt snapshot emit NaN', () => {
    const record = saved();
    const parsed = parseSavedSession({
      ...record,
      snapshot: { ...record.snapshot, totalPlates: 'lots', nutrition: 'none' },
    });

    expect(parsed?.snapshot.totalPlates).toBe(0);
    expect(parsed?.snapshot.nutrition).toEqual({ calories: 0, protein: 0, fat: 0, carbs: 0 });
  });
});

describe('schema migration', () => {
  /** A record as version 1 wrote it: no achievements on the snapshot. */
  function asVersion1(record: SavedMealSession) {
    const { achievementIds: _dropped, ...snapshot } = record.snapshot;
    return { ...record, version: 1, snapshot };
  }

  it('brings a version 1 record forward by deriving its achievements', () => {
    const record = saved({
      items: [
        item({ id: 'a', foodId: 'beef-ribeye' }),
        item({ id: 'b', foodId: 'pork-belly' }),
        item({ id: 'c', foodId: 'chicken-thigh' }),
        item({ id: 'd', foodId: 'seafood-prawns' }),
      ],
    });
    const parsed = parseSavedSession(asVersion1(record));

    expect(parsed?.version).toBe(SAVED_SESSION_VERSION);
    // Derivable purely from the meal, so nothing is lost in the upgrade.
    expect(parsed?.snapshot.achievementIds).toContain('four-corners');
    expect(parsed?.snapshot.achievementIds).toEqual(record.snapshot.achievementIds);
  });

  it('keeps the achievements a version 2 record already recorded', () => {
    const record = saved();
    const parsed = parseSavedSession({
      ...record,
      snapshot: { ...record.snapshot, achievementIds: ['kilogram-club'] },
    });

    expect(parsed?.snapshot.achievementIds).toEqual(['kilogram-club']);
  });

  it('discards stored achievement ids the engine no longer defines', () => {
    const record = saved();
    const parsed = parseSavedSession({
      ...record,
      snapshot: { ...record.snapshot, achievementIds: ['break-even', 'retired-award', 7] },
    });

    expect(parsed?.snapshot.achievementIds).toEqual(['break-even']);
  });

  it('treats a non-array achievement list as none recorded', () => {
    const record = saved();
    const parsed = parseSavedSession({
      ...record,
      snapshot: { ...record.snapshot, achievementIds: 'all of them' },
    });

    expect(parsed?.snapshot.achievementIds).toEqual([]);
  });

  it('gives a record written before notes existed an empty one', () => {
    const record = saved();
    const { note: _dropped, ...withoutNote } = asVersion1(record);

    const parsed = parseSavedSession(withoutNote);
    expect(parsed?.version).toBe(SAVED_SESSION_VERSION);
    expect(parsed?.note).toBe('');
  });
});

describe('session notes', () => {
  it('files a note alongside the meal', () => {
    const meal = session();
    const report = buildDamageReport(meal.items, meal);
    const record = createSavedSession(meal, report, getVerdict(report.totalRetailValue, 59.9), {
      id: 'noted',
      createdAt: '2026-08-16T12:00:00.000Z',
      note: 'Birthday dinner. The short rib was the whole argument.',
    });

    expect(record.note).toBe('Birthday dinner. The short rib was the whole argument.');
    expect(parseSavedSession(record)?.note).toBe(record.note);
  });

  it('records an empty note when none was written', () => {
    expect(saved().note).toBe('');
  });

  it('collapses whitespace so a pasted note cannot stretch the layout', () => {
    expect(parseSavedSession({ ...saved(), note: '  a\n\n\tlong   night  ' })?.note).toBe(
      'a long night',
    );
  });

  it('caps an over-long note rather than rejecting the record', () => {
    const parsed = parseSavedSession({ ...saved(), note: 'x'.repeat(1000) });
    expect(parsed).not.toBeNull();
    expect(parsed?.note).toHaveLength(MAX_SESSION_NOTE_LENGTH);
  });

  it('treats a note that is not a string as no note at all', () => {
    expect(parseSavedSession({ ...saved(), note: { text: 'hi' } })?.note).toBe('');
    expect(parseSavedSession({ ...saved(), note: 42 })?.note).toBe('');
  });

  it('keeps the note out of the meal fingerprint', () => {
    const meal = session();
    const report = buildDamageReport(meal.items, meal);
    const verdict = getVerdict(report.totalRetailValue, report.totalAdmission);

    const withNote = createSavedSession(meal, report, verdict, {
      id: 'a',
      createdAt: '2026-08-16T12:00:00.000Z',
      note: 'Something happened.',
    });
    const without = createSavedSession(meal, report, verdict, {
      id: 'b',
      createdAt: '2026-08-16T12:00:00.000Z',
    });

    // Writing a note does not make it a different meal.
    expect(withNote.fingerprint).toBe(without.fingerprint);
  });
});

describe('filterSessions', () => {
  const records: SavedMealSession[] = [
    { ...saved({ restaurantName: 'Seoul Garden' }, 'a'), note: 'Birthday, four of us' },
    { ...saved({ restaurantName: 'Wagyu House' }, 'b'), note: '' },
    { ...saved({ restaurantName: 'Little Seoul' }, 'c'), note: 'Quiet Tuesday' },
  ];

  function ids(query: string): string[] {
    return filterSessions(records, query).map((record) => record.id);
  }

  it('returns everything for an empty or whitespace-only query', () => {
    expect(filterSessions(records, '')).toBe(records);
    expect(filterSessions(records, '   ')).toBe(records);
  });

  it('matches a restaurant name regardless of case', () => {
    expect(ids('SEOUL')).toEqual(['a', 'c']);
  });

  it('matches inside a note', () => {
    expect(ids('birthday')).toEqual(['a']);
    expect(ids('tuesday')).toEqual(['c']);
  });

  it('narrows as words are added', () => {
    expect(ids('seoul garden')).toEqual(['a']);
  });

  it('returns nothing rather than everything when no record matches', () => {
    expect(ids('tiramisu')).toEqual([]);
  });

  it('preserves the order it was given', () => {
    expect(ids('seoul')).toEqual(['a', 'c']);
  });
});

describe('reportFromSaved', () => {
  it('recomputes totals from the canonical meal rather than the stored snapshot', () => {
    const record = saved();
    // A snapshot that disagrees with the meal must not win.
    const tampered: SavedMealSession = {
      ...record,
      snapshot: { ...record.snapshot, totalRetailValue: 999_999 },
    };

    expect(reportFromSaved(tampered).totalRetailValue).toBeCloseTo(16.12, 2);
  });
});

describe('sortResolvedSessions', () => {
  const older = { ...saved({}, 'older'), createdAt: '2026-08-14T12:00:00.000Z' };
  const bigger = {
    ...saved({ items: [item({ quantity: 9 })] }, 'bigger'),
    createdAt: '2026-08-15T12:00:00.000Z',
  };
  const newest = { ...saved({}, 'newest'), createdAt: '2026-08-16T12:00:00.000Z' };
  const records = [older, bigger, newest];

  const ids = (key: 'newest' | 'recovery' | 'plates') =>
    sortResolvedSessions(records, key).map((entry) => entry.record.id);

  it('orders by recency', () => {
    expect(ids('newest')).toEqual(['newest', 'bigger', 'older']);
  });

  it('orders by plates recorded', () => {
    expect(ids('plates')[0]).toBe('bigger');
  });

  it('orders by retail recovery', () => {
    expect(ids('recovery')[0]).toBe('bigger');
  });

  it('leaves the source array untouched', () => {
    sortResolvedSessions(records, 'plates');

    expect(records.map((r) => r.id)).toEqual(['older', 'bigger', 'newest']);
  });

  it('hands back the resolved report, so callers need not recompute it', () => {
    const [first] = sortResolvedSessions(records, 'plates');

    expect(first?.report.totalPlates).toBe(9);
    expect(first?.verdict.id).toBeTruthy();
    expect(first?.achievements).toBeDefined();
  });
});

describe('history limits', () => {
  it('caps stored records at a bounded number', () => {
    expect(MAX_HISTORY_RECORDS).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_HISTORY_RECORDS)).toBe(true);
  });
});
