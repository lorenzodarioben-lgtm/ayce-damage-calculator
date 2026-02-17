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
          'relative mt-2 w-full overflow-hidden rounded-full border border-line bg-ash-900',
          compact ? 'h-2.5' : 'h-3.5',
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-350 ease-out-soft',
            beaten
              ? 'bg-linear-to-r from-sesame-600 to-sesame-400'
              : 'bg-linear-to-r from-char-600 via-ember-600 to-ember-400',
          )}
          style={{ width: `${fill}%` }}
        />
        {/* Break-even tick stays visible once the bar is full. */}
        <span aria-hidden="true" className="absolute inset-y-0 right-0 w-px bg-cream-100/25" />
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
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
            'tabular display-type text-2xl',
            beaten ? 'text-sesame-400' : 'text-ember-400',
          )}
        >
          {formatPercent(recoveryPercent)}
        </p>
      </div>

      {beaten && !compact && (
        <p className="mt-1 text-[0.68rem] leading-snug text-cream-700">
          *By estimated supermarket retail value, not restaurant profitability.
        </p>
      )}
    </div>
  );
}
