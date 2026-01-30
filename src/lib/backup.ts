import { parseStoredFavorites, type MealFavorite } from '@/lib/favorites';
import { parseStoredCustomFoods } from '@/lib/customFoods';
import { isIsoTimestamp } from '@/lib/datetime';
import { foodCatalogue } from '@/lib/foodCatalogue';
import { parseSavedSession } from '@/lib/history';
import { parseStoredPresets } from '@/lib/presets';
import {
  RESTAURANTS_VERSION,
  parseStoredRestaurants,
  restaurantsFromPresets,
  type RestaurantProfile,
} from '@/lib/restaurants';
import { parseStoredPricingProfiles } from '@/lib/pricingProfiles';
import type { CustomFood } from '@/types/customFoods';
import type { SavedMealSession } from '@/types/history';
import type { PricingProfile } from '@/types/pricing';

/**
 * Export and import of everything this device holds.
 *
 * An imported file is as untrusted as a share token: it may be hand-edited,
 * from a much older build, or not a backup at all. Parsing therefore validates
 * every record individually and reports what it had to discard, so the user
 * decides whether the result is worth keeping — nothing is written until they
 * say so, and nothing is ever destroyed without an explicit choice.
 */

export const BACKUP_FORMAT = 'ayce-damage-backup';

/**
 * 1 — history and saved orders.
 * 2 — personal menus: pricing profiles, custom foods and restaurant presets.
 * 3 — filed records may carry a meal ledger and lifecycle metadata.
 * 4 — restaurant profiles replace the old preset list.
 * 5 — filed records may carry the bill adjustments that settled their total.
 */
export const BACKUP_VERSION = 5;

/** Roughly 8 MB of JSON; far beyond any real backup, but bounded. */
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

export interface BackupFile {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: number;
  readonly exportedAt: string;
  readonly history: readonly SavedMealSession[];
  readonly favorites: readonly MealFavorite[];
  readonly configuration: BackupConfiguration;
}

/** Personal menu assumptions required for a complete local-first restore. */
export interface BackupConfiguration {
  readonly pricingProfiles: readonly PricingProfile[];
  readonly customFoods: readonly CustomFood[];
  readonly restaurants: readonly RestaurantProfile[];
}

export type BackupError =
  | 'too-large'
  | 'invalid-json'
  | 'not-a-backup'
  | 'unsupported-version'
  | 'nothing-usable';

export const BACKUP_ERROR_MESSAGES: Readonly<Record<BackupError, string>> = {
  'too-large': 'That file is too large to be an AYCE backup.',
  'invalid-json': 'That file is not readable JSON.',
  'not-a-backup': 'That file is not an AYCE damage backup.',
  'unsupported-version': 'That backup was written by a newer version of the calculator.',
  'nothing-usable': 'Nothing in that backup could be read.',
};

export interface BackupContents {
  readonly exportedAt: string;
  readonly history: readonly SavedMealSession[];
  readonly favorites: readonly MealFavorite[];
  readonly configuration: BackupConfiguration;
}

export interface BackupSummary {
  /** Records that failed validation and were left out. */
  readonly skippedHistory: number;
  readonly skippedFavorites: number;
  readonly skippedPricingProfiles: number;
  readonly skippedCustomFoods: number;
  readonly skippedRestaurants: number;
}

export type BackupParseResult =
  | { readonly ok: true; readonly contents: BackupContents; readonly summary: BackupSummary }
  | { readonly ok: false; readonly error: BackupError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildBackup(
  history: readonly SavedMealSession[],
  favorites: readonly MealFavorite[],
  exportedAt: string,
  configuration: BackupConfiguration = {
    pricingProfiles: [],
    customFoods: [],
    restaurants: [],
  },
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    history,
    favorites,
    configuration,
  };
}

export function serialiseBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** `ayce-damage-backup-2026-08-16.json` */
export function backupFilename(date: Date): string {
  const stamp = Number.isNaN(date.getTime())
    ? 'unknown-date'
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `ayce-damage-backup-${stamp}.json`;
}

export function parseBackup(raw: string): BackupParseResult {
  if (raw.length > MAX_BACKUP_BYTES) {
    return { ok: false, error: 'too-large' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }

  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'not-a-backup' };
  }
  if (typeof parsed.version !== 'number' || parsed.version < 1 || parsed.version > BACKUP_VERSION) {
    return { ok: false, error: 'unsupported-version' };
  }

  const rawHistory = Array.isArray(parsed.history) ? parsed.history : [];
  const history: SavedMealSession[] = [];
  const seenIds = new Set<string>();

  for (const entry of rawHistory) {
    const record = parseSavedSession(entry);
    // A file can repeat a record; the first copy wins.
    if (record && !seenIds.has(record.id)) {
      seenIds.add(record.id);
      history.push(record);
    }
  }

  const rawConfiguration = isRecord(parsed.configuration) ? parsed.configuration : {};
  const rawPricingProfiles = Array.isArray(rawConfiguration.pricingProfiles)
    ? rawConfiguration.pricingProfiles
    : [];
  const pricingProfiles = parseStoredPricingProfiles(
    JSON.stringify({ version: 1, profiles: rawPricingProfiles }),
  );
  const rawCustomFoods = Array.isArray(rawConfiguration.customFoods)
    ? rawConfiguration.customFoods
    : [];
  const customFoods = parseStoredCustomFoods(JSON.stringify({ version: 1, foods: rawCustomFoods }));
  /*
   * Restaurant profiles superseded the preset list. A backup written before
   * that carried presets instead, so both are read and the older shape is
   * migrated forward rather than dropped.
   */
  const rawRestaurants = Array.isArray(rawConfiguration.restaurants)
    ? rawConfiguration.restaurants
    : [];
  const rawPresets = Array.isArray(rawConfiguration.presets) ? rawConfiguration.presets : [];
  const stored = parseStoredRestaurants(
    JSON.stringify({ version: RESTAURANTS_VERSION, restaurants: rawRestaurants }),
  );
  const migrated = restaurantsFromPresets(
    parseStoredPresets(JSON.stringify({ version: 2, presets: rawPresets })),
  );
  const known = new Set(stored.map((entry) => entry.id));
  const restaurants = [...stored, ...migrated.filter((entry) => !known.has(entry.id))];

  // Favourites reuse the storage parser, so exactly the same rules apply to a
  // restored list as to one written by the app itself. Custom foods are parsed
  // first so favourite configurations can keep referring to the diner menu.
  const favorites = parseStoredFavorites(
    JSON.stringify({
      version: 1,
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
    }),
    foodCatalogue(customFoods),
  );

  if (
    history.length === 0 &&
    favorites.length === 0 &&
    pricingProfiles.length === 0 &&
    customFoods.length === 0 &&
    restaurants.length === 0
  ) {
    return { ok: false, error: 'nothing-usable' };
  }

  const exportedAt = isIsoTimestamp(parsed.exportedAt)
    ? parsed.exportedAt
    : new Date(0).toISOString();

  return {
    ok: true,
    contents: {
      exportedAt,
      history,
      favorites,
      configuration: { pricingProfiles, customFoods, restaurants },
    },
    summary: {
      skippedHistory: rawHistory.length - history.length,
      skippedFavorites:
        (Array.isArray(parsed.favorites) ? parsed.favorites.length : 0) - favorites.length,
      skippedPricingProfiles: rawPricingProfiles.length - pricingProfiles.length,
      skippedCustomFoods: rawCustomFoods.length - customFoods.length,
      skippedRestaurants: rawRestaurants.length + rawPresets.length - restaurants.length,
    },
  };
}

export type RestoreMode = 'merge' | 'replace';

export interface MergeOutcome<T> {
  readonly result: readonly T[];
  readonly added: number;
  readonly kept: number;
}

/**
 * Merges by id, keeping what is already here.
 *
 * Existing records win because they are the ones the user can currently see;
 * a restore should feel additive, never like an overwrite they did not ask for.
 */
export function mergeById<T extends { id: string }>(
  existing: readonly T[],
  incoming: readonly T[],
): MergeOutcome<T> {
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  let added = 0;

  for (const entry of incoming) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
      added += 1;
    }
  }

  return { result: [...byId.values()], added, kept: existing.length };
}
