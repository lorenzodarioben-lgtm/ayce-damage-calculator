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
        'group relative flex h-full cursor-pointer flex-col gap-2 rounded-card border p-3 text-left',
        'transition-[border-color,background-color,transform,box-shadow] duration-200 ease-out-soft',
        'active:scale-[0.99] sm:p-4',
        selected
          ? 'border-ember-500 bg-ash-800 shadow-[0_0_0_1px_var(--color-ember-500),0_10px_30px_-12px_#000]'
          : 'border-line bg-ash-850 hover:border-ember-700 hover:bg-ash-800',
      )}
    >
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

      <FoodIllustration food={food} className="h-20 w-20 shrink-0 sm:h-24 sm:w-24" />

      <span className="display-type text-[1.05rem] leading-none text-cream-50 sm:text-[1.25rem]">
        {food.name}
      </span>

      <span className="text-[0.78rem] leading-snug text-cream-500 sm:text-[0.82rem]">
        {food.description}
      </span>

      <span className="tabular mt-auto pt-1 text-[0.72rem] font-semibold tracking-wide text-ember-400">
        ~{formatUnitPrice(pricing, pricingProfile.money)} retail
      </span>
    </button>
  );
}
