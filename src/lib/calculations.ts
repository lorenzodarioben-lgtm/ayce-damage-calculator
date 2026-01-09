import { findFood } from '@/data/foods';
import {
  KG_TO_LB,
  MAX_DINERS,
  MAX_PRICE_PER_DINER,
  MIN_DINERS,
  MIN_PRICE_PER_DINER,
  getPlateSizeMeta,
  getQualityMeta,
} from '@/lib/constants';
import type {
  DamageReport,
  FoodItem,
  LineItemTotals,
  MealItem,
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

export function calculateAdmission(config: Pick<SessionConfig, 'pricePerDiner' | 'dinerCount'>) {
  return clampPricePerDiner(config.pricePerDiner) * clampDinerCount(config.dinerCount);
}

export function adjustedRetailPricePerKg(food: FoodItem, quality: MealItem['quality']): number {
  return food.retailPricePerKg * getQualityMeta(quality).retailMultiplier;
}

export function adjustedRestaurantCostPerKg(food: FoodItem, quality: MealItem['quality']): number {
  return food.restaurantCostPerKg * getQualityMeta(quality).restaurantMultiplier;
}

export function calculateLineItem(item: MealItem, food: FoodItem): LineItemTotals {
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
    retailValue: weightKg * adjustedRetailPricePerKg(food, item.quality),
    restaurantCost: weightKg * adjustedRestaurantCostPerKg(food, item.quality),
    nutrition: {
      calories: per100g * food.caloriesPer100g,
      protein: per100g * food.proteinPer100g,
      fat: per100g * food.fatPer100g,
      carbs: per100g * food.carbsPer100g,
    },
  };
}

export function calculateSessionTotals(items: readonly MealItem[]): SessionTotals {
  const lines: LineItemTotals[] = [];

  for (const item of items) {
    const food = findFood(item.foodId);
    // Items referencing foods that no longer exist are skipped rather than
    // poisoning the totals; this can only happen via stale persisted state.
    if (food) {
      lines.push(calculateLineItem(item, food));
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

export function buildDamageReport(
  items: readonly MealItem[],
  config: Pick<SessionConfig, 'pricePerDiner' | 'dinerCount'>,
): DamageReport {
  const totals = calculateSessionTotals(items);
  const dinerCount = clampDinerCount(config.dinerCount);
  const totalAdmission = calculateAdmission(config);

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
