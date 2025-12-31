'use client';

import { Receipt } from 'lucide-react';
import { DamageMeter } from '@/components/summary/DamageMeter';
import { MealTab } from '@/components/summary/MealTab';
import { Button } from '@/components/ui/Button';
import { formatCount, formatKg, formatMoney, formatPlates } from '@/lib/formatting';
import type { DamageReport } from '@/types/meal';

interface LiveSummaryProps {
  report: DamageReport;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onCalculate: () => void;
  onReset: () => void;
}

export function LiveSummary({
  report,
  onIncrement,
  onDecrement,
  onRemove,
  onCalculate,
  onReset,
}: LiveSummaryProps) {
  const hasItems = report.lines.length > 0;

  return (
    <section aria-labelledby="tab-heading" className="panel p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="tab-heading" className="display-type text-2xl text-cream-50">
          Your tab
        </h2>
        <p className="tabular text-xs text-cream-700">{formatPlates(report.totalPlates)}</p>
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
        <p className="tabular mt-3 rounded-[8px] border border-line-soft bg-ash-900 px-3 py-2 text-xs text-cream-500">
          ~{formatCount(report.platesToBreakEven)} average{' '}
          {report.platesToBreakEven === 1 ? 'plate' : 'plates'} to retail break-even
        </p>
      )}

      <dl className="tabular mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-y border-line-soft py-4">
        <div>
          <dt className="micro-label">Eaten</dt>
          <dd className="text-lg font-bold text-cream-50">{formatKg(report.totalWeightKg)}</dd>
        </div>
        <div>
          <dt className="micro-label">Admission</dt>
          <dd className="text-lg font-bold text-cream-50">{formatMoney(report.totalAdmission)}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <MealTab
          lines={report.lines}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
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
