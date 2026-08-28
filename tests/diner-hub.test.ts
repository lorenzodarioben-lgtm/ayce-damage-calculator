import { describe, expect, it } from 'vitest';
import { buildDamageReport } from '@/lib/calculations';
import {
  buildDinerSummary,
  dinerVisits,
  hasAnyVisit,
  summariseDiners,
  unsavedDinerNames,
} from '@/lib/dinerHub';
import { createSavedSession, parseSavedSession } from '@/lib/history';
import { getVerdict } from '@/lib/verdicts';
import type { RegularDiner } from '@/lib/regularDiners';
import type { SavedMealSession } from '@/types/history';
import type { Diner, MealItem, MealSession } from '@/types/meal';

/**
 * Per-person figures, derived from the file rather than stored beside it.
 *
 * The claims worth testing are about honesty as much as arithmetic: a meal with
 * no roster belongs to nobody, explicit attribution is never conflated with an
 * even share, and removing a profile does not touch a single filed record.
 */

const ANA: RegularDiner = { id: 'diner-ana', displayName: 'Ana' };
const BEN: RegularDiner = { id: 'diner-ben', displayName: 'Ben' };

const ROSTER: readonly Diner[] = [ANA, BEN];

function line(foodId: string, quantity: number, allocations?: MealItem['allocations']): MealItem {
  return {
    id: `${foodId}__standard__regular`,
    foodId,
    quality: 'standard',
    plateSize: 'regular',
    quantity,
    ...(allocations ? { allocations } : {}),
  };
}

function file(
  id: string,
  createdAt: string,
  overrides: Partial<MealSession> = {},
): SavedMealSession {
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 50,
    dinerCount: 2,
    pricingProfileId: 'australian-kbbq',
    items: [line('beef-ribeye', 4)],
    ...overrides,
  };
  const report = buildDamageReport(session.items, session);
  return parseSavedSession(
    createSavedSession(
      session,
      report,
      getVerdict(report.totalRetailValue, report.totalAdmission),
      { id, createdAt },
    ),
  )!;
}

describe('Which meals belong to a person', () => {
  it('counts a meal whose roster names them', () => {
    const records = [file('a', '2026-08-16T12:00:00.000Z', { diners: ROSTER })];
    expect(dinerVisits(records, ANA.id).map((entry) => entry.id)).toEqual(['a']);
    expect(hasAnyVisit(records, ANA.id)).toBe(true);
  });

  it('assigns a meal with no roster to nobody at all', () => {
    // Nobody said who was there, and a date or a restaurant name is not a
    // record of attendance.
    const records = [file('a', '2026-08-16T12:00:00.000Z')];
    expect(dinerVisits(records, ANA.id)).toEqual([]);
    expect(hasAnyVisit(records, ANA.id)).toBe(false);
    expect(buildDinerSummary(ANA, records).visits).toBe(0);
  });

  it('matches on the opaque id rather than the display name', () => {
    const records = [
      file('a', '2026-08-16T12:00:00.000Z', {
        diners: [{ id: 'diner-someone-else', displayName: 'Ana' }],
      }),
    ];
    // Two people can share a name; only the id says who they are.
    expect(dinerVisits(records, ANA.id)).toEqual([]);
  });

  it('reports an empty summary honestly rather than with zeroed figures pretending to be data', () => {
    const summary = buildDinerSummary(ANA, []);

    expect(summary.visits).toBe(0);
    expect(summary.firstVisitAt).toBeNull();
    expect(summary.latestVisitAt).toBeNull();
    expect(summary.recent).toEqual([]);
    expect(summary.topFoods).toEqual([]);
  });
});

describe('Explicit attribution versus an even share', () => {
  it('keeps the two figures apart', () => {
    const records = [
      file('a', '2026-08-16T12:00:00.000Z', {
        diners: ROSTER,
        items: [line('beef-ribeye', 4, [{ dinerId: ANA.id, quantity: 3 }])],
      }),
    ];
    const ana = buildDinerSummary(ANA, records);
    const ben = buildDinerSummary(BEN, records);

    // Three plates are Ana's on the record; the remaining one is shared evenly.
    expect(ana.attributedPlates).toBe(3);
    expect(ana.sharedPlates).toBeCloseTo(0.5, 6);
    expect(ben.attributedPlates).toBe(0);
    expect(ben.sharedPlates).toBeCloseTo(0.5, 6);
  });

  it('sums the two into the effective figure', () => {
    const records = [
      file('a', '2026-08-16T12:00:00.000Z', {
        diners: ROSTER,
        items: [line('beef-ribeye', 4, [{ dinerId: ANA.id, quantity: 3 }])],
      }),
    ];
    const ana = buildDinerSummary(ANA, records);
    expect(ana.effectivePlates).toBeCloseTo(ana.attributedPlates + ana.sharedPlates, 10);
  });

  it('keeps the roster summing to the table', () => {
    const records = [file('a', '2026-08-16T12:00:00.000Z', { diners: ROSTER })];
    const total =
      buildDinerSummary(ANA, records).effectivePlates +
      buildDinerSummary(BEN, records).effectivePlates;

    expect(total).toBeCloseTo(4, 6);
  });

  it('never gives anyone more than the table ordered', () => {
    const records = [
      file('a', '2026-08-16T12:00:00.000Z', {
        diners: ROSTER,
        items: [line('beef-ribeye', 2, [{ dinerId: ANA.id, quantity: 99 }])],
      }),
    ];
    const ana = buildDinerSummary(ANA, records);

    expect(ana.effectivePlates).toBeLessThanOrEqual(2);
    expect(ana.attributedPlates).toBeLessThanOrEqual(2);
  });
});

describe('The figures beside a person', () => {
  const records = [
    file('older', '2026-08-10T12:00:00.000Z', { diners: ROSTER }),
    file('newer', '2026-08-16T12:00:00.000Z', {
      diners: ROSTER,
      items: [line('beef-ribeye', 2), line('pork-belly', 4, [{ dinerId: BEN.id, quantity: 4 }])],
    }),
  ];

  it('counts every meal they were at', () => {
    expect(buildDinerSummary(BEN, records).visits).toBe(2);
  });

  it('orders the visits newest first', () => {
    expect(buildDinerSummary(BEN, records).recent.map((visit) => visit.recordId)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('reports the first and latest meal from the records themselves', () => {
    const summary = buildDinerSummary(BEN, records);
    expect(summary.firstVisitAt).toBe('2026-08-10T12:00:00.000Z');
    expect(summary.latestVisitAt).toBe('2026-08-16T12:00:00.000Z');
  });

  it('keeps every derived figure finite and non-negative', () => {
    const summary = buildDinerSummary(BEN, records);

    for (const value of [
      summary.effectivePlates,
      summary.weightKg,
      summary.retailValue,
      summary.admission,
      summary.recoveryPercent,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('names their most ordered foods, ties broken by name', () => {
    const summary = buildDinerSummary(BEN, records);
    // Ben has all four pork belly plus his share of the ribeye.
    expect(summary.topFoods[0]?.name).toContain('Pork');
    expect(summary.topFoods[0]?.plates).toBeGreaterThan(summary.topFoods[1]?.plates ?? 0);
  });

  it('produces the same summary every time', () => {
    expect(buildDinerSummary(BEN, records)).toEqual(buildDinerSummary(BEN, records));
  });

  it('gives every category a row, so a chart can have a table beside it', () => {
    const summary = buildDinerSummary(BEN, records);
    expect(summary.categories).toHaveLength(8);
    expect(summary.categories.every((entry) => Number.isFinite(entry.share))).toBe(true);
  });
});

describe('Listing the people on file', () => {
  it('puts the most recently seen first, then by name', () => {
    const records = [
      file('a', '2026-08-16T12:00:00.000Z', { diners: [BEN] }),
      file('b', '2026-08-10T12:00:00.000Z', { diners: [ANA] }),
    ];
    expect(summariseDiners([ANA, BEN], records).map((entry) => entry.diner.id)).toEqual([
      BEN.id,
      ANA.id,
    ]);
  });

  it('sorts people with no meals to the bottom, by name', () => {
    const never: RegularDiner = { id: 'diner-cal', displayName: 'Cal' };
    const records = [file('a', '2026-08-16T12:00:00.000Z', { diners: [ANA] })];

    expect(summariseDiners([never, BEN, ANA], records).map((entry) => entry.diner.id)).toEqual([
      ANA.id,
      BEN.id,
      never.id,
    ]);
  });

  it('names people who appear on a roster without being saved', () => {
    const records = [
      file('a', '2026-08-16T12:00:00.000Z', {
        diners: [ANA, { id: 'diner-guest', displayName: 'A guest' }],
      }),
    ];

    expect(unsavedDinerNames(records, [ANA])).toEqual(['A guest']);
  });

  it('names each of them once, however many meals they appear in', () => {
    const guest = { id: 'diner-guest', displayName: 'A guest' };
    const records = [
      file('a', '2026-08-16T12:00:00.000Z', { diners: [guest] }),
      file('b', '2026-08-10T12:00:00.000Z', { diners: [guest] }),
    ];

    expect(unsavedDinerNames(records, [])).toEqual(['A guest']);
  });
});

describe('Deleting a profile', () => {
  it('leaves the filed rosters exactly as they were', () => {
    const records = [file('a', '2026-08-16T12:00:00.000Z', { diners: ROSTER })];
    const before = JSON.parse(JSON.stringify(records));

    // Removing a person is a change to the directory, not to history: these
    // summaries are the only thing that stops existing.
    summariseDiners([], records);

    expect(records).toEqual(before);
    expect(records[0]?.diners?.map((diner) => diner.id)).toEqual([ANA.id, BEN.id]);
    // And the meal is still readable, still naming who was at the table.
    expect(unsavedDinerNames(records, [])).toEqual(['Ana', 'Ben']);
  });
});
