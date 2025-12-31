import { describe, expect, it } from 'vitest';
import { buildDamageReport } from '@/lib/calculations';
import { buildResultCardModel } from '@/lib/resultCard';
import { buildShareText } from '@/lib/share';
import { getVerdict } from '@/lib/verdicts';
import type { MealItem } from '@/types/meal';

const config = { pricePerDiner: 59.9, dinerCount: 1 };

function reportFor(items: readonly MealItem[]) {
  const report = buildDamageReport(items, config);
  return { report, verdict: getVerdict(report.totalRetailValue, report.totalAdmission) };
}

const bigMeal: MealItem[] = [
  { id: 'a', foodId: 'beef-ribeye', quality: 'premium', plateSize: 'large', quantity: 8 },
];
const smallMeal: MealItem[] = [
  { id: 'a', foodId: 'chicken-thigh', quality: 'house', plateSize: 'small', quantity: 2 },
];

describe('buildResultCardModel', () => {
  it('labels a surplus as value extracted and tones it positively', () => {
    const { report, verdict } = reportFor(bigMeal);
    const model = buildResultCardModel(report, verdict, 'Seoul Garden');

    expect(model.outcome[0].label).toBe('Value extracted');
    expect(model.outcome[0].value.startsWith('+')).toBe(true);
    expect(model.outcome[0].tone).toBe('green');
    expect(model.restaurantName).toBe('Seoul Garden');
  });

  it('labels a shortfall as a value gap and tones it negatively', () => {
    const { report, verdict } = reportFor(smallMeal);
    const model = buildResultCardModel(report, verdict, '');

    expect(model.outcome[0].label).toBe('Value gap');
    expect(model.outcome[0].value.startsWith('-')).toBe(true);
    expect(model.outcome[0].tone).toBe('red');
  });

  it('never emits NaN or Infinity for an empty meal', () => {
    const { report, verdict } = reportFor([]);
    const model = buildResultCardModel(report, verdict, '');

    const values = [...model.volume, ...model.money, ...model.outcome, ...model.nutrition].map(
      (stat) => stat.value,
    );
    for (const value of values) {
      expect(value).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
});

describe('buildShareText', () => {
  it('includes the headline figures and the verdict', () => {
    const { report, verdict } = reportFor(bigMeal);
    const text = buildShareText(report, verdict, 'Seoul Garden');

    expect(text).toContain('AYCE Damage Report — Seoul Garden');
    expect(text).toContain('8 plates');
    expect(text).toContain('$59.90 admission');
    expect(text).toContain('value extracted');
    expect(text).toContain(`Verdict: ${verdict.title.toUpperCase()}`);
    expect(text).toContain('Did you beat the buffet?');
  });

  it('omits the separator when no restaurant was named', () => {
    const { report, verdict } = reportFor(smallMeal);
    const text = buildShareText(report, verdict, '');

    expect(text.startsWith('AYCE Damage Report\n')).toBe(true);
    expect(text).toContain('value gap');
  });

  it('contains no invented deployment URL', () => {
    const { report, verdict } = reportFor(bigMeal);
    expect(buildShareText(report, verdict, 'Seoul Garden')).not.toMatch(/https?:\/\//);
  });
});
