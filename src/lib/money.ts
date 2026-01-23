/** The deliberately small set of display currencies this local calculator supports. */
export const SUPPORTED_CURRENCIES = ['AUD', 'USD', 'NZD', 'GBP', 'EUR', 'KRW', 'JPY'] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface MoneyContext {
  readonly currency: CurrencyCode;
  readonly locale: string;
}

/** The original calculator context, preserved as the zero-configuration default. */
export const DEFAULT_MONEY_CONTEXT: MoneyContext = { currency: 'AUD', locale: 'en-AU' };

const DEFAULT_LOCALES: Readonly<Record<CurrencyCode, string>> = {
  AUD: 'en-AU',
  USD: 'en-US',
  NZD: 'en-NZ',
  GBP: 'en-GB',
  EUR: 'de-DE',
  KRW: 'ko-KR',
  JPY: 'ja-JP',
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && SUPPORTED_CURRENCIES.includes(value as CurrencyCode);
}

/**
 * Validates untrusted display context without turning locale input into an
 * arbitrary formatter construction surface. Currency is the authoritative
 * choice; an omitted or malformed locale falls back to its sensible default.
 */
export function resolveMoneyContext(value: unknown): MoneyContext {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_MONEY_CONTEXT;
  }

  const candidate = value as { currency?: unknown; locale?: unknown };
  if (!isCurrencyCode(candidate.currency)) {
    return DEFAULT_MONEY_CONTEXT;
  }

  const locale =
    typeof candidate.locale === 'string' &&
    /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(candidate.locale)
      ? candidate.locale
      : DEFAULT_LOCALES[candidate.currency];

  return { currency: candidate.currency, locale };
}

export function defaultLocaleForCurrency(currency: CurrencyCode): string {
  return DEFAULT_LOCALES[currency];
}
