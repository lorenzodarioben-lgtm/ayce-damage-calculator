'use client';

import { cn } from '@/lib/cn';
import { formatMoney, formatPercent } from '@/lib/formatting';
import { clampToRange } from '@/lib/range';
import { usePricingProfile } from '@/components/session/PricingContext';

interface DamageMeterProps {
  retailValue: number;
  totalAdmission: number;
  recoveryPercent: number;
  remainingGap: number;
  compact?: boolean;
}

/**
 * The quarter marks along the track.
 *
 * A bar with no landmarks answers "roughly how full" and nothing else. These
 * turn it into a reading: a glance says "just past half" rather than "some of
 * the way along", which is the question a diner is actually asking it.
 */
const QUARTERS = [25, 50, 75] as const;

export function DamageMeter({
  retailValue,
  totalAdmission,
  recoveryPercent,
  remainingGap,
  compact = false,
}: DamageMeterProps) {
  const pricingProfile = usePricingProfile();
  const beaten = recoveryPercent >= 100;
  // The bar caps at 100% while the numeric readout keeps climbing, so a 250%
  // meal cannot blow out the layout. An unreadable figure reads as no progress
  // rather than as a width and an ARIA value the browser cannot make sense of.
  const fill = clampToRange(recoveryPercent, 0, 100, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="micro-label">Retail damage</span>
        <span className="tabular text-sm font-semibold text-cream-300">
          {formatMoney(retailValue, pricingProfile.money)}{' '}
          <span className="text-cream-700">
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
          'relative mt-2.5 w-full overflow-hidden rounded-full border border-line bg-ash-950',
          'shadow-[inset_0_1px_3px_rgb(0_0_0/0.55)]',
          compact ? 'h-3' : 'h-5',
        )}
      >
        <div
          className={cn(
            'relative h-full rounded-full transition-[width] duration-500 ease-out-soft',
            beaten
              ? 'bg-linear-to-r from-sesame-600 via-sesame-500 to-sesame-400 shadow-[0_0_18px_-2px_var(--color-sesame-500)]'
              : 'bg-linear-to-r from-char-600 via-ember-600 to-ember-400 shadow-[0_0_14px_-3px_var(--color-ember-500)]',
          )}
          style={{ width: `${fill}%` }}
        >
          {/* Lit along its own top edge, like every other raised thing here. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1/2 rounded-full bg-linear-to-b from-cream-50/25 to-transparent"
          />
          {/* The sheen travels only across the filled portion, and only once
              there is enough of it for the travel to be legible. */}
          {fill > 12 && (
            <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-full">
              <span className="animate-meter-sheen absolute inset-y-0 w-1/3 bg-linear-to-r from-transparent via-cream-50/25 to-transparent" />
            </span>
          )}
        </div>

        {/* Landmarks sit above the fill so they stay legible once it passes
            them, and they stop short of the ends where the radius would clip. */}
        {!compact &&
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className={cn('text-xs font-semibold', beaten ? 'text-sesame-400' : 'text-cream-500')}>
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
        <p
          className={cn(
            'tabular display-hero leading-none',
            compact ? 'text-2xl' : 'text-[2rem]',
            beaten
              ? 'text-sesame-400 drop-shadow-[0_0_14px_var(--color-sesame-600)]'
              : 'text-ember-300',
          )}
        >
          {formatPercent(recoveryPercent)}
        </p>
      </div>

      {beaten && !compact && (
        <p className="mt-1.5 text-[0.68rem] leading-snug text-cream-700">
          *By estimated supermarket retail value, not restaurant profitability.
        </p>
      )}
    </div>
  );
}
