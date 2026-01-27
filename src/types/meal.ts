export type FoodCategory = 'beef' | 'pork' | 'chicken' | 'seafood';

export type QualityTier = 'house' | 'standard' | 'premium';

export type PlateSize = 'small' | 'regular' | 'large';

/**
 * Names the illustration arrangement a food uses. Several foods within a
 * category share a variant; the illustration system re-tints and re-arranges it.
 */
export type VisualVariant =
  | 'brisket-slices'
  | 'short-rib-blocks'
  | 'wagyu-blocks'
  | 'ribeye-steak'
  | 'bulgogi-tangle'
  | 'beef-belly-strips'
  | 'tongue-ovals'
  | 'pork-belly-layers'
  | 'spicy-pork'
  | 'jowl-rounds'
  | 'shoulder-cuts'
  | 'chicken-thigh-pieces'
  | 'spicy-chicken'
  | 'chicken-fillets'
  | 'prawns'
  | 'squid-rings'
  | 'salmon-fillet'
  | 'scallops';

export interface FoodItem {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly category: FoodCategory;
  readonly description: string;

  /** AUD per kilogram, supermarket-equivalent. */
  readonly retailPricePerKg: number;
  /** AUD per kilogram, illustrative bulk procurement estimate. */
  readonly restaurantCostPerKg: number;

  readonly caloriesPer100g: number;
  readonly proteinPer100g: number;
  readonly fatPer100g: number;
  readonly carbsPer100g: number;

  readonly visualVariant: VisualVariant;
  /** Present only for diner-authored catalogue entries. */
  readonly isCustom?: boolean;
}

export interface MealItem {
  readonly id: string;
  readonly foodId: string;
  readonly quality: QualityTier;
  readonly plateSize: PlateSize;
  readonly quantity: number;
  /**
   * Known ownership within this canonical line. Omitted means the whole line
   * remains shared-table food, preserving every session recorded before Table
   * Mode existed.
   */
  readonly allocations?: readonly DinerAllocation[];
}

/** A diner is a snapshot for this meal, never a link to device contacts. */
export interface Diner {
  readonly id: string;
  readonly displayName: string;
  /** Optional entry-price override in the session's existing currency context. */
  readonly admissionPrice?: number;
}

/** A positive, whole number of plates explicitly attributed to one diner. */
export interface DinerAllocation {
  readonly dinerId: string;
  readonly quantity: number;
}

export interface SessionConfig {
  readonly restaurantName: string;
  readonly pricePerDiner: number;
  readonly dinerCount: number;
  /**
   * The local pricing assumptions used for this live meal. Legacy in-memory
   * callers may omit it; persistence immediately restores the default.
   */
  readonly pricingProfileId?: PricingProfileId;
}

export interface MealSession extends SessionConfig {
  readonly items: readonly MealItem[];
  /** Optional so an ordinary shared-table session remains zero-setup. */
  readonly diners?: readonly Diner[];
  /**
   * How the meal developed over time. Absent on a session recorded before the
   * ledger existed, which is what makes such a session an explicitly untimed
   * record rather than one with fabricated timestamps.
   */
  readonly events?: readonly MealEvent[];
  /** Absent until meaningful meal activity starts the meal. */
  readonly lifecycle?: MealLifecycle;
}

export interface Nutrition {
  readonly calories: number;
  readonly protein: number;
  readonly fat: number;
  readonly carbs: number;
}

export interface LineItemTotals {
  readonly item: MealItem;
  readonly food: FoodItem;
  readonly plates: number;
  readonly weightG: number;
  readonly weightKg: number;
  readonly retailValue: number;
  readonly restaurantCost: number;
  readonly nutrition: Nutrition;
}

export interface SessionTotals {
  readonly lines: readonly LineItemTotals[];
  readonly totalPlates: number;
  readonly totalWeightG: number;
  readonly totalWeightKg: number;
  readonly totalWeightLb: number;
  readonly totalRetailValue: number;
  readonly totalRestaurantCost: number;
  readonly nutrition: Nutrition;
}

export interface DamageReport extends SessionTotals {
  /** Diners the admission was charged for, clamped to the supported range. */
  readonly dinerCount: number;
  readonly totalAdmission: number;
  /** Positive when retail value exceeds admission, negative otherwise. */
  readonly retailValueDifference: number;
  /** totalRetailValue / totalAdmission, expressed 0–n as a percentage. */
  readonly retailRecoveryPercent: number;
  readonly hasBeatenBuffet: boolean;
  /** Admission minus estimated ingredient cost. Not restaurant profit. */
  readonly estimatedIngredientMargin: number;
  readonly estimatedFoodCostPercent: number;
  /** Retail value still needed to reach admission. Zero once break-even is met. */
  readonly remainingRetailGap: number;
  readonly averageRetailValuePerPlate: number;
  /** Estimated further plates of average value needed to break even. */
  readonly platesToBreakEven: number;
}

export interface DinerDamageTotals {
  readonly diner: Diner;
  readonly admission: number;
  readonly attributedPlates: number;
  readonly sharedPlates: number;
  readonly effectivePlates: number;
  readonly weightG: number;
  readonly retailValue: number;
  readonly restaurantCost: number;
  readonly retailRecoveryPercent: number;
  readonly nutrition: Nutrition;
}
import type { PricingProfileId } from '@/types/pricing';
import type { MealEvent, MealLifecycle } from '@/types/mealEvents';
