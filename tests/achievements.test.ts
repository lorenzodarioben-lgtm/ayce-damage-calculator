import { describe, expect, it } from 'vitest';
import { buildDamageReport } from '@/lib/calculations';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_THRESHOLDS as T,
  collectAchievementFacts,
  evaluateAchievementIds,
  findAchievement,
  isAchievementId,
  resolveAchievementIds,
} from '@/lib/achievements';
import type { MealItem, PlateSize, QualityTier } from '@/types/meal';

function line(
  foodId: string,
  quantity: number,
  quality: QualityTier = 'standard',
  plateSize: PlateSize = 'regular',
): MealItem {
  return { id: `${foodId}__${quality}__${plateSize}`, foodId, quality, plateSize, quantity };
}

function earned(
  items: readonly MealItem[],
  config: { pricePerDiner?: number; dinerCount?: number } = {},
) {
  const pricePerDiner = config.pricePerDiner ?? 59.9;
  const dinerCount = config.dinerCount ?? 1;
  const report = buildDamageReport(items, { pricePerDiner, dinerCount });
  return evaluateAchievementIds(report, dinerCount);
}

describe('Achievement catalogue', () => {
  it('has a unique id for every entry', () => {
    const ids = ACHIEVEMENTS.map((achievement) => achievement.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry a title, a requirement and flavour copy', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.title.length).toBeGreaterThan(0);
      expect(achievement.requirement.length).toBeGreaterThan(0);
      expect(achievement.copy.length).toBeGreaterThan(0);
    }
  });

  it('recognises only ids it defines', () => {
    expect(isAchievementId('break-even')).toBe(true);
    expect(isAchievementId('invented-later')).toBe(false);
    expect(isAchievementId(42)).toBe(false);
    expect(findAchievement('break-even')?.title).toBe('Break Even');
  });
});

describe('Determinism', () => {
  it('returns the same result for the same meal every time', () => {
    const items = [line('beef-ribeye', 3), line('seafood-prawns', 2)];

    const runs = Array.from({ length: 5 }, () => earned(items).join(','));

    expect(new Set(runs).size).toBe(1);
  });

  it('awards nothing for an empty meal', () => {
    expect(earned([])).toEqual([]);
  });
});

describe('Recovery thresholds', () => {
  it('awards Break Even exactly at the threshold, not below it', () => {
    // 155 g x $52/kg = $8.06 per plate. At $8.06 admission, one plate is 100%.
    expect(earned([line('beef-ribeye', 1)], { pricePerDiner: 8.06 })).toContain('break-even');
    expect(earned([line('beef-ribeye', 1)], { pricePerDiner: 8.07 })).not.toContain('break-even');
  });

  it('awards Double Damage only past twice admission', () => {
    expect(earned([line('beef-ribeye', 2)], { pricePerDiner: 8.06 })).toContain('double-damage');
    expect(earned([line('beef-ribeye', 1)], { pricePerDiner: 8.06 })).not.toContain(
      'double-damage',
    );
  });

  it('awards Precision Instrument only near exactly break-even', () => {
    // Bang on 100%.
    expect(earned([line('beef-ribeye', 1)], { pricePerDiner: 8.06 })).toContain(
      'precision-instrument',
    );
    // Far past it: still a win, but not a precise one.
    expect(earned([line('beef-ribeye', 4)], { pricePerDiner: 8.06 })).not.toContain(
      'precision-instrument',
    );
  });

  it('never awards Precision Instrument for a meal with no plates', () => {
    expect(earned([])).not.toContain('precision-instrument');
  });
});

describe('Variety rules', () => {
  it('awards Four Corners only when all four categories appear', () => {
    const three = [line('beef-ribeye', 1), line('pork-belly', 1), line('chicken-thigh', 1)];
    expect(earned(three)).not.toContain('four-corners');

    expect(earned([...three, line('seafood-prawns', 1)])).toContain('four-corners');
  });

  it('counts selections rather than plates, so repetition earns nothing', () => {
    // One food, many plates: not variety.
    expect(earned([line('beef-ribeye', 40)])).not.toContain('variety-pack');

    const six = [
      line('beef-ribeye', 1),
      line('beef-brisket', 1),
      line('pork-belly', 1),
      line('pork-jowl', 1),
      line('chicken-thigh', 1),
      line('seafood-prawns', 1),
    ];
    expect(earned(six)).toContain('variety-pack');
    expect(six).toHaveLength(T.varietyUniqueFoods);
  });

  it('awards Premium Portfolio for distinct premium selections only', () => {
    const twoPremium = [line('beef-ribeye', 1, 'premium'), line('beef-brisket', 1, 'premium')];
    expect(earned(twoPremium)).not.toContain('premium-portfolio');

    expect(earned([...twoPremium, line('pork-belly', 1, 'premium')])).toContain(
      'premium-portfolio',
    );
  });

  it('awards Seafood Diversification at three seafood selections', () => {
    const two = [line('seafood-prawns', 1), line('seafood-squid', 1)];
    expect(earned(two)).not.toContain('seafood-diversification');

    expect(earned([...two, line('seafood-salmon', 1)])).toContain('seafood-diversification');
  });

  it('awards House Rules for finding value in the cheap seats', () => {
    const three = [
      line('chicken-thigh', 1, 'house'),
      line('pork-shoulder', 1, 'house'),
      line('seafood-squid', 1, 'house'),
    ];

    expect(earned(three)).toContain('house-rules');
    expect(earned(three.slice(0, 2))).not.toContain('house-rules');
  });

  it('awards Full Service only when all three serving sizes were used', () => {
    const twoSizes = [
      line('beef-ribeye', 1, 'standard', 'small'),
      line('pork-belly', 1, 'standard', 'large'),
    ];
    expect(earned(twoSizes)).not.toContain('full-service');

    expect(earned([...twoSizes, line('chicken-thigh', 1, 'standard', 'regular')])).toContain(
      'full-service',
    );
  });
});

describe('Volume rules', () => {
  it('awards Kilogram Club at one kilogram', () => {
    // 7 regular plates = 1085 g; 6 = 930 g.
    expect(earned([line('beef-ribeye', 7)])).toContain('kilogram-club');
    expect(earned([line('beef-ribeye', 6)])).not.toContain('kilogram-club');
  });

  it('awards Protein Audit on recorded protein', () => {
    const facts = collectAchievementFacts(
      buildDamageReport([line('chicken-thigh', 5)], { pricePerDiner: 59.9, dinerCount: 1 }),
      1,
    );

    // 5 x 155 g at 26 g/100 g = 201.5 g.
    expect(facts.proteinGrams).toBeCloseTo(201.5, 1);
    expect(facts.proteinGrams).toBeGreaterThanOrEqual(T.proteinGrams);
    expect(earned([line('chicken-thigh', 5)])).toContain('protein-audit');
  });
});

describe('Full Table', () => {
  it('needs both several diners and several categories', () => {
    const twoCategories = [line('beef-ribeye', 1), line('pork-belly', 1)];

    expect(earned(twoCategories, { dinerCount: 1 })).not.toContain('full-table');
    expect(earned([line('beef-ribeye', 1)], { dinerCount: 4 })).not.toContain('full-table');
    expect(earned(twoCategories, { dinerCount: 2 })).toContain('full-table');
  });
});

describe('collectAchievementFacts', () => {
  it('ignores lines that record no plates', () => {
    const report = buildDamageReport([line('beef-ribeye', 1)], {
      pricePerDiner: 59.9,
      dinerCount: 1,
    });
    const facts = collectAchievementFacts(
      { ...report, lines: report.lines.map((entry) => ({ ...entry, plates: 0 })) },
      1,
    );

    expect(facts.uniqueFoodIds.size).toBe(0);
    expect(facts.categories.size).toBe(0);
  });

  it('never lets non-finite totals through', () => {
    const report = buildDamageReport([line('beef-ribeye', 1)], {
      pricePerDiner: 59.9,
      dinerCount: 1,
    });
    const facts = collectAchievementFacts(
      { ...report, retailRecoveryPercent: Number.NaN, totalWeightKg: Number.POSITIVE_INFINITY },
      1,
    );

    expect(facts.retailRecoveryPercent).toBe(0);
    expect(facts.totalWeightKg).toBe(0);
  });
});

describe('resolveAchievementIds', () => {
  it('returns entries in catalogue order regardless of stored order', () => {
    const resolved = resolveAchievementIds(['kilogram-club', 'break-even', 'four-corners']);

    expect(resolved.map((achievement) => achievement.id)).toEqual([
      'break-even',
      'four-corners',
      'kilogram-club',
    ]);
  });

  it('drops ids the engine no longer defines', () => {
    expect(resolveAchievementIds(['break-even', 'retired-award'])).toHaveLength(1);
  });

  it('never returns the same achievement twice', () => {
    expect(resolveAchievementIds(['break-even', 'break-even'])).toHaveLength(1);
  });
});
