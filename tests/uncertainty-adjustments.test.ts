import { describe, expect, it } from 'vitest';
import { findFood } from '@/data/foods';
import { buildDamageReport, calculateBillTotals } from '@/lib/calculations';
import { buildUncertaintyAnalysis } from '@/lib/uncertainty';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import type { BillAdjustment, Diner, FoodItem, MealItem } from '@/types/meal';

/**
 * The range behind the headline, measured against the same number.
 *
 * The defect this locks down: the analysis used to receive the entry price and
 * nothing else, so a meal with a voucher had its scenarios measured against the
 * undiscounted bill while the report beside them was measured against what was
 * actually paid. Every recovery figure, verdict and headline sentence in the
 * panel could therefore contradict the report directly above it.
 */

const ribeye = findFood('beef-ribeye')!;
/** The bundled catalogue is all plated cuts, so a serving has to be supplied. */
const lager: FoodItem = {
  id: 'custom-food-lager',
  name: 'House lager',
  shortName: 'Lager',
  category: 'drinks',
  description: 'A serving priced as one thing.',
  visualVariant: 'drink-glass',
  isCustom: true,
  valuation: 'by-serving',
  retailPricePerServing: 9,
  restaurantCostPerServing: 2.5,
  gramsPerServing: 330,
  caloriesPerServing: 140,
};

function item(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 'line-1',
    foodId: ribeye.id,
    quality: 'standard',
    plateSize: 'regular',
    quantity: 4,
    ...overrides,
  };
}

function adjustment(
  kind: BillAdjustment['kind'],
  amount: number,
  overrides: Partial<BillAdjustment> = {},
): BillAdjustment {
  return {
    id: `adj-${kind}-${String(amount).replace(/[^0-9]/g, '')}`,
    label: kind === 'charge' ? 'Service charge' : 'Voucher',
    amount,
    kind,
    ...overrides,
  };
}

const items = [item()];

/** The report and the analysis must always agree about the denominator. */
function expectsAgreement(config: Parameters<typeof buildUncertaintyAnalysis>[1]) {
  const report = buildDamageReport(items, config);
  const analysis = buildUncertaintyAnalysis(items, config);

  expect(analysis.admission).toBe(report.totalAdmission);
  expect(analysis.base.recoveryPercent).toBeCloseTo(report.retailRecoveryPercent, 10);
  expect(analysis.base.beatsAdmission).toBe(report.hasBeatenBuffet);
  return { report, analysis };
}

describe('A meal with nothing on the bill', () => {
  it('is analysed exactly as it always was', () => {
    expectsAgreement({ pricePerDiner: 50, dinerCount: 1 });
  });
});

describe('A meal with a discount', () => {
  const config = { pricePerDiner: 50, dinerCount: 1, adjustments: [adjustment('discount', 30)] };

  it('measures every scenario against what was paid, not the entry price', () => {
    const { analysis } = expectsAgreement(config);
    // $50 less a $30 voucher is $20, and that is the denominator throughout.
    expect(analysis.admission).toBe(20);
  });

  it('does not contradict the report about whether admission was beaten', () => {
    const report = buildDamageReport(items, config);
    const analysis = buildUncertaintyAnalysis(items, config);

    expect(analysis.base.beatsAdmission).toBe(report.hasBeatenBuffet);
    expect(analysis.base.verdictId).toBeTruthy();
  });

  it('reads differently from the same meal at full price, as it must', () => {
    const discounted = buildUncertaintyAnalysis(items, config);
    const full = buildUncertaintyAnalysis(items, { pricePerDiner: 50, dinerCount: 1 });

    expect(discounted.base.recoveryPercent).toBeGreaterThan(full.base.recoveryPercent);
  });
});

describe('A meal with a charge', () => {
  const config = { pricePerDiner: 50, dinerCount: 1, adjustments: [adjustment('charge', 25)] };

  it('measures every scenario against the larger total', () => {
    const { analysis } = expectsAgreement(config);
    expect(analysis.admission).toBe(75);
  });

  it('carries the corrected denominator into the sensitivity table', () => {
    const analysis = buildUncertaintyAnalysis(items, config);
    const full = buildUncertaintyAnalysis(items, { pricePerDiner: 50, dinerCount: 1 });

    const surcharged = analysis.sensitivity.find((entry) => entry.assumptionId === 'retail-price')!;
    const plain = full.sensitivity.find((entry) => entry.assumptionId === 'retail-price')!;

    expect(surcharged.lowRecoveryPercent).not.toBeCloseTo(plain.lowRecoveryPercent, 6);
    expect(surcharged.swingPoints).toBeGreaterThanOrEqual(0);
  });

  it('resolves a percentage charge the same way the bill does', () => {
    const percent = {
      pricePerDiner: 50,
      dinerCount: 2,
      adjustments: [adjustment('charge', 10, { basis: 'percent' as const })],
    };
    const { analysis } = expectsAgreement(percent);
    expect(analysis.admission).toBe(calculateBillTotals(percent).totalPaid);
  });
});

describe('A roster with its own prices, plus a bill', () => {
  const diners: readonly Diner[] = [
    { id: 'ana', displayName: 'Ana', admissionPrice: 30 },
    { id: 'ben', displayName: 'Ben' },
  ];

  it('still agrees with the report', () => {
    expectsAgreement({
      pricePerDiner: 50,
      dinerCount: 2,
      diners,
      adjustments: [adjustment('discount', 15)],
    });
  });
});

describe('A bill a voucher settled to nothing', () => {
  const config = {
    pricePerDiner: 20,
    dinerCount: 1,
    adjustments: [adjustment('discount', 500)],
  };

  it('keeps the project’s zero-denominator convention rather than redefining it', () => {
    const { report, analysis } = expectsAgreement(config);

    expect(report.totalAdmission).toBe(0);
    expect(analysis.admission).toBe(0);
    expect(analysis.base.recoveryPercent).toBe(0);
  });

  it('emits no NaN or Infinity anywhere in the analysis', () => {
    const analysis = buildUncertaintyAnalysis(items, config);

    [analysis.conservative, analysis.base, analysis.optimistic].forEach((scenario) => {
      expect(Number.isFinite(scenario.recoveryPercent)).toBe(true);
      expect(Number.isFinite(scenario.retailValue)).toBe(true);
      expect(Number.isFinite(scenario.weightG)).toBe(true);
    });
    analysis.sensitivity.forEach((entry) => {
      expect(Number.isFinite(entry.swingPoints)).toBe(true);
      expect(entry.swingPoints).toBeGreaterThanOrEqual(0);
    });
  });

  it('still produces a coherent headline and verdict flags', () => {
    const analysis = buildUncertaintyAnalysis(items, config);

    expect(typeof analysis.headline).toBe('string');
    expect(analysis.headline.length).toBeGreaterThan(0);
    expect(typeof analysis.robust).toBe('boolean');
    expect(typeof analysis.verdictHolds).toBe('boolean');
  });
});

describe('Determinism', () => {
  it('produces the same analysis for the same meal, every time', () => {
    const config = {
      pricePerDiner: 49.9,
      dinerCount: 3,
      adjustments: [adjustment('charge', 7.77), adjustment('discount', 3.33)],
    };
    expect(buildUncertaintyAnalysis(items, config)).toEqual(
      buildUncertaintyAnalysis(items, config),
    );
  });

  it('orders the sensitivity table by how much each assumption moves the result', () => {
    const analysis = buildUncertaintyAnalysis(items, {
      pricePerDiner: 50,
      dinerCount: 1,
      adjustments: [adjustment('discount', 20)],
    });
    const swings = analysis.sensitivity.map((entry) => entry.swingPoints);
    expect([...swings].sort((a, b) => b - a)).toEqual(swings);
  });
});

describe('The weight band', () => {
  it('moves the weight of plated cuts, which is what the assumption is about', () => {
    const analysis = buildUncertaintyAnalysis(items, { pricePerDiner: 50, dinerCount: 1 });

    expect(analysis.optimistic.weightG).toBeGreaterThan(analysis.base.weightG);
    expect(analysis.conservative.weightG).toBeLessThan(analysis.base.weightG);
  });

  it('leaves a serving weighing what the restaurant served it at', () => {
    // A serving is one thing at one price, so its value is deliberately not
    // moved by the serving-weight assumption — and neither is its weight.
    const servingOnly = [item({ foodId: lager.id, quantity: 2 })];
    const analysis = buildUncertaintyAnalysis(
      servingOnly,
      { pricePerDiner: 50, dinerCount: 1 },
      DEFAULT_PRICING_PROFILE,
      [lager],
    );

    expect(analysis.base.weightG).toBe(660);
    expect(analysis.optimistic.weightG).toBe(660);
    expect(analysis.conservative.weightG).toBe(660);
  });

  it('moves only the plated half of a mixed meal', () => {
    const mixed = [item({ quantity: 4 }), item({ id: 'line-2', foodId: lager.id, quantity: 2 })];
    const analysis = buildUncertaintyAnalysis(
      mixed,
      { pricePerDiner: 50, dinerCount: 1 },
      DEFAULT_PRICING_PROFILE,
      [ribeye, lager],
    );

    // The lager's 660 g is constant; only the ribeye's weight carries the band.
    expect(analysis.optimistic.weightG - 660).toBeCloseTo((analysis.base.weightG - 660) * 1.2, 8);
  });
});
