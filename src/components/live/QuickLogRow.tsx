'use client';

import { useId, useState } from 'react';
import { Minus, Plus, Trash2, Utensils } from 'lucide-react';
import { getPlateSizeMeta, getQualityMeta } from '@/lib/constants';
import { CONSUMPTION_STEP, formatPlateQuantity } from '@/lib/consumption';
import { formatMoney, formatWeight } from '@/lib/formatting';
import type { LineItemTotals } from '@/types/meal';

interface QuickLogRowProps {
  line: LineItemTotals;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onConsumptionChange: (id: string, consumed: number) => void;
  onRemove: (id: string) => void;
}

/**
 * One cut, logged with a thumb.
 *
 * The add target is deliberately oversized and the destructive controls are
 * small and set apart: this is used one-handed, at a table, in poor light.
 */
export function QuickLogRow({
  line,
  onIncrement,
  onDecrement,
  onConsumptionChange,
  onRemove,
}: QuickLogRowProps) {
  const { item, food } = line;
  const descriptor = `${food.name}, ${getQualityMeta(item.quality).label}, ${getPlateSizeMeta(item.plateSize).label}`;
  const left = line.uneatenPlates > 0;
  const [open, setOpen] = useState(false);
  const consumptionPanelId = useId();
  // Only ever unfolded on purpose, or because there is already something to
  // show. The one-tap journey is what this screen is for.
  const expanded = open || left;

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
          <p className="text-xs text-cream-700">
            {line.hasWeight ? formatWeight(line.weightG) : 'Not weighed'}
          </p>
          {left && (
            <p className="text-xs text-cream-500">{formatPlateQuantity(line.uneatenPlates)} left</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => onIncrement(item.id)}
          aria-label={`Add one plate of ${descriptor}`}
          className="flex min-h-16 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-ember-500 text-base font-bold uppercase tracking-[0.1em] text-ash-950 transition-[background-color,transform] duration-200 ease-out-soft hover:bg-ember-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-300 active:scale-[0.985] active:bg-ember-600"
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
          className="flex min-h-16 w-14 cursor-pointer items-center justify-center rounded-[12px] border border-line bg-ash-800 text-cream-300 transition-colors duration-200 hover:border-ember-700 hover:text-cream-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus size={20} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={expanded}
          aria-controls={consumptionPanelId}
          aria-label={`Record how much of ${descriptor} was eaten`}
          className="flex min-h-16 w-14 cursor-pointer items-center justify-center rounded-[12px] border border-transparent text-cream-700 transition-colors duration-200 hover:border-line hover:bg-ash-800 hover:text-cream-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-400"
        >
          <Utensils size={18} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${descriptor} from your tab`}
          className="flex min-h-16 w-14 cursor-pointer items-center justify-center rounded-[12px] border border-transparent text-cream-700 transition-colors duration-200 hover:border-char-700 hover:bg-char-700/20 hover:text-char-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-char-500"
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <div
          id={consumptionPanelId}
          className="mt-3 rounded-[12px] border border-line-soft bg-ash-900 px-3 py-2"
        >
          <div className="tabular flex items-baseline justify-between gap-2 text-xs text-cream-500">
            <span className="text-cream-300">Eaten</span>
            <span>
              {formatPlateQuantity(line.consumedPlates)} of {line.plates}
            </span>
          </div>
          <input
            aria-label={`Plates of ${descriptor} eaten`}
            type="range"
            min={0}
            max={line.plates}
            step={CONSUMPTION_STEP}
            value={line.consumedPlates}
            aria-valuetext={`${formatPlateQuantity(line.consumedPlates)} of ${line.plates} plates eaten`}
            onChange={(event) => onConsumptionChange(item.id, Number(event.target.value))}
            className="mt-1.5 h-8 w-full cursor-pointer accent-[var(--color-ember-500)]"
          />
        </div>
      )}
    </li>
  );
}
