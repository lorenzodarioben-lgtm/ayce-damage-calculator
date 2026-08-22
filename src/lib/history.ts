import { findFood } from '@/data/foods';
import {
  evaluateAchievementIds,
  isAchievementId,
  resolveAchievementIds,
  type Achievement,
  type AchievementId,
} from '@/lib/achievements';
import { buildDamageReport, clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import {
  MAX_LINE_QUANTITY,
  MAX_SESSION_NOTE_LENGTH,
  MIN_QUANTITY,
  isPlateSize,
  isQualityTier,
} from '@/lib/constants';
import { sanitiseRestaurantName } from '@/lib/storage';
import { isIsoTimestamp } from '@/lib/datetime';
import { getVerdict, isVerdictId, type Verdict } from '@/lib/verdicts';
import type { SavedMealSession, SavedSessionSnapshot } from '@/types/history';
import type { DamageReport, MealItem, MealSession, Nutrition } from '@/types/meal';

/**
 * Bumped whenever the shape of a stored record changes.
 *
 * 1 — original.
 * 2 — snapshots carry the achievements the session earned.
 * 3 — records carry a free-text note.
 */
export const SAVED_SESSION_VERSION = 3;

/** Versions `parseSavedSession` knows how to read, current one included. */
export const SUPPORTED_SESSION_VERSIONS = [1, 2, 3] as const;

/** Beyond this the oldest records are pruned, so storage cannot grow forever. */
export const MAX_HISTORY_RECORDS = 200;

/**
 * Re-saving the same meal inside this window updates the existing record rather
 * than adding another. It is long enough to cover one sitting and short enough
 * that the same order on a later visit is still recorded separately.
 */
export const HISTORY_DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * A stable identity for "this meal, at this price, for this many diners".
 * Items are sorted so tab ordering cannot make an identical meal look new.
 */
export function fingerprintSession(session: MealSession): string {
  const items = [...session.items]
    .map((item) => `${item.foodId}:${item.quality}:${item.plateSize}:${item.quantity}`)
    .sort()
    .join('|');

  return [
    clampPricePerDiner(session.pricePerDiner).toFixed(2),
    clampDinerCount(session.dinerCount),
    items,
  ].join('#');
}

export function buildSnapshot(
  report: DamageReport,
  verdict: Verdict,
  dinerCount: number,
): SavedSessionSnapshot {
  return {
    achievementIds: evaluateAchievementIds(report, dinerCount),
    totalAdmission: report.totalAdmission,
    totalRetailValue: report.totalRetailValue,
    totalRestaurantCost: report.totalRestaurantCost,
    totalPlates: report.totalPlates,
    totalWeightKg: report.totalWeightKg,
    retailRecoveryPercent: report.retailRecoveryPercent,
    nutrition: report.nutrition,
    verdictId: verdict.id,
  };
}

/**
 * Trims a note to something a card can render.
 *
 * Whitespace is collapsed for the same reason the restaurant name collapses it:
 * a pasted paragraph should not be able to stretch the layout it lands in.
 */
export function sanitiseSessionNote(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_SESSION_NOTE_LENGTH);
}

export interface CreateSavedSessionOptions {
  readonly id: string;
  readonly createdAt: string;
  /** What the diner wrote about the meal, if anything. */
  readonly note?: string;
}

export function createSavedSession(
  session: MealSession,
  report: DamageReport,
  verdict: Verdict,
  options: CreateSavedSessionOptions,
): SavedMealSession {
  return {
    id: options.id,
    version: SAVED_SESSION_VERSION,
    createdAt: options.createdAt,
    restaurantName: sanitiseRestaurantName(session.restaurantName),
    pricePerDiner: clampPricePerDiner(session.pricePerDiner),
    dinerCount: clampDinerCount(session.dinerCount),
    note: sanitiseSessionNote(options.note),
    items: session.items.map((item) => ({ ...item })),
    fingerprint: fingerprintSession(session),
    snapshot: buildSnapshot(report, verdict, clampDinerCount(session.dinerCount)),
  };
}

function parseItem(value: unknown, index: number): MealItem | null {
  if (!isRecord(value)) {
    return null;
  }
  const { foodId, quality, plateSize, quantity, id } = value;

  if (typeof foodId !== 'string' || !findFood(foodId)) {
    return null;
  }
  if (!isQualityTier(quality) || !isPlateSize(plateSize)) {
    return null;
  }
  const rawQuantity = finiteOrNull(quantity);
  if (rawQuantity === null) {
    return null;
  }

  return {
    id: typeof id === 'string' && id.length > 0 ? id : `restored-${index}-${foodId}`,
    foodId,
    quality,
    plateSize,
    quantity: Math.min(MAX_LINE_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(rawQuantity))),
  };
}

const ZERO_NUTRITION: Nutrition = { calories: 0, protein: 0, fat: 0, carbs: 0 };

function parseNutrition(value: unknown): Nutrition {
  if (!isRecord(value)) {
    return ZERO_NUTRITION;
  }
  return {
    calories: finiteOrNull(value.calories) ?? 0,
    protein: finiteOrNull(value.protein) ?? 0,
    fat: finiteOrNull(value.fat) ?? 0,
    carbs: finiteOrNull(value.carbs) ?? 0,
  };
}

function parseAchievementIds(value: unknown): readonly AchievementId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  // Ids retired from the engine are dropped rather than rendered as blanks.
  return value.filter(isAchievementId);
}

function parseSnapshot(
  value: unknown,
  achievementIds: readonly AchievementId[],
): SavedSessionSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  if (!isVerdictId(value.verdictId)) {
    return null;
  }

  return {
    achievementIds,
    totalAdmission: finiteOrNull(value.totalAdmission) ?? 0,
    totalRetailValue: finiteOrNull(value.totalRetailValue) ?? 0,
    totalRestaurantCost: finiteOrNull(value.totalRestaurantCost) ?? 0,
    totalPlates: finiteOrNull(value.totalPlates) ?? 0,
    totalWeightKg: finiteOrNull(value.totalWeightKg) ?? 0,
    retailRecoveryPercent: finiteOrNull(value.retailRecoveryPercent) ?? 0,
    nutrition: parseNutrition(value.nutrition),
    verdictId: value.verdictId,
  };
}

/**
 * Validates one stored record. Everything read back from the database is
 * untrusted: it may predate a schema change, have been edited by hand in
 * devtools, or have been restored from a tampered backup file.
 */
export function parseSavedSession(value: unknown): SavedMealSession | null {
  if (!isRecord(value)) {
    return null;
  }

  const version = value.version;
  if (
    typeof version !== 'number' ||
    !SUPPORTED_SESSION_VERSIONS.some((supported) => supported === version)
  ) {
    return null;
  }

  if (typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }

  const createdAt = value.createdAt;
  if (!isIsoTimestamp(createdAt)) {
    return null;
  }

  const pricePerDiner = finiteOrNull(value.pricePerDiner);
  const dinerCount = finiteOrNull(value.dinerCount);
  if (pricePerDiner === null || dinerCount === null) {
    return null;
  }

  const rawItems = Array.isArray(value.items) ? value.items : [];
  const items = rawItems
    .map((item, index) => parseItem(item, index))
    .filter((item): item is MealItem => item !== null);

  // A record whose every line was rejected describes nothing.
  if (items.length === 0) {
    return null;
  }

  const safePrice = clampPricePerDiner(pricePerDiner);
  const safeDiners = clampDinerCount(dinerCount);

  /*
   * Version 1 predates recorded achievements. Because they are derived purely
   * from the meal, an old record can be brought forward exactly rather than
   * being discarded or left with an empty list.
   */
  const achievementIds =
    version >= 2
      ? parseAchievementIds(isRecord(value.snapshot) ? value.snapshot.achievementIds : undefined)
      : evaluateAchievementIds(
          buildDamageReport(items, { pricePerDiner: safePrice, dinerCount: safeDiners }),
          safeDiners,
        );

  const snapshot = parseSnapshot(value.snapshot, achievementIds);
  if (snapshot === null) {
    return null;
  }

  const restaurantName = sanitiseRestaurantName(value.restaurantName);

  return {
    id: value.id,
    version: SAVED_SESSION_VERSION,
    createdAt,
    restaurantName,
    pricePerDiner: safePrice,
    dinerCount: safeDiners,
    // Records written before version 3 simply have nothing to say.
    note: sanitiseSessionNote(value.note),
    items,
    fingerprint:
      typeof value.fingerprint === 'string' && value.fingerprint.length > 0
        ? value.fingerprint
        : fingerprintSession({
            restaurantName,
            pricePerDiner: safePrice,
            dinerCount: safeDiners,
            items,
          }),
    snapshot,
  };
}

/**
 * Recomputes a record's totals from its canonical meal, so history always
 * agrees with the engine rather than with whatever was cached at save time.
 */
export function reportFromSaved(record: SavedMealSession): DamageReport {
  return buildDamageReport(record.items, {
    pricePerDiner: record.pricePerDiner,
    dinerCount: record.dinerCount,
  });
}

export function verdictFromSaved(record: SavedMealSession): Verdict {
  const report = reportFromSaved(record);
  return getVerdict(report.totalRetailValue, report.totalAdmission);
}

export function sessionFromSaved(record: SavedMealSession): MealSession {
  return {
    restaurantName: record.restaurantName,
    pricePerDiner: record.pricePerDiner,
    dinerCount: record.dinerCount,
    items: record.items,
  };
}

export interface ResolvedSavedSession {
  readonly record: SavedMealSession;
  readonly report: DamageReport;
  readonly verdict: Verdict;
  /** What was earned when the session was filed, not what it would earn now. */
  readonly achievements: readonly Achievement[];
}

export function resolveSavedSession(record: SavedMealSession): ResolvedSavedSession {
  const report = reportFromSaved(record);
  return {
    record,
    report,
    verdict: getVerdict(report.totalRetailValue, report.totalAdmission),
    achievements: resolveAchievementIds(record.snapshot.achievementIds),
  };
}

/**
 * Narrows the file to records that answer a query.
 *
 * Only what the diner wrote is searched — the restaurant name and the note.
 * Matching on derived figures would mean "60" quietly selecting every session
 * whose recovery happened to round there, which is not what anyone typing a
 * number into a search box means.
 */
export function filterSessions(
  records: readonly SavedMealSession[],
  query: string,
): readonly SavedMealSession[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return records;
  }

  return records.filter((record) => {
    const searchable = `${record.restaurantName} ${record.note}`.toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

/**
 * Sorts and resolves in one pass.
 *
 * Returning the resolved sessions rather than the bare records matters: every
 * comparison key is derived from a recalculated report, so handing back only
 * the records would force the caller to recompute all of them a second time
 * just to render what was already worked out here.
 */
export function sortResolvedSessions(
  records: readonly SavedMealSession[],
  key: 'newest' | 'recovery' | 'plates',
): ResolvedSavedSession[] {
  const resolved = records.map(resolveSavedSession);

  const compare: Record<typeof key, (a: ResolvedSavedSession, b: ResolvedSavedSession) => number> =
    {
      newest: (a, b) => Date.parse(b.record.createdAt) - Date.parse(a.record.createdAt),
      recovery: (a, b) => b.report.retailRecoveryPercent - a.report.retailRecoveryPercent,
      plates: (a, b) => b.report.totalPlates - a.report.totalPlates,
    };

  return resolved.sort(compare[key]);
}
