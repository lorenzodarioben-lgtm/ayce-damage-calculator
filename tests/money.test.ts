import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MONEY_CONTEXT,
  SUPPORTED_CURRENCIES,
  defaultLocaleForCurrency,
  isCurrencyCode,
  resolveMoneyContext,
} from '@/lib/money';

/*
 * A money context arrives from storage, from a share link and from an imported
 * menu, so it is never trusted. The currency is the authoritative half — a
 * wrong one reprices the whole meal — while the locale only decides how the
 * digits are grouped, and a malformed one has a safe answer rather than an
 * error.
 */

describe('isCurrencyCode', () => {
  it.each(SUPPORTED_CURRENCIES)('accepts %s', (currency) => {
    expect(isCurrencyCode(currency)).toBe(true);
  });

  it('rejects a plausible but unsupported currency', () => {
    expect(isCurrencyCode('CAD')).toBe(false);
    expect(isCurrencyCode('DOGE')).toBe(false);
    expect(isCurrencyCode('')).toBe(false);
  });

  it('rejects a code that differs only by case', () => {
    expect(isCurrencyCode('aud')).toBe(false);
  });

  it('rejects anything that is not a string', () => {
    expect(isCurrencyCode(undefined)).toBe(false);
    expect(isCurrencyCode(null)).toBe(false);
    expect(isCurrencyCode(42)).toBe(false);
    expect(isCurrencyCode(['AUD'])).toBe(false);
    expect(isCurrencyCode({ currency: 'AUD' })).toBe(false);
  });
});

describe('resolveMoneyContext', () => {
  it('falls back to the default for anything that is not an object', () => {
    expect(resolveMoneyContext(undefined)).toEqual(DEFAULT_MONEY_CONTEXT);
    expect(resolveMoneyContext(null)).toEqual(DEFAULT_MONEY_CONTEXT);
    expect(resolveMoneyContext('AUD')).toEqual(DEFAULT_MONEY_CONTEXT);
    expect(resolveMoneyContext(7)).toEqual(DEFAULT_MONEY_CONTEXT);
  });

  it('falls back to the default for an array, which carries no fields to read', () => {
    expect(resolveMoneyContext([])).toEqual(DEFAULT_MONEY_CONTEXT);
    expect(resolveMoneyContext([{ currency: 'USD', locale: 'en-US' }])).toEqual(
      DEFAULT_MONEY_CONTEXT,
    );
  });

  it('falls back to the default when the currency is unsupported or missing', () => {
    expect(resolveMoneyContext({ currency: 'CAD', locale: 'en-CA' })).toEqual(
      DEFAULT_MONEY_CONTEXT,
    );
    expect(resolveMoneyContext({ locale: 'en-AU' })).toEqual(DEFAULT_MONEY_CONTEXT);
  });

  it('keeps a well-formed locale alongside its currency', () => {
    expect(resolveMoneyContext({ currency: 'GBP', locale: 'en-GB' })).toEqual({
      currency: 'GBP',
      locale: 'en-GB',
    });
    expect(resolveMoneyContext({ currency: 'EUR', locale: 'fr-FR' })).toEqual({
      currency: 'EUR',
      locale: 'fr-FR',
    });
  });

  it("falls back to the currency's own locale when the locale is malformed", () => {
    expect(resolveMoneyContext({ currency: 'JPY', locale: 'not a locale' })).toEqual({
      currency: 'JPY',
      locale: defaultLocaleForCurrency('JPY'),
    });
    expect(resolveMoneyContext({ currency: 'KRW', locale: 42 })).toEqual({
      currency: 'KRW',
      locale: defaultLocaleForCurrency('KRW'),
    });
  });

  it("falls back to the currency's own locale when no locale is supplied", () => {
    expect(resolveMoneyContext({ currency: 'NZD' })).toEqual({
      currency: 'NZD',
      locale: defaultLocaleForCurrency('NZD'),
    });
  });

  it('resolves every supported currency to a usable context', () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      expect(resolveMoneyContext({ currency })).toEqual({
        currency,
        locale: defaultLocaleForCurrency(currency),
      });
    }
  });
});

describe('defaultLocaleForCurrency', () => {
  it('pairs a currency with where it is ordinarily spent', () => {
    expect(defaultLocaleForCurrency('AUD')).toBe('en-AU');
    expect(defaultLocaleForCurrency('USD')).toBe('en-US');
    expect(defaultLocaleForCurrency('EUR')).toBe('de-DE');
    expect(defaultLocaleForCurrency('JPY')).toBe('ja-JP');
  });

  it('names a locale for every currency the app offers', () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      expect(defaultLocaleForCurrency(currency)).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });

  it('agrees with the default context the app starts from', () => {
    expect(defaultLocaleForCurrency(DEFAULT_MONEY_CONTEXT.currency)).toBe(
      DEFAULT_MONEY_CONTEXT.locale,
    );
  });
});
