import { calculateSessionTotals } from '@/lib/calculations';
import { resolveValuation } from '@/lib/valuation';
import {
  PLATE_SIZES,
  QUALITY_TIERS,
  getPlateSizeMeta,
  getQualityMeta,
  isPlateSize,
  isQualityTier,
} from '@/lib/constants';
import { clampToRange } from '@/lib/range';
import { findFoodInCatalogue } from '@/lib/foodCatalogue';
import { mealItemId } from '@/lib/mealItems';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import type { PricingProfile } from '@/types/pricing';
import type { FoodItem, MealItem, PlateSize, QualityTier, SessionTotals } from '@/types/meal';

/**
 * A menu simulation, not a recommendation.
 *
 * The planner answers one narrow arithmetic question: given a set of menu
 * assumptions, which combination of plates would reach a chosen share of the
 * admission price. It says nothing about what anyone should eat, and every
 * figure it produces is the same illustrative estimate the rest of the app
 * uses — a plan is a spreadsheet exercise, and the interface says so.
 *
 * The search is a bounded dynamic program. Every dimension of it is a constant
 * declared here, so the worst case is fixed at compile time and no input can
 * make the browser sit and think.
 */

export type PlanStrategy = 'fewest-plates' | 'lowest-weight' | 'balanced';

export const PLAN_STRATEGIES: readonly PlanStrategy[] = [
  'fewest-plates',
  'lowest-weight',
  'balanced',
];

export interface PlanStrategyMeta {
  readonly id: PlanStrategy;
  readonly label: string;
  readonly description: string;
}

export const PLAN_STRATEGY_META: readonly PlanStrategyMeta[] = [
  {
    id: 'fewest-plates',
    label: 'Fewest plates',
    description: 'The smallest number of plates that reaches the target.',
  },
  {
    id: 'lowest-weight',
    label: 'Lowest weight',
    description: 'The least estimated food weight that reaches the target.',
  },
  {
    id: 'balanced',
    label: 'Balanced spread',
    description: 'Fewest plates, with no single configuration repeated more than three times.',
  },
];

/** A share of admission worth simulating. Deliberately not unbounded. */
export const MIN_TARGET_RECOVERY = 50;
export const MAX_TARGET_RECOVERY = 250;
export const DEFAULT_TARGET_RECOVERY = 100;

/** Hard ceilings on the search, and on what a plan is allowed to describe. */
export const MAX_PLAN_QUANTITY_PER_ITEM = 12;
export const BALANCED_ITEM_CAP = 3;
export const MAX_PLAN_PLATES = 40;
export const MAX_PLAN_CANDIDATES = 480;

/** Retail value is searched in fifty-cent steps, floored, so a plan never undershoots. */
export const PLAN_VALUE_BUCKET = 0.5;

/** The dynamic program is never wider than this, whatever the admission price. */
export const MAX_PLAN_BUCKETS = 2400;

export interface PlanLine {
  readonly foodId: string;
  readonly quality: QualityTier;
  readonly plateSize: PlateSize;
  readonly quantity: number;
}

export interface PlanConstraints {
  readonly targetRecoveryPercent: number;
  readonly strategy: PlanStrategy;
  /** The admission the plan is measured against, already clamped by the caller. */
  readonly admission: number;
  /** Empty means the whole catalogue is available. */
  readonly includedFoodIds: readonly string[];
  readonly qualities: readonly QualityTier[];
  readonly plateSizes: readonly PlateSize[];
  readonly maxPerItem: number;
  /** Configurations the planner must include, whatever else it chooses. */
  readonly locked: readonly PlanLine[];
}

export type PlanFailure =
  | 'no-candidates'
  | 'target-unreachable'
  | 'exceeds-plate-cap'
  | 'locked-exceeds-cap';

export const PLAN_FAILURE_MESSAGES: Readonly<Record<PlanFailure, string>> = {
  'no-candidates':
    'Nothing is available to plan with. Include at least one cut, quality tier and serving size.',
  'target-unreachable': `That target is out of reach inside the ${MAX_PLAN_PLATES}-plate limit this simulation works within.`,
  'exceeds-plate-cap': `Reaching that target this way would take more than ${MAX_PLAN_PLATES} plates, which is past what this simulation will describe.`,
  'locked-exceeds-cap': `The locked items alone are past the ${MAX_PLAN_PLATES}-plate limit this simulation works within.`,
};

export interface PlanResult {
  readonly feasible: boolean;
  readonly failure: PlanFailure | null;
  readonly strategy: PlanStrategy;
  readonly lines: readonly PlanLine[];
  /** Recomputed by the ordinary engine, so a plan and a meal agree. */
  readonly totals: SessionTotals;
  readonly targetRetailValue: number;
  readonly recoveryPercent: number;
  /** Plain statements of why the search settled here. */
  readonly rationale: readonly string[];
  /** Dynamic-program cells filled, so the bound on the search is observable. */
  readonly evaluated: number;
}

export interface PlanProgress {
  readonly plannedPlates: number;
  readonly matchedPlates: number;
  readonly remainingPlates: number;
}

/**
 * Progress is a read-only comparison of a plan and the actual meal ledger.
 * It deliberately returns no meal items and never adjusts quantities or totals.
 */
export function calculatePlanProgress(
  plan: readonly PlanLine[],
  eaten: readonly MealItem[],
): PlanProgress {
  const actual = new Map(eaten.map((item) => [mealItemId(item), item.quantity]));
  const plannedPlates = plan.reduce((total, line) => total + line.quantity, 0);
  const matchedPlates = plan.reduce(
    (total, line) => total + Math.min(line.quantity, actual.get(mealItemId(line)) ?? 0),
    0,
  );
  return { plannedPlates, matchedPlates, remainingPlates: plannedPlates - matchedPlates };
}

interface Candidate {
  readonly foodId: string;
  readonly quality: QualityTier;
  readonly plateSize: PlateSize;
  readonly retailValue: number;
  readonly weightG: number;
  readonly buckets: number;
  readonly cap: number;
}

const QUALITY_ORDER: readonly QualityTier[] = QUALITY_TIERS.map((tier) => tier.id);
const PLATE_ORDER: readonly PlateSize[] = PLATE_SIZES.map((size) => size.id);

export function clampTargetRecovery(value: number): number {
  return clampToRange(
    Math.round(value),
    MIN_TARGET_RECOVERY,
    MAX_TARGET_RECOVERY,
    DEFAULT_TARGET_RECOVERY,
  );
}

export function clampPlanQuantity(value: number): number {
  return clampToRange(Math.floor(value), 1, MAX_PLAN_QUANTITY_PER_ITEM, 1);
}

function retailValueOf(
  food: FoodItem,
  quality: QualityTier,
  plateSize: PlateSize,
  profile: PricingProfile,
): number {
  // Valued per unit through the shared resolver, so a serving-priced item can
  // be planned alongside a per-kilogram cut without the optimiser knowing which
  // is which.
  const value = resolveValuation(food, quality, plateSize, profile).retailPerUnit;
  return Number.isFinite(value) ? value : 0;
}

/**
 * Builds the search space in one fixed order.
 *
 * Order matters: ties in the dynamic program are broken by whichever candidate
 * comes first, so a stable order is what makes the same request produce the
 * same plan every time.
 */
function buildCandidates(
  constraints: PlanConstraints,
  foods: readonly FoodItem[],
  profile: PricingProfile,
  cap: number,
): readonly Candidate[] {
  const included = new Set(constraints.includedFoodIds);
  const qualities = QUALITY_ORDER.filter((tier) => constraints.qualities.includes(tier));
  const plateSizes = PLATE_ORDER.filter((size) => constraints.plateSizes.includes(size));

  const candidates: Candidate[] = [];
  for (const food of foods) {
    if (included.size > 0 && !included.has(food.id)) {
      continue;
    }
    for (const quality of qualities) {
      for (const plateSize of plateSizes) {
        const retailValue = retailValueOf(food, quality, plateSize, profile);
        const buckets = Math.floor(retailValue / PLAN_VALUE_BUCKET);
        // A configuration worth nothing cannot move the plan toward its target.
        if (buckets <= 0) {
          continue;
        }
        candidates.push({
          foodId: food.id,
          quality,
          plateSize,
          retailValue,
          weightG: getPlateSizeMeta(plateSize).grams,
          buckets,
          cap,
        });
        if (candidates.length >= MAX_PLAN_CANDIDATES) {
          return candidates;
        }
      }
    }
  }
  return candidates;
}

function costOf(candidate: Candidate, strategy: PlanStrategy): number {
  return strategy === 'lowest-weight' ? candidate.weightG : 1;
}

function toMealItems(lines: readonly PlanLine[]): readonly MealItem[] {
  return lines.map((line) => ({
    id: mealItemId(line),
    foodId: line.foodId,
    quality: line.quality,
    plateSize: line.plateSize,
    quantity: line.quantity,
  }));
}

function mergeLines(lines: readonly PlanLine[]): readonly PlanLine[] {
  const byId = new Map<string, PlanLine>();
  for (const line of lines) {
    const id = mealItemId(line);
    const existing = byId.get(id);
    byId.set(id, existing ? { ...existing, quantity: existing.quantity + line.quantity } : line);
  }
  return [...byId.values()];
}

function describeLine(line: PlanLine, foods: readonly FoodItem[]): string {
  const food = findFoodInCatalogue(foods, line.foodId);
  return `${line.quantity} × ${food?.name ?? line.foodId} (${getQualityMeta(line.quality).label}, ${getPlateSizeMeta(line.plateSize).label})`;
}

function emptyResult(
  strategy: PlanStrategy,
  failure: PlanFailure | null,
  targetRetailValue: number,
  profile: PricingProfile,
  foods: readonly FoodItem[],
  rationale: readonly string[] = [],
): PlanResult {
  return {
    feasible: failure === null,
    failure,
    strategy,
    lines: [],
    totals: calculateSessionTotals([], profile, foods),
    targetRetailValue,
    recoveryPercent: 0,
    rationale,
    evaluated: 0,
  };
}

/**
 * Finds a plan that reaches the target, if one exists inside the bounds.
 *
 * The dynamic program's state is the retail value accumulated so far, in
 * fifty-cent buckets, clamped at the target — so "more than enough" is a single
 * state rather than an unbounded tail. Each candidate is offered up to its cap
 * in one pass, and the chosen quantity is recorded so the winning combination
 * can be read back out rather than re-derived.
 */
export function buildDamagePlan(
  constraints: PlanConstraints,
  foods: readonly FoodItem[],
  profile: PricingProfile = DEFAULT_PRICING_PROFILE,
): PlanResult {
  const strategy = constraints.strategy;
  const target = clampTargetRecovery(constraints.targetRecoveryPercent);
  const admission = Number.isFinite(constraints.admission) ? Math.max(0, constraints.admission) : 0;
  const targetRetailValue = (admission * target) / 100;

  const itemCap =
    strategy === 'balanced'
      ? Math.min(BALANCED_ITEM_CAP, clampPlanQuantity(constraints.maxPerItem))
      : clampPlanQuantity(constraints.maxPerItem);

  const locked = mergeLines(
    constraints.locked
      .filter((line) => findFoodInCatalogue(foods, line.foodId))
      .filter((line) => isQualityTier(line.quality) && isPlateSize(line.plateSize))
      .map((line) => ({ ...line, quantity: clampPlanQuantity(line.quantity) })),
  );
  const lockedPlates = locked.reduce((sum, line) => sum + line.quantity, 0);
  if (lockedPlates > MAX_PLAN_PLATES) {
    return emptyResult('fewest-plates', 'locked-exceeds-cap', targetRetailValue, profile, foods);
  }

  const lockedTotals = calculateSessionTotals(toMealItems(locked), profile, foods);
  const remainingValue = Math.max(0, targetRetailValue - lockedTotals.totalRetailValue);

  const candidates = buildCandidates(constraints, foods, profile, itemCap);
  if (candidates.length === 0 && remainingValue > 0) {
    return emptyResult(strategy, 'no-candidates', targetRetailValue, profile, foods);
  }

  // The locked selection alone may already clear the target.
  if (remainingValue <= 0) {
    return finish(locked, [], strategy, targetRetailValue, admission, profile, foods, 0, true);
  }

  const bestBuckets = candidates.reduce((best, candidate) => Math.max(best, candidate.buckets), 0);
  const platesAvailable = MAX_PLAN_PLATES - lockedPlates;
  const reachableBuckets = bestBuckets * platesAvailable;
  const wantedBuckets = Math.ceil(remainingValue / PLAN_VALUE_BUCKET);

  if (wantedBuckets > reachableBuckets || wantedBuckets > MAX_PLAN_BUCKETS) {
    return emptyResult(strategy, 'target-unreachable', targetRetailValue, profile, foods);
  }

  const width = wantedBuckets + 1;
  const cost = new Float64Array(width).fill(Number.POSITIVE_INFINITY);
  cost[0] = 0;
  // One row per candidate, holding how many of it the best route to each state used.
  const taken = new Int16Array(candidates.length * width);
  let evaluated = 0;

  for (const [index, candidate] of candidates.entries()) {
    const next = Float64Array.from(cost);
    const row = index * width;
    for (let quantity = 1; quantity <= candidate.cap; quantity += 1) {
      const gained = candidate.buckets * quantity;
      const added = costOf(candidate, strategy) * quantity;
      for (let state = 0; state < width; state += 1) {
        const from = cost[state];
        if (from === undefined || !Number.isFinite(from)) {
          continue;
        }
        evaluated += 1;
        const reached = Math.min(wantedBuckets, state + gained);
        // Strictly better only, so the earliest candidate wins every tie.
        if (from + added < (next[reached] ?? Number.POSITIVE_INFINITY)) {
          next[reached] = from + added;
          taken[row + reached] = quantity;
        }
      }
    }
    cost.set(next);
  }

  if (!Number.isFinite(cost[wantedBuckets] ?? Number.POSITIVE_INFINITY)) {
    return emptyResult(strategy, 'target-unreachable', targetRetailValue, profile, foods);
  }

  /*
   * Walking the choices back out requires re-running the prefix, because a
   * later candidate's row only records what it took, not what came before it.
   * Rebuilding forward for each step keeps the reconstruction exact without
   * storing a full parent table for every state.
   */
  const chosen: PlanLine[] = [];
  let state = wantedBuckets;
  for (let index = candidates.length - 1; index >= 0 && state > 0; index -= 1) {
    const candidate = candidates[index];
    const quantity = taken[index * width + state] ?? 0;
    if (!candidate || quantity <= 0) {
      continue;
    }
    chosen.push({
      foodId: candidate.foodId,
      quality: candidate.quality,
      plateSize: candidate.plateSize,
      quantity,
    });
    state = Math.max(0, state - candidate.buckets * quantity);
  }
  chosen.reverse();

  const plates = lockedPlates + chosen.reduce((sum, line) => sum + line.quantity, 0);
  if (plates > MAX_PLAN_PLATES) {
    return emptyResult(strategy, 'exceeds-plate-cap', targetRetailValue, profile, foods);
  }

  return finish(
    locked,
    chosen,
    strategy,
    targetRetailValue,
    admission,
    profile,
    foods,
    evaluated,
    false,
  );
}

function finish(
  locked: readonly PlanLine[],
  chosen: readonly PlanLine[],
  strategy: PlanStrategy,
  targetRetailValue: number,
  admission: number,
  profile: PricingProfile,
  foods: readonly FoodItem[],
  evaluated: number,
  lockedAlone: boolean,
): PlanResult {
  const lines = mergeLines([...locked, ...chosen]);
  const totals = calculateSessionTotals(toMealItems(lines), profile, foods);
  const recoveryPercent = admission > 0 ? (totals.totalRetailValue / admission) * 100 : 0;

  const rationale: string[] = [];
  if (locked.length > 0) {
    rationale.push(
      `Kept the items you locked: ${locked.map((line) => describeLine(line, foods)).join(', ')}.`,
    );
  }
  if (lockedAlone) {
    rationale.push('The locked items already clear the target on their own, so nothing was added.');
  } else {
    const meta = PLAN_STRATEGY_META.find((entry) => entry.id === strategy);
    rationale.push(
      `Searched for the ${meta?.label.toLowerCase() ?? strategy} route to the target: ${meta?.description ?? ''}`.trim(),
    );
    const headline = [...chosen].sort((a, b) => b.quantity - a.quantity)[0];
    if (headline) {
      rationale.push(
        `${describeLine(headline, foods)} carries the most of it, on estimated retail value per ${strategy === 'lowest-weight' ? 'gram' : 'plate'}.`,
      );
    }
  }
  rationale.push(
    'Every figure is the same illustrative estimate the calculator uses elsewhere. This is a menu simulation, not a suggestion about what to eat.',
  );

  return {
    feasible: true,
    failure: null,
    strategy,
    lines,
    totals,
    targetRetailValue,
    recoveryPercent,
    rationale,
    evaluated,
  };
}
