import { FOODS, findFood } from '@/data/foods';
import { clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import {
  MAX_LINE_QUANTITY,
  MAX_RESTAURANT_NAME_LENGTH,
  MIN_QUANTITY,
  PLATE_SIZES,
  QUALITY_TIERS,
} from '@/lib/constants';
import { sanitiseRestaurantName } from '@/lib/storage';
import { findFoodInCatalogue, foodCatalogue } from '@/lib/foodCatalogue';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import { parseCustomPricingProfile } from '@/lib/pricingProfiles';
import { MAX_CUSTOM_FOODS, parseCustomFood } from '@/lib/customFoods';
import type { CustomFood } from '@/types/customFoods';
import type { PricingProfile } from '@/types/pricing';
import type { FoodItem, MealItem, MealSession, PlateSize, QualityTier } from '@/types/meal';

/**
 * Encodes a completed meal into a URL path segment.
 *
 * There is no database behind a shared report: the link *is* the payload. That
 * makes the encoding a trust boundary, so everything here is written to be
 * bounded and total — a malformed, hostile or simply outdated token has to fail
 * to `null` rather than throw, and can never produce a meal the calculator
 * itself could not have produced.
 */

export const SHARE_TOKEN_VERSION = 2;
const LEGACY_SHARE_TOKEN_VERSION = 1;

/** Refuse absurd input before any parsing work is done. */
export const MAX_SHARE_TOKEN_LENGTH = 2048;

/** More lines than the builder can realistically produce, but still bounded. */
export const MAX_SHARE_ITEMS = 40;

/**
 * Stable two-character codes for each cut.
 *
 * Explicit rather than derived from array position, so reordering or extending
 * the dataset cannot silently change what an existing link decodes to. A test
 * asserts this table stays complete and collision-free.
 */
export const FOOD_SHARE_CODES: Readonly<Record<string, string>> = {
  'beef-brisket': 'ba',
  'beef-short-rib': 'bb',
  'beef-ribeye': 'bc',
  'beef-bulgogi': 'bd',
  'beef-belly': 'be',
  'beef-tongue': 'bf',
  'beef-wagyu-short-rib': 'bg',
  'pork-belly': 'pa',
  'pork-spicy': 'pb',
  'pork-jowl': 'pc',
  'pork-shoulder': 'pd',
  'chicken-thigh': 'ca',
  'chicken-spicy': 'cb',
  'chicken-garlic': 'cc',
  'seafood-prawns': 'sa',
  'seafood-squid': 'sb',
  'seafood-salmon': 'sc',
  'seafood-scallops': 'sd',
};

const FOOD_ID_BY_CODE: ReadonlyMap<string, string> = new Map(
  Object.entries(FOOD_SHARE_CODES).map(([foodId, code]) => [code, foodId]),
);

const QUALITY_ORDER: readonly QualityTier[] = QUALITY_TIERS.map((tier) => tier.id);
const PLATE_ORDER: readonly PlateSize[] = PLATE_SIZES.map((size) => size.id);

/** The meal a token carries. Deliberately the inputs only, never the totals. */
export interface SharePayload {
  readonly restaurantName: string;
  readonly pricePerDiner: number;
  readonly dinerCount: number;
  readonly pricingProfile: PricingProfile;
  readonly customFoods: readonly CustomFood[];
  readonly items: readonly MealItem[];
}

export interface ShareContext {
  readonly pricingProfile?: PricingProfile;
  readonly customFoods?: readonly CustomFood[];
}

function fromBase36(value: string): number | null {
  // parseInt would happily accept "12xyz"; this must not.
  if (!/^[0-9a-z]+$/.test(value)) {
    return null;
  }
  const parsed = Number.parseInt(value, 36);
  return Number.isFinite(parsed) ? parsed : null;
}

/** URL-safe base64 without padding, for the one free-text field. */
function encodeText(value: string): string {
  if (value.length === 0) {
    return '';
  }
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeText(value: string): string | null {
  if (value.length === 0) {
    return '';
  }
  if (!/^[A-Za-z0-9\-_]+$/.test(value)) {
    return null;
  }
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Version 1 used a compact dot-separated tuple. Version 2 keeps the address
 * URL-safe while carrying the menu context required to reproduce a custom meal.
 *
 *   1.<price in cents b36>.<diners b36>.<items>.<name>
 *
 * where items are `code-quality-plate-quantity` joined by `_`, and the name is
 * URL-safe base64. Compact by construction, so no compression dependency is
 * needed for payloads this size.
 */
export function encodeSharePayload(
  session: MealSession,
  context: ShareContext = {},
): string | null {
  if (session.items.length === 0 || session.items.length > MAX_SHARE_ITEMS) {
    return null;
  }

  const customFoods = (context.customFoods ?? [])
    .filter((food) => session.items.some((item) => item.foodId === food.id))
    .slice(0, MAX_CUSTOM_FOODS);
  const availableFoods = foodCatalogue(customFoods);
  if (session.items.some((item) => !findFoodInCatalogue(availableFoods, item.foodId))) {
    return null;
  }
  const payload = {
    restaurantName: sanitiseRestaurantName(session.restaurantName),
    pricePerDiner: clampPricePerDiner(session.pricePerDiner),
    dinerCount: clampDinerCount(session.dinerCount),
    pricingProfile: context.pricingProfile ?? DEFAULT_PRICING_PROFILE,
    customFoods,
    items: session.items.slice(0, MAX_SHARE_ITEMS).map((item) => ({
      foodId: item.foodId,
      quality: item.quality,
      plateSize: item.plateSize,
      quantity: Math.min(MAX_LINE_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(item.quantity))),
    })),
  };
  const token = `${SHARE_TOKEN_VERSION}.${encodeText(JSON.stringify(payload))}`;
  return token.length <= MAX_SHARE_TOKEN_LENGTH ? token : null;
}

function decodeItem(segment: string, index: number): MealItem | null {
  const parts = segment.split('-');
  if (parts.length !== 4) {
    return null;
  }

  const [code, qualityRaw, plateRaw, quantityRaw] = parts as [string, string, string, string];

  const foodId = FOOD_ID_BY_CODE.get(code);
  // A code from a newer build, or an invented one, is simply unknown here.
  if (!foodId || !findFood(foodId)) {
    return null;
  }

  const quality = QUALITY_ORDER[Number(qualityRaw)];
  const plateSize = PLATE_ORDER[Number(plateRaw)];
  if (!/^\d$/.test(qualityRaw) || !/^\d$/.test(plateRaw) || !quality || !plateSize) {
    return null;
  }

  const quantity = fromBase36(quantityRaw);
  if (quantity === null || quantity < MIN_QUANTITY) {
    return null;
  }

  return {
    id: `shared-${index}-${foodId}`,
    foodId,
    quality,
    plateSize,
    // Clamped rather than rejected: a large number is someone being silly, not
    // someone attacking, and the meal is still readable.
    quantity: Math.min(MAX_LINE_QUANTITY, quantity),
  };
}

/** Returns null for anything that is not a token this build can read. */
function decodeLegacySharePayload(token: string): SharePayload | null {
  if (typeof token !== 'string' || token.length === 0) {
    return null;
  }
  if (token.length > MAX_SHARE_TOKEN_LENGTH) {
    return null;
  }

  const segments = token.split('.');
  if (segments.length !== 5) {
    return null;
  }

  const [versionRaw, priceRaw, dinersRaw, itemsRaw, nameRaw] = segments as [
    string,
    string,
    string,
    string,
    string,
  ];

  if (Number(versionRaw) !== LEGACY_SHARE_TOKEN_VERSION || !/^\d+$/.test(versionRaw)) {
    return null;
  }

  const priceCents = fromBase36(priceRaw);
  const diners = fromBase36(dinersRaw);
  if (priceCents === null || diners === null) {
    return null;
  }

  const itemSegments = itemsRaw.split('_');
  if (itemSegments.length > MAX_SHARE_ITEMS) {
    return null;
  }

  const items: MealItem[] = [];
  for (const [index, segment] of itemSegments.entries()) {
    const item = decodeItem(segment, index);
    // One bad line means the whole token is untrustworthy; a partially decoded
    // meal would misreport the totals it is supposed to be sharing.
    if (!item) {
      return null;
    }
    items.push(item);
  }

  if (items.length === 0) {
    return null;
  }

  const restaurantName = decodeText(nameRaw);
  if (restaurantName === null) {
    return null;
  }

  return {
    // Sanitised and capped: this is the only free text in the payload, and it
    // is rendered as text, never as markup.
    restaurantName: sanitiseRestaurantName(restaurantName).slice(0, MAX_RESTAURANT_NAME_LENGTH),
    pricePerDiner: clampPricePerDiner(priceCents / 100),
    dinerCount: clampDinerCount(diners),
    pricingProfile: DEFAULT_PRICING_PROFILE,
    customFoods: [],
    items,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSharePricingProfile(value: unknown): PricingProfile {
  if (isRecord(value) && value.id === DEFAULT_PRICING_PROFILE.id) {
    return DEFAULT_PRICING_PROFILE;
  }
  return parseCustomPricingProfile(value) ?? DEFAULT_PRICING_PROFILE;
}

function parseShareCustomFoods(value: unknown): readonly CustomFood[] {
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

function parseShareItems(value: unknown, foods: readonly FoodItem[]): readonly MealItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SHARE_ITEMS) {
    return null;
  }
  const items: MealItem[] = [];
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry) || typeof entry.foodId !== 'string') {
      return null;
    }
    const quality = entry.quality;
    const plateSize = entry.plateSize;
    const quantity = entry.quantity;
    if (
      !findFoodInCatalogue(foods, entry.foodId) ||
      !QUALITY_ORDER.includes(quality as QualityTier) ||
      !PLATE_ORDER.includes(plateSize as PlateSize) ||
      typeof quantity !== 'number' ||
      !Number.isFinite(quantity)
    ) {
      return null;
    }
    items.push({
      id: `shared-${index}-${entry.foodId}`,
      foodId: entry.foodId,
      quality: quality as QualityTier,
      plateSize: plateSize as PlateSize,
      quantity: Math.min(MAX_LINE_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(quantity))),
    });
  }
  return items;
}

function decodeConfigurableSharePayload(token: string): SharePayload | null {
  const segments = token.split('.');
  if (segments.length !== 2 || segments[0] !== String(SHARE_TOKEN_VERSION)) {
    return null;
  }
  const decoded = decodeText(segments[1] ?? '');
  if (decoded === null) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.restaurantName !== 'string') {
    return null;
  }
  if (
    typeof value.pricePerDiner !== 'number' ||
    !Number.isFinite(value.pricePerDiner) ||
    typeof value.dinerCount !== 'number' ||
    !Number.isFinite(value.dinerCount)
  ) {
    return null;
  }
  const pricingProfile = parseSharePricingProfile(value.pricingProfile);
  const customFoods = parseShareCustomFoods(value.customFoods);
  const items = parseShareItems(value.items, foodCatalogue(customFoods));
  if (!items) {
    return null;
  }
  return {
    restaurantName: sanitiseRestaurantName(value.restaurantName),
    pricePerDiner: clampPricePerDiner(value.pricePerDiner),
    dinerCount: clampDinerCount(value.dinerCount),
    pricingProfile,
    customFoods,
    items,
  };
}

/** Returns null for anything that is not a token this build can read. */
export function decodeSharePayload(token: string | null | undefined): SharePayload | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_SHARE_TOKEN_LENGTH) {
    return null;
  }
  return token.startsWith(`${LEGACY_SHARE_TOKEN_VERSION}.`)
    ? decodeLegacySharePayload(token)
    : decodeConfigurableSharePayload(token);
}

/** Convenience for building the full path a recipient will open. */
export function shareLinkPath(session: MealSession, context: ShareContext = {}): string | null {
  const token = encodeSharePayload(session, context);
  return token === null ? null : `/share/${token}`;
}

/** Every cut in the dataset must be shareable; used by the completeness test. */
export function foodsMissingShareCodes(): readonly string[] {
  return FOODS.filter((food) => FOOD_SHARE_CODES[food.id] === undefined).map((food) => food.id);
}
