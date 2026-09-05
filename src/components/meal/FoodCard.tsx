'use client';

import { Check } from 'lucide-react';
import { FoodIllustration } from '@/components/meal/FoodIllustration';
import { usePricingProfile } from '@/components/session/PricingContext';
import { cn } from '@/lib/cn';
import { formatUnitPrice } from '@/lib/formatting';
import { resolveFoodPricing } from '@/lib/pricing';
import type { FoodItem } from '@/types/meal';

interface FoodCardProps {
  food: FoodItem;
  selected: boolean;
  onSelect: (foodId: string) => void;
}

export function FoodCard({ food, selected, onSelect }: FoodCardProps) {
  const pricingProfile = usePricingProfile();
  const pricing = resolveFoodPricing(food, pricingProfile);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(food.id)}
      className={cn(
        'group relative flex h-full cursor-pointer flex-col gap-2 overflow-hidden rounded-panel border p-3 text-left',
        'transition-[border-color,background-color,transform,box-shadow] duration-200 ease-out-soft',
        // Lifts a pixel under the pointer and settles back under the press, so
        // the card behaves like something on the page rather than a hit area.
        'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] sm:p-4',
        selected
          ? 'border-ember-500 bg-ash-800 shadow-[inset_0_1px_0_rgb(255_250_240/0.08),0_0_0_1px_var(--color-ember-500),0_14px_34px_-16px_#000,0_0_26px_-10px_var(--color-ember-500)]'
          : 'border-line bg-ash-850 shadow-[var(--shadow-panel)] hover:border-ember-700 hover:bg-ash-800 hover:shadow-[var(--shadow-raised)]',
      )}
    >
      {/* The light the cut is sitting under. Warms on hover and stays warm
          while the card is the selected one, so the grid has an obvious focus
          without the selected card having to be a different colour. */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -top-10 left-1/2 h-32 w-40 -translate-x-1/2 rounded-full blur-2xl transition-opacity duration-300',
          'bg-[radial-gradient(circle,var(--color-ember-500)_0%,transparent_70%)]',
          selected ? 'opacity-25' : 'opacity-0 group-hover:opacity-15',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full border transition-opacity duration-200',
          selected
            ? 'border-ember-500 bg-ember-500 text-ash-950 opacity-100'
            : 'border-line bg-ash-900 text-transparent opacity-0 group-hover:opacity-60',
        )}
      >
        <Check size={14} strokeWidth={3} />
      </span>

      <FoodIllustration
        food={food}
        className="relative h-24 w-24 shrink-0 drop-shadow-[0_6px_14px_rgb(0_0_0/0.55)] transition-transform duration-300 ease-out-soft group-hover:scale-[1.05] sm:h-28 sm:w-28"
      />

      <span className="display-type relative text-[1.1rem] leading-tight text-cream-50 sm:text-[1.3rem]">
        {food.name}
      </span>

      <span className="relative text-[0.78rem] leading-snug text-cream-500 sm:text-[0.82rem]">
        {food.description}
      </span>

      {/* A badge rather than a line of text: it is the one figure worth
          comparing between two cards, and it should be findable at a glance. */}
      <span className="relative mt-auto pt-2">
        <span className="tabular inline-flex items-center rounded-full border border-line-ember bg-ash-950/70 px-2.5 py-1 text-[0.72rem] font-semibold tracking-wide text-ember-300">
          ~{formatUnitPrice(pricing, pricingProfile.money)} retail
        </span>
      </span>
    </button>
  );
}
