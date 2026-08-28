import { FOODS } from '@/data/foods';
import { clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import {
  MAX_DINERS,
  MAX_LINE_QUANTITY,
  MAX_RESTAURANT_NAME_LENGTH,
  MIN_QUANTITY,
  isPlateSize,
  isQualityTier,
} from '@/lib/constants';
import { parseAdjustments } from '@/lib/adjustments';
import { normaliseConsumedQuantity } from '@/lib/consumption';
import { mealItemId, mergeMealItems } from '@/lib/mealItems';
import { IDLE_LIFECYCLE, parseMealEvents, parseMealLifecycle } from '@/lib/mealEvents';
import { parseMealDuration } from '@/lib/pacing';
import { isRestaurantId } from '@/lib/restaurants';
import { findFoodInCatalogue } from '@/lib/foodCatalogue';
import {
  isDinerId,
  normaliseAllocations,
  normaliseSharedAmong,
  normaliseDinerName,
  reconcileItemAllocations,
} from '@/lib/diners';
import type { Diner, DinerAllocation, FoodItem } from '@/types/meal';
import { DEFAULT_PRICING_PROFILE_ID, isPricingProfileId } from '@/lib/pricing';
import { normaliseSeparateCharge } from '@/lib/separateCharges';
import type { MealItem, MealSession } from '@/types/meal';

export const STORAGE_KEY = 'ayce-damage-calculator';

/**
 * 1 — the original tab.
 * 2 — pricing context.
 * 3 — the Table Mode roster and plate attribution.
 * 4 — the timestamped meal event ledger and lifecycle metadata.
 * 5 — the optional booked meal duration.
 * 6 — the local restaurant profile the meal was started from.
 * 7 — bill adjustments: charges and discounts alongside admission.
 * 8 — how much of each line was actually eaten.
 * 9 — which lines the buffet price did not cover, and what was paid for them.
 */
export const STORAGE_VERSION = 9;

/** Versions `parseStoredSession` can read, current one included. */
export const SUPPORTED_STORAGE_VERSIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * A tab is small; a full evening's ledger is still only tens of kilobytes.
 * Generous enough for the longest bounded meal, and a hard stop before parsing
 * an entry someone has edited into something else.
 */
export const MAX_STORED_SESSION_LENGTH = 192 * 1024;

interface StoredEnvelope {
  version: number;
  session: MealSession;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitiseRestaurantName(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  // Collapse whitespace so pasted names cannot break the report layout.
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_RESTAURANT_NAME_LENGTH);
}

/**
 * Normalises an in-progress field without swallowing the space a diner has
 * just typed before the next word. Completed and persisted names use the
 * fully trimmed form above.
 */
export function normaliseRestaurantNameInput(value: string): string {
  return value.replace(/\s+/g, ' ').trimStart().slice(0, MAX_RESTAURANT_NAME_LENGTH);
}

function parseDiners(value: unknown): readonly Diner[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const diners: Diner[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry) || !isDinerId(entry.id) || ids.has(entry.id)) {
      continue;
    }
    const displayName = normaliseDinerName(entry.displayName);
    if (!displayName) {
      continue;
    }
    ids.add(entry.id);
    const admissionPrice =
      typeof entry.admissionPrice === 'number' &&
      Number.isFinite(entry.admissionPrice) &&
      entry.admissionPrice > 0
        ? clampPricePerDiner(entry.admissionPrice)
        : undefined;
    diners.push({
      id: entry.id,
      displayName,
      ...(admissionPrice === undefined ? {} : { admissionPrice }),
    });
    if (diners.length >= MAX_DINERS) {
      break;
    }
  }
  return diners;
}

function parseMealItem(
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
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    return null;
  }

  const safeQuantity = Math.min(MAX_LINE_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(quantity)));

  /*
   * A line written before version 8 has no consumed quantity, and that is a
   * statement rather than a gap: it was eaten in full, which is exactly what
   * the calculator reported for it at the time.
   */
  const consumed =
    version >= 8 ? normaliseConsumedQuantity(value.consumedQuantity, safeQuantity) : undefined;

  // A line written before version 9 was paid for by admission, which is again
  // a statement about it rather than a gap in it.
  const separate = value.separatelyCharged === true;
  const charged = normaliseSeparateCharge(value.separateCharge);

  const base = {
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
    ...(separate ? { separatelyCharged: true as const } : {}),
    ...(separate && charged !== undefined ? { separateCharge: charged } : {}),
  };
  const allocations = normaliseAllocations(
    Array.isArray(value.allocations)
      ? (value.allocations as readonly DinerAllocation[])
      : undefined,
    safeQuantity,
    diners,
  );
  const sharedAmong = normaliseSharedAmong(
    Array.isArray(value.sharedAmong) ? (value.sharedAmong as readonly string[]) : undefined,
    diners,
  );
  return {
    ...base,
    ...(allocations.length > 0 ? { allocations } : {}),
    ...(sharedAmong.length > 0 ? { sharedAmong } : {}),
  };
}

/** Returns null whenever stored data is absent, stale or untrustworthy. */
export function parseStoredSession(
  raw: string | null,
  foods: readonly FoodItem[] = FOODS,
): MealSession | null {
  if (!raw || raw.length > MAX_STORED_SESSION_LENGTH) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    !isRecord(parsed) ||
    typeof parsed.version !== 'number' ||
    !SUPPORTED_STORAGE_VERSIONS.some((version) => version === parsed.version) ||
    !isRecord(parsed.session)
  ) {
    return null;
  }

  const version = parsed.version;
  const session = parsed.session;
  const rawItems = Array.isArray(session.items) ? session.items : [];
  // V1 and V2 had no roster by design; their full tabs continue as shared food.
  const diners = version >= 3 ? parseDiners(session.diners) : [];

  const items = mergeMealItems(
    rawItems
      .map((item) => parseMealItem(item, foods, diners, version))
      .filter((item): item is MealItem => item !== null),
  ).map((item) => reconcileItemAllocations(item, diners));

  const pricePerDiner =
    typeof session.pricePerDiner === 'number' ? clampPricePerDiner(session.pricePerDiner) : null;
  const dinerCount =
    typeof session.dinerCount === 'number' ? clampDinerCount(session.dinerCount) : null;

  if (pricePerDiner === null || dinerCount === null) {
    return null;
  }

  /*
   * A session written before version 4 has no ledger, and inventing one would
   * mean stamping made-up times on a meal nobody timed. It stays a valid,
   * fully usable session that simply has no timeline.
   */
  const events = version >= 4 ? parseMealEvents(session.events, foods) : [];
  const lifecycle = version >= 4 ? parseMealLifecycle(session.lifecycle) : IDLE_LIFECYCLE;
  const plannedDurationMinutes =
    version >= 5 ? parseMealDuration(session.plannedDurationMinutes) : undefined;
  const linkedRestaurantId =
    version >= 6 && isRestaurantId(session.restaurantId) ? session.restaurantId : undefined;
  /*
   * A session written before version 7 has no adjustments, and an empty list is
   * exactly what it means: the bill was the entry price. Such a tab settles to
   * the same total it always did.
   */
  const adjustments = version >= 7 ? parseAdjustments(session.adjustments, diners) : [];

  return {
    restaurantName: sanitiseRestaurantName(session.restaurantName),
    pricePerDiner,
    dinerCount,
    pricingProfileId: isPricingProfileId(session.pricingProfileId)
      ? session.pricingProfileId
      : DEFAULT_PRICING_PROFILE_ID,
    items,
    ...(diners.length > 0 ? { diners } : {}),
    ...(adjustments.length > 0 ? { adjustments } : {}),
    ...(events.length > 0 ? { events } : {}),
    ...(lifecycle.status === 'idle' ? {} : { lifecycle }),
    ...(plannedDurationMinutes === undefined ? {} : { plannedDurationMinutes }),
    ...(linkedRestaurantId === undefined ? {} : { restaurantId: linkedRestaurantId }),
  };
}

export function loadSession(foods: readonly FoodItem[] = FOODS): MealSession | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return parseStoredSession(window.localStorage.getItem(STORAGE_KEY), foods);
  } catch {
    // Storage can be unavailable in private modes or when quota-blocked.
    return null;
  }
}

export function saveSession(session: MealSession): void {
  if (typeof window === 'undefined') {
    return;
  }
  const envelope: StoredEnvelope = { version: STORAGE_VERSION, session };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // A failed write only costs persistence, never the running session.
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to recover from; the in-memory session is already reset.
  }
}
