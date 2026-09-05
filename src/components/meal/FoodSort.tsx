'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';
import type { FoodSortKey } from '@/data/foods';

interface FoodSortProps {
  value: FoodSortKey;
  onChange: (key: FoodSortKey) => void;
}

const OPTIONS: ReadonlyArray<{ key: FoodSortKey; label: string; description: string }> = [
  { key: 'menu', label: 'Menu', description: 'Show cuts in menu order' },
  { key: 'value', label: 'Value', description: 'Show the dearest retail price per kilogram first' },
];

/**
 * Reorders the picker.
 *
 * Value ordering is the one concession to min-maxing the app makes: the prices
 * are already on every card, so sorting by them tells the diner nothing the
 * menu did not, only faster.
 */
export function FoodSort({ value, onChange }: FoodSortProps) {
  const labelId = useId();

  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className="micro-label">
        Order by
      </span>
      <div role="group" aria-labelledby={labelId} className="segmented-track flex gap-1 p-1">
        {OPTIONS.map((option) => {
          const selected = option.key === value;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={selected}
              aria-label={option.description}
              onClick={() => onChange(option.key)}
              className={cn(
                'min-h-9 cursor-pointer rounded-[9px] px-3 text-xs font-semibold uppercase tracking-[0.08em]',
                'transition-[background-color,color,box-shadow] duration-200',
                selected
                  ? 'segmented-thumb'
                  : 'text-cream-500 hover:bg-ash-800 hover:text-cream-100',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-400',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
