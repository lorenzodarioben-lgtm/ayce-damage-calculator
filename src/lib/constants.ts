import type { FoodCategory, PlateSize, QualityTier } from '@/types/meal';

export const KG_TO_LB = 2.2046226218;

/**
 * The base surface colour, mirroring `--color-ash-950`. Declared here because
 * the manifest and browser chrome need it outside a stylesheet.
 */
export const THEME_COLOUR = '#0d0c0a';

export const FOOD_CATEGORIES = ['beef', 'pork', 'chicken', 'seafood'] as const;

export interface CategoryMeta {
  readonly id: FoodCategory;
  readonly label: string;
}

export const CATEGORY_META: readonly CategoryMeta[] = [
  { id: 'beef', label: 'Beef' },
  { id: 'pork', label: 'Pork' },
  { id: 'chicken', label: 'Chicken' },
  { id: 'seafood', label: 'Seafood' },
];

export interface QualityMeta {
  readonly id: QualityTier;
  readonly label: string;
  readonly subtitle: string;
  readonly retailMultiplier: number;
  readonly restaurantMultiplier: number;
}

export const QUALITY_TIERS: readonly QualityMeta[] = [
  {
    id: 'house',
    label: 'House',
    subtitle: 'Budget-friendly cuts',
    retailMultiplier: 0.85,
    restaurantMultiplier: 0.85,
  },
  {
    id: 'standard',
    label: 'Standard',
    subtitle: 'Typical AYCE quality',
    retailMultiplier: 1.0,
    restaurantMultiplier: 1.0,
  },
  {
    id: 'premium',
    label: 'Premium',
    subtitle: 'Higher-grade selection',
    retailMultiplier: 1.35,
    restaurantMultiplier: 1.25,
  },
];

export interface PlateSizeMeta {
  readonly id: PlateSize;
  readonly label: string;
  readonly grams: number;
  readonly ounces: string;
}

export const PLATE_SIZES: readonly PlateSizeMeta[] = [
  { id: 'small', label: 'Small', grams: 100, ounces: '3.5 oz' },
  { id: 'regular', label: 'Regular', grams: 155, ounces: '5.5 oz' },
  { id: 'large', label: 'Large', grams: 220, ounces: '7.8 oz' },
];

export const DEFAULT_QUALITY: QualityTier = 'standard';
export const DEFAULT_PLATE_SIZE: PlateSize = 'regular';

export const DEFAULT_PRICE_PER_DINER = 59.9;
export const MIN_PRICE_PER_DINER = 1;
export const MAX_PRICE_PER_DINER = 500;

export const DEFAULT_DINER_COUNT = 1;
export const MIN_DINERS = 1;
export const MAX_DINERS = 12;

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY_PER_ADD = 20;
export const MAX_LINE_QUANTITY = 99;

export const MAX_RESTAURANT_NAME_LENGTH = 60;

export function getQualityMeta(tier: QualityTier): QualityMeta {
  const meta = QUALITY_TIERS.find((entry) => entry.id === tier);
  if (!meta) {
    throw new Error(`Unknown quality tier: ${tier}`);
  }
  return meta;
}

export function getPlateSizeMeta(size: PlateSize): PlateSizeMeta {
  const meta = PLATE_SIZES.find((entry) => entry.id === size);
  if (!meta) {
    throw new Error(`Unknown plate size: ${size}`);
  }
  return meta;
}

export function isFoodCategory(value: unknown): value is FoodCategory {
  return typeof value === 'string' && FOOD_CATEGORIES.some((id) => id === value);
}

export function isQualityTier(value: unknown): value is QualityTier {
  return typeof value === 'string' && QUALITY_TIERS.some((tier) => tier.id === value);
}

export function isPlateSize(value: unknown): value is PlateSize {
  return typeof value === 'string' && PLATE_SIZES.some((size) => size.id === value);
}
