/**
 * Dividing money so the parts still add up to the whole.
 *
 * A table splitting a bill pays in cents, and cents do not divide evenly. Three
 * people settling a $10 charge each owe $3.33, and the three of them together
 * owe $9.99 — which is not what the receipt says. Every per-person figure the
 * app shows is rounded for display independently, so any split computed as a
 * plain division is liable to disagree with the total printed beside it.
 *
 * So a split is done once, in integer cents, by largest remainder: give
 * everybody their whole-cent share, then hand the leftover cents out one at a
 * time to whoever was rounded down hardest. The parts then reconcile with the
 * whole exactly, by construction rather than by luck.
 *
 * Ties go to the earlier position. That is arbitrary as fairness goes — someone
 * has to get the extra cent — but it is *deterministic*, which is the property
 * that matters: the same table split the same bill twice must produce the same
 * two answers, and a stored record must read back the way it was filed.
 */

/** Money is settled in whole cents, which is the smallest thing anyone pays. */
export const CENTS_PER_UNIT = 100;

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Rounds an amount to whole cents.
 *
 * Half away from zero, matching the rounding the bill total already uses, so a
 * split and the total it has to reconcile with never disagree about what a
 * half-cent is.
 */
export function toCents(value: number): number {
  const safe = finite(value);
  return Math.sign(safe) * Math.round(Math.abs(safe) * CENTS_PER_UNIT);
}

/** Back to an ordinary money figure. */
export function fromCents(cents: number): number {
  return finite(cents) / CENTS_PER_UNIT;
}

/**
 * Divides `totalCents` into as many parts as there are weights.
 *
 * The parts are whole cents that sum to exactly `totalCents`, including when
 * the total is negative — a net discount is divided the same way a charge is,
 * and the sign is never a special case.
 *
 * Weights are relative, not amounts: they say how the total should lean, and
 * anything malformed or negative counts as no claim at all. Weights that sum to
 * nothing fall back to an even division, because a total that exists has to go
 * somewhere and refusing to place it would lose money that was actually paid.
 */
export function distributeCents(totalCents: number, weights: readonly number[]): number[] {
  const parts = weights.length;
  if (parts === 0) {
    return [];
  }

  const total = Math.trunc(finite(totalCents));
  const safeWeights = weights.map((weight) => {
    const value = finite(weight);
    return value > 0 ? value : 0;
  });
  const totalWeight = safeWeights.reduce((sum, weight) => sum + weight, 0);
  // Nothing to lean on, so the only defensible division is an equal one.
  const shares = totalWeight > 0 ? safeWeights : safeWeights.map(() => 1);
  const shareTotal = totalWeight > 0 ? totalWeight : parts;

  const floors: number[] = [];
  const remainders: number[] = [];
  let placed = 0;
  for (const share of shares) {
    const exact = (total * share) / shareTotal;
    // Floor rather than truncate, so the leftover is always a non-negative
    // count of cents to hand out — true on both sides of zero.
    const whole = Math.floor(exact);
    floors.push(whole);
    remainders.push(exact - whole);
    placed += whole;
  }

  let leftover = total - placed;
  if (leftover > 0) {
    const order = floors
      .map((_, index) => index)
      // Largest shortfall first; equal shortfalls keep their original order, so
      // the same inputs always place the same cents in the same seats.
      .sort((a, b) => (remainders[b] ?? 0) - (remainders[a] ?? 0) || a - b);
    for (const index of order) {
      if (leftover === 0) {
        break;
      }
      floors[index] = (floors[index] ?? 0) + 1;
      leftover -= 1;
    }
  }

  return floors;
}

/**
 * Divides an ordinary money amount by weight, in money rather than cents.
 *
 * The convenience wrapper the calculation engine actually calls: it settles to
 * cents, divides exactly, and hands back figures that sum to the rounded total.
 */
export function distributeMoney(total: number, weights: readonly number[]): number[] {
  return distributeCents(toCents(total), weights).map(fromCents);
}

/** Divides an amount into `parts` equal shares, cents and all. */
export function splitMoneyEvenly(total: number, parts: number): number[] {
  const count = Number.isFinite(parts) ? Math.max(0, Math.floor(parts)) : 0;
  return distributeMoney(total, new Array<number>(count).fill(1));
}
