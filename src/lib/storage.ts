import { findFood } from '@/data/foods';
import { clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import {
  MAX_LINE_QUANTITY,
  MAX_RESTAURANT_NAME_LENGTH,
  MIN_QUANTITY,
  isPlateSize,
  isQualityTier,
} from '@/lib/constants';
import type { MealItem, MealSession } from '@/types/meal';

export const STORAGE_KEY = 'ayce-damage-calculator';
export const STORAGE_VERSION = 1;

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

function parseMealItem(value: unknown, index: number): MealItem | null {
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
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    return null;
  }

  const safeQuantity = Math.min(MAX_LINE_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(quantity)));

  return {
    id: typeof id === 'string' && id.length > 0 ? id : `restored-${index}-${foodId}`,
    foodId,
    quality,
    plateSize,
    quantity: safeQuantity,
  };
}

/** Returns null whenever stored data is absent, stale or untrustworthy. */
export function parseStoredSession(raw: string | null): MealSession | null {
  if (!raw || raw.length > MAX_STORED_SESSION_LENGTH) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION || !isRecord(parsed.session)) {
    return null;
  }

  const session = parsed.session;
  const rawItems = Array.isArray(session.items) ? session.items : [];

  const items = rawItems
    .map((item, index) => parseMealItem(item, index))
    .filter((item): item is MealItem => item !== null);

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
    items,
  };
}

export function loadSession(): MealSession | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return parseStoredSession(window.localStorage.getItem(STORAGE_KEY));
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
