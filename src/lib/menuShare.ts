import { clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import { MAX_CUSTOM_FOODS, nextCustomFoodId, parseCustomFood } from '@/lib/customFoods';
import { DEFAULT_PRICING_PROFILE, isPricingProfileId } from '@/lib/pricing';
import {
  createPricingProfile,
  nextPricingProfileId,
  parseCustomPricingProfile,
} from '@/lib/pricingProfiles';
import { createRestaurantProfile, restaurantId, type RestaurantProfile } from '@/lib/restaurants';
import { sanitiseRestaurantName } from '@/lib/storage';
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
import type { FoodPricing, PricingProfile } from '@/types/pricing';

/**
 * A personal menu, encoded into a link.
 *
 * Exactly the same architecture as a shared report: the link *is* the payload,
 * there is no database behind it, and nothing is uploaded. What travels is the
 * pricing assumptions, the diner-authored foods and — only if the sender asks
 * — the restaurant setup those assumptions belong to.
 *
 * What deliberately never travels: filed history, saved orders, the diner
 * directory, private notes, backups, or anything else the device holds. A menu
 * link carries a menu.
 */

/**
 * 1 — URL-safe base64 JSON.
 * 2 — the same document, compressed.
 *
 * Both still decode, because a menu someone shared is an address that has to
 * keep working.
 */
export const MENU_TOKEN_VERSION = 2;
const VERBOSE_MENU_TOKEN_VERSION = 1;

/** A menu is larger than a meal, and still has to fit in an address bar. */
export const MAX_MENU_TOKEN_LENGTH = 4096;

/**
 * A full personal catalogue is the largest document any link carries, and this
 * is still a fixed ceiling checked before a byte is allocated.
 */
export const MAX_MENU_DECODED_BYTES = 64 * 1024;

const MENU_LIMITS: PackLimits = {
  maxDecodedBytes: MAX_MENU_DECODED_BYTES,
  maxEncodedLength: MAX_MENU_TOKEN_LENGTH - 2,
};

export interface SharedRestaurantSetup {
  readonly name: string;
  readonly pricePerDiner: number;
  readonly dinerCount: number;
}

export interface MenuSharePayload {
  readonly pricingProfile: PricingProfile;
  readonly customFoods: readonly CustomFood[];
  /** Present only when the sender chose to include it. */
  readonly restaurant?: SharedRestaurantSetup;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Encodes a menu, saying whether it was empty or simply too big to carry. */
export function encodeMenuResult(payload: MenuSharePayload): ShareEncodeResult {
  const customFoods = payload.customFoods.slice(0, MAX_CUSTOM_FOODS);
  const overrides = Object.keys(payload.pricingProfile.overrides).length;

  // An empty menu is a link to nothing.
  if (customFoods.length === 0 && overrides === 0 && !payload.restaurant) {
    return shareEncodeFailure('empty');
  }

  const body = {
    pricingProfile: {
      id: payload.pricingProfile.id,
      name: payload.pricingProfile.name,
      money: payload.pricingProfile.money,
      overrides: payload.pricingProfile.overrides,
    },
    customFoods: customFoods.map((food) => ({ ...food })),
    ...(payload.restaurant
      ? {
          restaurant: {
            name: sanitiseRestaurantName(payload.restaurant.name),
            pricePerDiner: clampPricePerDiner(payload.restaurant.pricePerDiner),
            dinerCount: clampDinerCount(payload.restaurant.dinerCount),
          },
        }
      : {}),
  };

  const packed = packShareBody(JSON.stringify(body), MENU_LIMITS);
  return packed === null
    ? shareEncodeFailure('too-large')
    : shareEncodeSuccess(`${MENU_TOKEN_VERSION}.${packed}`);
}

/**
 * Encodes a menu, or returns null when there is nothing worth sharing or the
 * result would be too long to be a usable address.
 */
export function encodeMenuPayload(payload: MenuSharePayload): string | null {
  return shareTokenOrNull(encodeMenuResult(payload));
}

function parseSharedProfile(value: unknown): PricingProfile | null {
  if (isRecord(value) && value.id === DEFAULT_PRICING_PROFILE.id) {
    return DEFAULT_PRICING_PROFILE;
  }
  return parseCustomPricingProfile(value);
}

function parseSharedFoods(value: unknown): readonly CustomFood[] {
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

function parseSharedRestaurant(value: unknown): SharedRestaurantSetup | null {
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
  return {
    name,
    pricePerDiner: clampPricePerDiner(value.pricePerDiner),
    dinerCount: clampDinerCount(value.dinerCount),
  };
}

/**
 * Returns null for anything that is not a menu token this build can read.
 *
 * The version is checked by explicit prefix rather than inferred, so a token
 * from a later build fails cleanly here instead of being half-understood.
 */
export function decodeMenuPayload(token: string | null | undefined): MenuSharePayload | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_MENU_TOKEN_LENGTH) {
    return null;
  }

  const separator = token.indexOf('.');
  if (separator < 0) {
    return null;
  }

  const body = token.slice(separator + 1);
  const version = token.slice(0, separator);
  let decoded: string | null;
  if (version === String(VERBOSE_MENU_TOKEN_VERSION)) {
    decoded = decodeUrlText(body);
  } else if (version === String(MENU_TOKEN_VERSION)) {
    decoded = unpackShareBody(body, MENU_LIMITS);
  } else {
    return null;
  }
  if (decoded === null) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }

  const pricingProfile = parseSharedProfile(value.pricingProfile);
  if (!pricingProfile) {
    return null;
  }
  const customFoods = parseSharedFoods(value.customFoods);
  const restaurant = parseSharedRestaurant(value.restaurant);

  const overrides = Object.keys(pricingProfile.overrides).length;
  if (customFoods.length === 0 && overrides === 0 && !restaurant) {
    return null;
  }

  return {
    pricingProfile,
    customFoods,
    ...(restaurant ? { restaurant } : {}),
  };
}

/** Convenience for building the full path a recipient will open. */
export function menuLinkPath(payload: MenuSharePayload): string | null {
  const token = encodeMenuPayload(payload);
  return token === null ? null : `/menu/${token}`;
}

export interface LocalMenu {
  readonly pricingProfiles: readonly PricingProfile[];
  readonly customFoods: readonly CustomFood[];
  readonly restaurants: readonly RestaurantProfile[];
}

export interface MenuImportPlan {
  /** Null when the sender shared the built-in context, which everyone has. */
  readonly pricingProfile: PricingProfile | null;
  readonly pricingProfileRenamed: boolean;
  readonly customFoods: readonly CustomFood[];
  /** Foods that had to be given a new local id because one was already taken. */
  readonly renamedFoods: readonly string[];
  readonly restaurant: RestaurantProfile | null;
  readonly restaurantRenamed: boolean;
  /** True when anything at all would be written. */
  readonly writes: boolean;
}

function uniqueRestaurantName(existing: readonly RestaurantProfile[], name: string): string {
  const taken = new Set(existing.map((entry) => entry.id));
  if (!taken.has(restaurantId(name))) {
    return name;
  }
  let suffix = 1;
  let candidate = `${name} (shared)`;
  while (taken.has(restaurantId(candidate))) {
    suffix += 1;
    candidate = `${name} (shared ${suffix})`;
  }
  return candidate;
}

/**
 * Works out exactly what importing would write, without writing anything.
 *
 * Nothing local is ever replaced. Anything whose identifier is already taken
 * comes in under a fresh one, so the recipient keeps both and can compare them
 * — an imported menu is a suggestion, not an instruction.
 */
export function planMenuImport(
  payload: MenuSharePayload,
  local: LocalMenu,
  at: string,
): MenuImportPlan {
  const foodIdMap = new Map<string, string>();
  const takenFoodIds = new Set(local.customFoods.map((food) => food.id));

  const customFoods: CustomFood[] = [];
  const renamedFoods: string[] = [];
  for (const food of payload.customFoods) {
    if (!takenFoodIds.has(food.id)) {
      takenFoodIds.add(food.id);
      customFoods.push(food);
      continue;
    }
    const id = nextCustomFoodId([...local.customFoods, ...customFoods], food.name);
    takenFoodIds.add(id);
    foodIdMap.set(food.id, id);
    renamedFoods.push(food.name);
    customFoods.push({ ...food, id });
  }

  let pricingProfile: PricingProfile | null = null;
  let pricingProfileRenamed = false;

  if (payload.pricingProfile.id !== DEFAULT_PRICING_PROFILE.id) {
    // Overrides key on food ids, so a renamed food has to take its price with it.
    const overrides: Record<string, FoodPricing> = {};
    for (const [foodId, pricing] of Object.entries(payload.pricingProfile.overrides)) {
      overrides[foodIdMap.get(foodId) ?? foodId] = pricing;
    }

    const collides = local.pricingProfiles.some(
      (profile) => profile.id === payload.pricingProfile.id,
    );
    const name = collides ? `${payload.pricingProfile.name} (shared)` : payload.pricingProfile.name;
    const id = collides
      ? nextPricingProfileId(local.pricingProfiles, name)
      : payload.pricingProfile.id;

    pricingProfileRenamed = collides;
    pricingProfile = isPricingProfileId(id)
      ? createPricingProfile(
          {
            name,
            currency: payload.pricingProfile.money.currency,
            locale: payload.pricingProfile.money.locale,
            overrides,
          },
          id,
        )
      : null;
  }

  let restaurant: RestaurantProfile | null = null;
  let restaurantRenamed = false;
  if (payload.restaurant) {
    const name = uniqueRestaurantName(local.restaurants, payload.restaurant.name);
    restaurantRenamed = name !== payload.restaurant.name;
    restaurant = createRestaurantProfile(
      {
        name,
        pricePerDiner: payload.restaurant.pricePerDiner,
        dinerCount: payload.restaurant.dinerCount,
        ...(pricingProfile ? { pricingProfileId: pricingProfile.id } : {}),
      },
      at,
    );
  }

  return {
    pricingProfile,
    pricingProfileRenamed,
    customFoods,
    renamedFoods,
    restaurant,
    restaurantRenamed,
    writes: pricingProfile !== null || customFoods.length > 0 || restaurant !== null,
  };
}
