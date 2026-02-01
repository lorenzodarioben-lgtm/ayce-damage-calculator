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
import { parseAdjustments } from '@/lib/adjustments';
import { normaliseConsumedQuantity } from '@/lib/consumption';
import { normaliseSeparateCharge } from '@/lib/separateCharges';
import { isDinerId } from '@/lib/diners';
import {
  packShareBody,
  shareEncodeFailure,
  shareEncodeSuccess,
  shareTokenOrNull,
  unpackShareBody,
  type PackLimits,
  type ShareEncodeResult,
} from '@/lib/shareCodec';
import { decodeUrlText } from '@/lib/urlText';
import type { CustomFood } from '@/types/customFoods';
import type { PricingProfile } from '@/types/pricing';
import type {
  BillAdjustment,
  Diner,
  FoodItem,
  MealItem,
  MealSession,
  PlateSize,
  QualityTier,
} from '@/types/meal';

/**
 * Encodes a completed meal into a URL path segment.
 *
 * There is no database behind a shared report: the link *is* the payload. That
 * makes the encoding a trust boundary, so everything here is written to be
 * bounded and total — a malformed, hostile or simply outdated token has to fail
 * to `null` rather than throw, and can never produce a meal the calculator
 * itself could not have produced.
 */

/**
 * 1 — a compact dot-separated tuple, before menus were configurable.
 * 2 — URL-safe base64 JSON, carrying the pricing and custom-food context.
 * 3 — the same document, compressed.
 *
 * Every one of these still decodes. A link someone posted a year ago is a
 * permanent address, and there is no server that could migrate it.
 */
export const SHARE_TOKEN_VERSION = 3;
const LEGACY_SHARE_TOKEN_VERSION = 1;
const VERBOSE_SHARE_TOKEN_VERSION = 2;

/** Refuse absurd input before any parsing work is done. */
export const MAX_SHARE_TOKEN_LENGTH = 2048;

/**
 * The largest meal document the codec will pack or accept.
 *
 * Comfortably above a full tab with a complete custom menu attached, and a
 * fixed ceiling a decoder can check a token's own claim against before it
 * allocates anything.
 */
export const MAX_SHARE_DECODED_BYTES = 32 * 1024;

const SHARE_LIMITS: PackLimits = {
  maxDecodedBytes: MAX_SHARE_DECODED_BYTES,
  // The version prefix and its separator come out of the address budget.
  maxEncodedLength: MAX_SHARE_TOKEN_LENGTH - 2,
};

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
  readonly diners?: readonly Diner[];
  /**
   * What settled the bill. Carried because a recipient who cannot see the
   * voucher would recompute a different recovery figure from the same plates,
   * which is exactly the misreport the link exists to avoid.
   */
  readonly adjustments?: readonly BillAdjustment[];
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

/**
 * Encodes the current meal, saying why when it cannot.
 *
 * Version 3 packs the same document version 2 carried, so nothing about what
 * travels has changed — only how many bytes it takes. That headroom is the
 * feature: a tab with a full custom menu attached used to overflow the address
 * long before it reached the line limit, and now it fits.
 */
export function encodeShareResult(
  session: MealSession,
  context: ShareContext = {},
): ShareEncodeResult {
  if (session.items.length === 0) {
    return shareEncodeFailure('empty');
  }
  if (session.items.length > MAX_SHARE_ITEMS) {
    return shareEncodeFailure('too-large');
  }

  const customFoods = (context.customFoods ?? [])
    .filter((food) => session.items.some((item) => item.foodId === food.id))
    .slice(0, MAX_CUSTOM_FOODS);
  const availableFoods = foodCatalogue(customFoods);
  if (session.items.some((item) => !findFoodInCatalogue(availableFoods, item.foodId))) {
    return shareEncodeFailure('empty');
  }
  const payload = {
    restaurantName: sanitiseRestaurantName(session.restaurantName),
    pricePerDiner: clampPricePerDiner(session.pricePerDiner),
    dinerCount: clampDinerCount(session.dinerCount),
    pricingProfile: context.pricingProfile ?? DEFAULT_PRICING_PROFILE,
    customFoods,
    diners: session.diners?.map((diner, index) => ({
      id: diner.id,
      displayName: `Diner ${index + 1}`,
    })),
    // Labels travel, because "Voucher" is what the money was; the diner they
    // were charged to travels only as the same opaque id the roster already
    // anonymises.
    adjustments: session.adjustments?.length ? session.adjustments : undefined,
    items: session.items.slice(0, MAX_SHARE_ITEMS).map((item) => {
      const quantity = Math.min(
        MAX_LINE_QUANTITY,
        Math.max(MIN_QUANTITY, Math.floor(item.quantity)),
      );
      const consumed = normaliseConsumedQuantity(item.consumedQuantity, quantity);
      const charged = normaliseSeparateCharge(item.separateCharge);
      return {
        foodId: item.foodId,
        quality: item.quality,
        plateSize: item.plateSize,
        quantity,
        // Omitted for a clean plate, so a link carrying an ordinary meal is
        // exactly the document it always was.
        ...(consumed === undefined ? {} : { consumedQuantity: consumed }),
        // Carried because the recipient's recovery figure would otherwise
        // count food the sender paid for outside the buffet price.
        ...(item.sharedAmong?.length ? { sharedAmong: item.sharedAmong } : {}),
        ...(item.separatelyCharged === true ? { separatelyCharged: true } : {}),
        ...(item.separatelyCharged === true && charged !== undefined
          ? { separateCharge: charged }
          : {}),
      };
    }),
  };
  const body = packShareBody(JSON.stringify(payload), SHARE_LIMITS);
  return body === null
    ? shareEncodeFailure('too-large')
    : shareEncodeSuccess(`${SHARE_TOKEN_VERSION}.${body}`);
}

export function encodeSharePayload(
  session: MealSession,
  context: ShareContext = {},
): string | null {
  return shareTokenOrNull(encodeShareResult(session, context));
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

  const restaurantName = decodeUrlText(nameRaw);
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
    const safeQuantity = Math.min(MAX_LINE_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(quantity)));
    const consumed = normaliseConsumedQuantity(entry.consumedQuantity, safeQuantity);
    const charged = normaliseSeparateCharge(entry.separateCharge);
    const separate = entry.separatelyCharged === true;
    items.push({
      id: `shared-${index}-${entry.foodId}`,
      foodId: entry.foodId,
      quality: quality as QualityTier,
      plateSize: plateSize as PlateSize,
      quantity: safeQuantity,
      ...(consumed === undefined ? {} : { consumedQuantity: consumed }),
      ...(Array.isArray(entry.sharedAmong) && entry.sharedAmong.length
        ? { sharedAmong: (entry.sharedAmong as readonly unknown[]).filter(isDinerId) }
        : {}),
      ...(separate ? { separatelyCharged: true as const } : {}),
      ...(separate && charged !== undefined ? { separateCharge: charged } : {}),
    });
  }
  return items;
}

/** The document body both version 2 and version 3 carry, once it is text again. */
function parseShareDocument(decoded: string): SharePayload | null {
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
  const diners = Array.isArray(value.diners)
    ? value.diners
        .filter(isRecord)
        .map((diner, index) => ({
          id: typeof diner.id === 'string' ? diner.id : '',
          displayName: `Diner ${index + 1}`,
        }))
        .filter((diner) => diner.id.length > 0)
    : [];
  const adjustments = parseAdjustments(value.adjustments, diners);

  return {
    restaurantName: sanitiseRestaurantName(value.restaurantName),
    pricePerDiner: clampPricePerDiner(value.pricePerDiner),
    dinerCount: clampDinerCount(value.dinerCount),
    pricingProfile,
    customFoods,
    items,
    ...(diners.length ? { diners } : {}),
    ...(adjustments.length ? { adjustments } : {}),
  };
}

/** Version 2: the document as URL-safe base64 JSON. */
function decodeVerboseSharePayload(body: string): SharePayload | null {
  const decoded = decodeUrlText(body);
  return decoded === null ? null : parseShareDocument(decoded);
}

/** Version 3: the same document, compressed and length-prefixed. */
function decodeCompressedSharePayload(body: string): SharePayload | null {
  const decoded = unpackShareBody(body, SHARE_LIMITS);
  return decoded === null ? null : parseShareDocument(decoded);
}

/**
 * Returns null for anything that is not a token this build can read.
 *
 * Dispatch is on the version prefix and nothing else. A token is never tried
 * against a second reader after the first declines it: guessing at a format
 * would mean a corrupt version-3 body could be re-read as some other version's
 * and produce a meal nobody shared.
 */
export function decodeSharePayload(token: string | null | undefined): SharePayload | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_SHARE_TOKEN_LENGTH) {
    return null;
  }

  const separator = token.indexOf('.');
  if (separator < 0) {
    return null;
  }
  const body = token.slice(separator + 1);

  switch (token.slice(0, separator)) {
    case String(LEGACY_SHARE_TOKEN_VERSION):
      return decodeLegacySharePayload(token);
    case String(VERBOSE_SHARE_TOKEN_VERSION):
      return decodeVerboseSharePayload(body);
    case String(SHARE_TOKEN_VERSION):
      return decodeCompressedSharePayload(body);
    default:
      return null;
  }
}

/** Convenience for building the full path a recipient will open. */
export function shareLinkPath(session: MealSession, context: ShareContext = {}): string | null {
  const token = encodeSharePayload(session, context);
  return token === null ? null : `/share/${token}`;
}

export type ShareLinkResult =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly reason: 'empty' | 'too-large' };

/** The path, or the reason there is not one, for surfaces that report both. */
export function shareLinkResult(session: MealSession, context: ShareContext = {}): ShareLinkResult {
  const result = encodeShareResult(session, context);
  return result.ok ? { ok: true, path: `/share/${result.token}` } : result;
}

/** Every cut in the dataset must be shareable; used by the completeness test. */
export function foodsMissingShareCodes(): readonly string[] {
  return FOODS.filter((food) => FOOD_SHARE_CODES[food.id] === undefined).map((food) => food.id);
}
