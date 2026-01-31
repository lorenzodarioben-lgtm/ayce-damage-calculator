import { CATEGORY_META } from '@/lib/constants';
import { calculateDinerTotals, tableSeats } from '@/lib/calculations';
import { foodCatalogue, findFoodInCatalogue } from '@/lib/foodCatalogue';
import { DEFAULT_MONEY_CONTEXT, type MoneyContext } from '@/lib/money';
import { sharedQuantity } from '@/lib/diners';
import type { RegularDiner } from '@/lib/regularDiners';
import type { SavedMealSession } from '@/types/history';
import type { FoodCategory } from '@/types/meal';

/**
 * What the file says about one person.
 *
 * Everything here is a fold over records the diner already has. There is no
 * second store of per-person totals to drift out of step with history: a
 * profile is a name and an opaque local id, and every figure beside it is
 * recomputed from the meals themselves by the same engine the report uses.
 *
 * The honesty problem this has to solve is attribution. A table records one
 * shared tab, and Table Mode records who reached for what only when somebody
 * says so. So two figures are kept apart everywhere: plates explicitly
 * attributed to a person, and their even share of what the table shared. The
 * first is a record; the second is a stated assumption, and it is labelled as
 * one rather than folded into a single confident number.
 *
 * A meal recorded without a roster is not assigned to anybody at all. Nobody
 * said who was there, and guessing from a restaurant name or a date would be an
 * invention rather than a record.
 */

export interface DinerFoodTally {
  readonly foodId: string;
  readonly name: string;
  /** Explicit plus evenly shared, which is what "how much of this" means. */
  readonly plates: number;
}

export interface DinerCategoryTally {
  readonly id: FoodCategory;
  readonly label: string;
  readonly plates: number;
  /** Share of this diner's own plates, 0–100. */
  readonly share: number;
}

export interface DinerVisit {
  readonly recordId: string;
  readonly recordedAt: string;
  readonly restaurantName: string;
  readonly attributedPlates: number;
  readonly sharedPlates: number;
  readonly effectivePlates: number;
  readonly retailValue: number;
  readonly admission: number;
  readonly recoveryPercent: number;
  readonly money: MoneyContext;
}

export interface DinerSummary {
  readonly diner: RegularDiner;
  /** Records whose roster names this person. Never inferred from anything else. */
  readonly visits: number;
  readonly firstVisitAt: string | null;
  readonly latestVisitAt: string | null;
  /** Plates somebody explicitly said were this person's. */
  readonly attributedPlates: number;
  /** An even share of what the table shared. A stated assumption, not a record. */
  readonly sharedPlates: number;
  readonly effectivePlates: number;
  readonly weightKg: number;
  readonly retailValue: number;
  readonly admission: number;
  /** Retail value against what they paid, over every visit. */
  readonly recoveryPercent: number;
  readonly topFoods: readonly DinerFoodTally[];
  readonly categories: readonly DinerCategoryTally[];
  /** Newest first, so recent meals can be listed without re-sorting. */
  readonly recent: readonly DinerVisit[];
  /** The currency the most recent visit was recorded in. */
  readonly money: MoneyContext;
}

/** How many foods a diner's "most ordered" list names. */
export const DINER_TOP_FOOD_LENGTH = 5;

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

/**
 * The records that name this person on their roster.
 *
 * An explicit membership test, exactly like a restaurant's. A session filed
 * without a roster belongs to nobody, and a session whose roster happens to
 * contain a similar name belongs to whoever the id says it does.
 */
export function dinerVisits(
  records: readonly SavedMealSession[],
  dinerId: string,
): readonly SavedMealSession[] {
  return records.filter((record) => record.diners?.some((diner) => diner.id === dinerId));
}

/** True when any filed record has ever had this person at the table. */
export function hasAnyVisit(records: readonly SavedMealSession[], dinerId: string): boolean {
  return records.some((record) => record.diners?.some((diner) => diner.id === dinerId));
}

export function buildDinerSummary(
  diner: RegularDiner,
  records: readonly SavedMealSession[],
): DinerSummary {
  const visits = [...dinerVisits(records, diner.id)].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );

  let attributedPlates = 0;
  let sharedPlates = 0;
  let weightG = 0;
  let retailValue = 0;
  let admission = 0;

  const platesByFood = new Map<string, number>();
  const platesByCategory = new Map<FoodCategory, number>();
  const recent: DinerVisit[] = [];

  for (const record of visits) {
    const foods = foodCatalogue(record.customFoods);
    const totals = calculateDinerTotals(
      record.items,
      {
        pricePerDiner: record.pricePerDiner,
        dinerCount: record.dinerCount,
        ...(record.diners ? { diners: record.diners } : {}),
        ...(record.adjustments?.length ? { adjustments: record.adjustments } : {}),
      },
      record.pricingProfile,
      foods,
    );
    const mine = totals.find((entry) => entry.diner.id === diner.id);
    if (!mine) {
      continue;
    }

    attributedPlates += mine.attributedPlates;
    sharedPlates += mine.sharedPlates;
    weightG += mine.weightG;
    retailValue += mine.retailValue;
    admission += mine.admission;

    // Per-line attribution again, because the summary above is money and this
    // is "what did they actually eat" — the same division, applied per food.
    // Divided by seats rather than by the roster, so a meal where somebody was
    // never typed in does not quietly hand their food to the people who were.
    const seats = Math.max(1, tableSeats(record));
    for (const item of record.items) {
      const food = findFoodInCatalogue(foods, item.foodId);
      if (!food) {
        continue;
      }
      const explicit = item.allocations?.find((entry) => entry.dinerId === diner.id)?.quantity ?? 0;
      const share = sharedQuantity(item) / seats;
      const plates = Math.max(0, explicit) + share;
      if (plates <= 0) {
        continue;
      }
      platesByFood.set(item.foodId, (platesByFood.get(item.foodId) ?? 0) + plates);
      platesByCategory.set(food.category, (platesByCategory.get(food.category) ?? 0) + plates);
    }

    recent.push({
      recordId: record.id,
      recordedAt: record.createdAt,
      restaurantName: record.restaurantName,
      attributedPlates: mine.attributedPlates,
      sharedPlates: mine.sharedPlates,
      effectivePlates: mine.effectivePlates,
      retailValue: mine.retailValue,
      admission: mine.admission,
      recoveryPercent: mine.retailRecoveryPercent,
      money: record.pricingProfile.money,
    });
  }

  const effectivePlates = attributedPlates + sharedPlates;

  const topFoods = [...platesByFood.entries()]
    .map(([foodId, plates]) => {
      const record = visits.find((entry) =>
        findFoodInCatalogue(foodCatalogue(entry.customFoods), foodId),
      );
      const food = record
        ? findFoodInCatalogue(foodCatalogue(record.customFoods), foodId)
        : undefined;
      return { foodId, name: food?.name ?? foodId, plates };
    })
    // Ties break on name, so the same history always produces the same list.
    .sort((a, b) => b.plates - a.plates || a.name.localeCompare(b.name))
    .slice(0, DINER_TOP_FOOD_LENGTH);

  const categories = CATEGORY_META.map((category) => {
    const plates = platesByCategory.get(category.id) ?? 0;
    return {
      id: category.id,
      label: category.label,
      plates,
      share: safeRatio(plates, effectivePlates) * 100,
    };
  });

  return {
    diner,
    visits: visits.length,
    firstVisitAt: visits[visits.length - 1]?.createdAt ?? null,
    latestVisitAt: visits[0]?.createdAt ?? null,
    attributedPlates,
    sharedPlates,
    effectivePlates,
    weightKg: weightG / 1000,
    retailValue,
    admission,
    recoveryPercent: safeRatio(retailValue, admission) * 100,
    topFoods,
    categories,
    recent,
    money: visits[0]?.pricingProfile.money ?? DEFAULT_MONEY_CONTEXT,
  };
}

/**
 * Every saved profile with its figures, most recently seen first.
 *
 * People who have never appeared on a filed roster fall to the bottom, then by
 * name, so the order is stable rather than dependent on insertion.
 */
export function summariseDiners(
  diners: readonly RegularDiner[],
  records: readonly SavedMealSession[],
): readonly DinerSummary[] {
  return diners
    .map((diner) => buildDinerSummary(diner, records))
    .sort((a, b) => {
      const latest = Date.parse(b.latestVisitAt ?? '') || 0;
      const previous = Date.parse(a.latestVisitAt ?? '') || 0;
      return latest - previous || a.diner.displayName.localeCompare(b.diner.displayName);
    });
}

/**
 * People who appear on a filed roster but are not in the local directory.
 *
 * A roster is a snapshot of who was at one table, and deleting a directory
 * entry never rewrites one. These are reported so the count is honest, not so
 * they can be silently re-created.
 */
export function unsavedDinerNames(
  records: readonly SavedMealSession[],
  diners: readonly RegularDiner[],
): readonly string[] {
  const known = new Set(diners.map((diner) => diner.id));
  const seen = new Map<string, string>();
  for (const record of records) {
    for (const diner of record.diners ?? []) {
      if (!known.has(diner.id) && !seen.has(diner.id)) {
        seen.set(diner.id, diner.displayName);
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
