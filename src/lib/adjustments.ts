import {
  MAX_ADJUSTMENT_AMOUNT,
  MAX_ADJUSTMENT_LABEL_LENGTH,
  MAX_ADJUSTMENT_PERCENT,
  MAX_BILL_ADJUSTMENTS,
  MIN_ADJUSTMENT_AMOUNT,
  MIN_ADJUSTMENT_PERCENT,
} from '@/lib/constants';
import { isDinerId } from '@/lib/diners';
import type {
  BillAdjustment,
  AdjustmentBasis,
  AdjustmentKind,
  AdjustmentPercentBase,
  Diner,
} from '@/types/meal';

/**
 * What the bill picked up beyond admission.
 *
 * A real all-you-can-eat tab is rarely just the entry price multiplied by
 * heads. A voucher comes off, a weekend surcharge goes on, the card takes its
 * fee, somebody orders a drink that was never included. Until now the
 * calculator had one number for all of that and asked the diner to fold it into
 * the price per head by hand, which quietly misreports what each person paid
 * and makes the recovery figure answer a slightly different question than the
 * one it claims to.
 *
 * Everything here is bounded and total. Adjustments arrive from storage, from
 * an address and from an imported backup, so the parser is the trust boundary
 * and the arithmetic below can never produce a negative total, a NaN, or a
 * discount that pays the table to eat.
 */

export const ADJUSTMENT_KINDS = ['charge', 'discount'] as const;

/**
 * Suggested labels, offered as a datalist rather than a fixed vocabulary.
 *
 * These are the cases that actually turn up on a bill. They are suggestions
 * only: a restaurant will always have invented something these do not cover,
 * and a closed list would just make that case unrecordable.
 */
export const CHARGE_SUGGESTIONS: readonly string[] = [
  'Weekend surcharge',
  'Public holiday surcharge',
  'Card surcharge',
  'Service charge',
  'Drinks',
  'Extra side',
  'Corkage',
];

export const DISCOUNT_SUGGESTIONS: readonly string[] = [
  'Voucher',
  'Group discount',
  'Student discount',
  'Birthday discount',
  'Loyalty reward',
  'Early-bird discount',
];

export function isAdjustmentKind(value: unknown): value is AdjustmentKind {
  return typeof value === 'string' && ADJUSTMENT_KINDS.some((kind) => kind === value);
}

/** Ids appear in storage keys and tokens, so they keep the diner id's alphabet. */
const ADJUSTMENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function isAdjustmentId(value: unknown): value is string {
  return typeof value === 'string' && ADJUSTMENT_ID.test(value);
}

export function normaliseAdjustmentLabel(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_ADJUSTMENT_LABEL_LENGTH)
    : '';
}

/**
 * Money, to the cent.
 *
 * Rounded rather than truncated so a figure typed as 12.005 does not quietly
 * become 12.00, and clamped to a fixed range so no stored or shared amount can
 * dominate a total. Returns null for anything that is not a usable amount,
 * because a zero adjustment is not an adjustment.
 */
export function normaliseAdjustmentAmount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const magnitude = Math.round(Math.abs(value) * 100) / 100;
  if (magnitude < MIN_ADJUSTMENT_AMOUNT) {
    return null;
  }
  return Math.min(MAX_ADJUSTMENT_AMOUNT, magnitude);
}

export const ADJUSTMENT_BASES = ['fixed', 'percent'] as const;
export const ADJUSTMENT_PERCENT_BASES = ['admission', 'subtotal'] as const;

export function isAdjustmentBasis(value: unknown): value is AdjustmentBasis {
  return typeof value === 'string' && ADJUSTMENT_BASES.some((basis) => basis === value);
}

export function isAdjustmentPercentBase(value: unknown): value is AdjustmentPercentBase {
  return typeof value === 'string' && ADJUSTMENT_PERCENT_BASES.some((base) => base === value);
}

/**
 * A share of the bill, to two places.
 *
 * Bounded the same way the cash amount is, and for the same reason: a stored,
 * shared or imported figure must not be able to dominate a total. Returns null
 * for anything that is not a usable share, because a zero percent surcharge is
 * not a surcharge.
 */
export function normaliseAdjustmentPercent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const magnitude = Math.round(Math.abs(value) * 100) / 100;
  if (magnitude < MIN_ADJUSTMENT_PERCENT) {
    return null;
  }
  return Math.min(MAX_ADJUSTMENT_PERCENT, magnitude);
}

/** Whichever normaliser this adjustment's basis calls for. */
function normaliseByBasis(value: unknown, basis: AdjustmentBasis): number | null {
  return basis === 'percent' ? normaliseAdjustmentPercent(value) : normaliseAdjustmentAmount(value);
}

export interface AdjustmentDraft {
  readonly label: string;
  readonly amount: number;
  readonly kind: AdjustmentKind;
  /** Omitted means a fixed cash amount. */
  readonly basis?: AdjustmentBasis;
  /** Omitted means `subtotal`, and means nothing at all for a fixed amount. */
  readonly percentBase?: AdjustmentPercentBase;
  /** Omitted means the adjustment applies to the whole table. */
  readonly dinerId?: string;
}

/** Builds one adjustment, or null when the draft does not describe anything. */
export function createAdjustment(draft: AdjustmentDraft, id: string): BillAdjustment | null {
  if (!isAdjustmentId(id)) {
    return null;
  }
  const label = normaliseAdjustmentLabel(draft.label);
  const basis = isAdjustmentBasis(draft.basis) ? draft.basis : 'fixed';
  const amount = normaliseByBasis(draft.amount, basis);
  if (!label || amount === null || !isAdjustmentKind(draft.kind)) {
    return null;
  }
  return {
    id,
    label,
    amount,
    kind: draft.kind,
    // Omitted for a cash amount, so an ordinary adjustment serialises to
    // exactly the bytes it always did.
    ...(basis === 'percent'
      ? {
          basis,
          percentBase: isAdjustmentPercentBase(draft.percentBase) ? draft.percentBase : 'subtotal',
        }
      : {}),
    ...(isDinerId(draft.dinerId) ? { dinerId: draft.dinerId } : {}),
  };
}

/** True when this adjustment is a share of the bill rather than an amount of it. */
export function isPercentAdjustment(adjustment: BillAdjustment): boolean {
  return adjustment.basis === 'percent';
}

/** The base a percentage adjustment is worked out against. Never a percentage. */
export function percentBaseOf(adjustment: BillAdjustment): AdjustmentPercentBase {
  return isAdjustmentPercentBase(adjustment.percentBase) ? adjustment.percentBase : 'subtotal';
}

/** The entry price each scope's percentages are measured against. */
export interface AdjustmentBaseContext {
  /** The table's entry price, before anything went on or came off the bill. */
  readonly tableAdmission: number;
  /**
   * Entry price per diner, for a percentage charged to one person. A student
   * discount is a share of what that student paid to walk in, not of the table.
   */
  readonly dinerAdmission?: Readonly<Record<string, number>>;
}

function baseAdmissionFor(adjustment: BillAdjustment, context: AdjustmentBaseContext): number {
  const table = Number.isFinite(context.tableAdmission) ? context.tableAdmission : 0;
  if (adjustment.dinerId === undefined) {
    return table;
  }
  const own = context.dinerAdmission?.[adjustment.dinerId];
  return typeof own === 'number' && Number.isFinite(own) ? own : table;
}

/**
 * Turns every percentage on the bill into the money it actually came to.
 *
 * Done once, here, so nothing downstream ever has to know that percentages
 * exist: what leaves this function is a list of plain cash adjustments, and the
 * totals, the per-seat split, the receipt and the share token all keep working
 * on exactly the shape they always did.
 *
 * The base contains no percentage, in any scope, which is what makes the result
 * independent of the order the diner typed things in. Percentages do not
 * compound and a discount cannot shrink the surcharge levied beside it.
 */
export function resolveAdjustmentAmounts(
  adjustments: readonly BillAdjustment[] | undefined,
  context: AdjustmentBaseContext,
): readonly BillAdjustment[] {
  if (!adjustments?.length) {
    return [];
  }
  if (!adjustments.some(isPercentAdjustment)) {
    return adjustments;
  }

  // Fixed charges only: a percentage is never part of what a percentage is of.
  const fixedChargeFor = (dinerId: string | undefined) =>
    adjustments.reduce((total, entry) => {
      if (isPercentAdjustment(entry) || entry.kind !== 'charge' || entry.dinerId !== dinerId) {
        return total;
      }
      return total + (normaliseAdjustmentAmount(entry.amount) ?? 0);
    }, 0);

  const resolved: BillAdjustment[] = [];
  for (const adjustment of adjustments) {
    if (!isPercentAdjustment(adjustment)) {
      resolved.push(adjustment);
      continue;
    }
    const percent = normaliseAdjustmentPercent(adjustment.amount);
    if (percent === null || !isAdjustmentKind(adjustment.kind)) {
      // A percentage that says nothing resolves to nothing, rather than to a
      // confident zero-dollar line on the receipt.
      continue;
    }
    const admission = baseAdmissionFor(adjustment, context);
    const base =
      percentBaseOf(adjustment) === 'admission'
        ? admission
        : admission + fixedChargeFor(adjustment.dinerId);
    const amount = normaliseAdjustmentAmount((base * percent) / 100);
    if (amount === null) {
      // Rounds to less than a cent, so it is not money the table paid.
      continue;
    }
    const { basis: _basis, percentBase: _percentBase, ...cash } = adjustment;
    resolved.push({ ...cash, amount });
  }
  return resolved;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates a stored, shared or imported list.
 *
 * A reference to a diner who is not on this meal's roster is dropped to table
 * scope rather than discarded: the money was still spent, and silently deleting
 * a charge would make the totals disagree with the receipt the diner is holding.
 */
export function parseAdjustments(
  value: unknown,
  diners: readonly Diner[] | undefined,
): readonly BillAdjustment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const roster = new Set((diners ?? []).map((diner) => diner.id));
  const adjustments: BillAdjustment[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (!isRecord(entry) || !isAdjustmentId(entry.id) || seen.has(entry.id)) {
      continue;
    }
    const label = normaliseAdjustmentLabel(entry.label);
    // An unrecognised basis reads as a cash amount, which is the meaning every
    // record written before percentages existed already carries.
    const basis = isAdjustmentBasis(entry.basis) ? entry.basis : 'fixed';
    const amount = normaliseByBasis(entry.amount, basis);
    if (!label || amount === null || !isAdjustmentKind(entry.kind)) {
      continue;
    }
    seen.add(entry.id);
    const dinerId = isDinerId(entry.dinerId) && roster.has(entry.dinerId) ? entry.dinerId : null;
    adjustments.push({
      id: entry.id,
      label,
      amount,
      kind: entry.kind,
      ...(basis === 'percent'
        ? {
            basis,
            percentBase: isAdjustmentPercentBase(entry.percentBase)
              ? entry.percentBase
              : 'subtotal',
          }
        : {}),
      ...(dinerId === null ? {} : { dinerId }),
    });
    if (adjustments.length >= MAX_BILL_ADJUSTMENTS) {
      break;
    }
  }

  return adjustments;
}

/** Re-scopes adjustments naming a diner who has since left the roster. */
export function reconcileAdjustments(
  adjustments: readonly BillAdjustment[] | undefined,
  diners: readonly Diner[] | undefined,
): readonly BillAdjustment[] {
  if (!adjustments?.length) {
    return [];
  }
  const roster = new Set((diners ?? []).map((diner) => diner.id));
  return adjustments.map((adjustment) => {
    if (adjustment.dinerId === undefined || roster.has(adjustment.dinerId)) {
      return adjustment;
    }
    const { dinerId: _dinerId, ...tableWide } = adjustment;
    return tableWide;
  });
}

export interface AdjustmentTotals {
  /** Everything added to the bill, as a positive figure. */
  readonly charges: number;
  /** Everything taken off the bill, as a positive figure. */
  readonly discounts: number;
  /** Signed: charges minus discounts. */
  readonly net: number;
}

export const NO_ADJUSTMENTS: AdjustmentTotals = { charges: 0, discounts: 0, net: 0 };

/**
 * Sums a list of cash amounts, defensively.
 *
 * Percentages are skipped rather than added, because a percentage is not money
 * until `resolveAdjustmentAmounts` has said what it came to. Counting `10` as
 * ten dollars because it was written as ten percent is the one wrong answer
 * this function must never give.
 */
export function totalAdjustments(
  adjustments: readonly BillAdjustment[] | undefined,
): AdjustmentTotals {
  if (!adjustments?.length) {
    return NO_ADJUSTMENTS;
  }

  let charges = 0;
  let discounts = 0;
  for (const adjustment of adjustments) {
    if (!adjustment || isPercentAdjustment(adjustment)) {
      continue;
    }
    const amount = normaliseAdjustmentAmount(adjustment.amount);
    if (amount === null || !isAdjustmentKind(adjustment.kind)) {
      continue;
    }
    if (adjustment.kind === 'charge') {
      charges += amount;
    } else {
      discounts += amount;
    }
  }

  return { charges, discounts, net: charges - discounts };
}

/** The adjustments one diner is personally on the hook for. */
export function adjustmentsForDiner(
  adjustments: readonly BillAdjustment[] | undefined,
  dinerId: string,
): readonly BillAdjustment[] {
  return (adjustments ?? []).filter((adjustment) => adjustment.dinerId === dinerId);
}

/** The adjustments that belong to the table rather than to any one person. */
export function tableWideAdjustments(
  adjustments: readonly BillAdjustment[] | undefined,
): readonly BillAdjustment[] {
  return (adjustments ?? []).filter((adjustment) => adjustment.dinerId === undefined);
}

/**
 * The final total, which can be reduced to nothing but never below it.
 *
 * A voucher larger than the bill means the table paid nothing, not that the
 * restaurant owes them money — and a negative denominator would turn every
 * recovery percentage downstream into nonsense.
 */
export function settleTotal(baseAdmission: number, totals: AdjustmentTotals): number {
  const base = Number.isFinite(baseAdmission) ? baseAdmission : 0;
  const net = Number.isFinite(totals.net) ? totals.net : 0;
  return Math.max(0, Math.round((base + net) * 100) / 100);
}
