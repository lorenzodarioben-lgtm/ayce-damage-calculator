/**
 * The four grill categories hold the bundled catalogue. The four after them
 * exist only for a diner's own items — an all-you-can-eat table has sides, a
 * stew, a dessert and a drink, and none of those is a cut of meat.
 */
export type FoodCategory =
  | 'beef'
  | 'pork'
  | 'chicken'
  | 'seafood'
  | 'sides'
  | 'hot-food'
  | 'desserts'
  | 'drinks';

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
  | 'scallops'
  | 'side-bowls'
  | 'stew-pot'
  | 'dessert-scoop'
  | 'drink-glass';

/**
 * How a menu item is priced and measured.
 *
 * Grilled meat is bought by weight, and a plate of it is a quantity of that
 * weight — which is why every figure in this app has been per kilogram. Not
 * everything on a Korean barbecue table works that way: a bowl of soup, a
 * scoop of ice cream, a bottle of beer is one thing at one price, and no
 * amount of dividing by kilograms makes that a sensible way to describe it.
 *
 * So an item declares which model it is priced under, and the two are kept as
 * separate shapes rather than one shape with half its fields optional. That is
 * the point of the discriminated union: a per-serving item cannot carry a
 * price per kilogram, and nothing downstream has to guess which fields are
 * meaningful for the item in front of it.
 */
export type ValuationModel = 'by-weight' | 'by-serving';

interface FoodItemBase {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly category: FoodCategory;
  readonly description: string;
  readonly visualVariant: VisualVariant;
  /** Present only for diner-authored catalogue entries. */
  readonly isCustom?: boolean;
}

/** Priced by weight: the model every built-in cut uses. */
export interface WeightValuedFood extends FoodItemBase {
  readonly valuation: 'by-weight';

  /** AUD per kilogram, supermarket-equivalent. */
  readonly retailPricePerKg: number;
  /** AUD per kilogram, illustrative bulk procurement estimate. */
  readonly restaurantCostPerKg: number;

  /**
   * What a regular plate of this actually weighs, when somebody knows.
   *
   * Absent means the app's nominal 155 g, which is what every cut has always
   * assumed and what a diner who has never weighed anything keeps getting.
   *
   * It matters more than it looks. Retail value is weight times price per
   * kilogram, so a restaurant whose regular plate is 250 g had every figure
   * here — weight, value, recovery, the verdict itself — understated by more
   * than half, from one number nobody could correct. Small and large scale from
   * this in the same proportion the built-in sizes always had.
   */
  readonly gramsPerPlate?: number;

  /**
   * Absent means nobody recorded it, which is different from zero.
   *
   * Every bundled cut states all four. A diner adding a house side may simply
   * not know its macros, and inventing a plausible number would be worse than
   * saying so — the interface reports "not recorded" rather than "0 kcal".
   */
  readonly caloriesPer100g?: number;
  readonly proteinPer100g?: number;
  readonly fatPer100g?: number;
  readonly carbsPer100g?: number;
}

/**
 * Priced by serving: one thing, at one price.
 *
 * Plate size does not apply — a serving is whatever the restaurant calls a
 * serving — so the builder hides that control and the engine ignores it.
 * Quality still does: a house dessert and a premium one are different items at
 * different prices, and the same tier multipliers apply to a serving price
 * exactly as they do to a per-kilogram one.
 *
 * A declared serving weight keeps the table's weight totals meaningful. Zero is
 * legitimate and means the item was never weighed, which the interface says
 * rather than reporting as nothing.
 */
export interface ServingValuedFood extends FoodItemBase {
  readonly valuation: 'by-serving';

  readonly retailPricePerServing: number;
  readonly restaurantCostPerServing: number;

  /** Illustrative weight of one serving. Zero means it was not weighed. */
  readonly gramsPerServing: number;

  /** Absent means nobody recorded it, which is different from zero. */
  readonly caloriesPerServing?: number;
  readonly proteinPerServing?: number;
  readonly fatPerServing?: number;
  readonly carbsPerServing?: number;
}

export type FoodItem = WeightValuedFood | ServingValuedFood;

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
  /**
   * True when this line was not covered by the all-you-can-eat price.
   *
   * A beer, a premium upgrade, a dish the menu charges for on top: the table
   * ate it, but not because they paid to walk in. Counting its retail value
   * towards beating the buffet would credit the diner for food they bought
   * separately, which makes the headline figure answer a different question
   * than the one it asks.
   *
   * Omitted means the line was included in admission, which is what every meal
   * recorded before this existed is saying and what ordinary logging keeps
   * saying without anyone touching a control.
   */
  readonly separatelyCharged?: true;
  /**
   * What was actually paid for this line, in the session's currency.
   *
   * Only meaningful alongside `separatelyCharged`. Deliberately a recorded
   * figure rather than a derived one: what a restaurant charges for a beer has
   * nothing to do with what the same beer is worth at a supermarket, and
   * inferring one from the other would invent a number nobody paid. Absent
   * means the diner has not said, which is reported as unpriced rather than as
   * free.
   */
  readonly separateCharge?: number;
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
 * Whether an adjustment is an amount of money or a share of the bill.
 *
 * Most of what a real tab picks up is quoted as a percentage — ten percent
 * service, one and a half percent on the card, fifteen percent for eating on a
 * public holiday. Storing only the cash meant working it out by hand and
 * watching it go stale the moment the headcount changed.
 */
export type AdjustmentBasis = 'fixed' | 'percent';

/**
 * What a percentage is a percentage *of*.
 *
 * Stated rather than inferred, because the two answers differ and a bill that
 * silently picked one would be unarguable. `admission` is the entry price
 * alone; `subtotal` is the entry price plus the fixed charges already on the
 * bill, which is what a service charge is normally levied on.
 *
 * Percentages never compound: every one of them is worked out against a base
 * that contains no percentage, so the order they were entered in cannot change
 * the total.
 */
export type AdjustmentPercentBase = 'admission' | 'subtotal';

/**
 * Something the bill picked up beyond admission.
 *
 * The amount is always positive; `kind` carries the direction, so a stored or
 * shared figure can never be a sign away from meaning its own opposite.
 */
export interface BillAdjustment {
  readonly id: string;
  readonly label: string;
  /** Money when the basis is fixed, a percentage when it is not. */
  readonly amount: number;
  readonly kind: AdjustmentKind;
  /**
   * Absent means `fixed`, which is what every adjustment recorded before
   * percentages existed is saying, and what an ordinary cash amount keeps
   * saying without anyone choosing anything.
   */
  readonly basis?: AdjustmentBasis;
  /** Meaningful only for a percentage. Absent means `subtotal`. */
  readonly percentBase?: AdjustmentPercentBase;
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
  /**
   * False when this item is priced by serving and nobody declared a weight, so
   * a surface can say "not weighed" rather than report a confident zero.
   */
  readonly hasWeight: boolean;
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
  /** Nutrition of what was eaten. Zero throughout when none was recorded. */
  readonly nutrition: Nutrition;
  /** False when this item has no nutrition on file at all. */
  readonly hasNutrition: boolean;
  /** True when the buffet price did not cover this line. */
  readonly separatelyCharged: boolean;
  /** What was paid for it. Zero for anything included in admission. */
  readonly separateCharge: number;
  /** True when it is an extra whose price nobody has stated. */
  readonly unpricedCharge: boolean;
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
  /** Plates the buffet price covered. */
  readonly includedPlates: number;
  /** Plates that were charged for on top of it. */
  readonly separatePlates: number;
  /**
   * Retail value of the buffet food that was eaten, and the figure recovery is
   * measured on. Deliberately excludes anything charged separately: a beer the
   * table bought is not value the entry price delivered.
   */
  readonly totalRetailValue: number;
  /** Retail value of the buffet food that reached the table. */
  readonly totalOrderedRetailValue: number;
  readonly totalRestaurantCost: number;
  /** Retail value of the separately charged food that was eaten. */
  readonly separateRetailValue: number;
  /** Estimated ingredient cost of the separately charged food. */
  readonly separateRestaurantCost: number;
  /** What was actually paid for the separately charged lines. */
  readonly separateSpend: number;
  /** Extras whose price nobody has stated, so a surface can say so. */
  readonly unpricedSeparateLines: number;
  /** Nutrition of what was eaten, over the lines that have any on file. */
  readonly nutrition: Nutrition;
  /**
   * Lines with no nutrition recorded at all, so a surface can say the totals
   * are incomplete rather than presenting them as the whole meal.
   */
  readonly linesWithoutNutrition: number;
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
  /**
   * Everything the table paid: the settled buffet bill plus what was spent on
   * items the buffet price did not cover.
   *
   * Reported beside the recovery figure rather than inside it. Recovery answers
   * "did the entry price pay for itself"; this answers "what did the evening
   * cost", and folding the second into the first would quietly change what the
   * headline number means.
   */
  readonly totalSpend: number;
  /** True when anything on the tab was charged outside the buffet price. */
  readonly hasSeparatelyChargedItems: boolean;
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
