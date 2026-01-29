import type { Achievement } from '@/lib/achievements';
import { CATEGORY_META } from '@/lib/constants';
import { resolveSavedSession, type ResolvedSavedSession } from '@/lib/history';
import type { SavedMealSession } from '@/types/history';
import type { FoodCategory } from '@/types/meal';
import type { MoneyContext } from '@/lib/money';

/**
 * How a metric's difference should be read.
 *
 * `percentagePoints` exists specifically to keep 134% → 172% describable as
 * "+38 percentage points" and never as "+38%", which would mean something else
 * entirely.
 */
export type DeltaUnit = 'currency' | 'kilograms' | 'grams' | 'count' | 'percentagePoints';

/** Whether a larger number is the diner doing better, for colouring only. */
export type DeltaBias = 'diner' | 'neutral';

export interface MetricComparison {
  readonly id: string;
  readonly label: string;
  readonly previous: number;
  readonly current: number;
  /** current − previous, unavailable where two currency values cannot compare. */
  readonly delta: number | null;
  readonly unit: DeltaUnit;
  readonly bias: DeltaBias;
  /**
   * Proportional change against the earlier value, as a percentage.
   *
   * Null when there is no meaningful baseline (a zero previous value) and null
   * for `percentagePoints` metrics, where a proportional change of a percentage
   * invites exactly the misreading this module is trying to prevent.
   */
  readonly relativeChange: number | null;
  /** Currency metrics only compare across matching currency codes. */
  readonly comparable: boolean;
  readonly previousMoney?: MoneyContext;
  readonly currentMoney?: MoneyContext;
}

export interface CategoryComparison {
  readonly id: FoodCategory;
  readonly label: string;
  readonly previousPlates: number;
  readonly currentPlates: number;
  readonly delta: number;
}

/**
 * What each side earned, and what moved between them.
 *
 * Kept as three explicit lists rather than a diff the caller has to work out,
 * because "gained" and "lost" are the interesting halves and computing them
 * twice invites two answers.
 */
export interface AchievementComparison {
  readonly previous: readonly Achievement[];
  readonly current: readonly Achievement[];
  readonly gained: readonly Achievement[];
  readonly kept: readonly Achievement[];
  readonly lost: readonly Achievement[];
}

export interface SessionComparison {
  readonly previous: ResolvedSavedSession;
  readonly current: ResolvedSavedSession;
  readonly metrics: readonly MetricComparison[];
  readonly categories: readonly CategoryComparison[];
  readonly achievements: AchievementComparison;
  readonly verdictChanged: boolean;
  /** A deterministic one-line reading of the recovery difference. */
  readonly summary: string;
}

function relativeChange(
  previous: number,
  current: number,
  unit: DeltaUnit,
  comparable: boolean,
): number | null {
  if (!comparable) {
    return null;
  }
  if (unit === 'percentagePoints') {
    return null;
  }
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

function metric(
  id: string,
  label: string,
  previous: number,
  current: number,
  unit: DeltaUnit,
  bias: DeltaBias,
  money?: { readonly previous: MoneyContext; readonly current: MoneyContext },
): MetricComparison {
  const safePrevious = Number.isFinite(previous) ? previous : 0;
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const comparable = unit !== 'currency' || money?.previous.currency === money?.current.currency;

  return {
    id,
    label,
    previous: safePrevious,
    current: safeCurrent,
    delta: comparable ? safeCurrent - safePrevious : null,
    unit,
    bias,
    relativeChange: relativeChange(safePrevious, safeCurrent, unit, comparable),
    comparable,
    ...(money ? { previousMoney: money.previous, currentMoney: money.current } : {}),
  };
}

/** How many distinct cuts the meal touched, whatever the volume of each. */
function foodDiversity(resolved: ResolvedSavedSession): number {
  return new Set(resolved.report.lines.map((line) => line.food.id)).size;
}

function compareAchievements(
  previous: ResolvedSavedSession,
  current: ResolvedSavedSession,
): AchievementComparison {
  const before = new Set(previous.achievements.map((achievement) => achievement.id));
  const after = new Set(current.achievements.map((achievement) => achievement.id));

  return {
    previous: previous.achievements,
    current: current.achievements,
    gained: current.achievements.filter((achievement) => !before.has(achievement.id)),
    kept: current.achievements.filter((achievement) => before.has(achievement.id)),
    lost: previous.achievements.filter((achievement) => !after.has(achievement.id)),
  };
}

function platesByCategory(resolved: ResolvedSavedSession): Map<FoodCategory, number> {
  const counts = new Map<FoodCategory, number>();
  for (const line of resolved.report.lines) {
    counts.set(line.food.category, (counts.get(line.food.category) ?? 0) + line.plates);
  }
  return counts;
}

const SUMMARIES: ReadonlyArray<{ minPoints: number; copy: string }> = [
  { minPoints: 25, copy: 'This visit materially outperformed the previous incident.' },
  { minPoints: 5, copy: 'A measurable improvement on the previous visit.' },
  { minPoints: -5, copy: 'Broadly consistent with the previous incident.' },
  { minPoints: -25, copy: 'A softer showing than last time. Procurement is relieved.' },
  { minPoints: Number.NEGATIVE_INFINITY, copy: 'The house has recovered considerable ground.' },
];

export function summariseRecoveryShift(pointsDelta: number): string {
  const safe = Number.isFinite(pointsDelta) ? pointsDelta : 0;
  return SUMMARIES.find((entry) => safe >= entry.minPoints)?.copy ?? 'Comparison unavailable.';
}

/**
 * Compares two filed sessions.
 *
 * Both sides are recalculated from their canonical meals rather than read from
 * their stored snapshots, so a comparison is always like-for-like even if the
 * two records were filed under different versions of the app.
 */
export function compareSessions(
  previousRecord: SavedMealSession,
  currentRecord: SavedMealSession,
): SessionComparison {
  const previous = resolveSavedSession(previousRecord);
  const current = resolveSavedSession(currentRecord);

  const metrics: MetricComparison[] = [
    metric(
      'plates',
      'Plates',
      previous.report.totalPlates,
      current.report.totalPlates,
      'count',
      'diner',
    ),
    metric(
      'weight',
      'Food consumed',
      previous.report.totalWeightKg,
      current.report.totalWeightKg,
      'kilograms',
      'diner',
    ),
    metric(
      'recovery',
      'Retail recovery',
      previous.report.retailRecoveryPercent,
      current.report.retailRecoveryPercent,
      'percentagePoints',
      'diner',
    ),
    metric(
      'retail',
      'Est. retail value',
      previous.report.totalRetailValue,
      current.report.totalRetailValue,
      'currency',
      'diner',
      {
        previous: previous.record.pricingProfile.money,
        current: current.record.pricingProfile.money,
      },
    ),
    metric(
      'admission',
      'Admission',
      previous.report.totalAdmission,
      current.report.totalAdmission,
      'currency',
      'neutral',
      {
        previous: previous.record.pricingProfile.money,
        current: current.record.pricingProfile.money,
      },
    ),
    metric(
      'ingredientCost',
      'Est. ingredient cost',
      previous.report.totalRestaurantCost,
      current.report.totalRestaurantCost,
      'currency',
      'diner',
      {
        previous: previous.record.pricingProfile.money,
        current: current.record.pricingProfile.money,
      },
    ),
    metric(
      'protein',
      'Protein',
      previous.report.nutrition.protein,
      current.report.nutrition.protein,
      'grams',
      'neutral',
    ),
    metric(
      'calories',
      'Calories',
      previous.report.nutrition.calories,
      current.report.nutrition.calories,
      'count',
      'neutral',
    ),
    metric(
      'diversity',
      'Distinct cuts',
      foodDiversity(previous),
      foodDiversity(current),
      'count',
      'diner',
    ),
  ];

  const previousPlates = platesByCategory(previous);
  const currentPlates = platesByCategory(current);

  const categories: CategoryComparison[] = CATEGORY_META.map((category) => {
    const before = previousPlates.get(category.id) ?? 0;
    const after = currentPlates.get(category.id) ?? 0;
    return {
      id: category.id,
      label: category.label,
      previousPlates: before,
      currentPlates: after,
      delta: after - before,
    };
    // Categories absent from both sessions are filtered by the caller, so the
    // full set stays available for anything that wants a complete axis.
  });

  const recovery = metrics.find((entry) => entry.id === 'recovery');

  return {
    previous,
    current,
    metrics,
    categories,
    achievements: compareAchievements(previous, current),
    verdictChanged: previous.verdict.id !== current.verdict.id,
    summary: summariseRecoveryShift(recovery?.delta ?? 0),
  };
}

/** Orders two records so the comparison always reads oldest → newest. */
export function orderByRecordedAt(
  a: SavedMealSession,
  b: SavedMealSession,
): [SavedMealSession, SavedMealSession] {
  return Date.parse(a.createdAt) <= Date.parse(b.createdAt) ? [a, b] : [b, a];
}
