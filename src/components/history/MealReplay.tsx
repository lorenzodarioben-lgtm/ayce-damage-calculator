'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { usePricingProfile } from '@/components/session/PricingContext';
import { Button } from '@/components/ui/Button';
import {
  formatClock,
  formatDurationLabel,
  formatMoney,
  formatPercent,
  formatPlates,
  formatWeight,
} from '@/lib/formatting';
import { replayAt, type MealReplay as MealReplayModel, type ReplayPoint } from '@/lib/replay';
import type { SavedMealSession } from '@/types/history';

interface MealReplayProps {
  replay: MealReplayModel;
  record: SavedMealSession;
  headingId: string;
}

const WIDTH = 640;
const HEIGHT = 200;
const PADDING = { top: 18, right: 10, bottom: 22, left: 10 };

/** Playback advances in real ticks of this length, whatever the meal's length. */
const TICK_MS = 500;

/** A whole meal replays in roughly this many ticks, so an evening is not real-time. */
const PLAYBACK_TICKS = 24;

/**
 * A completed meal, replayed.
 *
 * The chart is hand-drawn SVG for the same reason the recovery trend is: it is
 * a path, a dashed rule and a handful of dots, and a charting library would
 * cost far more than it saves. Everything it shows is also available as a
 * table, and the scrubber is an ordinary range input, so the whole timeline is
 * reachable without seeing the drawing at all.
 */
export function MealReplay({ replay, record, headingId }: MealReplayProps) {
  const money = usePricingProfile().money;
  const scrubberId = useId();
  // The scrubber addresses time, not events, so the cursor always lines up with
  // the chart's own axis and a long lull reads as the pause it was.
  const [offsetMs, setOffsetMs] = useState(replay.durationMs);
  const [playing, setPlaying] = useState(false);

  const duration = replay.durationMs;
  const playbackStep = Math.max(1, Math.ceil(duration / PLAYBACK_TICKS));
  /*
   * The scrubber's granularity has to divide the meal, not assume it is long:
   * a fixed one-second step on a meal recorded in under a second would leave
   * the input with a single reachable value, and no way back to the start.
   */
  const scrubStep = Math.max(1, Math.min(1000, Math.ceil(Math.max(1, duration) / 100)));

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = setInterval(() => {
      setOffsetMs((current) => {
        if (current >= duration) {
          setPlaying(false);
          return duration;
        }
        return Math.min(duration, current + playbackStep);
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, duration, playbackStep]);

  // Offsets are measured from the first recorded event, so position zero is the
  // meal's first plate rather than an empty table.
  const current: ReplayPoint | null = replayAt(replay, offsetMs);

  const geometry = useMemo(() => {
    const plotWidth = WIDTH - PADDING.left - PADDING.right;
    const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const span = Math.max(1, replay.durationMs);
    const ceiling = Math.max(120, ...replay.points.map((point) => point.recoveryPercent));

    const x = (offsetMs: number) => PADDING.left + (offsetMs / span) * plotWidth;
    const y = (percent: number) =>
      PADDING.top + plotHeight - Math.min(1, percent / ceiling) * plotHeight;

    // Stepped, because recovery does not drift upward between plates: it jumps
    // when one lands and holds flat until the next.
    const commands: string[] = [];
    let previousY = y(0);
    commands.push(`M ${PADDING.left} ${previousY}`);
    for (const point of replay.points) {
      const pointX = x(point.offsetMs);
      commands.push(`L ${pointX} ${previousY}`);
      previousY = y(point.recoveryPercent);
      commands.push(`L ${pointX} ${previousY}`);
    }
    commands.push(`L ${WIDTH - PADDING.right} ${previousY}`);

    const line = commands.join(' ');
    const baseline = PADDING.top + plotHeight;

    return {
      line,
      area: `${line} L ${WIDTH - PADDING.right} ${baseline} L ${PADDING.left} ${baseline} Z`,
      breakEvenY: y(100),
      x,
      y,
      baseline,
    };
  }, [replay]);

  if (!replay.available || replay.points.length === 0) {
    return null;
  }

  function scrubTo(value: number) {
    setPlaying(false);
    setOffsetMs(Math.min(duration, Math.max(0, value)));
  }

  const dinerNames = new Map((record.diners ?? []).map((diner) => [diner.id, diner.displayName]));

  return (
    <section aria-labelledby={headingId} className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={headingId} className="micro-label">
          The replay
        </h3>
        <p className="text-xs text-cream-700">
          {formatDurationLabel(replay.durationMs)} of recorded activity
        </p>
      </div>

      {replay.truncated && (
        <p className="mt-2 text-xs leading-relaxed text-cream-700">
          This meal ran longer than the ledger keeps. The replay starts partway in, so its early
          figures are lower than the filed totals.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby={`${headingId}-chart-title`}
          className="h-auto w-full min-w-[280px]"
          preserveAspectRatio="none"
        >
          <title id={`${headingId}-chart-title`}>
            Retail recovery across {formatDurationLabel(replay.durationMs)} of the meal, rising from{' '}
            {formatPercent(replay.points[0]?.recoveryPercent ?? 0)} to{' '}
            {formatPercent(replay.points[replay.points.length - 1]?.recoveryPercent ?? 0)}.
          </title>

          <path d={geometry.area} fill="var(--color-ember-600)" opacity="0.18" />
          <path
            d={geometry.line}
            fill="none"
            stroke="var(--color-ember-500)"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Break-even is the only reference the chart needs. */}
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={geometry.breakEvenY}
            y2={geometry.breakEvenY}
            stroke="var(--color-cream-700)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {replay.moments.map((moment) => (
            <circle
              key={moment.id}
              cx={geometry.x(moment.offsetMs)}
              cy={geometry.baseline + 8}
              r="4"
              fill="var(--color-sesame-500)"
            />
          ))}

          {current && (
            <line
              x1={geometry.x(offsetMs)}
              x2={geometry.x(offsetMs)}
              y1={PADDING.top}
              y2={geometry.baseline}
              stroke="var(--color-cream-300)"
              strokeWidth="1.5"
            />
          )}
        </svg>
      </div>

      <p className="mt-1 text-center text-[0.7rem] text-cream-700">
        Dashed line marks retail break-even. Dots mark the moments listed below.
      </p>

      <div className="mt-4">
        <label htmlFor={scrubberId} className="micro-label mb-1 block">
          Scrub the meal
        </label>
        <input
          id={scrubberId}
          type="range"
          min={0}
          max={Math.max(1, duration)}
          step={scrubStep}
          value={Math.min(Math.max(0, offsetMs), Math.max(1, duration))}
          onChange={(event) => scrubTo(Number(event.target.value))}
          aria-valuetext={
            current
              ? `${formatClock(offsetMs)} in, ${formatPlates(current.plates)}, ${formatPercent(current.recoveryPercent)} recovered`
              : 'The start of the meal'
          }
          className="h-11 w-full accent-[var(--color-ember-500)]"
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (offsetMs >= duration) {
              setOffsetMs(0);
            }
            setPlaying((value) => !value);
          }}
        >
          {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {playing ? 'Pause replay' : 'Play replay'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setPlaying(false);
            setOffsetMs(0);
          }}
        >
          <RotateCcw size={15} aria-hidden="true" />
          Restart
        </Button>
      </div>

      {current && (
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Figure label="At" value={formatClock(offsetMs)} />
          <Figure label="Plates" value={formatPlates(current.plates)} />
          <Figure label="Retail value" value={formatMoney(current.retailValue, money)} />
          <Figure label="Recovery" value={formatPercent(current.recoveryPercent)} />
          <Figure label="Food weight" value={formatWeight(current.weightG)} />
          {replay.dinerIds.map((dinerId) => (
            <Figure
              key={dinerId}
              label={dinerNames.get(dinerId) ?? 'Diner'}
              value={formatPlates(current.dinerPlates[dinerId] ?? 0)}
            />
          ))}
        </dl>
      )}

      {replay.moments.length > 0 && (
        <ul className="mt-4 space-y-2">
          {replay.moments.map((moment) => (
            <li
              key={moment.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line-soft pt-2"
            >
              <span className="text-sm font-semibold text-cream-50">{moment.label}</span>
              <span className="text-xs text-cream-500">{moment.detail}</span>
              <span className="tabular text-xs text-cream-700">{formatClock(moment.offsetMs)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* The same series, readable without the drawing. */}
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-cream-500">
          Show the timeline as figures
        </summary>
        <div className="overflow-x-auto">
          <table className="tabular mt-2 w-full min-w-[320px] text-left text-xs">
            <caption className="sr-only">
              Every recorded step of the meal, with the running plates, retail value and recovery.
            </caption>
            <thead>
              <tr className="text-cream-700">
                <th scope="col" className="py-1 font-semibold">
                  At
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Plates
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Retail value
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Recovery
                </th>
              </tr>
            </thead>
            <tbody>
              {replay.points.map((point) => (
                <tr key={point.eventId} className="border-t border-line-soft">
                  <td className="py-1 text-cream-300">{formatClock(point.offsetMs)}</td>
                  <td className="py-1 text-right text-cream-100">{point.plates}</td>
                  <td className="py-1 text-right text-cream-100">
                    {formatMoney(point.retailValue, money)}
                  </td>
                  <td className="py-1 text-right text-cream-100">
                    {formatPercent(point.recoveryPercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="well px-3 py-2">
      <dt className="micro-label truncate">{label}</dt>
      <dd className="tabular mt-0.5 text-sm font-semibold text-cream-50">{value}</dd>
    </div>
  );
}

/** Named for a record that predates the ledger, which is not the same as an empty one. */
export function UntimedMealNotice({ headingId }: { headingId: string }) {
  return (
    <section aria-labelledby={headingId} className="panel border-dashed p-4 sm:p-5">
      <h3 id={headingId} className="micro-label">
        The replay
      </h3>
      <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-cream-300">
        Detailed timing was not recorded for this meal. It was filed before the calculator kept a
        timeline, so there is nothing to replay — the meal itself, and every figure on this page,
        are exactly as they were recorded.
      </p>
    </section>
  );
}
