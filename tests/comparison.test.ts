import { describe, expect, it } from 'vitest';
import { buildDamageReport } from '@/lib/calculations';
import { compareSessions, orderByRecordedAt, summariseRecoveryShift } from '@/lib/comparison';
import { formatDelta, formatMetricValue } from '@/lib/formatting';
import { createSavedSession } from '@/lib/history';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { MealItem, MealSession } from '@/types/meal';

function line(
  foodId: string,
  quantity: number,
  plateSize: MealItem['plateSize'] = 'regular',
): MealItem {
  return {
    id: `${foodId}__standard__${plateSize}`,
    foodId,
    quality: 'standard',
    plateSize,
    quantity,
  };
}

function filed(
  id: string,
  createdAt: string,
  items: readonly MealItem[],
  config: Partial<Pick<MealSession, 'pricePerDiner' | 'dinerCount'>> = {},
): SavedMealSession {
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 59.9,
    dinerCount: 1,
    items,
    ...config,
  };
  const report = buildDamageReport(session.items, session);
  return createSavedSession(
    session,
    report,
    getVerdict(report.totalRetailValue, report.totalAdmission),
    { id, createdAt },
  );
}

const LAST_VISIT = filed('last', '2026-08-10T12:00:00.000Z', [line('beef-ribeye', 4)]);
const THIS_VISIT = filed('this', '2026-08-16T12:00:00.000Z', [
  line('beef-ribeye', 6),
  line('seafood-prawns', 2),
]);

function metricOf(comparison: ReturnType<typeof compareSessions>, id: string) {
  const found = comparison.metrics.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`No metric named ${id}`);
  }
  return found;
}

describe('compareSessions', () => {
  const comparison = compareSessions(LAST_VISIT, THIS_VISIT);

  it('reports plate counts on both sides and their difference', () => {
    const plates = metricOf(comparison, 'plates');

    expect(plates.previous).toBe(4);
    expect(plates.current).toBe(8);
    expect(plates.delta).toBe(4);
    expect(plates.relativeChange).toBeCloseTo(100, 5);
  });

  it('measures retail recovery in percentage points, not proportionally', () => {
    const recovery = metricOf(comparison, 'recovery');

    // 4 x 155 g x $52/kg = $32.24 of $59.90 = 53.8%
    expect(recovery.previous).toBeCloseTo(53.83, 1);
    // 6 ribeye + 2 prawn plates = $48.36 + $9.30 = $57.66 of $59.90 = 96.3%
    expect(recovery.current).toBeCloseTo(96.26, 1);
    expect(recovery.delta).toBeCloseTo(42.43, 1);
    expect(recovery.unit).toBe('percentagePoints');
    // Deliberately withheld: a proportional change of a percentage would read
    // as though recovery rose 79%, which is a different claim.
    expect(recovery.relativeChange).toBeNull();
  });

  it('compares admission without treating a change as the diner winning', () => {
    expect(metricOf(comparison, 'admission').bias).toBe('neutral');
    expect(metricOf(comparison, 'retail').bias).toBe('diner');
  });

  it('recalculates both sides rather than trusting stored snapshots', () => {
    const tampered: SavedMealSession = {
      ...THIS_VISIT,
      snapshot: { ...THIS_VISIT.snapshot, totalPlates: 999 },
    };

    expect(metricOf(compareSessions(LAST_VISIT, tampered), 'plates').current).toBe(8);
  });

  it('breaks the meal down by category, including untouched ones', () => {
    const beef = comparison.categories.find((entry) => entry.id === 'beef');
    const seafood = comparison.categories.find((entry) => entry.id === 'seafood');
    const chicken = comparison.categories.find((entry) => entry.id === 'chicken');

    expect(beef).toMatchObject({ previousPlates: 4, currentPlates: 6, delta: 2 });
    expect(seafood).toMatchObject({ previousPlates: 0, currentPlates: 2, delta: 2 });
    expect(chicken).toMatchObject({ previousPlates: 0, currentPlates: 0, delta: 0 });
  });

  it('notes when the verdict itself moved', () => {
    expect(comparison.verdictChanged).toBe(true);
    expect(compareSessions(LAST_VISIT, LAST_VISIT).verdictChanged).toBe(false);
  });

  it('handles a comparison against an identical session', () => {
    const same = compareSessions(LAST_VISIT, LAST_VISIT);

    expect(metricOf(same, 'plates').delta).toBe(0);
    expect(metricOf(same, 'recovery').delta).toBe(0);
    expect(same.summary).toBe('Broadly consistent with the previous incident.');
  });

  it('compares fairly when the two visits had different admission prices', () => {
    const cheap = filed('cheap', '2026-08-10T12:00:00.000Z', [line('beef-ribeye', 4)], {
      pricePerDiner: 30,
    });
    const dear = filed('dear', '2026-08-16T12:00:00.000Z', [line('beef-ribeye', 4)], {
      pricePerDiner: 60,
    });
    const result = compareSessions(cheap, dear);

    // Identical meals, so the volume metrics must not move.
    expect(metricOf(result, 'plates').delta).toBe(0);
    expect(metricOf(result, 'retail').delta).toBeCloseTo(0, 5);
    // Recovery halves, because the denominator doubled.
    expect(metricOf(result, 'recovery').previous).toBeCloseTo(107.47, 1);
    expect(metricOf(result, 'recovery').current).toBeCloseTo(53.73, 1);
    expect(metricOf(result, 'admission').delta).toBeCloseTo(30, 5);
  });

  it('reports no proportional change when a metric held steady', () => {
    const same = compareSessions(LAST_VISIT, LAST_VISIT);

    expect(metricOf(same, 'retail').relativeChange).toBe(0);
    expect(metricOf(same, 'plates').relativeChange).toBe(0);
  });
});

describe('summariseRecoveryShift', () => {
  it.each([
    [45, 'This visit materially outperformed the previous incident.'],
    [25, 'This visit materially outperformed the previous incident.'],
    [10, 'A measurable improvement on the previous visit.'],
    [0, 'Broadly consistent with the previous incident.'],
    [-4.9, 'Broadly consistent with the previous incident.'],
    [-10, 'A softer showing than last time. Procurement is relieved.'],
    [-60, 'The house has recovered considerable ground.'],
  ])('reads a %s point shift deterministically', (points, expected) => {
    expect(summariseRecoveryShift(points)).toBe(expected);
  });

  it('never emits nonsense for a non-finite shift', () => {
    expect(summariseRecoveryShift(Number.NaN)).toBe(
      'Broadly consistent with the previous incident.',
    );
  });
});

describe('orderByRecordedAt', () => {
  it('puts the earlier session first regardless of argument order', () => {
    expect(orderByRecordedAt(THIS_VISIT, LAST_VISIT).map((r) => r.id)).toEqual(['last', 'this']);
    expect(orderByRecordedAt(LAST_VISIT, THIS_VISIT).map((r) => r.id)).toEqual(['last', 'this']);
  });
});

describe('delta formatting', () => {
  it.each([
    [5, 'currency', '+$5.00'],
    [-5, 'currency', '-$5.00'],
    [0, 'currency', '+$0.00'],
    [0.37, 'kilograms', '+0.37 kg'],
    [-0.37, 'kilograms', '-0.37 kg'],
    [59, 'grams', '+59 g'],
    [38, 'percentagePoints', '+38 percentage points'],
    [1, 'percentagePoints', '+1 percentage point'],
    [-38, 'percentagePoints', '-38 percentage points'],
    [5, 'count', '+5'],
  ] as const)('renders %s as %s', (value, unit, expected) => {
    expect(formatDelta(value, unit)).toBe(expected);
  });

  it('never shows a negative zero', () => {
    expect(formatDelta(-0, 'currency')).toBe('+$0.00');
    expect(formatDelta(-0, 'percentagePoints')).toBe('+0 percentage points');
  });

  it('renders each metric in its own unit', () => {
    expect(formatMetricValue(18, 'count')).toBe('18');
    expect(formatMetricValue(1.324, 'kilograms')).toBe('1.32 kg');
    expect(formatMetricValue(134.4, 'percentagePoints')).toBe('134%');
    expect(formatMetricValue(82.4, 'currency')).toBe('$82.40');
    expect(formatMetricValue(212.6, 'grams')).toBe('213 g');
  });
});
