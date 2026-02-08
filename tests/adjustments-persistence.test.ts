import { describe, expect, it } from 'vitest';
import { buildDamageReport } from '@/lib/calculations';
import {
  SAVED_SESSION_VERSION,
  createSavedSession,
  fingerprintSession,
  parseSavedSession,
  reportFromSaved,
  sessionFromSaved,
} from '@/lib/history';
import { historyToCsv } from '@/lib/csv';
import { STORAGE_VERSION, parseStoredSession } from '@/lib/storage';
import { decodeSharePayload, encodeSharePayload } from '@/lib/shareLink';
import {
  challengeSideFromRecord,
  decodeChallengePayload,
  encodeChallengePayload,
} from '@/lib/challengeShare';
import { getVerdict } from '@/lib/verdicts';
import { MAX_BILL_ADJUSTMENTS } from '@/lib/constants';
import type { SavedMealSession } from '@/types/history';
import type { BillAdjustment, MealItem, MealSession } from '@/types/meal';

/**
 * Adjustments across every boundary they have to survive.
 *
 * The whole feature is only worth having if the total it produces is the total
 * that comes back: out of storage, out of a filed record, out of an address, and
 * into a spreadsheet. Each of these is a separate parser, and each is tested for
 * the same two things — that a bill with adjustments keeps them, and that a bill
 * without them is byte-for-byte the meal it was before the feature existed.
 */

const ITEMS: readonly MealItem[] = [
  {
    id: 'beef-ribeye__standard__regular',
    foodId: 'beef-ribeye',
    quality: 'standard',
    plateSize: 'regular',
    quantity: 4,
  },
];

const ADJUSTMENTS: readonly BillAdjustment[] = [
  { id: 'adj-1', label: 'Weekend surcharge', amount: 6, kind: 'charge' },
  { id: 'adj-2', label: 'Voucher', amount: 25, kind: 'discount' },
];

function session(overrides: Partial<MealSession> = {}): MealSession {
  return {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 50,
    dinerCount: 2,
    pricingProfileId: 'australian-kbbq',
    items: ITEMS,
    ...overrides,
  };
}

function envelope(value: MealSession, version = STORAGE_VERSION): string {
  return JSON.stringify(
    version === STORAGE_VERSION
      ? { version, revision: 1, writerId: 'adjustments-test', kind: 'session', session: value }
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
  it('round trips adjustments through the current envelope', () => {
    const restored = parseStoredSession(envelope(session({ adjustments: ADJUSTMENTS })));
    expect(restored?.adjustments).toEqual(ADJUSTMENTS);
  });

  it('leaves a tab without adjustments with no such key at all', () => {
    // An absent list and an empty one already mean the same thing, so keeping
    // only one shape is what makes an ordinary tab serialise as it always did.
    expect(parseStoredSession(envelope(session()))).not.toHaveProperty('adjustments');
    expect(parseStoredSession(envelope(session({ adjustments: [] })))).not.toHaveProperty(
      'adjustments',
    );
  });

  it('reads a version 6 tab as having been paid at its entry price', () => {
    const legacy = JSON.stringify({
      version: 6,
      session: { ...session(), adjustments: ADJUSTMENTS },
    });
    // The key predates version 7, so whatever is sitting in it is not data this
    // build wrote and is not trusted.
    expect(parseStoredSession(legacy)).not.toHaveProperty('adjustments');
  });

  it('drops a stored adjustment that has been edited into nonsense', () => {
    const hostile = envelope({
      ...session(),
      adjustments: [{ id: 'adj-1', label: 'Voucher', amount: 'lots', kind: 'discount' }] as never,
    });
    expect(parseStoredSession(hostile)).not.toHaveProperty('adjustments');
  });

  it('re-scopes an adjustment naming a diner the tab does not have', () => {
    const restored = parseStoredSession(
      envelope(
        session({
          diners: [{ id: 'diner-a', displayName: 'Ana' }],
          adjustments: [
            { id: 'adj-1', label: 'Drinks', amount: 9, kind: 'charge', dinerId: 'ghost' },
          ],
        }),
      ),
    );
    expect(restored?.adjustments?.[0]?.dinerId).toBeUndefined();
    expect(restored?.adjustments?.[0]?.amount).toBe(9);
  });
});

describe('A filed record', () => {
  it('keeps the adjustments that settled its total', () => {
    const record = file(session({ adjustments: ADJUSTMENTS }));

    expect(record.version).toBe(SAVED_SESSION_VERSION);
    expect(record.adjustments).toEqual(ADJUSTMENTS);
    expect(record.snapshot.totalAdmission).toBe(81);
  });

  it('recomputes to the same total when read back', () => {
    const parsed = parseSavedSession(file(session({ adjustments: ADJUSTMENTS })));

    expect(parsed?.adjustments).toEqual(ADJUSTMENTS);
    expect(reportFromSaved(parsed!).totalAdmission).toBe(81);
    expect(reportFromSaved(parsed!).baseAdmission).toBe(100);
  });

  it('reads a version 9 record as having been paid at its entry price', () => {
    const legacy = { ...file(session({ adjustments: ADJUSTMENTS })), version: 9 };
    const parsed = parseSavedSession(legacy);

    expect(parsed?.adjustments).toBeUndefined();
    expect(reportFromSaved(parsed!).totalAdmission).toBe(100);
  });

  it('files a plain meal with no adjustments key', () => {
    expect(file(session())).not.toHaveProperty('adjustments');
  });

  it('treats two bills settled differently as different meals', () => {
    const plain = fingerprintSession(session());
    const discounted = fingerprintSession(session({ adjustments: ADJUSTMENTS }));

    expect(plain).not.toBe(discounted);
  });

  it('fingerprints the same bill identically however it is ordered', () => {
    expect(fingerprintSession(session({ adjustments: ADJUSTMENTS }))).toBe(
      fingerprintSession(session({ adjustments: [...ADJUSTMENTS].reverse() })),
    );
  });

  it('carries the adjustments into a re-ordered meal, scoped to the table', () => {
    const record = parseSavedSession(
      file(
        session({
          diners: [{ id: 'diner-a', displayName: 'Ana' }],
          adjustments: [
            { id: 'adj-1', label: 'Drinks', amount: 9, kind: 'charge', dinerId: 'diner-a' },
          ],
        }),
      ),
    );
    const reordered = sessionFromSaved(record!);

    expect(reordered.adjustments).toHaveLength(1);
    // The roster does not come along, so neither does the person the charge
    // pointed at — the money stays, attached to the table.
    expect(reordered.adjustments?.[0]?.dinerId).toBeUndefined();
    expect(reordered.diners).toBeUndefined();
  });

  it('stops at the ceiling when a record claims more than a bill can carry', () => {
    const many = Array.from({ length: MAX_BILL_ADJUSTMENTS + 5 }, (_unused, index) => ({
      id: `adj-${index}`,
      label: 'Drinks',
      amount: 1,
      kind: 'charge' as const,
    }));
    const parsed = parseSavedSession({
      ...file(session({ adjustments: many })),
      adjustments: many,
    });

    expect(parsed?.adjustments).toHaveLength(MAX_BILL_ADJUSTMENTS);
  });
});

describe('A shared report', () => {
  it('carries the adjustments so the recipient sees the same recovery', () => {
    const token = encodeSharePayload(session({ adjustments: ADJUSTMENTS }))!;
    const decoded = decodeSharePayload(token);

    expect(decoded?.adjustments).toEqual(ADJUSTMENTS);
    expect(buildDamageReport(decoded!.items, decoded!).totalAdmission).toBe(81);
  });

  it('leaves a plain meal without an adjustments key', () => {
    const decoded = decodeSharePayload(encodeSharePayload(session())!);
    expect(decoded?.adjustments).toBeUndefined();
  });

  it('reproduces the figures the sender saw, exactly', () => {
    const sent = session({ adjustments: ADJUSTMENTS });
    const decoded = decodeSharePayload(encodeSharePayload(sent)!)!;

    expect(buildDamageReport(decoded.items, decoded).retailRecoveryPercent).toBeCloseTo(
      buildDamageReport(sent.items, sent).retailRecoveryPercent,
      6,
    );
  });
});

describe('A shared challenge', () => {
  it('carries the adjustments on each side, scoped to the table', () => {
    const record = parseSavedSession(
      file(
        session({
          diners: [{ id: 'diner-a', displayName: 'Ana' }],
          adjustments: [
            { id: 'adj-1', label: 'Voucher', amount: 20, kind: 'discount', dinerId: 'diner-a' },
          ],
        }),
      ),
    )!;
    const side = challengeSideFromRecord(record);

    expect(side.adjustments).toHaveLength(1);
    // A challenge deliberately carries no roster, so it carries no diner ids.
    expect(side.adjustments?.[0]?.dinerId).toBeUndefined();

    const decoded = decodeChallengePayload(
      encodeChallengePayload({ previous: side, current: side })!,
    );
    expect(decoded?.previous.adjustments?.[0]?.amount).toBe(20);
  });

  it('compares two sides at what each of them actually paid', () => {
    const plain = challengeSideFromRecord(parseSavedSession(file(session()))!);
    const discounted = challengeSideFromRecord(
      parseSavedSession(file(session({ adjustments: ADJUSTMENTS })))!,
    );
    const decoded = decodeChallengePayload(
      encodeChallengePayload({ previous: plain, current: discounted })!,
    )!;

    expect(decoded.previous.adjustments).toBeUndefined();
    expect(decoded.current.adjustments).toHaveLength(2);
  });
});

describe('The spreadsheet export', () => {
  it('separates the entry price, the charges, the discounts and what was paid', () => {
    const csv = historyToCsv([parseSavedSession(file(session({ adjustments: ADJUSTMENTS })))!]);
    const [header, firstRow] = csv.split('\n') as [string, string];

    expect(header).toContain('base_admission,bill_charges,bill_discounts,admission');
    expect(firstRow).toContain('"100.00","6.00","25.00","81.00"');
  });

  it('reports zeroes for a bill that was just the entry price', () => {
    const csv = historyToCsv([parseSavedSession(file(session()))!]);
    expect(csv.split('\n')[1]).toContain('"100.00","0.00","0.00","100.00"');
  });
});
