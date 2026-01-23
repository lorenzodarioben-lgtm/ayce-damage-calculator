import { DEFAULT_PRICING_PROFILE, isPricingProfileId } from '@/lib/pricing';
import { resolveMoneyContext } from '@/lib/money';
import type { FoodPricing, PricingProfile, PricingProfileId } from '@/types/pricing';

export const PRICING_PROFILES_STORAGE_KEY = 'ayce-damage-pricing-profiles';
export const PRICING_PROFILES_VERSION = 1;
export const MAX_STORED_PRICING_PROFILES_LENGTH = 64 * 1024;
export const MAX_PRICING_PROFILES = 12;
export const MAX_PROFILE_NAME_LENGTH = 48;
export const MAX_PROFILE_OVERRIDES = 128;

export interface PricingProfileDraft {
  readonly name: string;
  readonly currency?: string;
  readonly locale?: string;
  readonly overrides?: Readonly<Record<string, FoodPricing>>;
}

interface StoredEnvelope {
  readonly version: number;
  readonly profiles: readonly PricingProfile[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function normalisePricingProfileName(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_PROFILE_NAME_LENGTH)
    : '';
}

export function pricingProfileId(name: string): PricingProfileId {
  const slug = normalisePricingProfileName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `custom-${slug || 'menu'}`;
}

export function nextPricingProfileId(
  profiles: readonly PricingProfile[],
  name: string,
): PricingProfileId {
  const base = pricingProfileId(name);
  const used = new Set(profiles.map((profile) => profile.id));
  if (!used.has(base)) {
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function parseOverrides(value: unknown): Readonly<Record<string, FoodPricing>> {
  if (!isRecord(value)) {
    return {};
  }

  const overrides: Record<string, FoodPricing> = {};
  for (const [foodId, pricing] of Object.entries(value)) {
    if (
      isPricingProfileId(foodId) &&
      isRecord(pricing) &&
      validPrice(pricing.retailPricePerKg) &&
      validPrice(pricing.restaurantCostPerKg)
    ) {
      overrides[foodId] = {
        retailPricePerKg: pricing.retailPricePerKg,
        restaurantCostPerKg: pricing.restaurantCostPerKg,
      };
    }
    if (Object.keys(overrides).length >= MAX_PROFILE_OVERRIDES) {
      break;
    }
  }
  return overrides;
}

export function createPricingProfile(
  draft: PricingProfileDraft,
  id: PricingProfileId,
): PricingProfile | null {
  const name = normalisePricingProfileName(draft.name);
  if (!name || !isPricingProfileId(id)) {
    return null;
  }

  return {
    id,
    name,
    money: resolveMoneyContext({ currency: draft.currency, locale: draft.locale }),
    overrides: parseOverrides(draft.overrides),
    builtIn: false,
  };
}

export function upsertPricingProfile(
  profiles: readonly PricingProfile[],
  profile: PricingProfile,
): readonly PricingProfile[] {
  if (profile.builtIn) {
    return profiles;
  }
  return [profile, ...profiles.filter((entry) => entry.id !== profile.id)].slice(
    0,
    MAX_PRICING_PROFILES,
  );
}

export function removePricingProfile(
  profiles: readonly PricingProfile[],
  id: PricingProfileId,
): readonly PricingProfile[] {
  return profiles.filter((profile) => profile.id !== id || profile.builtIn);
}

export function allPricingProfiles(
  customProfiles: readonly PricingProfile[],
): readonly PricingProfile[] {
  return [DEFAULT_PRICING_PROFILE, ...customProfiles.filter((profile) => !profile.builtIn)];
}

export function findPricingProfile(
  customProfiles: readonly PricingProfile[],
  id: PricingProfileId | undefined,
): PricingProfile {
  return (
    allPricingProfiles(customProfiles).find((profile) => profile.id === id) ??
    DEFAULT_PRICING_PROFILE
  );
}

/** Looks up an id in an already-complete profile list, such as a hydrated hook result. */
export function resolvePricingProfile(
  profiles: readonly PricingProfile[],
  id: PricingProfileId | undefined,
): PricingProfile {
  return profiles.find((profile) => profile.id === id) ?? DEFAULT_PRICING_PROFILE;
}

export function parseCustomPricingProfile(value: unknown): PricingProfile | null {
  if (!isRecord(value) || !isPricingProfileId(value.id)) {
    return null;
  }
  return createPricingProfile(
    {
      name: typeof value.name === 'string' ? value.name : '',
      ...(isRecord(value.money) && typeof value.money.currency === 'string'
        ? { currency: value.money.currency }
        : {}),
      ...(isRecord(value.money) && typeof value.money.locale === 'string'
        ? { locale: value.money.locale }
        : {}),
      overrides: parseOverrides(value.overrides),
    },
    value.id,
  );
}

export function parseStoredPricingProfiles(raw: string | null): readonly PricingProfile[] {
  if (!raw || raw.length > MAX_STORED_PRICING_PROFILES_LENGTH) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (
    !isRecord(parsed) ||
    parsed.version !== PRICING_PROFILES_VERSION ||
    !Array.isArray(parsed.profiles)
  ) {
    return [];
  }

  const profiles: PricingProfile[] = [];
  const ids = new Set<PricingProfileId>();
  for (const entry of parsed.profiles) {
    const profile = parseCustomPricingProfile(entry);
    if (profile && !ids.has(profile.id) && profile.id !== DEFAULT_PRICING_PROFILE.id) {
      ids.add(profile.id);
      profiles.push(profile);
    }
    if (profiles.length >= MAX_PRICING_PROFILES) {
      break;
    }
  }
  return profiles;
}

export function loadPricingProfiles(): readonly PricingProfile[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    return parseStoredPricingProfiles(window.localStorage.getItem(PRICING_PROFILES_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function savePricingProfiles(profiles: readonly PricingProfile[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  const envelope: StoredEnvelope = {
    version: PRICING_PROFILES_VERSION,
    profiles: profiles.filter((profile) => !profile.builtIn).slice(0, MAX_PRICING_PROFILES),
  };
  try {
    window.localStorage.setItem(PRICING_PROFILES_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // A failed write only costs persistence, never the active table.
  }
}
