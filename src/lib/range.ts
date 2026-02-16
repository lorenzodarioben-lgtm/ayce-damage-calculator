/**
 * Bounds a number that arrived from somewhere untrusted.
 *
 * Stored sessions, share tokens, imported menus and typed fields all hand this
 * module numbers that may be missing, `NaN`, `Infinity` or simply absurd, and
 * every one of them ends up multiplied into a figure the report states out
 * loud. A non-finite value takes the fallback rather than the nearest bound,
 * because "unreadable" and "too small" are different answers.
 *
 * Rounding is the caller's business: a diner count rounds, a plan quantity
 * floors, and a price keeps its cents.
 */
export function clampToRange(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}
