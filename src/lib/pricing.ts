import { DEFAULT_MONEY_CONTEXT } from '@/lib/money';
import type { FoodItem } from '@/types/meal';
import type { FoodPricing, PricingProfile, PricingProfileId } from '@/types/pricing';

export const DEFAULT_PRICING_PROFILE_ID = 'australian-kbbq';

/** The original built-in data, now named as an explicit economic context. */
export const DEFAULT_PRICING_PROFILE: PricingProfile = {
  id: DEFAULT_PRICING_PROFILE_ID,
  name: 'Australian KBBQ estimates',
  money: DEFAULT_MONEY_CONTEXT,
  overrides: {},
  builtIn: true,
};

export function isPricingProfileId(value: unknown): value is PricingProfileId {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(value);
}

function validPrice(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Applies a profile's per-item assumptions without ever mutating the catalogue.
 *
 * Missing or malformed overrides deliberately fall back to the catalogue
 * estimate, so an old or hand-edited profile cannot corrupt a meal — and an
 * override written for the other valuation model is treated as missing, because
 * a price per kilogram says nothing usable about a bowl of soup.
 *
 * Returned in the item's own model. Callers doing arithmetic want
 * `resolveValuation` instead, which turns either model into one unit price.
 */
export function resolveFoodPricing(
  food: FoodItem,
  profile: Pick<PricingProfile, 'overrides'> = DEFAULT_PRICING_PROFILE,
): FoodPricing {
  const override = profile.overrides[food.id];

  if (food.valuation === 'by-serving') {
    const priced = override?.valuation === 'by-serving' ? override : undefined;
    return {
      valuation: 'by-serving',
      retailPricePerServing:
        validPrice(priced?.retailPricePerServing) ?? food.retailPricePerServing,
      restaurantCostPerServing:
        validPrice(priced?.restaurantCostPerServing) ?? food.restaurantCostPerServing,
    };
  }

  const priced = override?.valuation === 'by-weight' ? override : undefined;
  return {
    valuation: 'by-weight',
    retailPricePerKg: validPrice(priced?.retailPricePerKg) ?? food.retailPricePerKg,
    restaurantCostPerKg: validPrice(priced?.restaurantCostPerKg) ?? food.restaurantCostPerKg,
  };
}
