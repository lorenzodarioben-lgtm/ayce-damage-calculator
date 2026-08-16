import type { AchievementId } from '@/lib/achievements';
import type { VerdictId } from '@/lib/verdicts';
import type { MealItem, Nutrition } from '@/types/meal';

/**
 * What the diner was actually shown when the session was recorded.
 *
 * Kept alongside the canonical meal rather than instead of it. Totals are
 * normally recomputed from `items` so history always reflects the current
 * engine, but a record whose food is later retired from the dataset would
 * otherwise lose those plates silently — the snapshot is what preserves them.
 */
export interface SavedSessionSnapshot {
  readonly totalAdmission: number;
  readonly totalRetailValue: number;
  readonly totalRestaurantCost: number;
  readonly totalPlates: number;
  readonly totalWeightKg: number;
  readonly retailRecoveryPercent: number;
  readonly nutrition: Nutrition;
  readonly verdictId: VerdictId;
  /** What the session earned when it was filed. Added in schema version 2. */
  readonly achievementIds: readonly AchievementId[];
}

export interface SavedMealSession {
  readonly id: string;
  /** Schema version of this record, independent of the database version. */
  readonly version: number;
  /** ISO-8601 timestamp of when the session was recorded. */
  readonly createdAt: string;

  readonly restaurantName: string;
  readonly pricePerDiner: number;
  readonly dinerCount: number;

  readonly items: readonly MealItem[];

  /**
   * Identifies the same meal recorded twice. Saving a report repeatedly must
   * not produce a pile of identical records.
   */
  readonly fingerprint: string;

  readonly snapshot: SavedSessionSnapshot;
}

export type HistorySortKey = 'newest' | 'recovery' | 'plates';
