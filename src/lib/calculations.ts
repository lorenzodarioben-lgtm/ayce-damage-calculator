import { FOODS } from '@/data/foods';
import {
  KG_TO_LB,
  MAX_DINERS,
  MAX_PRICE_PER_DINER,
  MIN_DINERS,
  MIN_PRICE_PER_DINER,
} from '@/lib/constants';
import {
  adjustmentsForDiner,
  settleTotal,
  tableWideAdjustments,
  totalAdjustments,
} from '@/lib/adjustments';
import { distributeMoney } from '@/lib/splitMoney';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import { resolveValuation } from '@/lib/valuation';
import { findFoodInCatalogue } from '@/lib/foodCatalogue';
import { sharedQuantity } from '@/lib/diners';
import { consumedQuantity, uneatenQuantity } from '@/lib/consumption';
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

/**
 * One tab line, in two measures.
 *
 * What reached the table and what was eaten are the same number for an ordinary
 * line, and this stays arithmetically identical for one. Where they differ, the
 * eaten figure drives retail value, nutrition and therefore recovery, because
 * value you did not eat is not value you extracted — while the ordered figures
 * are kept alongside so the tab still says what actually arrived.
 *
 * Estimated ingredient cost deliberately follows the ordered quantity. The
 * restaurant bought the plate whether or not it went back.
 */
export function calculateLineItem(
  item: MealItem,
  food: FoodItem,
  pricingProfile: PricingProfile = DEFAULT_PRICING_PROFILE,
): LineItemTotals {
  const plates = Math.max(0, Math.floor(item.quantity));
  const consumedPlates = consumedQuantity(item);

  // One resolution for both valuation models, so the arithmetic below has no
  // idea whether it is looking at a plate of ribeye or a bowl of soup.
  const unit = resolveValuation(food, item.quality, item.plateSize, pricingProfile);

  const orderedWeightG = unit.gramsPerUnit * plates;
  const weightG = unit.gramsPerUnit * consumedPlates;

  return {
    item,
    food,
    plates,
    consumedPlates,
    uneatenPlates: uneatenQuantity(item),
    weightG,
    weightKg: weightG / 1000,
    orderedWeightG,
    hasWeight: unit.hasWeight,
    retailValue: unit.retailPerUnit * consumedPlates,
    orderedRetailValue: unit.retailPerUnit * plates,
    restaurantCost: unit.restaurantCostPerUnit * plates,
    nutrition: {
      calories: unit.nutritionPerUnit.calories * consumedPlates,
      protein: unit.nutritionPerUnit.protein * consumedPlates,
      fat: unit.nutritionPerUnit.fat * consumedPlates,
      carbs: unit.nutritionPerUnit.carbs * consumedPlates,
    },
    hasNutrition: unit.hasNutrition,
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
      totalConsumedPlates: acc.totalConsumedPlates + line.consumedPlates,
      totalUneatenPlates: acc.totalUneatenPlates + line.uneatenPlates,
      totalWeightG: acc.totalWeightG + line.weightG,
      totalOrderedWeightG: acc.totalOrderedWeightG + line.orderedWeightG,
      totalRetailValue: acc.totalRetailValue + line.retailValue,
      totalOrderedRetailValue: acc.totalOrderedRetailValue + line.orderedRetailValue,
      totalRestaurantCost: acc.totalRestaurantCost + line.restaurantCost,
      linesWithoutNutrition: acc.linesWithoutNutrition + (line.hasNutrition ? 0 : 1),
      nutrition: {
        calories: acc.nutrition.calories + line.nutrition.calories,
        protein: acc.nutrition.protein + line.nutrition.protein,
        fat: acc.nutrition.fat + line.nutrition.fat,
        carbs: acc.nutrition.carbs + line.nutrition.carbs,
      },
    }),
    {
      totalPlates: 0,
      totalConsumedPlates: 0,
      totalUneatenPlates: 0,
      totalWeightG: 0,
      totalOrderedWeightG: 0,
      totalRetailValue: 0,
      totalOrderedRetailValue: 0,
      totalRestaurantCost: 0,
      linesWithoutNutrition: 0,
      nutrition: EMPTY_NUTRITION,
    },
  );

  const totalWeightKg = totals.totalWeightG / 1000;

  return {
    lines,
    totalPlates: totals.totalPlates,
    totalConsumedPlates: totals.totalConsumedPlates,
    totalUneatenPlates: totals.totalUneatenPlates,
    totalWeightG: totals.totalWeightG,
    totalWeightKg,
    totalWeightLb: totalWeightKg * KG_TO_LB,
    totalOrderedWeightG: totals.totalOrderedWeightG,
    totalOrderedWeightKg: totals.totalOrderedWeightG / 1000,
    totalRetailValue: totals.totalRetailValue,
    totalOrderedRetailValue: totals.totalOrderedRetailValue,
    totalRestaurantCost: totals.totalRestaurantCost,
    nutrition: totals.nutrition,
    linesWithoutNutrition: totals.linesWithoutNutrition,
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
 * How many people the shared food has to stretch across.
 *
 * The roster names whoever the diner bothered to name, and the headcount says
 * how many people the restaurant charged for. Those are different numbers
 * whenever somebody was not typed in, and the larger one is the truth about the
 * table: four people ate, two of them have names on file, and the shared plates
 * were still shared four ways.
 *
 * Dividing by the roster alone would hand the two unnamed seats' food to the
 * two named ones — inflating their plates, their weight, their retail value and
 * therefore their recovery, purely because nobody typed a name.
 */
export function tableSeats(config: Pick<AdmissionConfig, 'dinerCount' | 'diners'>): number {
  return Math.max(clampDinerCount(config.dinerCount), config.diners?.length ?? 0);
}

/**
 * The share of the table that belongs to seats nobody named.
 *
 * Reported rather than hidden. This food was eaten by somebody, and the only
 * honest thing to say about them is that the roster does not name them — which
 * is a different statement from splitting their plates among the people it does.
 */
export interface UnnamedSeatTotals {
  /** Seats charged for but not on the roster. Always at least one when present. */
  readonly seats: number;
  readonly admission: number;
  readonly baseAdmission: number;
  readonly adjustmentNet: number;
  readonly sharedPlates: number;
  readonly consumedPlates: number;
  readonly weightG: number;
  readonly retailValue: number;
  readonly restaurantCost: number;
  readonly retailRecoveryPercent: number;
  readonly nutrition: Nutrition;
}

/**
 * The whole table, divided so that the parts add back up to it.
 *
 * Two invariants hold here by construction rather than by coincidence, and both
 * are the reason a per-person figure is worth showing at all:
 *
 * Plates are exhaustive. Every diner's attributed plates, plus every seat's even
 * share of what stayed shared, equals what reached the table — with the unnamed
 * seats carrying their own share rather than donating it to the named ones.
 *
 * Money is exact. The per-seat amounts are settled in whole cents against the
 * table's own settled total, so what each person owes adds up to what the table
 * paid. Rounding four amounts independently and hoping is what produces a
 * receipt that is a cent short of itself.
 */
export interface TableSplit {
  readonly diners: readonly DinerDamageTotals[];
  /** Null when the roster names everybody the table was charged for. */
  readonly unnamed: UnnamedSeatTotals | null;
  readonly seats: number;
}

interface SeatFood {
  sharedPlates: number;
  consumedPlates: number;
  weightG: number;
  retailValue: number;
  restaurantCost: number;
  nutrition: Nutrition;
}

function emptySeatFood(): SeatFood {
  return {
    sharedPlates: 0,
    consumedPlates: 0,
    weightG: 0,
    retailValue: 0,
    restaurantCost: 0,
    nutrition: { ...EMPTY_NUTRITION },
  };
}

/**
 * Calculates an estimate per seat at the table while preserving its totals.
 *
 * Adjustments follow the same rule the plates do. One named to a diner is
 * theirs; anything charged to the table is divided evenly across every seat,
 * which is a stated assumption rather than a measurement — the bill records a
 * card fee, not who tapped the card.
 */
export function calculateTableSplit(
  items: readonly MealItem[],
  config: AdmissionConfig,
  pricingProfile: PricingProfile = DEFAULT_PRICING_PROFILE,
  foods = FOODS,
): TableSplit {
  const diners = config.diners ?? [];
  const seats = tableSeats(config);
  if (diners.length === 0) {
    return { diners: [], unnamed: null, seats };
  }

  const defaultAdmission = clampPricePerDiner(config.pricePerDiner);
  const unnamedSeats = Math.max(0, seats - diners.length);
  const tableAdjustments = totalAdjustments(tableWideAdjustments(config.adjustments));
  // One seat's share of what the table as a whole was charged.
  const seatAdjustmentNet = safeRatio(tableAdjustments.net, seats);

  const perDinerFood = diners.map(() => emptySeatFood());
  const attributedPlates = diners.map(() => 0);
  const unnamedFood = emptySeatFood();

  for (const item of items) {
    const food = findFoodInCatalogue(foods, item.foodId);
    if (!food) continue;
    const line = calculateLineItem(item, food, pricingProfile);
    // One seat's share of whatever nobody claimed from this line.
    const sharedPerSeat = safeRatio(sharedQuantity(item), seats);

    const take = (target: SeatFood, plates: number) => {
      const fraction = safeRatio(plates, line.plates);
      // A line's uneaten share is a property of the line, not of one person, so
      // each seat carries its proportion of what was eaten from it.
      target.consumedPlates += line.consumedPlates * fraction;
      target.weightG += line.weightG * fraction;
      target.retailValue += line.retailValue * fraction;
      target.restaurantCost += line.restaurantCost * fraction;
      target.nutrition = {
        calories: target.nutrition.calories + line.nutrition.calories * fraction,
        protein: target.nutrition.protein + line.nutrition.protein * fraction,
        fat: target.nutrition.fat + line.nutrition.fat * fraction,
        carbs: target.nutrition.carbs + line.nutrition.carbs * fraction,
      };
    };

    diners.forEach((diner, index) => {
      const attributed = Math.max(
        0,
        item.allocations?.find((entry) => entry.dinerId === diner.id)?.quantity ?? 0,
      );
      const seat = perDinerFood[index];
      if (!seat) return;
      attributedPlates[index] = (attributedPlates[index] ?? 0) + attributed;
      seat.sharedPlates += sharedPerSeat;
      take(seat, attributed + sharedPerSeat);
    });

    if (unnamedSeats > 0) {
      const plates = sharedPerSeat * unnamedSeats;
      unnamedFood.sharedPlates += plates;
      take(unnamedFood, plates);
    }
  }

  const baseAdmissions = diners.map((diner) =>
    typeof diner.admissionPrice === 'number' && diner.admissionPrice > 0
      ? clampPricePerDiner(diner.admissionPrice)
      : defaultAdmission,
  );
  const ownNets = diners.map(
    (diner) => totalAdjustments(adjustmentsForDiner(config.adjustments, diner.id)).net,
  );
  const adjustmentNets = ownNets.map((net) => net + seatAdjustmentNet);
  const unnamedBaseAdmission = defaultAdmission * unnamedSeats;
  const unnamedAdjustmentNet = seatAdjustmentNet * unnamedSeats;

  // What each seat would owe before the table's own total is rounded. Floored
  // at zero for the same reason the table's total is: a discount bigger than
  // somebody's entry price means they paid nothing, not less than nothing.
  const claims = [
    ...baseAdmissions.map((base, index) => Math.max(0, base + (adjustmentNets[index] ?? 0))),
    ...(unnamedSeats > 0 ? [Math.max(0, unnamedBaseAdmission + unnamedAdjustmentNet)] : []),
  ];
  // Settled against the table's own paid total, so the seats reconcile with the
  // receipt exactly rather than each rounding away from it on their own.
  const settled = distributeMoney(calculateBillTotals(config).totalPaid, claims);

  const dinerTotals = diners.map((diner, index) => {
    const seat = perDinerFood[index] ?? emptySeatFood();
    const attributed = attributedPlates[index] ?? 0;
    const admission = settled[index] ?? 0;
    const retailValue = seat.retailValue;
    return {
      diner,
      admission,
      baseAdmission: baseAdmissions[index] ?? defaultAdmission,
      adjustmentNet: adjustmentNets[index] ?? 0,
      attributedPlates: attributed,
      sharedPlates: seat.sharedPlates,
      effectivePlates: attributed + seat.sharedPlates,
      consumedPlates: seat.consumedPlates,
      weightG: seat.weightG,
      retailValue,
      restaurantCost: seat.restaurantCost,
      retailRecoveryPercent: safeRatio(retailValue, admission) * 100,
      nutrition: seat.nutrition,
    };
  });

  if (unnamedSeats === 0) {
    return { diners: dinerTotals, unnamed: null, seats };
  }

  const unnamedAdmission = settled[diners.length] ?? 0;
  return {
    diners: dinerTotals,
    unnamed: {
      seats: unnamedSeats,
      admission: unnamedAdmission,
      baseAdmission: unnamedBaseAdmission,
      adjustmentNet: unnamedAdjustmentNet,
      sharedPlates: unnamedFood.sharedPlates,
      consumedPlates: unnamedFood.consumedPlates,
      weightG: unnamedFood.weightG,
      retailValue: unnamedFood.retailValue,
      restaurantCost: unnamedFood.restaurantCost,
      retailRecoveryPercent: safeRatio(unnamedFood.retailValue, unnamedAdmission) * 100,
      nutrition: unnamedFood.nutrition,
    },
    seats,
  };
}

/** The named roster's own figures. The unnamed seats are in `calculateTableSplit`. */
export function calculateDinerTotals(
  items: readonly MealItem[],
  config: AdmissionConfig,
  pricingProfile: PricingProfile = DEFAULT_PRICING_PROFILE,
  foods = FOODS,
): readonly DinerDamageTotals[] {
  return calculateTableSplit(items, config, pricingProfile, foods).diners;
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
