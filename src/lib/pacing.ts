import { sessionLifecycle } from '@/lib/mealEvents';
import type { MealLifecycle, MealLifecycleStatus } from '@/types/mealEvents';

/**
 * How a meal is going against the clock.
 *
 * Every figure here is an extrapolation of what has happened so far, offered as
 * entertainment rather than a promise. Nothing in this module encourages eating
 * more than someone wants to: the required pace exists so a table can decide to
 * stop chasing it, and the projection is withheld entirely until there is
 * enough of a meal to project from.
 *
 * Pure by construction. The current time arrives as an argument, so a forecast
 * is a function of its inputs and can be tested without waiting for dinner.
 */

/** Meal lengths a table actually books, plus a validated custom option. */
export const MEAL_DURATION_PRESETS: readonly number[] = [60, 90, 120];

export const MIN_MEAL_DURATION_MINUTES = 15;
export const MAX_MEAL_DURATION_MINUTES = 300;

/**
 * Below this, a projection says more about the first thirty seconds than about
 * the meal. Rates are still reported; the forecast is not.
 */
export const PACING_SETTLE_MS = 3 * 60_000;

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;

export function clampMealDuration(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_MEAL_DURATION_MINUTES;
  }
  return Math.min(
    MAX_MEAL_DURATION_MINUTES,
    Math.max(MIN_MEAL_DURATION_MINUTES, Math.round(value)),
  );
}

/** Reads an untrusted stored duration, treating anything unusable as "no limit". */
export function parseMealDuration(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  const rounded = Math.round(value);
  return rounded < MIN_MEAL_DURATION_MINUTES || rounded > MAX_MEAL_DURATION_MINUTES
    ? undefined
    : rounded;
}

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

/**
 * Time actually spent eating.
 *
 * Derived from the recorded instants rather than from a counter, which is what
 * makes it survive a reload, a backgrounded tab and an offline stretch. A
 * paused meal is frozen at the moment it paused; a finished one at the moment
 * it finished.
 */
export function elapsedMealMs(lifecycle: MealLifecycle | undefined, now: number): number {
  const state = sessionLifecycle(lifecycle);
  if (state.status === 'idle' || !state.startedAt) {
    return 0;
  }
  const started = Date.parse(state.startedAt);
  if (!Number.isFinite(started)) {
    return 0;
  }

  const until =
    state.status === 'paused' && state.pausedAt
      ? Date.parse(state.pausedAt)
      : state.status === 'completed' && state.completedAt
        ? Date.parse(state.completedAt)
        : now;

  if (!Number.isFinite(until)) {
    return 0;
  }
  return Math.max(0, until - started - state.pausedMs);
}

export interface PacingInput {
  readonly lifecycle: MealLifecycle | undefined;
  /** Absent when the table is not running against a clock at all. */
  readonly plannedDurationMinutes?: number | undefined;
  readonly now: number;
  readonly totalPlates: number;
  readonly totalRetailValue: number;
  readonly totalAdmission: number;
  readonly remainingRetailGap: number;
  readonly averageRetailValuePerPlate: number;
}

export interface PacingForecast {
  readonly status: MealLifecycleStatus;
  /** True once a duration has been chosen; otherwise this is an untimed meal. */
  readonly timed: boolean;
  readonly elapsedMs: number;
  /** Null when there is no limit to count down to. */
  readonly remainingMs: number | null;
  readonly plannedDurationMs: number | null;
  /** 0–100, how far through the booked window the meal is. */
  readonly progressPercent: number;
  readonly expired: boolean;
  /** False until there is enough meal to extrapolate from. */
  readonly settled: boolean;
  readonly platesPerHour: number;
  readonly retailValuePerMinute: number;
  /** Percentage points of admission recovered per minute so far. */
  readonly recoveryPointsPerMinute: number;
  /** Withheld until the meal has settled, or when there is no window to project into. */
  readonly projectedRetailValue: number | null;
  readonly projectedRecoveryPercent: number | null;
  /** Whether the current pace reaches admission before the window closes. */
  readonly projectedToBreakEven: boolean;
  /** The pace break-even would take from here. Null once it is met or unreachable. */
  readonly requiredRetailValuePerMinute: number | null;
  readonly requiredPlatesPerHour: number | null;
  readonly hasBeatenBuffet: boolean;
}

/**
 * Builds the whole forecast in one pass.
 *
 * Every division is guarded, so a zero-plate meal, a zero admission, a
 * zero-length window and a meal that started one millisecond ago all produce
 * finite numbers rather than `NaN` or `Infinity`.
 */
export function buildPacingForecast(input: PacingInput): PacingForecast {
  const state = sessionLifecycle(input.lifecycle);
  const elapsedMs = elapsedMealMs(input.lifecycle, input.now);
  const duration = parseMealDuration(input.plannedDurationMinutes);
  const plannedDurationMs = duration === undefined ? null : duration * MS_PER_MINUTE;

  const remainingMs =
    plannedDurationMs === null ? null : Math.max(0, plannedDurationMs - elapsedMs);
  const expired = remainingMs !== null && remainingMs === 0 && state.status !== 'idle';
  const settled = elapsedMs >= PACING_SETTLE_MS;

  const elapsedMinutes = elapsedMs / MS_PER_MINUTE;
  const platesPerHour = safeRatio(input.totalPlates, elapsedMs / MS_PER_HOUR);
  const retailValuePerMinute = safeRatio(input.totalRetailValue, elapsedMinutes);
  const recoveryPercent = safeRatio(input.totalRetailValue, input.totalAdmission) * 100;
  const recoveryPointsPerMinute = safeRatio(recoveryPercent, elapsedMinutes);

  const hasBeatenBuffet = input.remainingRetailGap <= 0 && input.totalPlates > 0;

  const canProject = settled && remainingMs !== null && !expired;
  const projectedRetailValue = canProject
    ? input.totalRetailValue + retailValuePerMinute * (remainingMs / MS_PER_MINUTE)
    : null;
  const projectedRecoveryPercent =
    projectedRetailValue === null
      ? null
      : safeRatio(projectedRetailValue, input.totalAdmission) * 100;

  const chasingBreakEven = input.remainingRetailGap > 0 && remainingMs !== null && remainingMs > 0;
  const requiredRetailValuePerMinute = chasingBreakEven
    ? safeRatio(input.remainingRetailGap, remainingMs / MS_PER_MINUTE)
    : null;
  const requiredPlatesPerHour =
    chasingBreakEven && input.averageRetailValuePerPlate > 0
      ? safeRatio(
          input.remainingRetailGap / input.averageRetailValuePerPlate,
          remainingMs / MS_PER_HOUR,
        )
      : null;

  return {
    status: state.status,
    timed: plannedDurationMs !== null,
    elapsedMs,
    remainingMs,
    plannedDurationMs,
    progressPercent:
      plannedDurationMs === null ? 0 : Math.min(100, safeRatio(elapsedMs, plannedDurationMs) * 100),
    expired,
    settled,
    platesPerHour,
    retailValuePerMinute,
    recoveryPointsPerMinute,
    projectedRetailValue,
    projectedRecoveryPercent,
    projectedToBreakEven:
      hasBeatenBuffet || (projectedRecoveryPercent !== null && projectedRecoveryPercent >= 100),
    requiredRetailValuePerMinute,
    requiredPlatesPerHour,
    hasBeatenBuffet,
  };
}

/**
 * Milestones worth saying out loud.
 *
 * A countdown that announces every second is unusable with a screen reader on,
 * so only these crossings are announced. Chosen to be sparse enough to be
 * useful and rare enough not to interrupt a conversation.
 */
export const PACING_ANNOUNCEMENT_MINUTES: readonly number[] = [30, 15, 10, 5, 1];

/** The largest milestone at or below the minutes remaining, or null between them. */
export function pacingMilestone(remainingMs: number | null): number | null {
  if (remainingMs === null || remainingMs <= 0) {
    return null;
  }
  const minutes = Math.ceil(remainingMs / MS_PER_MINUTE);
  return PACING_ANNOUNCEMENT_MINUTES.includes(minutes) ? minutes : null;
}
