import { CATEGORY_META, QUALITY_TIERS } from '@/lib/constants';
import { resolveSavedSession } from '@/lib/history';
import type { SavedMealSession } from '@/types/history';
import type { FoodCategory, QualityTier } from '@/types/meal';

/**
 * Everything on the analytics page, derived from filed history.
 *
 * Purely a fold over the records: nothing is estimated, extrapolated or
 * invented, and every session is recalculated from its own meal so the figures
 * agree with the rest of the app.
 */

export interface Tally<Id extends string> {
  readonly id: Id;
  readonly label: string;
  readonly plates: number;
  /** Share of all recorded plates, 0–100. Zero when nothing is recorded. */
  readonly share: number;
}

export interface FoodTally {
  readonly foodId: string;
  readonly name: string;
  readonly plates: number;
}

export interface TrendPoint {
  readonly id: string;
  readonly recordedAt: string;
  readonly recoveryPercent: number;
}

export interface SessionHighlight {
  readonly id: string;
  readonly label: string;
  readonly recordedAt: string;
  readonly value: number;
}

export interface HistoryAnalytics {
  readonly sessionCount: number;
  readonly totalPlates: number;
  readonly totalWeightKg: number;
  readonly totalProteinG: number;
  readonly averageRecoveryPercent: number;
  readonly bestRecoveryPercent: number;
  readonly averageWeightKg: number;
  readonly sessionsAtBreakEven: number;
  readonly best: SessionHighlight | null;
  readonly mostPlates: SessionHighlight | null;
  readonly topFoods: readonly FoodTally[];
  readonly categories: readonly Tally<FoodCategory>[];
  readonly qualities: readonly Tally<QualityTier>[];
  /** Oldest to newest, so a chart reads left to right. */
  readonly trend: readonly TrendPoint[];
}

/** How many recent sessions the trend chart shows. */
export const TREND_LENGTH = 10;

/** How many foods the "most ordered" list names. */
export const TOP_FOOD_LENGTH = 5;

export const EMPTY_ANALYTICS: HistoryAnalytics = {
  sessionCount: 0,
  totalPlates: 0,
  totalWeightKg: 0,
  totalProteinG: 0,
  averageRecoveryPercent: 0,
  bestRecoveryPercent: 0,
  averageWeightKg: 0,
  sessionsAtBreakEven: 0,
  best: null,
  mostPlates: null,
  topFoods: [],
  categories: [],
  qualities: [],
  trend: [],
};

function share(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function describe(record: SavedMealSession): string {
  return record.restaurantName || 'Unnamed restaurant';
}

export function buildHistoryAnalytics(records: readonly SavedMealSession[]): HistoryAnalytics {
  if (records.length === 0) {
    return EMPTY_ANALYTICS;
  }

  const resolved = records.map(resolveSavedSession);

  let totalPlates = 0;
  let totalWeightKg = 0;
  let totalProteinG = 0;
  let recoverySum = 0;
  let bestRecoveryPercent = 0;
  let sessionsAtBreakEven = 0;

  let best: SessionHighlight | null = null;
  let mostPlates: SessionHighlight | null = null;

  const platesByFood = new Map<string, { name: string; plates: number }>();
  const platesByCategory = new Map<FoodCategory, number>();
  const platesByQuality = new Map<QualityTier, number>();

  for (const { record, report } of resolved) {
    totalPlates += report.totalPlates;
    totalWeightKg += report.totalWeightKg;
    totalProteinG += report.nutrition.protein;
    recoverySum += report.retailRecoveryPercent;

    if (report.retailRecoveryPercent >= 100) {
      sessionsAtBreakEven += 1;
    }
    if (report.retailRecoveryPercent > bestRecoveryPercent) {
      bestRecoveryPercent = report.retailRecoveryPercent;
    }

    if (!best || report.retailRecoveryPercent > best.value) {
      best = {
        id: record.id,
        label: describe(record),
        recordedAt: record.createdAt,
        value: report.retailRecoveryPercent,
      };
    }
    if (!mostPlates || report.totalPlates > mostPlates.value) {
      mostPlates = {
        id: record.id,
        label: describe(record),
        recordedAt: record.createdAt,
        value: report.totalPlates,
      };
    }

    for (const line of report.lines) {
      const food = platesByFood.get(line.food.id);
      platesByFood.set(line.food.id, {
        name: line.food.name,
        plates: (food?.plates ?? 0) + line.plates,
      });
      platesByCategory.set(
        line.food.category,
        (platesByCategory.get(line.food.category) ?? 0) + line.plates,
      );
      platesByQuality.set(
        line.item.quality,
        (platesByQuality.get(line.item.quality) ?? 0) + line.plates,
      );
    }
  }

  const topFoods = [...platesByFood.entries()]
    .map(([foodId, entry]) => ({ foodId, name: entry.name, plates: entry.plates }))
    // Ties are broken by name so the order is stable between renders.
    .sort((a, b) => b.plates - a.plates || a.name.localeCompare(b.name))
    .slice(0, TOP_FOOD_LENGTH);

  const categories = CATEGORY_META.map((category) => {
    const plates = platesByCategory.get(category.id) ?? 0;
    return { id: category.id, label: category.label, plates, share: share(plates, totalPlates) };
  });

  const qualities = QUALITY_TIERS.map((tier) => {
    const plates = platesByQuality.get(tier.id) ?? 0;
    return { id: tier.id, label: tier.label, plates, share: share(plates, totalPlates) };
  });

  const trend = [...resolved]
    .sort((a, b) => Date.parse(a.record.createdAt) - Date.parse(b.record.createdAt))
    .slice(-TREND_LENGTH)
    .map(({ record, report }) => ({
      id: record.id,
      recordedAt: record.createdAt,
      recoveryPercent: report.retailRecoveryPercent,
    }));

  return {
    sessionCount: records.length,
    totalPlates,
    totalWeightKg,
    totalProteinG,
    averageRecoveryPercent: recoverySum / records.length,
    bestRecoveryPercent,
    averageWeightKg: totalWeightKg / records.length,
    sessionsAtBreakEven,
    best,
    mostPlates,
    topFoods,
    categories,
    qualities,
    trend,
  };
}
