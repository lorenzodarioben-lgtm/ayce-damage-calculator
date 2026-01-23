import { describe, expect, it } from 'vitest';
import {
  formatCalories,
  formatGrams,
  formatKg,
  formatLb,
  formatMoney,
  formatPercent,
  formatPlates,
  formatPricePerKg,
  formatSignedMoney,
  formatWeight,
} from '@/lib/formatting';
import { DEFAULT_MONEY_CONTEXT, resolveMoneyContext } from '@/lib/money';

describe('currency formatting', () => {
  it('renders AUD with two decimals', () => {
    expect(formatMoney(59.9)).toBe('$59.90');
    expect(formatMoney(104.2)).toBe('$104.20');
    expect(formatMoney(1234.5)).toBe('$1,234.50');
  });

  it('keeps AUD/en-AU as the default money context', () => {
    expect(DEFAULT_MONEY_CONTEXT).toEqual({ currency: 'AUD', locale: 'en-AU' });
    expect(formatMoney(59.9, DEFAULT_MONEY_CONTEXT)).toBe('$59.90');
  });

  it('formats alternate supported currencies through the supplied context', () => {
    const gbp = { currency: 'GBP', locale: 'en-GB' } as const;
    expect(formatMoney(59.9, gbp)).toBe('£59.90');
    expect(formatSignedMoney(-17.2, gbp)).toBe('-£17.20');
  });

  it('falls back safely from malformed money context', () => {
    expect(resolveMoneyContext({ currency: 'AUD', locale: 42 })).toEqual(DEFAULT_MONEY_CONTEXT);
    expect(resolveMoneyContext({ currency: 'DOGE', locale: 'en-AU' })).toEqual(
      DEFAULT_MONEY_CONTEXT,
    );
  });

  it('renders explicit signs for differences', () => {
    expect(formatSignedMoney(36.5)).toBe('+$36.50');
    expect(formatSignedMoney(-17.2)).toBe('-$17.20');
    expect(formatSignedMoney(0)).toBe('+$0.00');
  });

  it('never renders a negative zero', () => {
    expect(formatSignedMoney(-0)).toBe('+$0.00');
  });

  it('degrades to zero rather than NaN', () => {
    expect(formatMoney(Number.NaN)).toBe('$0.00');
    expect(formatSignedMoney(Number.POSITIVE_INFINITY)).toBe('+$0.00');
  });
});

describe('measurement formatting', () => {
  it('rounds macros to whole grams', () => {
    expect(formatGrams(286.3499999997)).toBe('286 g');
    expect(formatGrams(0.3)).toBe('0 g');
  });

  it('renders weights to two decimals', () => {
    expect(formatKg(1.71)).toBe('1.71 kg');
    expect(formatKg(1.7)).toBe('1.70 kg');
    expect(formatLb(3.7699)).toBe('3.77 lb');
  });

  it('switches to kilograms past a kilogram', () => {
    expect(formatWeight(465)).toBe('465 g');
    expect(formatWeight(1740)).toBe('1.74 kg');
  });

  it('formats calories with a tilde and thousands separator', () => {
    expect(formatCalories(3420.4)).toBe('~3,420 kcal');
  });

  it('formats percentages as whole numbers', () => {
    expect(formatPercent(137.4)).toBe('137%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(Number.NaN)).toBe('0%');
  });

  it('pluralises plates', () => {
    expect(formatPlates(1)).toBe('1 plate');
    expect(formatPlates(11)).toBe('11 plates');
    expect(formatPlates(0)).toBe('0 plates');
  });

  it('drops trailing decimals on whole per-kilogram prices', () => {
    expect(formatPricePerKg(52)).toBe('$52/kg');
    expect(formatPricePerKg(9.5)).toBe('$9.50/kg');
  });
});
