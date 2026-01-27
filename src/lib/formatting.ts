import type { DeltaUnit } from '@/lib/comparison';
import { DEFAULT_MONEY_CONTEXT, type MoneyContext, resolveMoneyContext } from '@/lib/money';

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

function currencyFormatter(context: MoneyContext, digits = 2): Intl.NumberFormat {
  return new Intl.NumberFormat(context.locale, {
    style: 'currency',
    currency: context.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatMoney(value: number, context: MoneyContext = DEFAULT_MONEY_CONTEXT): string {
  return currencyFormatter(resolveMoneyContext(context)).format(finite(value));
}

/** Renders an explicit sign so gains and gaps are never ambiguous. */
export function formatSignedMoney(
  value: number,
  context: MoneyContext = DEFAULT_MONEY_CONTEXT,
): string {
  const safe = finite(value);
  // -0 would otherwise render as "-$0.00".
  const normalised = Object.is(safe, -0) ? 0 : safe;
  const sign = normalised < 0 ? '-' : '+';
  return `${sign}${formatMoney(Math.abs(normalised), context)}`;
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

export function formatPricePerKg(
  value: number,
  context: MoneyContext = DEFAULT_MONEY_CONTEXT,
): string {
  const safe = finite(value);
  const digits = Number.isInteger(safe) ? 0 : 2;
  return `${currencyFormatter(resolveMoneyContext(context), digits).format(safe)}/kg`;
}

function signOf(value: number): string {
  // -0 would otherwise render with a minus.
  return (Object.is(value, -0) ? 0 : value) < 0 ? '-' : '+';
}

/**
 * Renders a difference with an explicit sign and its own unit.
 *
 * Percentage-point differences are labelled as such rather than with a "%",
 * because "+38%" and "+38 percentage points" are different claims and only one
 * of them is true of a recovery figure moving from 134% to 172%.
 */
export function formatDelta(
  value: number,
  unit: DeltaUnit,
  moneyContext: MoneyContext = DEFAULT_MONEY_CONTEXT,
): string {
  const safe = finite(value);
  const magnitude = Math.abs(safe);
  const sign = signOf(safe);

  switch (unit) {
    case 'currency':
      return `${sign}${formatMoney(magnitude, moneyContext)}`;
    case 'kilograms':
      return `${sign}${KG.format(magnitude)} kg`;
    case 'grams':
      return `${sign}${INTEGER.format(Math.round(magnitude))} g`;
    case 'percentagePoints': {
      const points = Math.round(magnitude);
      return `${sign}${INTEGER.format(points)} percentage ${points === 1 ? 'point' : 'points'}`;
    }
    case 'count':
      return `${sign}${INTEGER.format(Math.round(magnitude))}`;
  }
}

/** Renders a metric's own value in the unit it is measured in. */
export function formatMetricValue(
  value: number,
  unit: DeltaUnit,
  moneyContext: MoneyContext = DEFAULT_MONEY_CONTEXT,
): string {
  switch (unit) {
    case 'currency':
      return formatMoney(value, moneyContext);
    case 'kilograms':
      return formatKg(value);
    case 'grams':
      return formatGrams(value);
    case 'percentagePoints':
      return formatPercent(value);
    case 'count':
      return formatCount(value);
  }
}

/**
 * A running meal clock, as `1:24:05` or `24:05`.
 *
 * Deliberately terse: it sits above the tab and is read at a glance. The
 * spoken form below is what assistive technology gets instead, because
 * "1:24:05" is not a sentence.
 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(finite(ms) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** The same span, said out loud: "1 hour 24 minutes", "45 minutes", "under a minute". */
export function formatDurationLabel(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, finite(ms)) / 60_000);
  if (totalMinutes < 1) {
    return 'under a minute';
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }
  return parts.join(' ');
}

/** A rate expressed per hour, such as plates cleared. */
export function formatPerHour(value: number): string {
  return `${DECIMAL(1).format(finite(value))}/hr`;
}

/** A money rate expressed per minute of eating. */
export function formatMoneyPerMinute(
  value: number,
  context: MoneyContext = DEFAULT_MONEY_CONTEXT,
): string {
  return `${formatMoney(value, context)}/min`;
}
