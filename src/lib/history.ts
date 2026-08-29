import {
  evaluateAchievementIds,
  isAchievementId,
  resolveAchievementIds,
  type Achievement,
  type AchievementId,
} from '@/lib/achievements';
import { buildDamageReport, clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import {
  MAX_DINERS,
  MAX_LINE_QUANTITY,
  MAX_SESSION_NOTE_LENGTH,
  MIN_QUANTITY,
  isPlateSize,
  isQualityTier,
} from '@/lib/constants';
import { parseAdjustments } from '@/lib/adjustments';
import { consumedQuantity, normaliseConsumedQuantity } from '@/lib/consumption';
import { normaliseSeparateCharge, separateCharge } from '@/lib/separateCharges';
import { sanitiseRestaurantName } from '@/lib/storage';
import { isIsoTimestamp } from '@/lib/datetime';
import { findFoodInCatalogue, foodCatalogue } from '@/lib/foodCatalogue';
import { mealItemId, mergeMealItems } from '@/lib/mealItems';
import { IDLE_LIFECYCLE, parseMealEvents, parseMealLifecycle } from '@/lib/mealEvents';
import { parseMealDuration } from '@/lib/pacing';
import { isRestaurantId } from '@/lib/restaurants';
import {
  isDinerId,
  normaliseAllocations,
  normaliseDinerName,
  normaliseSharedAmong,
  reconcileItemAllocations,
} from '@/lib/diners';
import { DEFAULT_PRICING_PROFILE, DEFAULT_PRICING_PROFILE_ID } from '@/lib/pricing';
import { parseCustomPricingProfile } from '@/lib/pricingProfiles';
import { MAX_CUSTOM_FOODS, parseCustomFood } from '@/lib/customFoods';
import { getVerdict, isVerdictId, type Verdict } from '@/lib/verdicts';
import { parseSessionTags } from '@/lib/sessionTags';
import type { SavedMealSession, SavedSessionSnapshot } from '@/types/history';
import type {
  DamageReport,
  Diner,
  DinerAllocation,
  FoodItem,
  MealItem,
  MealSession,
  Nutrition,
} from '@/types/meal';
import type { CustomFood } from '@/types/customFoods';
import type { PricingProfile } from '@/types/pricing';

/**
 * Bumped whenever the shape of a stored record changes.
 *
 * 1 — original.
 * 2 — snapshots carry the achievements the session earned.
 * 3 — records carry a free-text note.
 * 4 — records retain a complete pricing context.
 * 5 — records retain custom food entries used by the meal.
 * 6 — records retain the Table Mode roster.
 * 7 — records retain plate attribution and the timestamped meal ledger.
 * 8 — records retain the booked meal duration.
 * 9 — records retain the local restaurant profile the visit belongs to.
 * 10 — records retain the bill adjustments that settled the final total.
 * 11 — records retain how much of each line was actually eaten.
 * 12 — records retain which lines the buffet price did not cover, and what was
 *      paid for them.
 * 13 — records retain diner-authored local tags.
 */
export const SAVED_SESSION_VERSION = 13;

/** Versions `parseSavedSession` knows how to read, current one included. */
export const SUPPORTED_SESSION_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;

/**
 * The first schema that could carry a timeline.
 *
 * Anything older is a legitimate record of a meal that was simply never timed.
 * The replay surfaces say so plainly rather than deriving timestamps from a
 * created-at date the diner never claimed anything about.
 */
export const FIRST_TIMELINE_VERSION = 7;

/** Beyond this the oldest records are pruned, so storage cannot grow forever. */
export const MAX_HISTORY_RECORDS = 200;

/** IDs appear in route segments and IndexedDB keys, so keep their alphabet safe. */
export const MAX_SAVED_SESSION_ID_LENGTH = 100;

function isSavedSessionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_SAVED_SESSION_ID_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

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
    .map(
      (item) =>
        // The separate charge is part of what the meal cost, so a tab whose
        // drinks were paid for is a different record from one whose were not.
        `${item.foodId}:${item.quality}:${item.plateSize}:${item.quantity}:${consumedQuantity(item)}:${
          item.separatelyCharged ? `x${separateCharge(item).toFixed(2)}` : ''
        }`,
    )
    .sort()
    .join('|');

  // Adjustments are part of what the meal cost, so two otherwise identical
  // tabs settled at different totals are different records rather than one
  // overwriting the other. Sorted for the same reason the items are.
  const adjustments = [...(session.adjustments ?? [])]
    .map(
      (entry) =>
        // The basis is part of the identity: ten percent and ten dollars are
        // different lines on a bill, and one must not overwrite the other.
        `${entry.kind}:${entry.basis ?? 'fixed'}:${entry.percentBase ?? ''}:${entry.amount.toFixed(2)}:${entry.label}:${entry.dinerId ?? ''}`,
    )
    .sort()
    .join('|');

  return [
    clampPricePerDiner(session.pricePerDiner).toFixed(2),
    clampDinerCount(session.dinerCount),
    session.pricingProfileId ?? DEFAULT_PRICING_PROFILE_ID,
    items,
    adjustments,
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
  /** The resolved profile, copied rather than merely referenced. */
  readonly pricingProfile?: PricingProfile;
  /** The custom catalogue at filing time; only entries used by this meal are stored. */
  readonly customFoods?: readonly CustomFood[];
  /** Optional local labels. They are never derived from meal data. */
  readonly tags?: readonly string[];
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
    ...(session.restaurantId === undefined ? {} : { restaurantId: session.restaurantId }),
    pricePerDiner: clampPricePerDiner(session.pricePerDiner),
    dinerCount: clampDinerCount(session.dinerCount),
    pricingProfile: options.pricingProfile ?? DEFAULT_PRICING_PROFILE,
    customFoods: (options.customFoods ?? [])
      .filter((food) => session.items.some((item) => item.foodId === food.id))
      .map((food) => ({ ...food })),
    note: sanitiseSessionNote(options.note),
    tags: parseSessionTags(options.tags),
    items: session.items.map((item) => ({ ...item })),
    ...(session.diners ? { diners: session.diners.map((diner) => ({ ...diner })) } : {}),
    // Copied rather than referenced: what the table paid has to stay what it
    // paid, whatever is edited afterwards.
    ...(session.adjustments?.length
      ? { adjustments: session.adjustments.map((entry) => ({ ...entry })) }
      : {}),
    // Copied rather than referenced, for the same reason the pricing snapshot
    // is: what is filed has to stay what happened.
    ...(session.events?.length ? { events: session.events.map((event) => ({ ...event })) } : {}),
    ...(session.lifecycle ? { lifecycle: { ...session.lifecycle } } : {}),
    ...(session.plannedDurationMinutes === undefined
      ? {}
      : { plannedDurationMinutes: session.plannedDurationMinutes }),
    fingerprint: fingerprintSession(session),
    snapshot: buildSnapshot(report, verdict, clampDinerCount(session.dinerCount)),
  };
}

function parseItem(
  value: unknown,
  foods: readonly FoodItem[],
  diners: readonly Diner[],
  version: number,
): MealItem | null {
  if (!isRecord(value)) {
    return null;
  }
  const { foodId, quality, plateSize, quantity } = value;

  if (typeof foodId !== 'string' || !findFoodInCatalogue(foods, foodId)) {
    return null;
  }
  if (!isQualityTier(quality) || !isPlateSize(plateSize)) {
    return null;
  }
  const rawQuantity = finiteOrNull(quantity);
  if (rawQuantity === null) {
    return null;
  }

  const safeQuantity = Math.min(MAX_LINE_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(rawQuantity)));
  // A record filed before version 11 recorded no consumption, which means the
  // plate went clean — the figures it was filed with say exactly that.
  const consumed =
    version >= 11 ? normaliseConsumedQuantity(value.consumedQuantity, safeQuantity) : undefined;
  const charged = normaliseSeparateCharge(value.separateCharge);
  const separate = value.separatelyCharged === true;

  const base = {
    // Who paid for it is part of the line's identity, so a filed extra is not
    // merged back into the included line of the same cut.
    id: mealItemId({
      foodId,
      quality,
      plateSize,
      ...(separate ? { separatelyCharged: true } : {}),
    }),
    foodId,
    quality,
    plateSize,
    quantity: safeQuantity,
    ...(consumed === undefined ? {} : { consumedQuantity: consumed }),
    // A record filed before extras existed was paid for entirely by admission,
    // which is a fact about it rather than a gap in it.
    ...(separate ? { separatelyCharged: true as const } : {}),
    ...(separate && charged !== undefined ? { separateCharge: charged } : {}),
  };
  // Ownership is reconciled against the record's own roster, so a filed table
  // breakdown reads exactly as it did when the meal was recorded.
  const sharedAmong = normaliseSharedAmong(
    Array.isArray(value.sharedAmong) ? (value.sharedAmong as readonly string[]) : undefined,
    diners,
  );
  const allocations = normaliseAllocations(
    Array.isArray(value.allocations)
      ? (value.allocations as readonly DinerAllocation[])
      : undefined,
    safeQuantity,
    diners,
  );
  return {
    ...base,
    ...(allocations.length > 0 ? { allocations } : {}),
    ...(sharedAmong.length > 0 ? { sharedAmong } : {}),
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

function parsePricingSnapshot(value: unknown): PricingProfile {
  if (isRecord(value) && value.id === DEFAULT_PRICING_PROFILE.id) {
    return DEFAULT_PRICING_PROFILE;
  }
  return parseCustomPricingProfile(value) ?? DEFAULT_PRICING_PROFILE;
}

function parseCustomFoodSnapshots(value: unknown): readonly CustomFood[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const foods: CustomFood[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    const food = parseCustomFood(entry);
    if (food && !ids.has(food.id)) {
      ids.add(food.id);
      foods.push(food);
    }
    if (foods.length >= MAX_CUSTOM_FOODS) {
      break;
    }
  }
  return foods;
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

  if (!isSavedSessionId(value.id)) {
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

  const customFoods = version >= 5 ? parseCustomFoodSnapshots(value.customFoods) : [];
  const foods = foodCatalogue(customFoods);
  // Parsed before the items, because plate attribution is only meaningful
  // against a roster that has itself been validated.
  const diners = Array.isArray(value.diners)
    ? value.diners
        .filter(isRecord)
        .map((diner) => ({
          id: typeof diner.id === 'string' ? diner.id : '',
          displayName: normaliseDinerName(diner.displayName),
        }))
        .filter((diner) => isDinerId(diner.id) && diner.displayName)
        .slice(0, MAX_DINERS)
    : [];
  const rawItems = Array.isArray(value.items) ? value.items : [];
  const items = mergeMealItems(
    rawItems
      .map((item) => parseItem(item, foods, diners, version))
      .filter((item): item is MealItem => item !== null),
  ).map((item) => reconcileItemAllocations(item, diners));

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
  const pricingProfile =
    version >= 4 ? parsePricingSnapshot(value.pricingProfile) : DEFAULT_PRICING_PROFILE;

  // Older records predate the ledger entirely. They are kept exactly as they
  // were filed and reported as having no timeline, rather than being given one.
  const events = version >= FIRST_TIMELINE_VERSION ? parseMealEvents(value.events, foods) : [];
  const lifecycle =
    version >= FIRST_TIMELINE_VERSION ? parseMealLifecycle(value.lifecycle) : IDLE_LIFECYCLE;
  const plannedDurationMinutes =
    version >= 8 ? parseMealDuration(value.plannedDurationMinutes) : undefined;
  const linkedRestaurantId =
    version >= 9 && isRestaurantId(value.restaurantId) ? value.restaurantId : undefined;
  // Older records were filed before a bill could carry anything but admission,
  // so an empty list is the truth about them rather than missing data.
  const adjustments = version >= 10 ? parseAdjustments(value.adjustments, diners) : [];
  // Version 10 was published independently with tags on main and adjustments
  // on the feature branch. Both fields are optional and structurally distinct,
  // so retaining each when present is the only lossless migration.
  const tags = version >= 10 ? parseSessionTags(value.tags) : [];

  return {
    id: value.id,
    version: SAVED_SESSION_VERSION,
    createdAt,
    restaurantName,
    ...(linkedRestaurantId === undefined ? {} : { restaurantId: linkedRestaurantId }),
    pricePerDiner: safePrice,
    dinerCount: safeDiners,
    pricingProfile,
    customFoods,
    // Records written before version 3 simply have nothing to say.
    note: sanitiseSessionNote(value.note),
    tags,
    items,
    ...(diners.length ? { diners } : {}),
    ...(adjustments.length ? { adjustments } : {}),
    ...(events.length ? { events } : {}),
    ...(lifecycle.status === 'idle' ? {} : { lifecycle }),
    ...(plannedDurationMinutes === undefined ? {} : { plannedDurationMinutes }),
    fingerprint: fingerprintSession({
      restaurantName,
      pricePerDiner: safePrice,
      dinerCount: safeDiners,
      pricingProfileId: pricingProfile.id,
      items,
      ...(adjustments.length ? { adjustments } : {}),
    }),
    snapshot,
  };
}

/**
 * Recomputes a record's totals from its canonical meal, so history always
 * agrees with the engine rather than with whatever was cached at save time.
 */
export function reportFromSaved(record: SavedMealSession): DamageReport {
  return buildDamageReport(
    record.items,
    {
      pricePerDiner: record.pricePerDiner,
      dinerCount: record.dinerCount,
      ...(record.diners ? { diners: record.diners } : {}),
      ...(record.adjustments?.length ? { adjustments: record.adjustments } : {}),
    },
    record.pricingProfile,
    foodCatalogue(record.customFoods),
  );
}

export function verdictFromSaved(record: SavedMealSession): Verdict {
  const report = reportFromSaved(record);
  return getVerdict(report.totalRetailValue, report.totalAdmission);
}

/**
 * Whether this record was filed with a ledger worth replaying.
 *
 * A record without one is not damaged and not incomplete — it is a meal from
 * before the app timed anything, and the interface says exactly that rather
 * than manufacturing a timeline out of its filing date.
 */
export function hasRecordedTimeline(record: SavedMealSession): boolean {
  return (record.events?.length ?? 0) > 0;
}

/**
 * The meal, ready to be ordered again.
 *
 * Deliberately without the ledger: a new sitting is a new meal, and carrying
 * last month's timestamps into tonight's tab would date a session that has not
 * happened yet.
 */
export function sessionFromSaved(record: SavedMealSession): MealSession {
  return {
    restaurantName: record.restaurantName,
    // The place is carried forward, because ordering the same meal again is
    // still a visit to the same restaurant.
    ...(record.restaurantId === undefined ? {} : { restaurantId: record.restaurantId }),
    pricePerDiner: record.pricePerDiner,
    dinerCount: record.dinerCount,
    pricingProfileId: record.pricingProfile.id,
    // The roster is deliberately not carried forward, so the adjustments come
    // back scoped to the table rather than pointing at diners who are not here.
    ...(record.adjustments?.length
      ? {
          adjustments: record.adjustments.map(({ dinerId: _dinerId, ...entry }) => entry),
        }
      : {}),
    items: record.items.map((item) => {
      const { allocations: _allocations, ...sharedItem } = item;
      return sharedItem;
    }),
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
 * Only what the diner wrote is searched — the restaurant name, note and tags.
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
    const searchable =
      `${record.restaurantName} ${record.note} ${record.tags.join(' ')}`.toLowerCase();
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
