'use client';

import { BAND_FILL, BAND_TEXT, bandForPercent } from '@/lib/bands';
import { cn } from '@/lib/cn';
import { formatMoney, formatPercent } from '@/lib/formatting';
import { clampToRange } from '@/lib/range';
import { usePricingProfile } from '@/components/session/PricingContext';

interface DamageMeterProps {
  retailValue: number;
  totalAdmission: number;
  recoveryPercent: number;
  remainingGap: number;
  /**
   * `compact` is the older name for the rail treatment and is kept so callers
   * that only want a smaller meter do not have to know about variants.
   */
  compact?: boolean;
  variant?: 'inline' | 'rail' | 'bar';
}

/**
 * The reading.
 *
 * This is the one number the product exists to report, and for a long time it
 * lived in a card inside a sidebar on a desktop and as a four-pixel unlabelled
 * bar at the bottom of a phone — which is the device it is actually read on,
 * across a table, in a dark room, by somebody who wants an answer in about ten
 * seconds.
 *
 * So it is the largest thing on the screen apart from a verdict, and it is set
 * in Inter rather than the display face: a measurement is a measurement, and
 * Inter's figures are the same width to the pixel, so a total stops shifting
 * sideways as it counts up.
 *
 * The quarter marks are what turn a bar into a reading — a glance says "just
 * past half" rather than "some of the way along", which is the question a diner
 * is actually asking it. The break-even datum stays visible once the bar is
 * full, because "how far past" is the next question.
 */
const QUARTERS = [25, 50, 75] as const;

export function DamageMeter({
  retailValue,
  totalAdmission,
  recoveryPercent,
  remainingGap,
  compact = false,
  variant = compact ? 'rail' : 'inline',
}: DamageMeterProps) {
  const pricingProfile = usePricingProfile();
  const band = bandForPercent(recoveryPercent);
  const beaten = band !== 'behind';
  // The bar caps at 100% while the numeric readout keeps climbing, so a 250%
  // meal cannot blow out the layout. An unreadable figure reads as no progress
  // rather than as a width and an ARIA value the browser cannot make sense of.
  const fill = clampToRange(recoveryPercent, 0, 100, 0);
  const bar = variant === 'bar';
  const rail = variant === 'rail';
  const inline = variant === 'inline';

  return (
    <div className={cn(bar && 'px-4 pt-2')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="micro-label text-cream-500">Retail damage</span>
        <span className="tabular text-ui font-semibold text-cream-100">
          {formatMoney(retailValue, pricingProfile.money)}{' '}
          <span className="font-normal text-cream-500">
            / {formatMoney(totalAdmission, pricingProfile.money)}
          </span>
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Retail value recovered against admission"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
        aria-valuetext={`${formatPercent(recoveryPercent)} of admission recovered`}
        className={cn(
          // Recessed, so the fill reads as something rising in a channel rather
          // than a coloured rectangle laid over a grey one.
          'recessed relative mt-2 w-full overflow-hidden rounded-full border border-line bg-ash-950',
          rail ? 'h-2' : 'h-3 sm:h-2.5',
        )}
      >
        {/*
         * A full-width fill slid into place rather than a width that animates.
         * Width is a layout property and cost a frame every time the tab
         * changed; a transform does not, and it keeps the fill's rounded end
         * from being squashed into an ellipse on the way.
         */}
        <div
          className={cn(
            'absolute inset-0 rounded-full transition-transform duration-[420ms] ease-out-soft',
            BAND_FILL[band],
          )}
          style={{ transform: `translateX(${fill - 100}%)` }}
        >
          {/* Lit along its own top edge, like every other raised thing here. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1/2 rounded-full bg-linear-to-b from-cream-50/25 to-transparent"
          />
        </div>

        {/* Landmarks sit above the fill so they stay legible once it passes
            them, and they stop short of the ends where the radius would clip. */}
        {!rail &&
          QUARTERS.map((mark) => (
            <span
              key={mark}
              aria-hidden="true"
              style={{ left: `${mark}%` }}
              className="absolute inset-y-1 w-px bg-cream-50/15"
            />
          ))}

        {/* Break-even stays visible once the bar is full. */}
        <span aria-hidden="true" className="absolute inset-y-0 right-0 w-0.5 bg-cream-100/40" />
      </div>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <p className={cn('text-caption', beaten ? BAND_TEXT[band] : 'text-cream-500')}>
          {beaten ? (
            <>
              You beat the buffet
              <span aria-hidden="true">*</span>
              <span className="sr-only"> by estimated supermarket retail value</span>
            </>
          ) : (
            `${formatMoney(remainingGap, pricingProfile.money)} until retail break-even`
          )}
        </p>
        {/* The reading, named. On the report it carries its own label, because
            there it is the report's headline figure rather than a number beside
            a bar somebody is already looking at. */}
        <div className="text-right">
          {inline && (
            <div>
              <p className="micro-label text-cream-500">Retail value recovered</p>
            </div>
          )}
          <p
            className={cn(
              'tabular font-bold leading-none',
              rail ? 'text-figure' : 'text-figure sm:text-reading',
              inline && 'mt-1',
              BAND_TEXT[band],
            )}
          >
            {formatPercent(recoveryPercent)}
          </p>
        </div>
      </div>

      {beaten && !rail && !bar && (
        <p className="mt-1.5 text-caption leading-snug text-cream-600">
          *By estimated supermarket retail value, not restaurant profitability.
        </p>
      )}
    </div>
  );
}
