import { describe, expect, it } from 'vitest';
import {
  TOP_FOOD_LENGTH,
  TREND_LENGTH,
  buildHistoryAnalytics,
  recordsInAnalyticsRange,
} from '@/lib/analytics';
import { buildDamageReport } from '@/lib/calculations';
import { createSavedSession } from '@/lib/history';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { MealItem, MealSession } from '@/types/meal';

function line(
  foodId: string,
  quantity: number,
  quality: MealItem['quality'] = 'standard',
): MealItem {
  return { id: `${foodId}__${quality}__regular`, foodId, quality, plateSize: 'regular', quantity };
}

function filed(
  id: string,
  createdAt: string,
  items: readonly MealItem[],
  overrides: Partial<MealSession> = {},
): SavedMealSession {
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 59.9,
    dinerCount: 1,
    items,
    ...overrides,
  };
  const report = buildDamageReport(session.items, session);
  return createSavedSession(
    session,
    report,
    getVerdict(report.totalRetailValue, report.totalAdmission),
    { id, createdAt },
  );
}

const SMALL = filed('small', '2026-08-10T12:00:00.000Z', [line('chicken-thigh', 2)], {
  restaurantName: 'Little Seoul',
});
// 8 x 155 g x $82/kg x 1.35 premium = $137.27 of $59.90 = 229%
const BIG = filed('big', '2026-08-14T12:00:00.000Z', [line('beef-wagyu-short-rib', 8, 'premium')], {
  restaurantName: 'Wagyu House',
});
const MIXED = filed('mixed', '2026-08-16T12:00:00.000Z', [
  line('beef-ribeye', 3),
  line('seafood-prawns', 2, 'house'),
]);

describe('Empty history', () => {
  it('reports nothing rather than inventing figures', () => {
    const analytics = buildHistoryAnalytics([]);

    expect(analytics.sessionCount).toBe(0);
    expect(analytics.totalPlates).toBe(0);
    expect(analytics.averageRecoveryPercent).toBe(0);
    expect(analytics.best).toBeNull();
    expect(analytics.mostPlates).toBeNull();
    expect(analytics.topFoods).toEqual([]);
    expect(analytics.trend).toEqual([]);
  });
});

describe('Analytics periods', () => {
  const now = new Date('2026-08-30T00:00:00.000Z');

  it('uses an inclusive, deterministic lower boundary and excludes future meals', () => {
    const records = [
      filed('on-boundary', '2026-07-31T00:00:00.000Z', [line('beef-ribeye', 1)]),
      filed('inside', '2026-08-01T00:00:00.000Z', [line('beef-ribeye', 1)]),
      filed('outside', '2026-07-30T23:59:59.999Z', [line('beef-ribeye', 1)]),
      filed('future', '2026-08-30T00:00:00.001Z', [line('beef-ribeye', 1)]),
    ];

    expect(recordsInAnalyticsRange(records, '30', now).map((record) => record.id)).toEqual([
      'on-boundary',
      'inside',
    ]);
  });

  it('keeps all records for all time and returns an empty set for an empty period', () => {
    expect(recordsInAnalyticsRange([SMALL, BIG], 'all', now)).toEqual([SMALL, BIG]);
    expect(recordsInAnalyticsRange([SMALL, BIG], '30', now)).toEqual([]);
  });
});

describe('Totals', () => {
  const analytics = buildHistoryAnalytics([SMALL, BIG, MIXED]);

  it('counts sessions and plates', () => {
    expect(analytics.sessionCount).toBe(3);
    expect(analytics.totalPlates).toBe(2 + 8 + 5);
  });

  it('sums weight and protein across every session', () => {
    // 15 regular plates at 155 g = 2.325 kg.
    expect(analytics.totalWeightKg).toBeCloseTo(2.325, 3);
    expect(analytics.totalProteinG).toBeGreaterThan(0);
  });

  it('averages weight per session', () => {
    expect(analytics.averageWeightKg).toBeCloseTo(2.325 / 3, 4);
  });

  it('counts how many sessions reached break-even', () => {
    expect(analytics.sessionsAtBreakEven).toBe(1);
  });
});

describe('Recovery', () => {
  const analytics = buildHistoryAnalytics([SMALL, BIG, MIXED]);

  it('averages recovery across sessions rather than over pooled totals', () => {
    const each = [SMALL, BIG, MIXED].map((record) => {
      const report = buildDamageReport(record.items, record);
      return report.retailRecoveryPercent;
    });
    const expected = each.reduce((sum, value) => sum + value, 0) / each.length;

    expect(analytics.averageRecoveryPercent).toBeCloseTo(expected, 6);
  });

  it('names the best session', () => {
    expect(analytics.bestRecoveryPercent).toBeCloseTo(229.16, 1);
    expect(analytics.best?.id).toBe('big');
    expect(analytics.best?.label).toBe('Wagyu House');
  });

  it('names the largest session by plates', () => {
    expect(analytics.mostPlates?.id).toBe('big');
    expect(analytics.mostPlates?.value).toBe(8);
  });

  it('labels an unnamed restaurant rather than leaving it blank', () => {
    const anonymous = buildHistoryAnalytics([
      filed('anon', '2026-08-16T12:00:00.000Z', [line('beef-ribeye', 1)], { restaurantName: '' }),
    ]);

    expect(anonymous.best?.label).toBe('Unnamed restaurant');
  });
});

describe('Distributions', () => {
  const analytics = buildHistoryAnalytics([SMALL, BIG, MIXED]);

  it('splits plates by category, including untouched ones', () => {
    const byId = new Map(analytics.categories.map((entry) => [entry.id, entry]));

    expect(byId.get('beef')?.plates).toBe(11);
    expect(byId.get('chicken')?.plates).toBe(2);
    expect(byId.get('seafood')?.plates).toBe(2);
    expect(byId.get('pork')?.plates).toBe(0);
  });

  it('expresses each share as a percentage of all plates', () => {
    const total = analytics.categories.reduce((sum, entry) => sum + entry.share, 0);

    expect(total).toBeCloseTo(100, 6);
    expect(analytics.categories.find((entry) => entry.id === 'beef')?.share).toBeCloseTo(
      (11 / 15) * 100,
      6,
    );
  });

  it('splits plates by grade', () => {
    const byId = new Map(analytics.qualities.map((entry) => [entry.id, entry]));

    expect(byId.get('premium')?.plates).toBe(8);
    expect(byId.get('house')?.plates).toBe(2);
    expect(byId.get('standard')?.plates).toBe(5);
  });

  it('gives a zero share rather than dividing by nothing', () => {
    const analytics = buildHistoryAnalytics([SMALL]);

    expect(analytics.categories.find((entry) => entry.id === 'pork')?.share).toBe(0);
  });
});

describe('Most ordered cuts', () => {
  it('ranks by plates recorded', () => {
    const analytics = buildHistoryAnalytics([SMALL, BIG, MIXED]);

    expect(analytics.topFoods[0]).toMatchObject({ foodId: 'beef-wagyu-short-rib', plates: 8 });
    expect(analytics.topFoods[1]).toMatchObject({ foodId: 'beef-ribeye', plates: 3 });
  });

  it('breaks ties by name so the order does not wander', () => {
    const tied = buildHistoryAnalytics([
      filed('a', '2026-08-16T12:00:00.000Z', [line('beef-ribeye', 2), line('beef-brisket', 2)]),
    ]);

    expect(tied.topFoods.map((food) => food.name)).toEqual(['Brisket', 'Ribeye']);
  });

  it('names no more cuts than it promises to', () => {
    const many = buildHistoryAnalytics([
      filed('many', '2026-08-16T12:00:00.000Z', [
        line('beef-ribeye', 9),
        line('beef-brisket', 8),
        line('beef-belly', 7),
        line('pork-belly', 6),
        line('pork-jowl', 5),
        line('chicken-thigh', 4),
        line('seafood-prawns', 3),
      ]),
    ]);

    expect(many.topFoods).toHaveLength(TOP_FOOD_LENGTH);
  });
});

describe('Trend', () => {
  it('runs oldest to newest', () => {
    const analytics = buildHistoryAnalytics([MIXED, SMALL, BIG]);

    expect(analytics.trend.map((point) => point.id)).toEqual(['small', 'big', 'mixed']);
  });

  it('keeps only the most recent sessions', () => {
    const records = Array.from({ length: TREND_LENGTH + 6 }, (_, index) =>
      filed(`s${index}`, `2026-08-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`, [
        line('beef-ribeye', 1),
      ]),
    );

    const analytics = buildHistoryAnalytics(records);

    expect(analytics.trend).toHaveLength(TREND_LENGTH);
    expect(analytics.trend.at(-1)?.id).toBe(`s${records.length - 1}`);
  });
});

describe('Resilience', () => {
  it('recalculates from the meal rather than trusting a stored snapshot', () => {
    const tampered: SavedMealSession = {
      ...BIG,
      snapshot: { ...BIG.snapshot, totalPlates: 9999, retailRecoveryPercent: 9999 },
    };
    const analytics = buildHistoryAnalytics([tampered]);

    expect(analytics.totalPlates).toBe(8);
    expect(analytics.bestRecoveryPercent).toBeCloseTo(229.16, 1);
  });

  it('never emits a figure that is not a real number', () => {
    const analytics = buildHistoryAnalytics([SMALL, BIG, MIXED]);

    for (const value of [
      analytics.totalPlates,
      analytics.totalWeightKg,
      analytics.totalProteinG,
      analytics.averageRecoveryPercent,
      analytics.bestRecoveryPercent,
      analytics.averageWeightKg,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
