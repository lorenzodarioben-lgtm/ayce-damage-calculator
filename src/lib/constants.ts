import type { FoodCategory, PlateSize, QualityTier } from '@/types/meal';

export const KG_TO_LB = 2.2046226218;

/**
 * The base surface colour, mirroring `--color-ash-950`. Declared here because
 * the manifest and browser chrome need it outside a stylesheet.
 */
export const THEME_COLOUR = '#0d0c0a';

/**
 * The grill categories are the built-in menu. The four after them exist only
 * for a diner's own items: an all-you-can-eat table has sides, a stew, a scoop
 * of ice cream and a bottle of something, and none of those is a cut of meat.
 *
 * Nothing is bundled for them. There is no invented price for a bowl of soup
 * and no assumed calorie count for a beer, because the app does not know and
 * will not pretend to — the categories are empty until somebody fills them.
 */
export const FOOD_CATEGORIES = [
  'beef',
  'pork',
  'chicken',
  'seafood',
  'sides',
  'hot-food',
  'desserts',
  'drinks',
] as const;

/** The categories the bundled Australian KBBQ catalogue occupies. */
export const GRILL_CATEGORIES: readonly FoodCategory[] = ['beef', 'pork', 'chicken', 'seafood'];

/** The categories that only ever hold diner-authored items. */
export const CUSTOM_ONLY_CATEGORIES: readonly FoodCategory[] = [
  'sides',
  'hot-food',
  'desserts',
  'drinks',
];

export interface CategoryMeta {
  readonly id: FoodCategory;
  readonly label: string;
}

export const CATEGORY_META: readonly CategoryMeta[] = [
  { id: 'beef', label: 'Beef' },
  { id: 'pork', label: 'Pork' },
  { id: 'chicken', label: 'Chicken' },
  { id: 'seafood', label: 'Seafood' },
  { id: 'sides', label: 'Sides' },
  { id: 'hot-food', label: 'Hot food' },
  { id: 'desserts', label: 'Desserts' },
  { id: 'drinks', label: 'Drinks' },
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
export const MAX_DINER_NAME_LENGTH = 40;
export const MAX_DINER_ID_LENGTH = 80;

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY_PER_ADD = 20;
export const MAX_LINE_QUANTITY = 99;

export const MAX_RESTAURANT_NAME_LENGTH = 60;

/** Long enough for who was there and what happened; short enough to render. */
export const MAX_SESSION_NOTE_LENGTH = 280;

/**
 * Bounds on what a bill can have added to or taken off it.
 *
 * A real tab picks up a handful of these — a voucher, a card fee, a weekend
 * surcharge, a plate of something charged separately. Twelve is more than any
 * receipt anyone has produced and still a fixed ceiling, which is what a
 * storage, URL and import boundary needs.
 */
export const MAX_BILL_ADJUSTMENTS = 12;
export const MAX_ADJUSTMENT_LABEL_LENGTH = 40;
/** Per adjustment, in the session's own currency context. */
export const MAX_ADJUSTMENT_AMOUNT = 5000;
export const MIN_ADJUSTMENT_AMOUNT = 0.01;

/**
 * A percentage of a bill, bounded to what a bill can actually say.
 *
 * A hundred percent is the whole thing, and nothing on a receipt is a share of
 * more than all of it — a bigger surcharge than that is a different entry
 * price, not a percentage.
 */
export const MAX_ADJUSTMENT_PERCENT = 100;
export const MIN_ADJUSTMENT_PERCENT = 0.01;

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
