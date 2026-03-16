'use client';

import { Receipt } from 'lucide-react';
import { DamageMeter } from '@/components/summary/DamageMeter';
import { Button } from '@/components/ui/Button';
import type { DamageReport } from '@/types/meal';

interface StickySummaryBarProps {
  report: DamageReport;
  onCalculate: () => void;
}

/**
 * The reading, where it is actually read.
 *
 * This used to be a four-pixel unlabelled progress bar with a total beside it,
 * which is what the product's own answer had been reduced to on the only device
 * anybody uses it on. It is the reading now — label, value pair, calibrated
 * track, break-even datum and the figure itself — pinned to the bottom edge
 * where a thumb can reach it and an eye can find it across a table.
 *
 * Below `lg` only. On a wide screen the same reading sits at the top of the
 * rail, where there is room for it to stay in view without covering anything.
 */
export function StickySummaryBar({ report, onCalculate }: StickySummaryBarProps) {
  if (report.lines.length === 0) {
    return null;
  }

  return (
    <div
      className="elevate-float fixed inset-x-0 bottom-0 z-30 border-t border-line-ember bg-ash-900/95 backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <DamageMeter
        retailValue={report.totalRetailValue}
        totalAdmission={report.totalAdmission}
        recoveryPercent={report.retailRecoveryPercent}
        remainingGap={report.remainingRetailGap}
        variant="bar"
      />

      {/* Named "Calculate" rather than "Calculate the damage": the tab in the
          rail already owns that name, and below `lg` both are in the document
          at once. Two controls answering to one name is ambiguous to a screen
          reader before it is ambiguous to a test. */}
      <div className="px-4 pb-1 pt-2.5">
        <Button fullWidth onClick={onCalculate}>
          <Receipt size={18} aria-hidden="true" />
          Calculate
        </Button>
      </div>
    </div>
  );
}
