import { FOODS } from '@/data/foods';
import { getPlateSizeMeta, getQualityMeta, isPlateSize, isQualityTier } from '@/lib/constants';
import { isIsoTimestamp } from '@/lib/datetime';
import { findFoodInCatalogue } from '@/lib/foodCatalogue';
import { mealItemId } from '@/lib/mealItems';
import type { FoodItem, PlateSize, QualityTier } from '@/types/meal';

export const FAVORITES_STORAGE_KEY = 'ayce-damage-favorites';
export const FAVORITES_VERSION = 1;

/** Enough for every valid favourite, without parsing an edited multi-megabyte value. */
export const MAX_STORED_FAVORITES_LENGTH = 32 * 1024;

/** A cap, so a stuck control cannot fill storage with near-identical entries. */
export const MAX_FAVORITES = 24;

/** The configuration a favourite pins: a cut, at a grade, at a serving size. */
export interface FavoriteConfig {
  readonly foodId: string;
  readonly quality: QualityTier;
  readonly plateSize: PlateSize;
}

export interface MealFavorite extends FavoriteConfig {
  readonly id: string;
  readonly createdAt: string;
}

interface StoredEnvelope {
  version: number;
  favorites: readonly MealFavorite[];
}

/**
 * Identity is the configuration itself, not a random key.
 *
 * Deriving the id this way makes duplicates impossible to create rather than
 * something that has to be checked for, and it matches how tab lines are keyed
 * so the two models line up.
 */
export function favoriteId(config: FavoriteConfig): string {
  return mealItemId(config);
}

export function createFavorite(config: FavoriteConfig, createdAt: string): MealFavorite {
  return { id: favoriteId(config), ...config, createdAt };
}

export function isFavorited(favorites: readonly MealFavorite[], config: FavoriteConfig): boolean {
  const id = favoriteId(config);
  return favorites.some((favorite) => favorite.id === id);
}

/** Adds the configuration if absent, removes it if present. */
export function toggleFavorite(
  favorites: readonly MealFavorite[],
  config: FavoriteConfig,
  createdAt: string,
): readonly MealFavorite[] {
  const id = favoriteId(config);

  if (favorites.some((favorite) => favorite.id === id)) {
    return favorites.filter((favorite) => favorite.id !== id);
  }
  // Newest first, and bounded: the oldest falls off the end.
  return [createFavorite(config, createdAt), ...favorites].slice(0, MAX_FAVORITES);
}

export function removeFavorite(
  favorites: readonly MealFavorite[],
  id: string,
): readonly MealFavorite[] {
  return favorites.filter((favorite) => favorite.id !== id);
}

/** Human-readable, derived from the dataset rather than stored on the record. */
export function describeFavorite(
  favorite: FavoriteConfig,
  foods: readonly FoodItem[] = FOODS,
): string | null {
  const food = findFoodInCatalogue(foods, favorite.foodId);
  if (!food) {
    return null;
  }
  return `${food.name} · ${getQualityMeta(favorite.quality).label} · ${getPlateSizeMeta(favorite.plateSize).label}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFavorite(value: unknown, foods: readonly FoodItem[]): MealFavorite | null {
  if (!isRecord(value)) {
    return null;
  }
  const { foodId, quality, plateSize, createdAt } = value;

  // A favourite pointing at a cut that no longer exists is unusable, so it is
  // dropped rather than rendered as a blank chip.
  if (typeof foodId !== 'string' || !findFoodInCatalogue(foods, foodId)) {
    return null;
  }
  if (!isQualityTier(quality) || !isPlateSize(plateSize)) {
    return null;
  }

  const config: FavoriteConfig = { foodId, quality, plateSize };
  return {
    id: favoriteId(config),
    ...config,
    createdAt: isIsoTimestamp(createdAt) ? createdAt : new Date(0).toISOString(),
  };
}

/** Returns an empty list whenever stored data is absent, stale or unusable. */
export function parseStoredFavorites(
  raw: string | null,
  foods: readonly FoodItem[] = FOODS,
): readonly MealFavorite[] {
  if (!raw || raw.length > MAX_STORED_FAVORITES_LENGTH) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!isRecord(parsed) || parsed.version !== FAVORITES_VERSION) {
    return [];
  }

  const rawFavorites = Array.isArray(parsed.favorites) ? parsed.favorites : [];
  const seen = new Set<string>();
  const favorites: MealFavorite[] = [];

  for (const entry of rawFavorites) {
    const favorite = parseFavorite(entry, foods);
    // A file edited by hand, or restored from a backup, can repeat an entry.
    if (favorite && !seen.has(favorite.id)) {
      seen.add(favorite.id);
      favorites.push(favorite);
    }
    if (favorites.length >= MAX_FAVORITES) {
      break;
    }
  }

  return favorites;
}

export function loadFavorites(foods: readonly FoodItem[] = FOODS): readonly MealFavorite[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    return parseStoredFavorites(window.localStorage.getItem(FAVORITES_STORAGE_KEY), foods);
  } catch {
    // Storage can be unavailable in private modes or when quota-blocked.
    return [];
  }
}

export function saveFavorites(favorites: readonly MealFavorite[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  const envelope: StoredEnvelope = { version: FAVORITES_VERSION, favorites };
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // A failed write only costs persistence, never the running session.
  }
}
