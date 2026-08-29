import { buildHistoryAnalytics, type HistoryAnalytics } from '@/lib/analytics';
import { resolveSavedSession } from '@/lib/history';
import { restaurantId, type RestaurantProfile } from '@/lib/restaurants';
import type { SavedMealSession } from '@/types/history';
import type { MoneyContext } from '@/lib/money';
import { DEFAULT_MONEY_CONTEXT } from '@/lib/money';

/**
 * What the file says about one place.
 *
 * Everything here is a fold over records the diner already has. Nothing is
 * fetched, nothing is inferred about the restaurant itself, and each visit is
 * recalculated from its own meal so a place's history agrees with the rest of
 * the app rather than with whatever was cached at the time.
 */

export interface RestaurantSummary {
  readonly profile: RestaurantProfile;
  readonly visits: number;
  readonly firstVisitAt: string | null;
  readonly latestVisitAt: string | null;
  readonly averageAdmission: number;
  readonly averageRecoveryPercent: number;
  readonly bestRecoveryPercent: number;
  readonly averagePlates: number;
  readonly averageWeightKg: number;
  /** Categories, most-ordered foods and the recovery trend, over these visits only. */
  readonly analytics: HistoryAnalytics;
  /** Newest first, so the page can show the recent ones without re-sorting. */
  readonly records: readonly SavedMealSession[];
  /** The currency the most recent visit was recorded in. */
  readonly money: MoneyContext;
}

export interface RestaurantComparison {
  readonly left: RestaurantSummary;
  readonly right: RestaurantSummary;
}

/** Compares two saved profiles; each side only includes explicitly linked visits. */
export function compareRestaurants(
  left: RestaurantProfile,
  right: RestaurantProfile,
  records: readonly SavedMealSession[],
): RestaurantComparison {
  return {
    left: buildRestaurantSummary(left, records),
    right: buildRestaurantSummary(right, records),
  };
}

function safeAverage(total: number, count: number): number {
  return count > 0 && Number.isFinite(total) ? total / count : 0;
}

/**
 * The visits that belong to a profile.
 *
 * Membership is an explicit link recorded on the record, never a name match.
 * Two restaurants can share a name, and a filed record's own name is a snapshot
 * of what was typed that night — neither is evidence of identity.
 */
export function restaurantVisits(
  records: readonly SavedMealSession[],
  id: string,
): readonly SavedMealSession[] {
  return records.filter((record) => record.restaurantId === id);
}

/**
 * Records that look like they might belong here, for the diner to confirm.
 *
 * Offered as candidates and nothing more: they are only ever linked when
 * someone says so, which is the whole difference between a suggestion and an
 * assumption.
 */
export function unlinkedVisitCandidates(
  records: readonly SavedMealSession[],
  profile: RestaurantProfile,
): readonly SavedMealSession[] {
  return records.filter(
    (record) =>
      record.restaurantId === undefined && restaurantId(record.restaurantName) === profile.id,
  );
}

export function buildRestaurantSummary(
  profile: RestaurantProfile,
  records: readonly SavedMealSession[],
): RestaurantSummary {
  const visits = [...restaurantVisits(records, profile.id)].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const resolved = visits.map(resolveSavedSession);

  let admissionTotal = 0;
  let recoveryTotal = 0;
  let platesTotal = 0;
  let weightTotal = 0;
  let bestRecoveryPercent = 0;

  for (const { report } of resolved) {
    admissionTotal += report.totalAdmission;
    recoveryTotal += report.retailRecoveryPercent;
    platesTotal += report.totalPlates;
    weightTotal += report.totalWeightKg;
    if (report.retailRecoveryPercent > bestRecoveryPercent) {
      bestRecoveryPercent = report.retailRecoveryPercent;
    }
  }

  const count = visits.length;

  return {
    profile,
    visits: count,
    firstVisitAt: visits[count - 1]?.createdAt ?? null,
    latestVisitAt: visits[0]?.createdAt ?? null,
    averageAdmission: safeAverage(admissionTotal, count),
    averageRecoveryPercent: safeAverage(recoveryTotal, count),
    bestRecoveryPercent,
    averagePlates: safeAverage(platesTotal, count),
    averageWeightKg: safeAverage(weightTotal, count),
    analytics: buildHistoryAnalytics(visits),
    records: visits,
    money: visits[0]?.pricingProfile.money ?? DEFAULT_MONEY_CONTEXT,
  };
}

/** Every profile with its visit count, most recently visited first. */
export function summariseRestaurants(
  profiles: readonly RestaurantProfile[],
  records: readonly SavedMealSession[],
): readonly RestaurantSummary[] {
  return profiles
    .map((profile) => buildRestaurantSummary(profile, records))
    .sort((a, b) => {
      const latest = Date.parse(b.latestVisitAt ?? '') || 0;
      const previous = Date.parse(a.latestVisitAt ?? '') || 0;
      // Never-visited places fall to the bottom, then by name so the order is
      // stable rather than dependent on insertion.
      return latest - previous || a.profile.name.localeCompare(b.profile.name);
    });
}

/**
 * Records that name a restaurant which no longer has a profile.
 *
 * Deleting a profile is not allowed to touch the file, so these keep their own
 * snapshot and stay readable; this is only how the hub reports them.
 */
export function orphanedVisits(
  records: readonly SavedMealSession[],
  profiles: readonly RestaurantProfile[],
): readonly SavedMealSession[] {
  const known = new Set(profiles.map((profile) => profile.id));
  return records.filter(
    (record) => record.restaurantId !== undefined && !known.has(record.restaurantId),
  );
}
