import { clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import { isIsoTimestamp } from '@/lib/datetime';
import { loadPresets, type RestaurantPreset } from '@/lib/presets';
import { DEFAULT_PRICING_PROFILE_ID, isPricingProfileId } from '@/lib/pricing';
import { sanitiseRestaurantName } from '@/lib/storage';
import type { PricingProfileId } from '@/types/pricing';

/**
 * A place the diner goes back to, held on this device.
 *
 * There is still no bundled database of real restaurants, no address, no
 * rating and no network call: a profile is a name and a setup someone typed,
 * plus whatever their own filed history says about visiting it. Two profiles
 * that happen to share a name are not assumed to be the same place — a filed
 * record belongs to a restaurant only when the meal was started from it, or
 * when the diner explicitly says so.
 */

export const RESTAURANTS_STORAGE_KEY = 'ayce-damage-restaurants';
export const RESTAURANTS_VERSION = 1;

/** A personal list of regular haunts, not a directory. */
export const MAX_RESTAURANTS = 24;
export const MAX_STORED_RESTAURANTS_LENGTH = 64 * 1024;
export const MAX_RESTAURANT_NOTE_LENGTH = 200;

export interface RestaurantProfile {
  readonly id: string;
  readonly name: string;
  readonly pricePerDiner: number;
  readonly dinerCount: number;
  readonly pricingProfileId: PricingProfileId;
  /** What the diner wrote about the place. Empty is the normal case. */
  readonly note: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RestaurantDraft {
  readonly name: string;
  readonly pricePerDiner: number;
  readonly dinerCount: number;
  readonly pricingProfileId?: PricingProfileId;
  readonly note?: string;
}

interface StoredEnvelope {
  readonly version: number;
  readonly restaurants: readonly RestaurantProfile[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Identity is the name, case- and space-insensitively.
 *
 * The same rule the presets used, so a migrated preset keeps the id it had and
 * nothing that referred to it is orphaned by the move.
 */
export function restaurantId(name: string): string {
  return sanitiseRestaurantName(name).trim().toLowerCase().replace(/\s+/g, '-');
}

export function isRestaurantId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 80;
}

export function sanitiseRestaurantNote(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_RESTAURANT_NOTE_LENGTH);
}

export function createRestaurantProfile(
  draft: RestaurantDraft,
  at: string,
  createdAt?: string,
): RestaurantProfile | null {
  const name = sanitiseRestaurantName(draft.name).trim();
  // A profile with no name could not be told apart from any other.
  if (name.length === 0) {
    return null;
  }

  return {
    id: restaurantId(name),
    name,
    pricePerDiner: clampPricePerDiner(draft.pricePerDiner),
    dinerCount: clampDinerCount(draft.dinerCount),
    pricingProfileId: draft.pricingProfileId ?? DEFAULT_PRICING_PROFILE_ID,
    note: sanitiseRestaurantNote(draft.note),
    createdAt: createdAt ?? at,
    updatedAt: at,
  };
}

/** Adds or replaces by id, newest first, preserving the original created date. */
export function upsertRestaurant(
  restaurants: readonly RestaurantProfile[],
  profile: RestaurantProfile,
): readonly RestaurantProfile[] {
  const existing = restaurants.find((entry) => entry.id === profile.id);
  const merged = existing ? { ...profile, createdAt: existing.createdAt } : profile;
  return [merged, ...restaurants.filter((entry) => entry.id !== profile.id)].slice(
    0,
    MAX_RESTAURANTS,
  );
}

export function removeRestaurant(
  restaurants: readonly RestaurantProfile[],
  id: string,
): readonly RestaurantProfile[] {
  return restaurants.filter((entry) => entry.id !== id);
}

export function findRestaurant(
  restaurants: readonly RestaurantProfile[],
  id: string,
): RestaurantProfile | undefined {
  return restaurants.find((entry) => entry.id === id);
}

export interface RestaurantSetup {
  readonly name: string;
  readonly pricePerDiner: number;
  readonly dinerCount: number;
  readonly pricingProfileId?: PricingProfileId;
}

/** Whether applying this profile would actually change the session setup. */
export function restaurantMatchesSetup(
  profile: RestaurantProfile,
  setup: RestaurantSetup,
): boolean {
  return (
    restaurantId(setup.name) === profile.id &&
    Math.abs(clampPricePerDiner(setup.pricePerDiner) - profile.pricePerDiner) < 0.005 &&
    clampDinerCount(setup.dinerCount) === profile.dinerCount &&
    (setup.pricingProfileId ?? DEFAULT_PRICING_PROFILE_ID) === profile.pricingProfileId
  );
}

export function parseRestaurantProfile(value: unknown): RestaurantProfile | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = sanitiseRestaurantName(value.name).trim();
  if (name.length === 0) {
    return null;
  }
  if (typeof value.pricePerDiner !== 'number' || !Number.isFinite(value.pricePerDiner)) {
    return null;
  }
  if (typeof value.dinerCount !== 'number' || !Number.isFinite(value.dinerCount)) {
    return null;
  }

  const createdAt = isIsoTimestamp(value.createdAt) ? value.createdAt : new Date(0).toISOString();

  return {
    id: restaurantId(name),
    name,
    pricePerDiner: clampPricePerDiner(value.pricePerDiner),
    dinerCount: clampDinerCount(value.dinerCount),
    pricingProfileId: isPricingProfileId(value.pricingProfileId)
      ? value.pricingProfileId
      : DEFAULT_PRICING_PROFILE_ID,
    note: sanitiseRestaurantNote(value.note),
    createdAt,
    updatedAt: isIsoTimestamp(value.updatedAt) ? value.updatedAt : createdAt,
  };
}

export function parseStoredRestaurants(raw: string | null): readonly RestaurantProfile[] {
  if (!raw || raw.length > MAX_STORED_RESTAURANTS_LENGTH) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!isRecord(parsed) || parsed.version !== RESTAURANTS_VERSION) {
    return [];
  }

  const rawRestaurants = Array.isArray(parsed.restaurants) ? parsed.restaurants : [];
  const seen = new Set<string>();
  const restaurants: RestaurantProfile[] = [];

  for (const entry of rawRestaurants) {
    const profile = parseRestaurantProfile(entry);
    if (profile && !seen.has(profile.id)) {
      seen.add(profile.id);
      restaurants.push(profile);
    }
    if (restaurants.length >= MAX_RESTAURANTS) {
      break;
    }
  }

  return restaurants;
}

/**
 * Brings the old preset list forward.
 *
 * A preset was already a named setup, so the move is a widening rather than a
 * translation: the id, name, price, table size and pricing context all carry
 * over unchanged, and the new fields start empty.
 */
export function restaurantsFromPresets(
  presets: readonly RestaurantPreset[],
): readonly RestaurantProfile[] {
  return presets.map((preset) => ({
    id: preset.id,
    name: preset.name,
    pricePerDiner: preset.pricePerDiner,
    dinerCount: preset.dinerCount,
    pricingProfileId: preset.pricingProfileId,
    note: '',
    createdAt: preset.createdAt,
    updatedAt: preset.createdAt,
  }));
}

/**
 * Reads the list, migrating the old presets the first time.
 *
 * The presets are left where they are rather than deleted: a diner who opens
 * an older build, or restores an older backup, still finds them intact.
 */
export function loadRestaurants(): readonly RestaurantProfile[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(RESTAURANTS_STORAGE_KEY);
    if (stored !== null) {
      return parseStoredRestaurants(stored);
    }
    return restaurantsFromPresets(loadPresets());
  } catch {
    return [];
  }
}

export function saveRestaurants(restaurants: readonly RestaurantProfile[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  const envelope: StoredEnvelope = {
    version: RESTAURANTS_VERSION,
    restaurants: restaurants.slice(0, MAX_RESTAURANTS),
  };
  try {
    window.localStorage.setItem(RESTAURANTS_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // A failed write only costs persistence, never the list being edited.
  }
}
