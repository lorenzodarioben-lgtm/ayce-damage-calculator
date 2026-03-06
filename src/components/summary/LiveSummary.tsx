'use client';

import { Receipt } from 'lucide-react';
import { DamageMeter } from '@/components/summary/DamageMeter';
import { MealTab } from '@/components/summary/MealTab';
import { Button } from '@/components/ui/Button';
import { formatCount, formatKg, formatMoney, formatPlates } from '@/lib/formatting';
import { usePricingProfile } from '@/components/session/PricingContext';
import type { Diner } from '@/types/meal';
import type { DamageReport } from '@/types/meal';

interface LiveSummaryProps {
  report: DamageReport;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onConsumptionChange: (id: string, consumed: number) => void;
  onChargeChange: (id: string, separate: boolean, charge?: number) => void;
  onSharedAmongChange: (id: string, sharedAmong: readonly string[]) => void;
  diners: readonly Diner[];
  onRemove: (id: string) => void;
  onCalculate: () => void;
  onReset: () => void;
}

export function LiveSummary({
  report,
  onIncrement,
  onDecrement,
  onConsumptionChange,
  onChargeChange,
  onSharedAmongChange,
  diners,
  onRemove,
  onCalculate,
  onReset,
}: LiveSummaryProps) {
  const pricingProfile = usePricingProfile();
  const hasItems = report.lines.length > 0;

  return (
    /* The tab is the one panel on the calculator that outranks the others: it
       is where the answer accumulates, so it is raised rather than level with
       the form it is reading from. */
    <section aria-labelledby="tab-heading" className="panel-raised p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
        <h2 id="tab-heading" className="display-type text-2xl text-cream-50">
          Your tab
        </h2>
        <p className="tabular rounded-full border border-line bg-ash-950/60 px-2.5 py-1 text-xs text-cream-500">
          {formatPlates(report.totalPlates)}
        </p>
      </div>

      <div className="mt-4">
        <DamageMeter
          retailValue={report.totalRetailValue}
          totalAdmission={report.totalAdmission}
          recoveryPercent={report.retailRecoveryPercent}
          remainingGap={report.remainingRetailGap}
        />
      </div>

      {hasItems && !report.hasBeatenBuffet && report.platesToBreakEven > 0 && (
        <p className="well tabular mt-3 px-3 py-2 text-xs text-cream-500">
          ~{formatCount(report.platesToBreakEven)} average{' '}
          {report.platesToBreakEven === 1 ? 'plate' : 'plates'} to retail break-even
        </p>
      )}

      {/* Two figures worth reading at a glance, so they are given tiles of
          their own rather than a row of a definition list nobody scans. */}
      <dl className="tabular mt-4 grid grid-cols-2 gap-2">
        <div className="well px-3 py-2.5">
          <dt className="micro-label">Eaten</dt>
          <dd className="mt-0.5 text-lg font-bold text-cream-50">
            {formatKg(report.totalWeightKg)}
          </dd>
        </div>
        <div className="well px-3 py-2.5">
          <dt className="micro-label">Admission</dt>
          <dd className="mt-0.5 text-lg font-bold text-cream-50">
            {formatMoney(report.totalAdmission, pricingProfile.money)}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <MealTab
          lines={report.lines}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          onConsumptionChange={onConsumptionChange}
          onChargeChange={onChargeChange}
          onSharedAmongChange={onSharedAmongChange}
          diners={diners}
          onRemove={onRemove}
        />
      </div>

      <div className="mt-4 space-y-2">
        <Button size="lg" fullWidth onClick={onCalculate} disabled={!hasItems}>
          <Receipt size={18} aria-hidden="true" />
          Calculate the damage
        </Button>
        <Button variant="danger" fullWidth onClick={onReset}>
          Reset session
        </Button>
      </div>
    </section>
  );
}
