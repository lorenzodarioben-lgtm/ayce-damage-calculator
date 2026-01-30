import { buildDamageReport, calculateBillTotals } from '@/lib/calculations';
import { FOODS } from '@/data/foods';
import { DEFAULT_PRICING_PROFILE, resolveFoodPricing } from '@/lib/pricing';
import { getVerdict, type VerdictId } from '@/lib/verdicts';
import type { FoodPricing, PricingProfile } from '@/types/pricing';
import type { Diner, FoodItem, MealItem, SessionConfig } from '@/types/meal';

/**
 * How much the headline figure depends on assumptions nobody measured.
 *
 * The calculator's point estimate is a product of three numbers it cannot know
 * exactly: how much a plate actually weighed, what the same meat costs at a
 * supermarket this week, and what a restaurant paid a wholesaler. Reporting one
 * figure to the cent and stopping there would claim a precision the data does
 * not have.
 *
 * So this module varies each assumption across a stated range and reports what
 * happens. These are explicitly *not* confidence intervals — nothing here was
 * sampled, and no distribution is being estimated. They are three named
 * scenarios built from bounds the project chose and states plainly, which is a
 * much weaker and much more honest claim.
 */

export type ScenarioId = 'conservative' | 'base' | 'optimistic';

export type AssumptionId = 'serving-weight' | 'retail-price' | 'ingredient-cost';

/** Which headline figure an assumption actually moves. */
export type AssumptionEffect = 'recovery' | 'ingredient-margin';

export interface UncertaintyAssumption {
  readonly id: AssumptionId;
  readonly label: string;
  readonly detail: string;
  readonly effect: AssumptionEffect;
  /** Multipliers on the base estimate, chosen by the project and stated openly. */
  readonly low: number;
  readonly base: number;
  readonly high: number;
}

export const UNCERTAINTY_ASSUMPTIONS: readonly UncertaintyAssumption[] = [
  {
    id: 'serving-weight',
    label: 'Serving weight',
    detail:
      'A "regular" plate is a nominal 155 g. Real plates vary with the restaurant, the cut and how it was trimmed.',
    effect: 'recovery',
    low: 0.8,
    base: 1,
    high: 1.2,
  },
  {
    id: 'retail-price',
    label: 'Retail price per kilogram',
    detail:
      'Supermarket prices move with supplier, grade, city and the week. The catalogue holds one illustrative figure per cut.',
    effect: 'recovery',
    low: 0.85,
    base: 1,
    high: 1.15,
  },
  {
    id: 'ingredient-cost',
    label: 'Restaurant ingredient cost',
    detail:
      'The least knowable figure here: what a restaurant pays a wholesaler is not published. It moves the estimated ingredient margin, never the recovery.',
    effect: 'ingredient-margin',
    low: 0.7,
    base: 1,
    high: 1.3,
  },
];

function assumption(id: AssumptionId): UncertaintyAssumption {
  const found = UNCERTAINTY_ASSUMPTIONS.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`Unknown uncertainty assumption: ${id}`);
  }
  return found;
}

interface Multipliers {
  readonly weight: number;
  readonly retail: number;
  readonly cost: number;
}

const BASE_MULTIPLIERS: Multipliers = { weight: 1, retail: 1, cost: 1 };

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

/**
 * Builds a scaled pricing profile rather than a second calculation engine.
 *
 * Retail value is weight × price per kilogram, so scaling one is arithmetically
 * identical to scaling the other. Folding both multipliers into the profile
 * lets every scenario run through exactly the same engine the report uses,
 * which is what keeps a scenario and the headline figure comparable at all.
 */
function scaledProfile(
  profile: PricingProfile,
  foods: readonly FoodItem[],
  multipliers: Multipliers,
): PricingProfile {
  const overrides: Record<string, FoodPricing> = {};
  for (const food of foods) {
    const base = resolveFoodPricing(food, profile);
    overrides[food.id] =
      base.valuation === 'by-serving'
        ? {
            valuation: 'by-serving',
            // A serving is one thing at one price, so the serving-weight
            // multiplier has nothing to act on: what is uncertain about a bowl
            // of soup is its price, not how many grams of plate it was.
            retailPricePerServing: base.retailPricePerServing * multipliers.retail,
            restaurantCostPerServing: base.restaurantCostPerServing * multipliers.cost,
          }
        : {
            valuation: 'by-weight',
            retailPricePerKg: base.retailPricePerKg * multipliers.retail * multipliers.weight,
            restaurantCostPerKg: base.restaurantCostPerKg * multipliers.cost * multipliers.weight,
          };
  }
  return { ...profile, overrides };
}

export interface ScenarioOutcome {
  readonly id: ScenarioId;
  readonly label: string;
  readonly retailValue: number;
  readonly restaurantCost: number;
  /** The meal's weight under this scenario's serving-weight assumption. */
  readonly weightG: number;
  readonly recoveryPercent: number;
  readonly beatsAdmission: boolean;
  readonly verdictId: VerdictId;
  readonly verdictTitle: string;
}

export interface SensitivityEntry {
  readonly assumptionId: AssumptionId;
  readonly label: string;
  readonly effect: AssumptionEffect;
  readonly lowRecoveryPercent: number;
  readonly highRecoveryPercent: number;
  /** High minus low, in percentage points. Always non-negative. */
  readonly swingPoints: number;
  /** True when the two ends of this assumption alone land on different verdicts. */
  readonly changesVerdict: boolean;
  /** True when the two ends disagree about whether admission was beaten. */
  readonly changesOutcome: boolean;
  /** Ingredient-margin swing, for the assumption that moves that instead. */
  readonly marginSwing: number;
}

export interface UncertaintyAnalysis {
  readonly admission: number;
  readonly base: ScenarioOutcome;
  readonly conservative: ScenarioOutcome;
  readonly optimistic: ScenarioOutcome;
  /** Ordered by how much each assumption moves the result, largest first. */
  readonly sensitivity: readonly SensitivityEntry[];
  /** True when every scenario agrees about whether admission was beaten. */
  readonly robust: boolean;
  /** True when every scenario also lands on the same verdict. */
  readonly verdictHolds: boolean;
  /** A deterministic one-line reading of the range. */
  readonly headline: string;
}

type AnalysisConfig = Pick<SessionConfig, 'pricePerDiner' | 'dinerCount'> & {
  readonly diners?: readonly Diner[];
};

const SCENARIO_LABELS: Readonly<Record<ScenarioId, string>> = {
  conservative: 'Conservative',
  base: 'Base estimate',
  optimistic: 'Upper estimate',
};

function scenario(
  id: ScenarioId,
  multipliers: Multipliers,
  items: readonly MealItem[],
  config: AnalysisConfig,
  profile: PricingProfile,
  foods: readonly FoodItem[],
): ScenarioOutcome {
  const report = buildDamageReport(
    items,
    config,
    scaledProfile(profile, foods, multipliers),
    foods,
  );
  const verdict = getVerdict(report.totalRetailValue, report.totalAdmission);

  return {
    id,
    label: SCENARIO_LABELS[id],
    retailValue: report.totalRetailValue,
    restaurantCost: report.totalRestaurantCost,
    // The engine's weight is the nominal one; the scenario's own assumption is
    // applied here rather than pretending the plate sizes themselves changed.
    weightG: report.totalWeightG * multipliers.weight,
    recoveryPercent: report.retailRecoveryPercent,
    beatsAdmission: report.hasBeatenBuffet,
    verdictId: verdict.id,
    verdictTitle: verdict.title,
  };
}

function recoveryAt(
  id: AssumptionId,
  end: 'low' | 'high',
  items: readonly MealItem[],
  config: AnalysisConfig,
  profile: PricingProfile,
  foods: readonly FoodItem[],
): ScenarioOutcome {
  const entry = assumption(id);
  const multipliers: Multipliers = {
    ...BASE_MULTIPLIERS,
    ...(id === 'serving-weight' ? { weight: entry[end] } : {}),
    ...(id === 'retail-price' ? { retail: entry[end] } : {}),
    ...(id === 'ingredient-cost' ? { cost: entry[end] } : {}),
  };
  return scenario('base', multipliers, items, config, profile, foods);
}

function buildSensitivity(
  items: readonly MealItem[],
  config: AnalysisConfig,
  profile: PricingProfile,
  foods: readonly FoodItem[],
): readonly SensitivityEntry[] {
  const entries = UNCERTAINTY_ASSUMPTIONS.map((entry) => {
    const low = recoveryAt(entry.id, 'low', items, config, profile, foods);
    const high = recoveryAt(entry.id, 'high', items, config, profile, foods);

    return {
      assumptionId: entry.id,
      label: entry.label,
      effect: entry.effect,
      lowRecoveryPercent: low.recoveryPercent,
      highRecoveryPercent: high.recoveryPercent,
      swingPoints: Math.abs(high.recoveryPercent - low.recoveryPercent),
      changesVerdict: low.verdictId !== high.verdictId,
      changesOutcome: low.beatsAdmission !== high.beatsAdmission,
      marginSwing: Math.abs(high.restaurantCost - low.restaurantCost),
    };
  });

  // Largest mover first; ties fall back to the declared order, so the list is
  // stable for a meal where two assumptions happen to matter equally.
  return [...entries].sort(
    (a, b) =>
      b.swingPoints - a.swingPoints ||
      UNCERTAINTY_ASSUMPTIONS.findIndex((entry) => entry.id === a.assumptionId) -
        UNCERTAINTY_ASSUMPTIONS.findIndex((entry) => entry.id === b.assumptionId),
  );
}

function headlineFor(
  conservative: ScenarioOutcome,
  base: ScenarioOutcome,
  optimistic: ScenarioOutcome,
  hasMeal: boolean,
): string {
  if (!hasMeal) {
    return 'There is nothing on the tab to test yet.';
  }
  if (conservative.beatsAdmission) {
    return 'Even under the conservative assumptions, estimated retail value stays above admission.';
  }
  if (!optimistic.beatsAdmission) {
    return 'Admission stays ahead even under the most generous assumptions here.';
  }
  return base.beatsAdmission
    ? 'The verdict depends on the assumptions: it clears admission on the base estimate, but not on the conservative one.'
    : 'The verdict depends on the assumptions: it clears admission only at the generous end of the range.';
}

/**
 * Runs the whole analysis over one meal.
 *
 * Every figure comes from the ordinary calculation engine with a scaled pricing
 * context, so a scenario is the same sum as the headline with different inputs
 * — never a second model that could quietly disagree with the first.
 */
export function buildUncertaintyAnalysis(
  items: readonly MealItem[],
  config: AnalysisConfig,
  profile: PricingProfile = DEFAULT_PRICING_PROFILE,
  foods: readonly FoodItem[] = FOODS,
): UncertaintyAnalysis {
  const weight = assumption('serving-weight');
  const retail = assumption('retail-price');
  const cost = assumption('ingredient-cost');

  const base = scenario('base', BASE_MULTIPLIERS, items, config, profile, foods);
  const conservative = scenario(
    'conservative',
    // Conservative about the diner's claim on both sides: the least value
    // recovered, against the highest plausible ingredient cost.
    { weight: weight.low, retail: retail.low, cost: cost.high },
    items,
    config,
    profile,
    foods,
  );
  const optimistic = scenario(
    'optimistic',
    { weight: weight.high, retail: retail.high, cost: cost.low },
    items,
    config,
    profile,
    foods,
  );

  const outcomes = [conservative, base, optimistic];
  const hasMeal = items.length > 0 && base.retailValue > 0;

  return {
    // The final paid total, because that is what every scenario below is
    // measured against — an uncertainty band around the wrong denominator
    // would be precise about the wrong question.
    admission: calculateBillTotals(config).totalPaid,
    base,
    conservative,
    optimistic,
    sensitivity: buildSensitivity(items, config, profile, foods),
    robust: hasMeal && outcomes.every((entry) => entry.beatsAdmission === base.beatsAdmission),
    verdictHolds: hasMeal && outcomes.every((entry) => entry.verdictId === base.verdictId),
    headline: headlineFor(conservative, base, optimistic, hasMeal),
  };
}

/** The stated width of the range, as a share of the base estimate. */
export function scenarioSpreadPercent(analysis: UncertaintyAnalysis): number {
  return (
    safeRatio(
      analysis.optimistic.retailValue - analysis.conservative.retailValue,
      analysis.base.retailValue,
    ) * 100
  );
}
