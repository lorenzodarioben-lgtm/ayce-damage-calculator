'use client';

import { cn } from '@/lib/cn';
import type { Diner } from '@/types/meal';

interface DinerAttributionProps {
  readonly diners: readonly Diner[];
  readonly activeDinerId: string | null;
  readonly onChange: (id: string | null) => void;
}

export function DinerAttribution({ diners, activeDinerId, onChange }: DinerAttributionProps) {
  if (diners.length === 0) return null;
  return (
    <div className="mb-4" role="group" aria-label="Plate attribution">
      <p className="micro-label mb-2">Log plates to</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[{ id: null, displayName: 'Table' }, ...diners].map((target) => {
          const active = target.id === activeDinerId;
          return (
            <button
              key={target.id ?? 'table'}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(target.id)}
              className={cn(
                'min-h-10 shrink-0 cursor-pointer rounded-full border px-3 text-sm font-semibold transition-colors',
                active
                  ? 'border-ember-500 bg-ember-500 text-ash-950'
                  : 'border-line bg-ash-900 text-cream-300 hover:border-ember-700',
              )}
            >
              {target.displayName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
