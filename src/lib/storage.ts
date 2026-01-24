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
import { mealItemId, mergeMealItems } from '@/lib/mealItems';
import { findFoodInCatalogue } from '@/lib/foodCatalogue';
import {
  isDinerId,
  normaliseAllocations,
  normaliseDinerName,
  reconcileItemAllocations,
} from '@/lib/diners';
import type { Diner, DinerAllocation, FoodItem } from '@/types/meal';
import { DEFAULT_PRICING_PROFILE_ID, isPricingProfileId } from '@/lib/pricing';
import type { MealItem, MealSession } from '@/types/meal';

export const STORAGE_KEY = 'ayce-damage-calculator';
export const STORAGE_VERSION = 3;

/** A normal tab is tiny; refuse an edited storage entry before parsing it. */
export const MAX_STORED_SESSION_LENGTH = 64 * 1024;

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

  const base = {
    id: mealItemId({ foodId, quality, plateSize }),
    foodId,
    quality,
    plateSize,
    quantity: safeQuantity,
  };
  const allocations = normaliseAllocations(
    Array.isArray(value.allocations)
      ? (value.allocations as readonly DinerAllocation[])
      : undefined,
    safeQuantity,
    diners,
  );
  return allocations.length > 0 ? { ...base, allocations } : base;
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
    (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== STORAGE_VERSION) ||
    !isRecord(parsed.session)
  ) {
    return null;
  }

  const session = parsed.session;
  const rawItems = Array.isArray(session.items) ? session.items : [];
  // V1 and V2 had no roster by design; their full tabs continue as shared food.
  const diners = parsed.version === STORAGE_VERSION ? parseDiners(session.diners) : [];

  const items = mergeMealItems(
    rawItems
      .map((item) => parseMealItem(item, foods, diners))
      .filter((item): item is MealItem => item !== null),
  ).map((item) => reconcileItemAllocations(item, diners));

  const pricePerDiner =
    typeof session.pricePerDiner === 'number' ? clampPricePerDiner(session.pricePerDiner) : null;
  const dinerCount =
    typeof session.dinerCount === 'number' ? clampDinerCount(session.dinerCount) : null;

  if (pricePerDiner === null || dinerCount === null) {
    return null;
  }

  return {
    restaurantName: sanitiseRestaurantName(session.restaurantName),
    pricePerDiner,
    dinerCount,
    pricingProfileId: isPricingProfileId(session.pricingProfileId)
      ? session.pricingProfileId
      : DEFAULT_PRICING_PROFILE_ID,
    items,
    ...(diners.length > 0 ? { diners } : {}),
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
