import { describe, expect, it } from 'vitest';
import {
  MAX_MEAL_DURATION_MINUTES,
  MIN_MEAL_DURATION_MINUTES,
  PACING_SETTLE_MS,
  buildPacingForecast,
  clampMealDuration,
  elapsedMealMs,
  pacingMilestone,
  parseMealDuration,
  type PacingInput,
} from '@/lib/pacing';
import type { MealLifecycle } from '@/types/mealEvents';

const START = Date.parse('2026-08-16T18:00:00.000Z');

function at(minutes: number): string {
  return new Date(START + minutes * 60_000).toISOString();
}

function now(minutes: number): number {
  return START + minutes * 60_000;
}

const running: MealLifecycle = { status: 'active', startedAt: at(0), pausedMs: 0 };

function input(overrides: Partial<PacingInput> = {}): PacingInput {
  return {
    lifecycle: running,
    plannedDurationMinutes: 90,
    now: now(30),
    totalPlates: 10,
    totalRetailValue: 40,
    totalAdmission: 120,
    remainingRetailGap: 80,
    averageRetailValuePerPlate: 4,
    ...overrides,
  };
}

describe('clampMealDuration and parseMealDuration', () => {
  it('holds a custom length inside the supported range', () => {
    expect(clampMealDuration(75)).toBe(75);
    expect(clampMealDuration(1)).toBe(MIN_MEAL_DURATION_MINUTES);
    expect(clampMealDuration(10_000)).toBe(MAX_MEAL_DURATION_MINUTES);
    expect(clampMealDuration(Number.NaN)).toBe(MIN_MEAL_DURATION_MINUTES);
    expect(clampMealDuration(89.6)).toBe(90);
  });

  it('treats an unusable stored duration as no limit at all', () => {
    expect(parseMealDuration(90)).toBe(90);
    expect(parseMealDuration(undefined)).toBeUndefined();
    expect(parseMealDuration('90')).toBeUndefined();
    expect(parseMealDuration(Number.POSITIVE_INFINITY)).toBeUndefined();
    // Out of range is rejected rather than clamped: a stored 9000 is not a plan.
    expect(parseMealDuration(9000)).toBeUndefined();
    expect(parseMealDuration(2)).toBeUndefined();
  });
});

describe('elapsedMealMs', () => {
  it('is zero for a meal nobody has started', () => {
    expect(elapsedMealMs(undefined, now(40))).toBe(0);
    expect(elapsedMealMs({ status: 'idle', pausedMs: 0 }, now(40))).toBe(0);
  });

  it('counts from the recorded start rather than from a counter', () => {
    expect(elapsedMealMs(running, now(42))).toBe(42 * 60_000);
  });

  it('excludes time already spent paused', () => {
    expect(
      elapsedMealMs({ status: 'active', startedAt: at(0), pausedMs: 10 * 60_000 }, now(40)),
    ).toBe(30 * 60_000);
  });

  it('freezes while paused, however long the tab stays open', () => {
    const paused: MealLifecycle = {
      status: 'paused',
      startedAt: at(0),
      pausedAt: at(20),
      pausedMs: 0,
    };
    expect(elapsedMealMs(paused, now(25))).toBe(20 * 60_000);
    expect(elapsedMealMs(paused, now(600))).toBe(20 * 60_000);
  });

  it('freezes at the moment a finished meal finished', () => {
    const finished: MealLifecycle = {
      status: 'completed',
      startedAt: at(0),
      completedAt: at(75),
      pausedMs: 5 * 60_000,
    };
    expect(elapsedMealMs(finished, now(900))).toBe(70 * 60_000);
  });

  it('never runs backwards, even from a clock that has', () => {
    expect(elapsedMealMs(running, now(-30))).toBe(0);
  });

  it('is zero rather than NaN when the recorded instants are unusable', () => {
    expect(elapsedMealMs({ status: 'active', startedAt: 'not a time', pausedMs: 0 }, now(10))).toBe(
      0,
    );
  });
});

describe('buildPacingForecast', () => {
  it('reports the window it is counting down', () => {
    const forecast = buildPacingForecast(input());

    expect(forecast.timed).toBe(true);
    expect(forecast.elapsedMs).toBe(30 * 60_000);
    expect(forecast.remainingMs).toBe(60 * 60_000);
    expect(forecast.progressPercent).toBeCloseTo(33.33, 1);
    expect(forecast.expired).toBe(false);
  });

  it('derives current pace from what has actually happened', () => {
    const forecast = buildPacingForecast(input());

    expect(forecast.platesPerHour).toBeCloseTo(20, 5);
    expect(forecast.retailValuePerMinute).toBeCloseTo(40 / 30, 5);
    // 40 of 120 is 33.3% recovered over 30 minutes.
    expect(forecast.recoveryPointsPerMinute).toBeCloseTo(100 / 90, 5);
  });

  it('projects the rest of the window from the pace so far', () => {
    const forecast = buildPacingForecast(input());

    // $40 in 30 minutes, 60 minutes left, so $80 more.
    expect(forecast.projectedRetailValue).toBeCloseTo(120, 5);
    expect(forecast.projectedRecoveryPercent).toBeCloseTo(100, 5);
    expect(forecast.projectedToBreakEven).toBe(true);
  });

  it('states the pace break-even would take from here', () => {
    const forecast = buildPacingForecast(input());

    // $80 to find across 60 minutes.
    expect(forecast.requiredRetailValuePerMinute).toBeCloseTo(80 / 60, 5);
    // 20 more average plates across one hour.
    expect(forecast.requiredPlatesPerHour).toBeCloseTo(20, 5);
  });

  it('withholds a projection until there is enough meal to project from', () => {
    const early = buildPacingForecast(input({ now: START + PACING_SETTLE_MS - 1 }));

    expect(early.settled).toBe(false);
    expect(early.projectedRetailValue).toBeNull();
    expect(early.projectedRecoveryPercent).toBeNull();
    // The rates it does have are still honest ones.
    expect(Number.isFinite(early.platesPerHour)).toBe(true);
  });

  it('says nothing about a projection for an untimed meal', () => {
    const untimed = buildPacingForecast(input({ plannedDurationMinutes: undefined }));

    expect(untimed.timed).toBe(false);
    expect(untimed.remainingMs).toBeNull();
    expect(untimed.plannedDurationMs).toBeNull();
    expect(untimed.progressPercent).toBe(0);
    expect(untimed.projectedRecoveryPercent).toBeNull();
    expect(untimed.requiredRetailValuePerMinute).toBeNull();
    expect(untimed.expired).toBe(false);
  });

  it('reports an expired window without a negative countdown', () => {
    const over = buildPacingForecast(input({ now: now(120) }));

    expect(over.remainingMs).toBe(0);
    expect(over.expired).toBe(true);
    expect(over.progressPercent).toBe(100);
    expect(over.projectedRecoveryPercent).toBeNull();
    expect(over.requiredRetailValuePerMinute).toBeNull();
  });

  it('stops asking for a pace once break-even is met', () => {
    const beaten = buildPacingForecast(input({ remainingRetailGap: 0, totalRetailValue: 150 }));

    expect(beaten.hasBeatenBuffet).toBe(true);
    expect(beaten.requiredRetailValuePerMinute).toBeNull();
    expect(beaten.requiredPlatesPerHour).toBeNull();
    expect(beaten.projectedToBreakEven).toBe(true);
  });

  it('produces finite figures for a meal with nothing on the tab', () => {
    const empty = buildPacingForecast(
      input({ totalPlates: 0, totalRetailValue: 0, averageRetailValuePerPlate: 0 }),
    );

    expect(empty.platesPerHour).toBe(0);
    expect(empty.retailValuePerMinute).toBe(0);
    expect(empty.recoveryPointsPerMinute).toBe(0);
    expect(empty.projectedRetailValue).toBe(0);
    expect(empty.requiredPlatesPerHour).toBeNull();
  });

  it('produces finite figures for a meal that started this instant', () => {
    const instant = buildPacingForecast(input({ now: START }));

    expect(instant.elapsedMs).toBe(0);
    for (const value of [
      instant.platesPerHour,
      instant.retailValuePerMinute,
      instant.recoveryPointsPerMinute,
      instant.progressPercent,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('produces finite figures when admission is somehow zero', () => {
    const free = buildPacingForecast(input({ totalAdmission: 0, remainingRetailGap: 0 }));

    expect(Number.isFinite(free.recoveryPointsPerMinute)).toBe(true);
    expect(free.projectedRecoveryPercent).toBe(0);
  });

  it('freezes the forecast while the meal is paused', () => {
    const paused: MealLifecycle = {
      status: 'paused',
      startedAt: at(0),
      pausedAt: at(20),
      pausedMs: 0,
    };
    const first = buildPacingForecast(input({ lifecycle: paused, now: now(25) }));
    const later = buildPacingForecast(input({ lifecycle: paused, now: now(300) }));

    expect(first.status).toBe('paused');
    expect(first.elapsedMs).toBe(later.elapsedMs);
    expect(first.remainingMs).toBe(later.remainingMs);
  });

  it('leaves a finished meal exactly where it stopped', () => {
    const finished: MealLifecycle = {
      status: 'completed',
      startedAt: at(0),
      completedAt: at(60),
      pausedMs: 0,
    };
    const forecast = buildPacingForecast(input({ lifecycle: finished, now: now(500) }));

    expect(forecast.status).toBe('completed');
    expect(forecast.elapsedMs).toBe(60 * 60_000);
    expect(forecast.remainingMs).toBe(30 * 60_000);
  });

  it('reports nothing running for a meal that has not started', () => {
    const idle = buildPacingForecast(input({ lifecycle: undefined }));

    expect(idle.status).toBe('idle');
    expect(idle.elapsedMs).toBe(0);
    expect(idle.expired).toBe(false);
  });

  it('ignores a malformed persisted duration rather than counting down to nonsense', () => {
    const forecast = buildPacingForecast(input({ plannedDurationMinutes: 99_999 }));

    expect(forecast.timed).toBe(false);
    expect(forecast.remainingMs).toBeNull();
  });
});

describe('pacingMilestone', () => {
  it('names only the milestones worth announcing', () => {
    expect(pacingMilestone(30 * 60_000)).toBe(30);
    expect(pacingMilestone(15 * 60_000)).toBe(15);
    expect(pacingMilestone(60_000)).toBe(1);
    expect(pacingMilestone(23 * 60_000)).toBeNull();
  });

  it('says nothing for an untimed or finished countdown', () => {
    expect(pacingMilestone(null)).toBeNull();
    expect(pacingMilestone(0)).toBeNull();
  });

  it('rounds up, so a milestone is announced before it passes', () => {
    expect(pacingMilestone(4 * 60_000 + 30_000)).toBe(5);
  });
});
