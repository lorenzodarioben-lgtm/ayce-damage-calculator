import { FOODS } from '@/data/foods';
import {
  KG_TO_LB,
  MAX_DINERS,
  MAX_PRICE_PER_DINER,
  MIN_DINERS,
  MIN_PRICE_PER_DINER,
  getPlateSizeMeta,
  getQualityMeta,
} from '@/lib/constants';
import {
  adjustmentsForDiner,
  settleTotal,
  tableWideAdjustments,
  totalAdjustments,
  type AdjustmentTotals,
} from '@/lib/adjustments';
import { DEFAULT_PRICING_PROFILE, resolveFoodPricing } from '@/lib/pricing';
import { findFoodInCatalogue } from '@/lib/foodCatalogue';
import { sharedQuantity } from '@/lib/diners';
import type { PricingProfile } from '@/types/pricing';
import type {
  DamageReport,
  DinerDamageTotals,
  FoodItem,
  LineItemTotals,
  MealItem,
  MealSession,
  Nutrition,
  SessionConfig,
  SessionTotals,
} from '@/types/meal';

const EMPTY_NUTRITION: Nutrition = { calories: 0, protein: 0, fat: 0, carbs: 0 };

/** Guards every division in this module so totals can never emit NaN or Infinity. */
function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

export function clampPricePerDiner(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_PRICE_PER_DINER;
  }
  return Math.min(MAX_PRICE_PER_DINER, Math.max(MIN_PRICE_PER_DINER, value));
}

export function clampDinerCount(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_DINERS;
  }
  return Math.min(MAX_DINERS, Math.max(MIN_DINERS, Math.round(value)));
}

type AdmissionConfig = Pick<SessionConfig, 'pricePerDiner' | 'dinerCount' | 'adjustments'> &
  Pick<MealSession, 'diners'>;

/**
 * Entry price alone, before anything went on or came off the bill.
 *
 * Kept separate from the final total on purpose: the two answer different
 * questions, and folding a card fee into "admission" would misreport what the
 * restaurant actually charges to walk in.
 */
export function calculateAdmission(config: AdmissionConfig) {
  const defaultPrice = clampPricePerDiner(config.pricePerDiner);
  const dinerCount = clampDinerCount(config.dinerCount);
  const diners = config.diners ?? [];
  const hasOverride = diners.some(
    (diner) =>
      typeof diner.admissionPrice === 'number' &&
      Number.isFinite(diner.admissionPrice) &&
      diner.admissionPrice > 0,
  );

  // The ordinary calculator remains byte-for-byte the same economic model
  // until someone deliberately supplies a per-diner price.
  if (!hasOverride) {
    return defaultPrice * dinerCount;
  }

  const rosterAdmission = diners.reduce(
    (total, diner) =>
      total +
      (typeof diner.admissionPrice === 'number' &&
      Number.isFinite(diner.admissionPrice) &&
      diner.admissionPrice > 0
        ? clampPricePerDiner(diner.admissionPrice)
        : defaultPrice),
    0,
  );
  // A partially named roster can still retain generic diners from the original
  // session setup; they inherit the table default rather than disappearing.
  return rosterAdmission + defaultPrice * Math.max(0, dinerCount - diners.length);
}

export function adjustedRetailPricePerKg(
  food: FoodItem,
  quality: MealItem['quality'],
  pricingProfile: PricingProfile = DEFAULT_PRICING_PROFILE,
): number {
  return (
    resolveFoodPricing(food, pricingProfile).retailPricePerKg *
    getQualityMeta(quality).retailMultiplier
  );
}

export function adjustedRestaurantCostPerKg(
  food: FoodItem,
  quality: MealItem['quality'],
  pricingProfile: PricingProfile = DEFAULT_PRICING_PROFILE,
): number {
  return (
    resolveFoodPricing(food, pricingProfile).restaurantCostPerKg *
    getQualityMeta(quality).restaurantMultiplier
  );
}

export function calculateLineItem(
  item: MealItem,
  food: FoodItem,
  pricingProfile: PricingProfile = DEFAULT_PRICING_PROFILE,
): LineItemTotals {
  const plates = Math.max(0, Math.floor(item.quantity));
  const weightG = getPlateSizeMeta(item.plateSize).grams * plates;
  const weightKg = weightG / 1000;
  const per100g = weightG / 100;

  return {
    item,
    food,
    plates,
    weightG,
    weightKg,
    retailValue: weightKg * adjustedRetailPricePerKg(food, item.quality, pricingProfile),
    restaurantCost: weightKg * adjustedRestaurantCostPerKg(food, item.quality, pricingProfile),
    nutrition: {
      calories: per100g * food.caloriesPer100g,
      protein: per100g * food.proteinPer100g,
      fat: per100g * food.fatPer100g,
      carbs: per100g * food.carbsPer100g,
    },
  };
}

export function calculateSessionTotals(
  items: readonly MealItem[],
  pricingProfile: PricingProfile = DEFAULT_PRICING_PROFILE,
  foods = FOODS,
): SessionTotals {
  const lines: LineItemTotals[] = [];

  for (const item of items) {
    const food = findFoodInCatalogue(foods, item.foodId);
    // Items referencing foods that no longer exist are skipped rather than
    // poisoning the totals; this can only happen via stale persisted state.
    if (food) {
      lines.push(calculateLineItem(item, food, pricingProfile));
    }
  }

  const totals = lines.reduce(
    (acc, line) => ({
      totalPlates: acc.totalPlates + line.plates,
      totalWeightG: acc.totalWeightG + line.weightG,
      totalRetailValue: acc.totalRetailValue + line.retailValue,
      totalRestaurantCost: acc.totalRestaurantCost + line.restaurantCost,
      nutrition: {
        calories: acc.nutrition.calories + line.nutrition.calories,
        protein: acc.nutrition.protein + line.nutrition.protein,
        fat: acc.nutrition.fat + line.nutrition.fat,
        carbs: acc.nutrition.carbs + line.nutrition.carbs,
      },
    }),
    {
      totalPlates: 0,
      totalWeightG: 0,
      totalRetailValue: 0,
      totalRestaurantCost: 0,
      nutrition: EMPTY_NUTRITION,
    },
  );

  const totalWeightKg = totals.totalWeightG / 1000;

  return {
    lines,
    totalPlates: totals.totalPlates,
    totalWeightG: totals.totalWeightG,
    totalWeightKg,
    totalWeightLb: totalWeightKg * KG_TO_LB,
    totalRetailValue: totals.totalRetailValue,
    totalRestaurantCost: totals.totalRestaurantCost,
    nutrition: totals.nutrition,
  };
}

export interface PerDinerTotals {
  readonly dinerCount: number;
  readonly admission: number;
  readonly retailValue: number;
  readonly plates: number;
  readonly weightG: number;
  readonly nutrition: Nutrition;
}

/**
 * The table's totals divided evenly by head.
 *
 * An even split is a stated assumption, not a measurement: the calculator
 * records one shared tab and has no idea who reached for what. It is still the
 * only division available, and it is the one a table actually does when the
 * bill lands, so it is offered plainly rather than dressed up as a per-person
 * measurement.
 */
export function perDinerTotals(report: DamageReport): PerDinerTotals {
  const dinerCount = clampDinerCount(report.dinerCount);
  const per = (value: number) => safeRatio(value, dinerCount);

  return {
    dinerCount,
    admission: per(report.totalAdmission),
    retailValue: per(report.totalRetailValue),
    plates: per(report.totalPlates),
    weightG: per(report.totalWeightG),
    nutrition: {
      calories: per(report.nutrition.calories),
      protein: per(report.nutrition.protein),
      fat: per(report.nutrition.fat),
      carbs: per(report.nutrition.carbs),
    },
  };
}

/**
 * Calculates an estimate per active roster member while preserving table totals.
 *
 * Adjustments follow the same rule the plates do. One named to a diner is
 * theirs; anything charged to the table is divided evenly, which is a stated
 * assumption rather than a measurement — the bill records a card fee, not who
 * tapped the card. Per-diner totals therefore still sum to the table's, which
 * is the property that makes them worth showing at all.
 */
export function calculateDinerTotals(
  items: readonly MealItem[],
  config: AdmissionConfig,
  pricingProfile: PricingProfile = DEFAULT_PRICING_PROFILE,
  foods = FOODS,
): readonly DinerDamageTotals[] {
  const diners = config.diners ?? [];
  if (diners.length === 0) return [];
  const defaultAdmission = clampPricePerDiner(config.pricePerDiner);
  const sharedDivisor = diners.length;
  const tableAdjustments = totalAdjustments(tableWideAdjustments(config.adjustments));
  const sharedAdjustmentNet = safeRatio(tableAdjustments.net, sharedDivisor);

  return diners.map((diner) => {
    let attributedPlates = 0;
    let sharedPlates = 0;
    let weightG = 0;
    let retailValue = 0;
    let restaurantCost = 0;
    let nutrition: Nutrition = { ...EMPTY_NUTRITION };
    for (const item of items) {
      const food = findFoodInCatalogue(foods, item.foodId);
      if (!food) continue;
      const line = calculateLineItem(item, food, pricingProfile);
      const attributed =
        item.allocations?.find((entry) => entry.dinerId === diner.id)?.quantity ?? 0;
      const shared = sharedQuantity(item) / sharedDivisor;
      const effective = Math.max(0, attributed) + shared;
      const fraction = safeRatio(effective, line.plates);
      attributedPlates += Math.max(0, attributed);
      sharedPlates += shared;
      weightG += line.weightG * fraction;
      retailValue += line.retailValue * fraction;
      restaurantCost += line.restaurantCost * fraction;
      nutrition = {
        calories: nutrition.calories + line.nutrition.calories * fraction,
        protein: nutrition.protein + line.nutrition.protein * fraction,
        fat: nutrition.fat + line.nutrition.fat * fraction,
        carbs: nutrition.carbs + line.nutrition.carbs * fraction,
      };
    }
    const baseAdmission =
      typeof diner.admissionPrice === 'number' && diner.admissionPrice > 0
        ? clampPricePerDiner(diner.admissionPrice)
        : defaultAdmission;
    const own: AdjustmentTotals = totalAdjustments(
      adjustmentsForDiner(config.adjustments, diner.id),
    );
    const adjustmentNet = own.net + sharedAdjustmentNet;
    // Floored at zero for the same reason the table's total is: a share bigger
    // than the entry price means this diner paid nothing, not less than nothing.
    const admission = Math.max(0, baseAdmission + adjustmentNet);
    const effectivePlates = attributedPlates + sharedPlates;
    return {
      diner,
      admission,
      baseAdmission,
      adjustmentNet,
      attributedPlates,
      sharedPlates,
      effectivePlates,
      weightG,
      retailValue,
      restaurantCost,
      retailRecoveryPercent: safeRatio(retailValue, admission) * 100,
      nutrition,
    };
  });
}

/**
 * What the table paid, and how it got there.
 *
 * A session with no adjustments settles to exactly its base admission, which is
 * what keeps every meal recorded before adjustments existed calculating
 * byte-for-byte as it always did.
 */
export function calculateBillTotals(config: AdmissionConfig) {
  const baseAdmission = calculateAdmission(config);
  const adjustments = totalAdjustments(config.adjustments);
  return { baseAdmission, adjustments, totalPaid: settleTotal(baseAdmission, adjustments) };
}

export function buildDamageReport(
  items: readonly MealItem[],
  config: AdmissionConfig,
  pricingProfile: PricingProfile = DEFAULT_PRICING_PROFILE,
  foods = FOODS,
): DamageReport {
  const totals = calculateSessionTotals(items, pricingProfile, foods);
  const dinerCount = clampDinerCount(config.dinerCount);
  const { baseAdmission, adjustments, totalPaid: totalAdmission } = calculateBillTotals(config);

  const retailValueDifference = totals.totalRetailValue - totalAdmission;
  const retailRecoveryPercent = safeRatio(totals.totalRetailValue, totalAdmission) * 100;
  const remainingRetailGap = Math.max(0, totalAdmission - totals.totalRetailValue);
  const averageRetailValuePerPlate = safeRatio(totals.totalRetailValue, totals.totalPlates);

  const platesToBreakEven =
    remainingRetailGap <= 0 || averageRetailValuePerPlate <= 0
      ? 0
      : Math.ceil(remainingRetailGap / averageRetailValuePerPlate);

  return {
    ...totals,
    dinerCount,
    baseAdmission,
    adjustmentCharges: adjustments.charges,
    adjustmentDiscounts: adjustments.discounts,
    adjustmentNet: adjustments.net,
    totalAdmission,
    retailValueDifference,
    retailRecoveryPercent,
    hasBeatenBuffet: totals.totalRetailValue >= totalAdmission && totals.totalPlates > 0,
    estimatedIngredientMargin: totalAdmission - totals.totalRestaurantCost,
    estimatedFoodCostPercent: safeRatio(totals.totalRestaurantCost, totalAdmission) * 100,
    remainingRetailGap,
    averageRetailValuePerPlate,
    platesToBreakEven,
  };
}
