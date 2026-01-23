import type { MoneyContext } from '@/lib/money';

export type PricingProfileId = string;

/** Raw pre-quality figures; quality tiers are still applied by the calculation engine. */
export interface FoodPricing {
  readonly retailPricePerKg: number;
  readonly restaurantCostPerKg: number;
}

export interface PricingProfile {
  readonly id: PricingProfileId;
  readonly name: string;
  readonly money: MoneyContext;
  readonly overrides: Readonly<Record<string, FoodPricing>>;
  readonly builtIn: boolean;
}
