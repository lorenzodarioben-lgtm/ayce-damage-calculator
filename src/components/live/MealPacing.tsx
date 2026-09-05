'use client';

import { useId, useMemo, useState } from 'react';
import { Flag, Pause, Play, Timer } from 'lucide-react';
import { usePricingProfile } from '@/components/session/PricingContext';
import { Button } from '@/components/ui/Button';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/cn';
import {
  MAX_MEAL_DURATION_MINUTES,
  MEAL_DURATION_PRESETS,
  MIN_MEAL_DURATION_MINUTES,
  buildPacingForecast,
  pacingMilestone,
} from '@/lib/pacing';
import {
  formatClock,
  formatDurationLabel,
  formatMoneyPerMinute,
  formatPerHour,
  formatPercent,
} from '@/lib/formatting';
import type { DamageReport } from '@/types/meal';
import type { MealLifecycle, MealLifecycleStatus } from '@/types/mealEvents';

interface MealPacingProps {
  report: DamageReport;
  lifecycle: MealLifecycle;
  plannedDurationMinutes: number | undefined;
  onDurationChange: (minutes: number | undefined) => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}

const STATUS_LABELS: Record<MealLifecycleStatus, string> = {
  idle: 'Not started',
  active: 'Running',
  paused: 'Paused',
  completed: 'Finished',
};

const CHIP =
  'min-h-11 flex-1 cursor-pointer rounded-[10px] border px-3 text-xs font-semibold uppercase ' +
  'tracking-[0.08em] transition-colors duration-200';

/**
 * The meal clock, and what the current pace implies.
 *
 * Optional throughout: a table that has not booked a window sees a single
 * invitation and nothing else, and the one-tap logging above it is untouched.
 * Every figure is an extrapolation offered for entertainment — the required
 * pace exists so a table can decide the chase is not worth it, which is why it
 * is stated as a fact about the clock rather than as a target.
 */
export function MealPacing({
  report,
  lifecycle,
  plannedDurationMinutes,
  onDurationChange,
  onPause,
  onResume,
  onFinish,
}: MealPacingProps) {
  const money = usePricingProfile().money;
  const headingId = useId();
  const customId = useId();
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('75');

  // Only a running meal moves, so a paused or finished one costs no timer at all.
  const now = useNow(1000, lifecycle.status === 'active');

  const forecast = useMemo(
    () =>
      buildPacingForecast({
        lifecycle,
        plannedDurationMinutes,
        now,
        totalPlates: report.totalPlates,
        totalRetailValue: report.totalRetailValue,
        totalAdmission: report.totalAdmission,
        remainingRetailGap: report.remainingRetailGap,
        averageRetailValuePerPlate: report.averageRetailValuePerPlate,
      }),
    [lifecycle, plannedDurationMinutes, now, report],
  );

  /*
   * A countdown that speaks every second is unusable. Only a status change, the
   * window closing, or one of a handful of milestones is announced, so the
   * region stays quiet through most of the meal and says something worth
   * hearing when it does not.
   *
   * Resolved during render rather than in an effect, so nothing is announced
   * merely because the component mounted.
   */
  const milestone = pacingMilestone(forecast.remainingMs);
  const [announcement, setAnnouncement] = useState('');
  const [lastStatus, setLastStatus] = useState(lifecycle.status);
  const [lastMilestone, setLastMilestone] = useState(milestone);
  const [expiredAnnounced, setExpiredAnnounced] = useState(forecast.expired);

  if (lastStatus !== lifecycle.status) {
    setLastStatus(lifecycle.status);
    setAnnouncement(`Meal clock ${STATUS_LABELS[lifecycle.status].toLowerCase()}.`);
  } else if (forecast.expired && !expiredAnnounced) {
    setExpiredAnnounced(true);
    setAnnouncement('The booked window is over. Anything logged from here is extra time.');
  } else if (milestone !== null && milestone !== lastMilestone) {
    setLastMilestone(milestone);
    setAnnouncement(`${milestone} ${milestone === 1 ? 'minute' : 'minutes'} left on the clock.`);
  }

  const started = lifecycle.status !== 'idle';
  const clockMs = forecast.remainingMs ?? forecast.elapsedMs;
  const clockLabel = forecast.remainingMs === null ? 'Elapsed' : 'Remaining';

  function applyCustom() {
    const parsed = Number.parseInt(customValue, 10);
    if (Number.isFinite(parsed)) {
      onDurationChange(parsed);
      setCustomOpen(false);
    }
  }

  return (
    <section aria-labelledby={headingId} className="panel mb-4 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="micro-label flex items-center gap-1.5">
          <Timer size={13} aria-hidden="true" />
          Meal clock
        </h2>
        <p className="text-xs text-cream-500">{STATUS_LABELS[lifecycle.status]}</p>
      </div>

      <div role="group" aria-label="Meal length" className="mt-3 flex flex-wrap gap-2">
        {MEAL_DURATION_PRESETS.map((minutes) => {
          const active = plannedDurationMinutes === minutes;
          return (
            <button
              key={minutes}
              type="button"
              aria-pressed={active}
              onClick={() => onDurationChange(minutes)}
              className={cn(
                CHIP,
                active
                  ? 'border-line-ember bg-ash-800 text-ember-400'
                  : 'border-line bg-ash-900 text-cream-300 hover:bg-ash-800',
              )}
            >
              {minutes} min
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={customOpen}
          aria-expanded={customOpen}
          onClick={() => setCustomOpen((open) => !open)}
          className={cn(CHIP, 'border-line bg-ash-900 text-cream-300 hover:bg-ash-800')}
        >
          Custom
        </button>
        <button
          type="button"
          aria-pressed={plannedDurationMinutes === undefined}
          onClick={() => onDurationChange(undefined)}
          className={cn(
            CHIP,
            plannedDurationMinutes === undefined
              ? 'border-line-ember bg-ash-800 text-ember-400'
              : 'border-line bg-ash-900 text-cream-300 hover:bg-ash-800',
          )}
        >
          No limit
        </button>
      </div>

      {customOpen && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor={customId} className="micro-label mb-1 block">
              Custom length in minutes
            </label>
            <input
              id={customId}
              type="number"
              inputMode="numeric"
              min={MIN_MEAL_DURATION_MINUTES}
              max={MAX_MEAL_DURATION_MINUTES}
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              className="h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 text-sm text-cream-50"
            />
          </div>
          <Button variant="secondary" size="md" onClick={applyCustom}>
            Set length
          </Button>
        </div>
      )}

      {forecast.timed ? (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="micro-label">{clockLabel}</p>
            <p className="text-xs text-cream-700">
              {formatDurationLabel(forecast.plannedDurationMs ?? 0)} booked
            </p>
          </div>
          {/* The digits update every second, which is exactly what a screen
              reader must not follow; the spoken form lives in the label below. */}
          <p aria-hidden="true" className="tabular display-type mt-1 text-4xl text-cream-50">
            {formatClock(clockMs)}
          </p>
          <div
            role="progressbar"
            aria-label="Meal window progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(forecast.progressPercent)}
            aria-valuetext={`${formatDurationLabel(forecast.elapsedMs)} elapsed, ${formatDurationLabel(forecast.remainingMs ?? 0)} remaining`}
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ash-800"
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-500 ease-out-soft',
                forecast.expired ? 'bg-char-500' : 'bg-ember-500',
              )}
              style={{ width: `${Math.max(2, forecast.progressPercent)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-cream-700">
          No time limit set. Pick a length above if your table has one — the meal itself works
          exactly the same either way.
        </p>
      )}

      {started && (
        <div className="mt-3 flex flex-wrap gap-2">
          {lifecycle.status === 'paused' ? (
            <Button variant="secondary" size="md" onClick={onResume}>
              <Play size={16} aria-hidden="true" />
              Resume meal
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="md"
              onClick={onPause}
              disabled={lifecycle.status !== 'active'}
            >
              <Pause size={16} aria-hidden="true" />
              Pause meal
            </Button>
          )}
          <Button
            variant="ghost"
            size="md"
            onClick={onFinish}
            disabled={lifecycle.status === 'completed'}
          >
            <Flag size={16} aria-hidden="true" />
            Finish meal
          </Button>
        </div>
      )}

      {started && (
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Figure label="Plates per hour" value={formatPerHour(forecast.platesPerHour)} />
          <Figure
            label="Retail per minute"
            value={formatMoneyPerMinute(forecast.retailValuePerMinute, money)}
          />
          <Figure
            label="Recovery per minute"
            value={`${formatPercent(forecast.recoveryPointsPerMinute)} pts`}
          />
          <Figure
            label="Projected recovery"
            value={
              forecast.projectedRecoveryPercent === null
                ? 'Too early'
                : formatPercent(forecast.projectedRecoveryPercent)
            }
            accent={forecast.projectedToBreakEven}
          />
          <Figure
            label="Pace to break even"
            value={
              forecast.hasBeatenBuffet
                ? 'Already there'
                : forecast.requiredRetailValuePerMinute === null
                  ? '—'
                  : formatMoneyPerMinute(forecast.requiredRetailValuePerMinute, money)
            }
          />
          <Figure label="Time eaten" value={formatDurationLabel(forecast.elapsedMs)} />
        </dl>
      )}

      {started && (
        <p className="mt-3 text-xs leading-relaxed text-cream-700">
          {forecast.expired
            ? 'The booked window is over. Anything after this is extra time, and the numbers keep counting it.'
            : forecast.projectedRecoveryPercent === null
              ? 'Projections need a few minutes of meal behind them before they mean anything.'
              : forecast.hasBeatenBuffet
                ? 'Break-even is already behind you. Everything from here is for the story.'
                : forecast.projectedToBreakEven
                  ? 'At this pace the retail value reaches admission before time runs out.'
                  : 'At this pace admission stays ahead. That is a perfectly good evening, not a failure.'}{' '}
          Forecasts are extrapolations of what has happened so far, not promises — and nobody has to
          eat to a number.
        </p>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-ash-900 px-3 py-2">
      <dt className="micro-label">{label}</dt>
      <dd
        className={cn(
          'tabular mt-0.5 text-sm font-semibold',
          accent ? 'text-sesame-400' : 'text-cream-50',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
