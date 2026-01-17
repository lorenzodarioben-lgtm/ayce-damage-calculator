import { DEFAULT_MONEY_CONTEXT } from '@/lib/money';
import type { PricingProfile, PricingProfileId } from '@/types/pricing';

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
