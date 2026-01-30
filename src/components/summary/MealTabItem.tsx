'use client';

import { useState } from 'react';
import { Trash2, Utensils } from 'lucide-react';
import { QuantityStepper } from '@/components/meal/QuantityStepper';
import { MAX_LINE_QUANTITY, MIN_QUANTITY, getPlateSizeMeta, getQualityMeta } from '@/lib/constants';
import { CONSUMPTION_STEP, formatPlateQuantity } from '@/lib/consumption';
import { formatMoney, formatPlates, formatWeight } from '@/lib/formatting';
import { usePricingProfile } from '@/components/session/PricingContext';
import type { LineItemTotals } from '@/types/meal';

interface MealTabItemProps {
  line: LineItemTotals;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onConsumptionChange: (id: string, consumed: number) => void;
  onRemove: (id: string) => void;
}

/**
 * One tab line, with an optional statement about how much of it was eaten.
 *
 * The control stays folded away behind an explicit action, because the fast
 * journey is unchanged: log a plate, and it is a plate you ate. Only someone
 * who actually left something has any reason to open it, and the wording stays
 * on the food — what arrived and what is left — rather than on the person.
 */
export function MealTabItem({
  line,
  onIncrement,
  onDecrement,
  onConsumptionChange,
  onRemove,
}: MealTabItemProps) {
  const pricingProfile = usePricingProfile();
  const { item, food } = line;
  const descriptor = `${food.name}, ${getQualityMeta(item.quality).label}, ${getPlateSizeMeta(item.plateSize).label}`;
  const left = line.uneatenPlates > 0;
  const [open, setOpen] = useState(false);
  const expanded = open || left;

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
          {left && (
            <p className="tabular mt-0.5 text-xs text-cream-500">
              {formatPlateQuantity(line.consumedPlates)} eaten ·{' '}
              {formatPlateQuantity(line.uneatenPlates)} left
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular text-sm font-bold text-ember-400">
            {formatMoney(line.retailValue, pricingProfile.money)}
          </p>
          {left && (
            <p className="tabular text-xs text-cream-700">
              of {formatMoney(line.orderedRetailValue, pricingProfile.money)} ordered
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1.5">
        {!left && (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={expanded}
            aria-label={`Record how much of ${descriptor} was eaten`}
            className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-transparent text-cream-700 transition-colors duration-200 hover:border-line hover:bg-ash-800 hover:text-cream-300"
          >
            <Utensils size={15} aria-hidden="true" />
          </button>
        )}
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

      {expanded && (
        <div className="mt-2 rounded-[10px] border border-line-soft bg-ash-900 px-3 py-2">
          <div className="tabular flex items-baseline justify-between gap-2 text-xs text-cream-500">
            <span className="text-cream-300">Eaten</span>
            <span>
              {formatPlateQuantity(line.consumedPlates)} of {line.plates}
            </span>
          </div>
          {/*
            Named for its own line rather than just "Eaten": a tab has one of
            these per cut, and four identically named sliders would tell a
            screen reader nothing about which plate it was adjusting.
          */}
          <input
            type="range"
            aria-label={`Plates of ${descriptor} eaten`}
            min={0}
            max={line.plates}
            step={CONSUMPTION_STEP}
            value={line.consumedPlates}
            onChange={(event) => onConsumptionChange(item.id, Number(event.target.value))}
            className="mt-1.5 h-6 w-full cursor-pointer accent-[var(--color-ember-500)]"
          />
          <p className="text-xs leading-relaxed text-cream-700">
            Slide it down if some went back. Ordered value is still counted separately, so the tab
            keeps saying what reached the table.
          </p>
        </div>
      )}
    </li>
  );
}
