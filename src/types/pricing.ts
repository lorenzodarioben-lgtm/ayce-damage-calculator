import type { MoneyContext } from '@/lib/money';

export type PricingProfileId = string;

/**
 * Raw pre-quality figures; quality tiers are still applied by the engine.
 *
 * Split by valuation model for the same reason the food itself is: an override
 * for a per-serving item is a price per serving, and letting one shape carry
 * both would mean every reader deciding for itself which half to believe.
 */
export type FoodPricing =
  | {
      readonly valuation: 'by-weight';
      readonly retailPricePerKg: number;
      readonly restaurantCostPerKg: number;
      /**
       * What a regular plate weighs at this place. Absent keeps the nominal
       * 155 g, so a profile that says nothing about weight changes nothing.
       */
      readonly gramsPerPlate?: number;
    }
  | {
      readonly valuation: 'by-serving';
      readonly retailPricePerServing: number;
      readonly restaurantCostPerServing: number;
    };

export interface PricingProfile {
  readonly id: PricingProfileId;
  readonly name: string;
  readonly money: MoneyContext;
  readonly overrides: Readonly<Record<string, FoodPricing>>;
  readonly builtIn: boolean;
}
