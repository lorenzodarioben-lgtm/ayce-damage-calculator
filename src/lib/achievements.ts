import { FOOD_CATEGORIES, PLATE_SIZES } from '@/lib/constants';
import type { DamageReport, FoodCategory, PlateSize, QualityTier } from '@/types/meal';

export type AchievementId =
  | 'break-even'
  | 'double-damage'
  | 'four-corners'
  | 'variety-pack'
  | 'premium-portfolio'
  | 'seafood-diversification'
  | 'kilogram-club'
  | 'full-table'
  | 'house-rules'
  | 'full-service'
  | 'protein-audit'
  | 'precision-instrument';

/**
 * Every threshold the engine tests against, in one place.
 *
 * Named separately from the rules so a value can be re-tuned without reading
 * any logic, and so the tests can assert against the same constants rather than
 * restating magic numbers.
 */
export const ACHIEVEMENT_THRESHOLDS = {
  breakEvenPercent: 100,
  doubleDamagePercent: 200,
  varietyUniqueFoods: 6,
  premiumSelections: 3,
  seafoodSelections: 3,
  kilogramClubKg: 1,
  fullTableDiners: 2,
  fullTableCategories: 2,
  houseSelections: 3,
  proteinGrams: 150,
  /** How close to exactly break-even "Precision Instrument" demands. */
  precisionPoints: 2,
} as const;

export interface Achievement {
  readonly id: AchievementId;
  readonly title: string;
  /** States the requirement plainly, so a locked entry is still informative. */
  readonly requirement: string;
  /** Dry flavour, shown once unlocked. */
  readonly copy: string;
}

/** Derived facts about a session, computed once and shared by every rule. */
export interface AchievementFacts {
  readonly retailRecoveryPercent: number;
  readonly totalWeightKg: number;
  readonly totalPlates: number;
  readonly proteinGrams: number;
  readonly dinerCount: number;
  readonly uniqueFoodIds: ReadonlySet<string>;
  readonly categories: ReadonlySet<FoodCategory>;
  readonly selectionsByQuality: ReadonlyMap<QualityTier, number>;
  readonly selectionsByCategory: ReadonlyMap<FoodCategory, number>;
  readonly plateSizes: ReadonlySet<PlateSize>;
}

interface AchievementRule extends Achievement {
  /** Pure and total: same facts in, same answer out, no randomness anywhere. */
  readonly isEarned: (facts: AchievementFacts) => boolean;
}

const T = ACHIEVEMENT_THRESHOLDS;

/**
 * Ordered as they should be presented. Rules reward breadth and precision
 * rather than sheer volume, so the engine never encourages a diner to simply
 * eat more.
 */
const RULES: readonly AchievementRule[] = [
  {
    id: 'break-even',
    title: 'Break Even',
    requirement: `Recover at least ${T.breakEvenPercent}% of admission in estimated retail value.`,
    copy: 'The arrangement has been honoured.',
    isEarned: (facts) => facts.retailRecoveryPercent >= T.breakEvenPercent,
  },
  {
    id: 'double-damage',
    title: 'Double Damage',
    requirement: `Recover at least ${T.doubleDamagePercent}% of admission.`,
    copy: 'Twice the admission, recovered. Procurement has requested clarification.',
    isEarned: (facts) => facts.retailRecoveryPercent >= T.doubleDamagePercent,
  },
  {
    id: 'four-corners',
    title: 'Four Corners',
    requirement: 'Record at least one item from Beef, Pork, Chicken and Seafood.',
    copy: 'A complete survey of the menu. Nothing was overlooked.',
    isEarned: (facts) => FOOD_CATEGORIES.every((category) => facts.categories.has(category)),
  },
  {
    id: 'variety-pack',
    title: 'Variety Pack',
    requirement: `Record ${T.varietyUniqueFoods} or more different foods.`,
    copy: 'Breadth of coverage noted by the kitchen.',
    isEarned: (facts) => facts.uniqueFoodIds.size >= T.varietyUniqueFoods,
  },
  {
    id: 'premium-portfolio',
    title: 'Premium Portfolio',
    requirement: `Record at least ${T.premiumSelections} different Premium selections.`,
    copy: 'A diversified position in high-grade assets.',
    isEarned: (facts) => (facts.selectionsByQuality.get('premium') ?? 0) >= T.premiumSelections,
  },
  {
    id: 'seafood-diversification',
    title: 'Seafood Diversification',
    requirement: `Record at least ${T.seafoodSelections} seafood selections.`,
    copy: 'Exposure to the marine sector, prudently balanced.',
    isEarned: (facts) => (facts.selectionsByCategory.get('seafood') ?? 0) >= T.seafoodSelections,
  },
  {
    id: 'kilogram-club',
    title: 'Kilogram Club',
    requirement: `Record at least ${T.kilogramClubKg} kg of food.`,
    copy: 'Membership is not advertised.',
    isEarned: (facts) => facts.totalWeightKg >= T.kilogramClubKg,
  },
  {
    id: 'full-table',
    title: 'Full Table',
    requirement: `Complete a session with ${T.fullTableDiners} or more diners across ${T.fullTableCategories} or more categories.`,
    copy: 'Coordinated action. The most efficient kind.',
    isEarned: (facts) =>
      facts.dinerCount >= T.fullTableDiners && facts.categories.size >= T.fullTableCategories,
  },
  {
    id: 'house-rules',
    title: 'House Rules',
    requirement: `Record at least ${T.houseSelections} House-tier selections.`,
    copy: 'Value found where nobody was looking for it.',
    isEarned: (facts) => (facts.selectionsByQuality.get('house') ?? 0) >= T.houseSelections,
  },
  {
    id: 'full-service',
    title: 'Full Service',
    requirement: 'Record a plate in every serving size.',
    copy: 'Small, regular and large. A thorough methodology.',
    isEarned: (facts) => PLATE_SIZES.every((size) => facts.plateSizes.has(size.id)),
  },
  {
    id: 'protein-audit',
    title: 'Protein Audit',
    requirement: `Record at least ${T.proteinGrams} g of protein.`,
    copy: 'The figures have been reviewed and stand.',
    isEarned: (facts) => facts.proteinGrams >= T.proteinGrams,
  },
  {
    id: 'precision-instrument',
    title: 'Precision Instrument',
    requirement: `Finish within ${T.precisionPoints} percentage points of exactly ${T.breakEvenPercent}%.`,
    copy: 'Break-even, to the plate. This was not an accident.',
    isEarned: (facts) =>
      facts.totalPlates > 0 &&
      Math.abs(facts.retailRecoveryPercent - T.breakEvenPercent) <= T.precisionPoints,
  },
];

export const ACHIEVEMENTS: readonly Achievement[] = RULES.map(
  ({ id, title, requirement, copy }) => ({ id, title, requirement, copy }),
);

const BY_ID: ReadonlyMap<AchievementId, Achievement> = new Map(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
);

export function isAchievementId(value: unknown): value is AchievementId {
  return typeof value === 'string' && BY_ID.has(value as AchievementId);
}

export function findAchievement(id: AchievementId): Achievement | undefined {
  return BY_ID.get(id);
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Collapses a report into the facts the rules ask about.
 *
 * A "selection" is one line on the tab, not one plate: recording four plates of
 * the same premium cut is one selection, so the variety rules cannot be
 * satisfied by repetition.
 */
export function collectAchievementFacts(
  report: DamageReport,
  dinerCount: number,
): AchievementFacts {
  const uniqueFoodIds = new Set<string>();
  const categories = new Set<FoodCategory>();
  const plateSizes = new Set<PlateSize>();
  const selectionsByQuality = new Map<QualityTier, number>();
  const selectionsByCategory = new Map<FoodCategory, number>();

  for (const line of report.lines) {
    if (line.plates <= 0) {
      continue;
    }
    uniqueFoodIds.add(line.food.id);
    categories.add(line.food.category);
    plateSizes.add(line.item.plateSize);
    selectionsByQuality.set(
      line.item.quality,
      (selectionsByQuality.get(line.item.quality) ?? 0) + 1,
    );
    selectionsByCategory.set(
      line.food.category,
      (selectionsByCategory.get(line.food.category) ?? 0) + 1,
    );
  }

  return {
    retailRecoveryPercent: finite(report.retailRecoveryPercent),
    totalWeightKg: finite(report.totalWeightKg),
    totalPlates: finite(report.totalPlates),
    proteinGrams: finite(report.nutrition.protein),
    dinerCount: finite(dinerCount),
    uniqueFoodIds,
    categories,
    selectionsByQuality,
    selectionsByCategory,
    plateSizes,
  };
}

/** Evaluates every rule. Deterministic: nothing here consults time or chance. */
export function evaluateAchievements(
  report: DamageReport,
  dinerCount: number,
): readonly Achievement[] {
  const facts = collectAchievementFacts(report, dinerCount);
  return RULES.filter((rule) => rule.isEarned(facts)).map(({ id, title, requirement, copy }) => ({
    id,
    title,
    requirement,
    copy,
  }));
}

export function evaluateAchievementIds(
  report: DamageReport,
  dinerCount: number,
): readonly AchievementId[] {
  return evaluateAchievements(report, dinerCount).map((achievement) => achievement.id);
}

/** Resolves stored ids back to achievements, dropping any no longer defined. */
export function resolveAchievementIds(ids: readonly string[]): readonly Achievement[] {
  const seen = new Set<AchievementId>();
  const resolved: Achievement[] = [];

  // Iterating the canonical list keeps presentation order stable regardless of
  // the order ids were stored in.
  for (const achievement of ACHIEVEMENTS) {
    if (ids.includes(achievement.id) && !seen.has(achievement.id)) {
      seen.add(achievement.id);
      resolved.push(achievement);
    }
  }
  return resolved;
}
