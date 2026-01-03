import { findFood } from '@/data/foods';
import { buildDamageReport, clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import { MAX_LINE_QUANTITY, MIN_QUANTITY, isPlateSize, isQualityTier } from '@/lib/constants';
import { sanitiseRestaurantName } from '@/lib/storage';
import { getVerdict, isVerdictId, type Verdict } from '@/lib/verdicts';
import type { SavedMealSession, SavedSessionSnapshot } from '@/types/history';
import type { DamageReport, MealItem, MealSession, Nutrition } from '@/types/meal';

/** Bumped whenever the shape of a stored record changes. */
export const SAVED_SESSION_VERSION = 1;

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

export function buildSnapshot(report: DamageReport, verdict: Verdict): SavedSessionSnapshot {
  return {
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

export interface CreateSavedSessionOptions {
  readonly id: string;
  readonly createdAt: string;
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
    items: session.items.map((item) => ({ ...item })),
    fingerprint: fingerprintSession(session),
    snapshot: buildSnapshot(report, verdict),
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

function parseSnapshot(value: unknown): SavedSessionSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  if (!isVerdictId(value.verdictId)) {
    return null;
  }

  return {
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
  if (value.version !== SAVED_SESSION_VERSION) {
    return null;
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    return null;
  }

  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : null;
  if (createdAt === null || Number.isNaN(Date.parse(createdAt))) {
    return null;
  }

  const pricePerDiner = finiteOrNull(value.pricePerDiner);
  const dinerCount = finiteOrNull(value.dinerCount);
  if (pricePerDiner === null || dinerCount === null) {
    return null;
  }

  const snapshot = parseSnapshot(value.snapshot);
  if (snapshot === null) {
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

  const restaurantName = sanitiseRestaurantName(value.restaurantName);

  return {
    id: value.id,
    version: SAVED_SESSION_VERSION,
    createdAt,
    restaurantName,
    pricePerDiner: clampPricePerDiner(pricePerDiner),
    dinerCount: clampDinerCount(dinerCount),
    items,
    fingerprint:
      typeof value.fingerprint === 'string' && value.fingerprint.length > 0
        ? value.fingerprint
        : fingerprintSession({
            restaurantName,
            pricePerDiner: clampPricePerDiner(pricePerDiner),
            dinerCount: clampDinerCount(dinerCount),
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
}

export function resolveSavedSession(record: SavedMealSession): ResolvedSavedSession {
  const report = reportFromSaved(record);
  return { record, report, verdict: getVerdict(report.totalRetailValue, report.totalAdmission) };
}

export function sortSavedSessions(
  records: readonly SavedMealSession[],
  key: 'newest' | 'recovery' | 'plates',
): SavedMealSession[] {
  const resolved = records.map(resolveSavedSession);

  const compare: Record<typeof key, (a: ResolvedSavedSession, b: ResolvedSavedSession) => number> =
    {
      newest: (a, b) => Date.parse(b.record.createdAt) - Date.parse(a.record.createdAt),
      recovery: (a, b) => b.report.retailRecoveryPercent - a.report.retailRecoveryPercent,
      plates: (a, b) => b.report.totalPlates - a.report.totalPlates,
    };

  return [...resolved].sort(compare[key]).map((entry) => entry.record);
}
