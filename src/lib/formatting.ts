const AUD = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INTEGER = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });

const DECIMAL = (digits: number) =>
  new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const KG = DECIMAL(2);
const LB = DECIMAL(2);

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function formatMoney(value: number): string {
  return AUD.format(finite(value));
}

/** Renders an explicit sign so gains and gaps are never ambiguous. */
export function formatSignedMoney(value: number): string {
  const safe = finite(value);
  // -0 would otherwise render as "-$0.00".
  const normalised = Object.is(safe, -0) ? 0 : safe;
  const sign = normalised < 0 ? '-' : '+';
  return `${sign}${AUD.format(Math.abs(normalised))}`;
}

export function formatPercent(value: number): string {
  return `${INTEGER.format(Math.round(finite(value)))}%`;
}

export function formatGrams(value: number): string {
  return `${INTEGER.format(Math.round(finite(value)))} g`;
}

export function formatKg(value: number): string {
  return `${KG.format(finite(value))} kg`;
}

export function formatLb(value: number): string {
  return `${LB.format(finite(value))} lb`;
}

export function formatCalories(value: number): string {
  return `~${INTEGER.format(Math.round(finite(value)))} kcal`;
}

export function formatCount(value: number): string {
  return INTEGER.format(Math.round(finite(value)));
}

export function formatPlates(value: number): string {
  const count = Math.max(0, Math.round(finite(value)));
  return `${INTEGER.format(count)} ${count === 1 ? 'plate' : 'plates'}`;
}

/** Displays "kg" past 1000 g so the summary never reads "1740 g". */
export function formatWeight(grams: number): string {
  const safe = finite(grams);
  return safe >= 1000 ? formatKg(safe / 1000) : formatGrams(safe);
}

const DATE_TIME = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Renders a stored ISO timestamp, or an honest placeholder if it is unusable. */
export function formatRecordedAt(iso: string): string {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 'Date unknown' : DATE_TIME.format(new Date(parsed));
}

export function formatPricePerKg(value: number): string {
  const safe = finite(value);
  const digits = Number.isInteger(safe) ? 0 : 2;
  return `$${DECIMAL(digits).format(safe)}/kg`;
}
