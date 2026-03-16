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
        // A row on a phone and a card above it. Seven cuts as tall two-column
        // cards was most of a screen of scrolling before the first plate could
        // be added; as rows they are a list you can thumb down.
        'group relative flex h-full cursor-pointer items-center gap-3 overflow-hidden rounded-surface border p-3 text-left',
        'sm:flex-col sm:items-stretch sm:gap-2',
        'transition-[border-color,background-color,transform,box-shadow] duration-160 ease-out-soft',
        // Lifts a pixel under the pointer and settles back under the press, so
        // the card behaves like something on the page rather than a hit area.
        'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] sm:p-4',
        selected
          ? 'border-ember-500 bg-ash-800 elevate-selected'
          : 'border-line bg-ash-850 elevate-panel hover:border-line-strong hover:bg-ash-800 hover:elevate-raised',
      )}
    >
      {/* The light the cut is sitting under. Warms on hover and stays warm
          while the card is the selected one, so the grid has an obvious focus
          without the selected card having to be a different colour. */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -top-10 left-1/2 h-32 w-40 -translate-x-1/2 rounded-full blur-2xl transition-opacity duration-160',
          'bg-[radial-gradient(circle,var(--color-ember-500)_0%,transparent_70%)]',
          selected ? 'opacity-25' : 'opacity-0 group-hover:opacity-15',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full border transition-opacity duration-160',
          selected
            ? 'border-ember-500 bg-ember-500 text-ash-950 opacity-100'
            : 'border-line bg-ash-900 text-transparent opacity-0 group-hover:opacity-60',
        )}
      >
        <Check size={14} strokeWidth={3} />
      </span>

      <FoodIllustration
        food={food}
        className="relative h-16 w-16 shrink-0 elevate-illustration transition-transform duration-160 ease-out-soft group-hover:scale-[1.05] sm:h-28 sm:w-28"
      />

      <span className="relative flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-none sm:gap-2">
        <span className="display-type text-lead leading-tight text-cream-50">{food.name}</span>

        <span className="line-clamp-2 text-ui leading-snug text-cream-500 sm:line-clamp-none">
          {food.description}
        </span>

        {/* The one figure worth comparing between two cuts, so it is findable
            at a glance rather than read out of a sentence. */}
        <span className="tabular mt-0.5 text-caption font-semibold text-cream-100 sm:mt-auto sm:pt-2">
          ~{formatUnitPrice(pricing, pricingProfile.money)} retail
        </span>
      </span>
    </button>
  );
}
