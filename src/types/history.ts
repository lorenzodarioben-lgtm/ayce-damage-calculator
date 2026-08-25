import type { AchievementId } from '@/lib/achievements';
import type { VerdictId } from '@/lib/verdicts';
import type { BillAdjustment, Diner, MealItem, Nutrition } from '@/types/meal';
import type { MealEvent, MealLifecycle } from '@/types/mealEvents';
import type { PricingProfile } from '@/types/pricing';
import type { CustomFood } from '@/types/customFoods';

/**
 * What the diner was actually shown when the session was recorded.
 *
 * Kept alongside the canonical meal rather than instead of it. Totals are
 * normally recomputed from `items` so history always reflects the current
 * engine, but a record whose food is later retired from the dataset would
 * otherwise lose those plates silently — the snapshot is what preserves them.
 */
export interface SavedSessionSnapshot {
  /**
   * What the table paid, adjustments included. Identical to base admission for
   * every record filed before adjustments existed.
   */
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
  /**
   * The local restaurant profile this visit belongs to, when the meal was
   * started from one or the diner linked it later. A record never joins a
   * profile because their names happen to match.
   */
  readonly restaurantId?: string;
  readonly pricePerDiner: number;
  readonly dinerCount: number;

  /** A complete local pricing snapshot, so filed totals never drift after edits. */
  readonly pricingProfile: PricingProfile;

  /** Custom catalogue entries used by this meal, copied for a durable record. */
  readonly customFoods: readonly CustomFood[];

  /**
   * What the diner wrote about the meal. Empty when nothing was written, which
   * is the normal case. Added in schema version 3.
   */
  readonly note: string;

  readonly items: readonly MealItem[];
  readonly diners?: readonly Diner[];
  /**
   * What went on and came off the bill. Absent on any record filed before
   * schema version 10 — such a record was paid at its entry price, which is a
   * fact about it rather than a gap in it.
   */
  readonly adjustments?: readonly BillAdjustment[];

  /**
   * How the meal developed, when it was recorded with a ledger. Absent on any
   * record filed before schema version 7 — such a record is explicitly a
   * timeless one, not a meal whose timing was lost.
   */
  readonly events?: readonly MealEvent[];
  /** The lifecycle the meal was in when it was filed. Absent alongside `events`. */
  readonly lifecycle?: MealLifecycle;
  /** The window the table had booked, when they were running against one. */
  readonly plannedDurationMinutes?: number;

  /**
   * Identifies the same meal recorded twice. Saving a report repeatedly must
   * not produce a pile of identical records.
   */
  readonly fingerprint: string;

  readonly snapshot: SavedSessionSnapshot;
}

export type HistorySortKey = 'newest' | 'recovery' | 'plates';
