'use client';

import { Button } from '@/components/ui/Button';
import { formatMoney, formatPercent, formatPlates } from '@/lib/formatting';
import { usePricingProfile } from '@/components/session/PricingContext';
import type { DamageReport } from '@/types/meal';

interface StickySummaryBarProps {
  report: DamageReport;
  onCalculate: () => void;
}

/** Mobile-only condensed tab. Hidden entirely until the meal has content. */
export function StickySummaryBar({ report, onCalculate }: StickySummaryBarProps) {
  const pricingProfile = usePricingProfile();
  if (report.lines.length === 0) {
    return null;
  }

  const fill = Math.min(100, Math.max(0, report.retailRecoveryPercent));

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-ember/70 bg-ash-900/88 shadow-[0_-14px_36px_-18px_#000] backdrop-blur-xl backdrop-saturate-150 lg:hidden">
      <div aria-hidden="true" className="h-1 bg-ash-950">
        <div
          className={
            report.hasBeatenBuffet
              ? 'h-full bg-linear-to-r from-sesame-600 to-sesame-400 shadow-[0_0_10px_0_var(--color-sesame-500)] transition-[width] duration-350 ease-out-soft'
              : 'h-full bg-linear-to-r from-char-600 via-ember-600 to-ember-400 shadow-[0_0_10px_0_var(--color-ember-500)] transition-[width] duration-350 ease-out-soft'
          }
          style={{ width: `${fill}%` }}
        />
      </div>

      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5"
        style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
      >
        <div className="min-w-0">
          <p className="tabular text-sm font-bold text-cream-50">
            {formatMoney(report.totalRetailValue, pricingProfile.money)}
            <span className="font-normal text-cream-700">
              {' '}
              / {formatMoney(report.totalAdmission, pricingProfile.money)}
            </span>
          </p>
          <p className="tabular truncate text-xs text-cream-500">
            {formatPlates(report.totalPlates)} · {formatPercent(report.retailRecoveryPercent)}{' '}
            recovered
          </p>
        </div>
        <Button onClick={onCalculate} className="shrink-0">
          Calculate
        </Button>
      </div>
    </div>
  );
}
