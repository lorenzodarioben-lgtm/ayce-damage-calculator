import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import {
  MAX_PRICING_PROFILES,
  MAX_STORED_PRICING_PROFILES_LENGTH,
  PRICING_PROFILES_STORAGE_KEY,
  PRICING_PROFILES_VERSION,
  allPricingProfiles,
  createPricingProfile,
  findPricingProfile,
  loadPricingProfiles,
  nextPricingProfileId,
  parseStoredPricingProfiles,
  removePricingProfile,
  savePricingProfiles,
  upsertPricingProfile,
} from '@/lib/pricingProfiles';
import type { PricingProfile } from '@/types/pricing';

const PROFILE: PricingProfile = {
  id: 'custom-weekend-market',
  name: 'Weekend Market',
  money: { currency: 'USD', locale: 'en-US' },
  overrides: { 'beef-ribeye': { retailPricePerKg: 75, restaurantCostPerKg: 42 } },
  builtIn: false,
};

function stored(profiles: readonly unknown[], version = PRICING_PROFILES_VERSION): string {
  return JSON.stringify({ version, profiles });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('pricing profile helpers', () => {
  it('creates a bounded custom profile with its selected money context', () => {
    expect(
      createPricingProfile(
        { name: '  Weekend  Market ', currency: 'USD', locale: 'en-US' },
        PROFILE.id,
      ),
    ).toMatchObject({
      id: PROFILE.id,
      name: 'Weekend Market',
      money: { currency: 'USD', locale: 'en-US' },
      builtIn: false,
    });
  });

  it('allocates a stable unused id from the profile name', () => {
    expect(nextPricingProfileId([DEFAULT_PRICING_PROFILE], 'Weekend Market')).toBe(PROFILE.id);
    expect(nextPricingProfileId([DEFAULT_PRICING_PROFILE, PROFILE], 'Weekend Market')).toBe(
      'custom-weekend-market-2',
    );
  });

  it('updates, removes and caps custom profiles without touching the default', () => {
    expect(upsertPricingProfile([], DEFAULT_PRICING_PROFILE)).toEqual([]);
    expect(
      removePricingProfile([DEFAULT_PRICING_PROFILE, PROFILE], DEFAULT_PRICING_PROFILE.id),
    ).toContain(DEFAULT_PRICING_PROFILE);
    expect(removePricingProfile([PROFILE], PROFILE.id)).toEqual([]);

    const many = Array.from({ length: MAX_PRICING_PROFILES + 1 }, (_, index) => ({
      ...PROFILE,
      id: `custom-profile-${index}`,
      name: `Profile ${index}`,
    }));
    const storedProfiles = many.reduce<readonly PricingProfile[]>(
      (profiles, profile) => upsertPricingProfile(profiles, profile),
      [],
    );
    expect(storedProfiles).toHaveLength(MAX_PRICING_PROFILES);
  });

  it('always provides a usable fallback profile', () => {
    expect(allPricingProfiles([PROFILE])).toEqual([DEFAULT_PRICING_PROFILE, PROFILE]);
    expect(findPricingProfile([], 'missing')).toBe(DEFAULT_PRICING_PROFILE);
    expect(findPricingProfile([PROFILE], PROFILE.id)).toBe(PROFILE);
  });
});

describe('pricing profile storage', () => {
  it('round-trips custom profiles without persisting the built-in default', () => {
    savePricingProfiles([DEFAULT_PRICING_PROFILE, PROFILE]);
    expect(window.localStorage.getItem(PRICING_PROFILES_STORAGE_KEY)).not.toContain(
      DEFAULT_PRICING_PROFILE.id,
    );
    expect(loadPricingProfiles()).toEqual([PROFILE]);
  });

  it.each([
    ['nothing', null],
    ['bad JSON', '{ nope'],
    ['wrong version', stored([PROFILE], 99)],
    ['oversized data', 'x'.repeat(MAX_STORED_PRICING_PROFILES_LENGTH + 1)],
  ])('returns no custom profiles for %s', (_label, raw) => {
    expect(parseStoredPricingProfiles(raw)).toEqual([]);
  });

  it('repairs malformed overrides and drops duplicate/default entries', () => {
    const parsed = parseStoredPricingProfiles(
      stored([
        DEFAULT_PRICING_PROFILE,
        {
          ...PROFILE,
          overrides: { 'beef-ribeye': { retailPricePerKg: 'free', restaurantCostPerKg: 42 } },
        },
        PROFILE,
        PROFILE,
      ]),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.overrides).toEqual({});
  });
});
