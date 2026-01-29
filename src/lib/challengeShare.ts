import { evaluateAchievementIds } from '@/lib/achievements';
import { buildDamageReport, clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import { compareSessions, type SessionComparison } from '@/lib/comparison';
import { MAX_CUSTOM_FOODS, parseCustomFood } from '@/lib/customFoods';
import { isIsoTimestamp } from '@/lib/datetime';
import { foodCatalogue, findFoodInCatalogue } from '@/lib/foodCatalogue';
import { MAX_LINE_QUANTITY, MIN_QUANTITY, isPlateSize, isQualityTier } from '@/lib/constants';
import { mealItemId } from '@/lib/mealItems';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import { parseCustomPricingProfile } from '@/lib/pricingProfiles';
import { sanitiseRestaurantName } from '@/lib/storage';
import { decodeUrlText, encodeUrlText } from '@/lib/urlText';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { CustomFood } from '@/types/customFoods';
import type { MealItem, PlateSize, QualityTier } from '@/types/meal';
import type { PricingProfile } from '@/types/pricing';

/**
 * Two completed meals, measured against each other, encoded into a link.
 *
 * The same architecture as every other share in this project: no backend, no
 * challenge database, no account, and no server-side record. The link carries
 * exactly what the comparison needs to be reproduced, and the comparison
 * itself is the app's own engine — a challenge is the `/history/compare` page
 * with its two sides read from an address instead of from the file.
 *
 * What never travels: diner names, roster attribution, private notes, the meal
 * ledger, saved orders and everything else the device holds. A challenge is two
 * meals and their prices.
 */

export const CHALLENGE_TOKEN_VERSION = 1;

/** Two meals is more than one, so the bound is larger than a report's — still fixed. */
export const MAX_CHALLENGE_TOKEN_LENGTH = 4096;

/** More lines than a real tab carries, and a hard stop on a hostile one. */
export const MAX_CHALLENGE_ITEMS = 24;

export interface ChallengeSide {
  /** The restaurant name, or empty. Never a diner's name. */
  readonly label: string;
  readonly recordedAt: string;
  readonly pricePerDiner: number;
  readonly dinerCount: number;
  readonly pricingProfile: PricingProfile;
  readonly customFoods: readonly CustomFood[];
  readonly items: readonly MealItem[];
}

export interface ChallengePayload {
  readonly previous: ChallengeSide;
  readonly current: ChallengeSide;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Strips a filed record down to a challengeable side.
 *
 * Written as an explicit projection rather than a deletion, so a field added to
 * the record later cannot leak into a link by being forgotten here.
 */
export function challengeSideFromRecord(record: SavedMealSession): ChallengeSide {
  return {
    label: sanitiseRestaurantName(record.restaurantName),
    recordedAt: record.createdAt,
    pricePerDiner: clampPricePerDiner(record.pricePerDiner),
    dinerCount: clampDinerCount(record.dinerCount),
    pricingProfile: record.pricingProfile,
    customFoods: record.customFoods.map((food) => ({ ...food })),
    items: record.items.slice(0, MAX_CHALLENGE_ITEMS).map((item) => ({
      id: item.id,
      foodId: item.foodId,
      quality: item.quality,
      plateSize: item.plateSize,
      quantity: item.quantity,
    })),
  };
}

/** Compact keys, because two meals have to fit in one address. */
function encodeSide(side: ChallengeSide) {
  return {
    l: side.label,
    t: side.recordedAt,
    p: side.pricePerDiner,
    d: side.dinerCount,
    m: {
      i: side.pricingProfile.id,
      n: side.pricingProfile.name,
      c: side.pricingProfile.money,
      o: side.pricingProfile.overrides,
    },
    f: side.customFoods,
    x: side.items.map((item) => ({
      f: item.foodId,
      q: item.quality,
      s: item.plateSize,
      n: item.quantity,
    })),
  };
}

export function encodeChallengePayload(payload: ChallengePayload): string | null {
  if (payload.previous.items.length === 0 || payload.current.items.length === 0) {
    return null;
  }

  const token = `${CHALLENGE_TOKEN_VERSION}.${encodeUrlText(
    JSON.stringify({
      a: encodeSide(payload.previous),
      b: encodeSide(payload.current),
    }),
  )}`;

  return token.length <= MAX_CHALLENGE_TOKEN_LENGTH ? token : null;
}

function parseProfile(value: unknown): PricingProfile {
  if (!isRecord(value)) {
    return DEFAULT_PRICING_PROFILE;
  }
  if (value.i === DEFAULT_PRICING_PROFILE.id) {
    return DEFAULT_PRICING_PROFILE;
  }
  return (
    parseCustomPricingProfile({
      id: value.i,
      name: value.n,
      money: value.c,
      overrides: value.o,
    }) ?? DEFAULT_PRICING_PROFILE
  );
}

function parseFoods(value: unknown): readonly CustomFood[] {
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

function parseItems(
  value: unknown,
  customFoods: readonly CustomFood[],
): readonly MealItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CHALLENGE_ITEMS) {
    return null;
  }
  const foods = foodCatalogue(customFoods);
  const items: MealItem[] = [];

  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.f !== 'string') {
      return null;
    }
    if (!findFoodInCatalogue(foods, entry.f)) {
      return null;
    }
    if (!isQualityTier(entry.q) || !isPlateSize(entry.s)) {
      return null;
    }
    if (typeof entry.n !== 'number' || !Number.isFinite(entry.n)) {
      return null;
    }
    const quality: QualityTier = entry.q;
    const plateSize: PlateSize = entry.s;
    items.push({
      id: mealItemId({ foodId: entry.f, quality, plateSize }),
      foodId: entry.f,
      quality,
      plateSize,
      quantity: Math.min(MAX_LINE_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(entry.n))),
    });
  }
  return items;
}

function parseSide(value: unknown): ChallengeSide | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.p !== 'number' || !Number.isFinite(value.p)) {
    return null;
  }
  if (typeof value.d !== 'number' || !Number.isFinite(value.d)) {
    return null;
  }

  const customFoods = parseFoods(value.f);
  const items = parseItems(value.x, customFoods);
  if (!items) {
    return null;
  }

  return {
    label: sanitiseRestaurantName(value.l),
    // A timestamp that is not one is replaced rather than guessed at; the
    // comparison only uses it to order and to label the two sides.
    recordedAt: isIsoTimestamp(value.t) ? value.t : new Date(0).toISOString(),
    pricePerDiner: clampPricePerDiner(value.p),
    dinerCount: clampDinerCount(value.d),
    pricingProfile: parseProfile(value.m),
    customFoods,
    items,
  };
}

export function decodeChallengePayload(token: string | null | undefined): ChallengePayload | null {
  if (
    typeof token !== 'string' ||
    token.length === 0 ||
    token.length > MAX_CHALLENGE_TOKEN_LENGTH
  ) {
    return null;
  }

  const separator = token.indexOf('.');
  if (separator < 0 || token.slice(0, separator) !== String(CHALLENGE_TOKEN_VERSION)) {
    return null;
  }

  const decoded = decodeUrlText(token.slice(separator + 1));
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

  const previous = parseSide(value.a);
  const current = parseSide(value.b);
  if (!previous || !current) {
    return null;
  }

  return { previous, current };
}

/**
 * Rebuilds a side as a record the comparison engine already knows how to read.
 *
 * Achievements are recomputed from the meal rather than carried in the token:
 * the sender does not get to assert what their meal earned, and the engine
 * gives the same answer for both sides by construction.
 */
function recordFromSide(side: ChallengeSide, id: string): SavedMealSession {
  const foods = foodCatalogue(side.customFoods);
  const report = buildDamageReport(
    side.items,
    { pricePerDiner: side.pricePerDiner, dinerCount: side.dinerCount },
    side.pricingProfile,
    foods,
  );
  const verdict = getVerdict(report.totalRetailValue, report.totalAdmission);

  return {
    id,
    version: 0,
    createdAt: side.recordedAt,
    restaurantName: side.label,
    pricePerDiner: side.pricePerDiner,
    dinerCount: side.dinerCount,
    pricingProfile: side.pricingProfile,
    customFoods: side.customFoods,
    note: '',
    items: side.items,
    fingerprint: id,
    snapshot: {
      achievementIds: evaluateAchievementIds(report, side.dinerCount),
      totalAdmission: report.totalAdmission,
      totalRetailValue: report.totalRetailValue,
      totalRestaurantCost: report.totalRestaurantCost,
      totalPlates: report.totalPlates,
      totalWeightKg: report.totalWeightKg,
      retailRecoveryPercent: report.retailRecoveryPercent,
      nutrition: report.nutrition,
      verdictId: verdict.id,
    },
  };
}

/** Runs the app's own comparison over a decoded challenge. */
export function comparisonFromChallenge(payload: ChallengePayload): SessionComparison {
  return compareSessions(
    recordFromSide(payload.previous, 'challenge-a'),
    recordFromSide(payload.current, 'challenge-b'),
  );
}

/** Convenience for building the full path a recipient will open. */
export function challengeLinkPath(payload: ChallengePayload): string | null {
  const token = encodeChallengePayload(payload);
  return token === null ? null : `/challenge/${token}`;
}
