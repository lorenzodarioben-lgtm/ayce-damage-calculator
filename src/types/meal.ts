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
  /** Plates that reached the table. Always a whole number. */
  readonly quantity: number;
  /**
   * How much of this line was actually eaten, in quarter plates.
   *
   * Omitted means all of it, which is both the default for ordinary logging and
   * the truth about every session recorded before consumption was tracked.
   * Never negative and never greater than `quantity`.
   */
  readonly consumedQuantity?: number;
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

/** Whether a bill adjustment adds to the total or comes off it. */
export type AdjustmentKind = 'charge' | 'discount';

/**
 * Something the bill picked up beyond admission.
 *
 * The amount is always positive; `kind` carries the direction, so a stored or
 * shared figure can never be a sign away from meaning its own opposite.
 */
export interface BillAdjustment {
  readonly id: string;
  readonly label: string;
  readonly amount: number;
  readonly kind: AdjustmentKind;
  /**
   * The one diner this belongs to. Omitted means the whole table, which is the
   * default and the only possibility when Table Mode is not in use.
   */
  readonly dinerId?: string;
}

export interface SessionConfig {
  readonly restaurantName: string;
  readonly pricePerDiner: number;
  readonly dinerCount: number;
  /**
   * What went on or came off the bill. Optional so a plain tab stays exactly
   * what it always was — an absent list and an empty one mean the same thing.
   */
  readonly adjustments?: readonly BillAdjustment[];
  /**
   * The local restaurant profile this meal was started from, when it was.
   * Absent for an ad-hoc meal, and cleared the moment the name is edited by
   * hand — a different name is a different place until someone says otherwise.
   */
  readonly restaurantId?: string;
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
  /**
   * The window the table has booked, in minutes. Absent means the meal is not
   * running against a clock at all, which stays the default.
   */
  readonly plannedDurationMinutes?: number;
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
  /** Plates that reached the table. */
  readonly plates: number;
  /** Plates that were eaten. Equal to `plates` unless some was left. */
  readonly consumedPlates: number;
  /** Plates that were left. Zero unless some was. */
  readonly uneatenPlates: number;
  /** Weight eaten. */
  readonly weightG: number;
  readonly weightKg: number;
  /** Weight that reached the table, eaten or not. */
  readonly orderedWeightG: number;
  /** Retail value of what was eaten. */
  readonly retailValue: number;
  /** Retail value of everything that reached the table. */
  readonly orderedRetailValue: number;
  /**
   * What the restaurant may have spent on the raw ingredient.
   *
   * Measured against what reached the table rather than what was eaten,
   * because the restaurant's outlay does not shrink when a plate goes back.
   */
  readonly restaurantCost: number;
  /** Nutrition of what was eaten. */
  readonly nutrition: Nutrition;
}

export interface SessionTotals {
  readonly lines: readonly LineItemTotals[];
  /** Plates that reached the table. */
  readonly totalPlates: number;
  /** Plates that were eaten. Equal to `totalPlates` unless some was left. */
  readonly totalConsumedPlates: number;
  /** Plates that were left. Zero unless some were. */
  readonly totalUneatenPlates: number;
  /** Weight eaten. */
  readonly totalWeightG: number;
  readonly totalWeightKg: number;
  readonly totalWeightLb: number;
  /** Weight that reached the table, eaten or not. */
  readonly totalOrderedWeightG: number;
  readonly totalOrderedWeightKg: number;
  /** Retail value of what was eaten, and the figure recovery is measured on. */
  readonly totalRetailValue: number;
  /** Retail value of everything that reached the table. */
  readonly totalOrderedRetailValue: number;
  readonly totalRestaurantCost: number;
  /** Nutrition of what was eaten. */
  readonly nutrition: Nutrition;
}

export interface DamageReport extends SessionTotals {
  /** Diners the admission was charged for, clamped to the supported range. */
  readonly dinerCount: number;
  /** Entry price alone, before anything went on or came off the bill. */
  readonly baseAdmission: number;
  /** Added to the bill, as a positive figure. Zero without adjustments. */
  readonly adjustmentCharges: number;
  /** Taken off the bill, as a positive figure. Zero without adjustments. */
  readonly adjustmentDiscounts: number;
  /** Signed: charges minus discounts. */
  readonly adjustmentNet: number;
  /**
   * What the table actually paid, and the denominator of every figure below.
   *
   * Equal to `baseAdmission` for any meal without adjustments, which is what
   * keeps every session recorded before they existed reading exactly as before.
   * Never negative: a voucher larger than the bill means nothing was paid, not
   * that the restaurant owes the table money.
   */
  readonly totalAdmission: number;
  /** Positive when retail value exceeds what was paid, negative otherwise. */
  readonly retailValueDifference: number;
  /** totalRetailValue / totalAdmission, expressed 0–n as a percentage. */
  readonly retailRecoveryPercent: number;
  readonly hasBeatenBuffet: boolean;
  /** What was paid minus estimated ingredient cost. Not restaurant profit. */
  readonly estimatedIngredientMargin: number;
  readonly estimatedFoodCostPercent: number;
  /** Retail value still needed to reach the paid total. Zero once met. */
  readonly remainingRetailGap: number;
  readonly averageRetailValuePerPlate: number;
  /** Estimated further plates of average value needed to break even. */
  readonly platesToBreakEven: number;
}

export interface DinerDamageTotals {
  readonly diner: Diner;
  /** This diner's share of the final paid total, adjustments included. */
  readonly admission: number;
  /** Entry price alone for this diner, before their share of adjustments. */
  readonly baseAdmission: number;
  /** Signed: this diner's own adjustments plus an even share of the table's. */
  readonly adjustmentNet: number;
  readonly attributedPlates: number;
  readonly sharedPlates: number;
  readonly effectivePlates: number;
  /** This diner's share of what was eaten, in plates. */
  readonly consumedPlates: number;
  readonly weightG: number;
  readonly retailValue: number;
  readonly restaurantCost: number;
  readonly retailRecoveryPercent: number;
  readonly nutrition: Nutrition;
}
import type { PricingProfileId } from '@/types/pricing';
import type { MealEvent, MealLifecycle } from '@/types/mealEvents';
