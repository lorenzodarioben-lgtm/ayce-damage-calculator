'use client';

import { Trash2 } from 'lucide-react';
import { QuantityStepper } from '@/components/meal/QuantityStepper';
import { MAX_LINE_QUANTITY, MIN_QUANTITY, getPlateSizeMeta, getQualityMeta } from '@/lib/constants';
import { formatMoney, formatPlates, formatWeight } from '@/lib/formatting';
import type { LineItemTotals } from '@/types/meal';

interface MealTabItemProps {
  line: LineItemTotals;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
}

export function MealTabItem({ line, onIncrement, onDecrement, onRemove }: MealTabItemProps) {
  const { item, food } = line;
  const descriptor = `${food.name}, ${getQualityMeta(item.quality).label}, ${getPlateSizeMeta(item.plateSize).label}`;

  return (
    <li className="border-b border-line-soft py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        {/* The name is given the full row width; cut-off cut names read as bugs. */}
        <div className="min-w-0">
          <p className="text-sm font-bold text-cream-50">{food.name}</p>
          <p className="text-xs text-cream-500">
            {getQualityMeta(item.quality).label} · {getPlateSizeMeta(item.plateSize).label}
          </p>
          <p className="tabular mt-0.5 text-xs text-cream-700">
            {formatPlates(line.plates)} · {formatWeight(line.weightG)}
          </p>
        </div>
        <p className="tabular shrink-0 text-sm font-bold text-ember-400">
          {formatMoney(line.retailValue)}
        </p>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1.5">
        <QuantityStepper
          size="sm"
          label={`plates of ${descriptor}`}
          value={item.quantity}
          min={MIN_QUANTITY}
          max={MAX_LINE_QUANTITY}
          onIncrement={() => onIncrement(item.id)}
          onDecrement={() => onDecrement(item.id)}
          decrementLabel={`Remove one plate of ${descriptor}`}
          incrementLabel={`Add one plate of ${descriptor}`}
        />
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${descriptor} from your tab`}
          className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-transparent text-cream-700 transition-colors duration-200 hover:border-char-700 hover:bg-char-700/20 hover:text-char-500"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
