import { describe, expect, it } from 'vitest';
import { FOODS } from '@/data/foods';
import { createCustomFood } from '@/lib/customFoods';
import {
  DEFAULT_PRICING_PROFILE,
  DEFAULT_PRICING_PROFILE_ID,
  isPricingProfileId,
  resolveFoodPricing,
} from '@/lib/pricing';
import type { CustomFood } from '@/types/customFoods';
import type { WeightValuedFood } from '@/types/meal';

type ServingValuedCustomFood = Extract<CustomFood, { valuation: 'by-serving' }>;

/*
 * A profile is hand-edited data that outlives the release that wrote it, so the
 * rule this file guards is that a bad override is never worse than no override:
 * the catalogue estimate is always there to fall back to, and the fallback has
 * to be reached without the catalogue itself being touched.
 */

const CUT = FOODS[0] as WeightValuedFood;

const SOUP = createCustomFood(
  {
    name: 'Kimchi jjigae',
    category: 'pork',
    valuation: 'by-serving',
    retailPricePerServing: 12,
    restaurantCostPerServing: 4,
    gramsPerServing: 400,
  },
  'custom-food-kimchi-jjigae',
) as ServingValuedCustomFood;

describe('isPricingProfileId', () => {
  it('accepts the ids the app itself allocates', () => {
    expect(isPricingProfileId(DEFAULT_PRICING_PROFILE_ID)).toBe(true);
    expect(isPricingProfileId('seoul-bbq-2')).toBe(true);
    expect(isPricingProfileId('a')).toBe(true);
    expect(isPricingProfileId('profile_with_underscores')).toBe(true);
  });

  it('rejects an empty or whitespace-only id', () => {
    expect(isPricingProfileId('')).toBe(false);
    expect(isPricingProfileId(' ')).toBe(false);
    expect(isPricingProfileId('two words')).toBe(false);
  });

  it('rejects uppercase and punctuation, so one profile has one spelling', () => {
    expect(isPricingProfileId('Australian-KBBQ')).toBe(false);
    expect(isPricingProfileId('profile.one')).toBe(false);
    expect(isPricingProfileId('profile/one')).toBe(false);
  });

  it('rejects an id that does not start with a letter or digit', () => {
    expect(isPricingProfileId('-leading-dash')).toBe(false);
    expect(isPricingProfileId('_leading-underscore')).toBe(false);
  });

  it('bounds the length rather than storing an arbitrary string', () => {
    expect(isPricingProfileId('a'.repeat(80))).toBe(true);
    expect(isPricingProfileId('a'.repeat(81))).toBe(false);
  });

  it('rejects anything that is not a string', () => {
    expect(isPricingProfileId(undefined)).toBe(false);
    expect(isPricingProfileId(null)).toBe(false);
    expect(isPricingProfileId(12)).toBe(false);
  });
});

describe('resolveFoodPricing', () => {
  it('reports the catalogue estimate when no profile is supplied', () => {
    expect(resolveFoodPricing(CUT)).toEqual({
      valuation: 'by-weight',
      retailPricePerKg: CUT.retailPricePerKg,
      restaurantCostPerKg: CUT.restaurantCostPerKg,
    });
  });

  it('reports the catalogue estimate when the profile says nothing about the item', () => {
    expect(resolveFoodPricing(CUT, DEFAULT_PRICING_PROFILE)).toEqual(resolveFoodPricing(CUT));
  });

  it('takes a by-weight override in place of the catalogue estimate', () => {
    const pricing = resolveFoodPricing(CUT, {
      overrides: {
        [CUT.id]: { valuation: 'by-weight', retailPricePerKg: 44, restaurantCostPerKg: 21 },
      },
    });

    expect(pricing).toEqual({
      valuation: 'by-weight',
      retailPricePerKg: 44,
      restaurantCostPerKg: 21,
    });
  });

  it('takes a by-serving override in place of the catalogue estimate', () => {
    const pricing = resolveFoodPricing(SOUP, {
      overrides: {
        [SOUP.id]: {
          valuation: 'by-serving',
          retailPricePerServing: 18,
          restaurantCostPerServing: 6,
        },
      },
    });

    expect(pricing).toEqual({
      valuation: 'by-serving',
      retailPricePerServing: 18,
      restaurantCostPerServing: 6,
    });
  });

  it.each([
    ['negative', -5],
    ['not a number', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
  ])('falls back to the catalogue for a %s price', (_label, price) => {
    const pricing = resolveFoodPricing(CUT, {
      overrides: {
        [CUT.id]: { valuation: 'by-weight', retailPricePerKg: price, restaurantCostPerKg: 21 },
      },
    });

    // Only the unusable half falls back; the good figure beside it still counts.
    expect(pricing).toEqual({
      valuation: 'by-weight',
      retailPricePerKg: CUT.retailPricePerKg,
      restaurantCostPerKg: 21,
    });
  });

  it('accepts a free item, which is a price rather than a missing one', () => {
    const pricing = resolveFoodPricing(CUT, {
      overrides: {
        [CUT.id]: { valuation: 'by-weight', retailPricePerKg: 0, restaurantCostPerKg: 0 },
      },
    });

    expect(pricing).toEqual({
      valuation: 'by-weight',
      retailPricePerKg: 0,
      restaurantCostPerKg: 0,
    });
  });

  it('ignores an override written for the other valuation model', () => {
    // A price per kilogram says nothing usable about a bowl of soup.
    const soupPricing = resolveFoodPricing(SOUP, {
      overrides: {
        [SOUP.id]: { valuation: 'by-weight', retailPricePerKg: 99, restaurantCostPerKg: 40 },
      },
    });

    expect(soupPricing).toEqual({
      valuation: 'by-serving',
      retailPricePerServing: SOUP.retailPricePerServing,
      restaurantCostPerServing: SOUP.restaurantCostPerServing,
    });

    const cutPricing = resolveFoodPricing(CUT, {
      overrides: {
        [CUT.id]: {
          valuation: 'by-serving',
          retailPricePerServing: 99,
          restaurantCostPerServing: 40,
        },
      },
    });

    expect(cutPricing).toEqual({
      valuation: 'by-weight',
      retailPricePerKg: CUT.retailPricePerKg,
      restaurantCostPerKg: CUT.restaurantCostPerKg,
    });
  });

  it('leaves the food and the profile it was given exactly as they were', () => {
    const food = { ...CUT };
    const profile = {
      overrides: {
        [CUT.id]: {
          valuation: 'by-weight' as const,
          retailPricePerKg: 44,
          restaurantCostPerKg: 21,
        },
      },
    };
    const foodBefore = structuredClone(food);
    const profileBefore = structuredClone(profile);

    resolveFoodPricing(food, profile);

    expect(food).toEqual(foodBefore);
    expect(profile).toEqual(profileBefore);
  });
});
