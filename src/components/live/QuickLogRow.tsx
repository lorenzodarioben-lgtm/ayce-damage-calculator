'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { getPlateSizeMeta, getQualityMeta } from '@/lib/constants';
import { formatMoney, formatWeight } from '@/lib/formatting';
import type { LineItemTotals } from '@/types/meal';

interface QuickLogRowProps {
  line: LineItemTotals;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
}

/**
 * One cut, logged with a thumb.
 *
 * The add target is deliberately oversized and the destructive controls are
 * small and set apart: this is used one-handed, at a table, in poor light.
 */
export function QuickLogRow({ line, onIncrement, onDecrement, onRemove }: QuickLogRowProps) {
  const { item, food } = line;
  const descriptor = `${food.name}, ${getQualityMeta(item.quality).label}, ${getPlateSizeMeta(item.plateSize).label}`;

  return (
    <li className="panel p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="display-type text-xl leading-tight text-cream-50">{food.name}</p>
          <p className="mt-1 text-xs text-cream-500">
            {getQualityMeta(item.quality).label} · {getPlateSizeMeta(item.plateSize).label}
          </p>
        </div>
        <div className="tabular shrink-0 text-right">
          <p className="text-sm font-bold text-ember-400">{formatMoney(line.retailValue)}</p>
          <p className="text-xs text-cream-700">{formatWeight(line.weightG)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => onIncrement(item.id)}
          aria-label={`Add one plate of ${descriptor}`}
          className="flex min-h-16 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-ember-500 text-base font-bold uppercase tracking-[0.1em] text-ash-950 transition-[background-color,transform] duration-200 ease-out-soft hover:bg-ember-400 active:scale-[0.985] active:bg-ember-600"
        >
          <Plus size={20} strokeWidth={3} aria-hidden="true" />
          <span>
            1 plate
            <span aria-hidden="true" className="ml-2 tabular font-black">
              ×{item.quantity}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onDecrement(item.id)}
          disabled={item.quantity <= 1}
          aria-label={`Remove one plate of ${descriptor}`}
          className="flex min-h-16 w-14 cursor-pointer items-center justify-center rounded-[12px] border border-line bg-ash-800 text-cream-300 transition-colors duration-200 hover:border-ember-700 hover:text-cream-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus size={20} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${descriptor} from your tab`}
          className="flex min-h-16 w-14 cursor-pointer items-center justify-center rounded-[12px] border border-transparent text-cream-700 transition-colors duration-200 hover:border-char-700 hover:bg-char-700/20 hover:text-char-500"
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
