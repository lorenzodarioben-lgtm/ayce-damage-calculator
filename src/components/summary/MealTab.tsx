'use client';

import { MealTabItem } from '@/components/summary/MealTabItem';
import type { Diner } from '@/types/meal';
import type { LineItemTotals } from '@/types/meal';

interface MealTabProps {
  lines: readonly LineItemTotals[];
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onConsumptionChange: (id: string, consumed: number) => void;
  onChargeChange: (id: string, separate: boolean, charge?: number) => void;
  onSharedAmongChange: (id: string, sharedAmong: readonly string[]) => void;
  diners: readonly Diner[];
  onRemove: (id: string) => void;
}

export function MealTab({
  lines,
  onIncrement,
  onDecrement,
  onConsumptionChange,
  onChargeChange,
  onSharedAmongChange,
  diners,
  onRemove,
}: MealTabProps) {
  if (lines.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-line bg-ash-900/60 px-4 py-6 text-center">
        <p className="display-type text-lg text-cream-300">No damage yet</p>
        <p className="mt-1 text-sm text-cream-700">
          Add your first plate to begin the investigation.
        </p>
      </div>
    );
  }

  return (
    <ul className="max-h-[38vh] overflow-y-auto overscroll-contain lg:max-h-[30vh]">
      {lines.map((line) => (
        <MealTabItem
          key={line.item.id}
          line={line}
          onIncrement={onIncrement}
          onDecrement={onDecrement}
          onConsumptionChange={onConsumptionChange}
          onChargeChange={onChargeChange}
          onSharedAmongChange={onSharedAmongChange}
          diners={diners}
          onRemove={onRemove}
        />
      ))}
    </ul>
  );
}
