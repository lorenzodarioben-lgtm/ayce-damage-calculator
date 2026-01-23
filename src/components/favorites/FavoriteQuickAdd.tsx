'use client';

import { Plus, Star, X } from 'lucide-react';
import { FOODS } from '@/data/foods';
import { getPlateSizeMeta, getQualityMeta } from '@/lib/constants';
import { findFoodInCatalogue } from '@/lib/foodCatalogue';
import { describeFavorite, type MealFavorite } from '@/lib/favorites';
import type { AddItemPayload } from '@/hooks/useMealSession';
import type { FoodItem } from '@/types/meal';

interface FavoriteQuickAddProps {
  favorites: readonly MealFavorite[];
  onAdd: (payload: AddItemPayload, confirmation: string) => void;
  onRemove: (id: string) => void;
  foods?: readonly FoodItem[];
  /** Larger targets for the at-the-table surface. */
  size?: 'compact' | 'large';
}

/**
 * One tap to put a saved configuration on the tab.
 *
 * Nothing here duplicates the food dataset: a favourite stores ids only, and
 * the name, grade and portion are looked up at render time. A cut removed from
 * the dataset therefore disappears from the strip rather than rendering blank.
 */
export function FavoriteQuickAdd({
  favorites,
  onAdd,
  onRemove,
  foods = FOODS,
  size = 'compact',
}: FavoriteQuickAddProps) {
  if (favorites.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-line bg-ash-900/60 px-4 py-3 text-center text-xs leading-relaxed text-cream-700">
        No saved orders yet. Use the star beside a configured cut to keep it here for next time.
      </p>
    );
  }

  const padding = size === 'large' ? 'min-h-14 px-4' : 'min-h-11 px-3';

  return (
    <ul className="flex flex-wrap gap-2">
      {favorites.map((favorite) => {
        const food = findFoodInCatalogue(foods, favorite.foodId);
        const description = describeFavorite(favorite, foods);
        if (!food || !description) {
          return null;
        }

        return (
          <li key={favorite.id} className="relative">
            <button
              type="button"
              onClick={() =>
                onAdd(
                  {
                    foodId: favorite.foodId,
                    quality: favorite.quality,
                    plateSize: favorite.plateSize,
                    quantity: 1,
                  },
                  `1 plate of ${food.name} added to your tab.`,
                )
              }
              aria-label={`Add one plate of ${description}`}
              className={`flex cursor-pointer items-center gap-2 rounded-[10px] border border-line-ember bg-ash-850 pr-9 text-left transition-colors duration-200 hover:bg-ash-800 ${padding}`}
            >
              <Plus
                size={15}
                strokeWidth={3}
                aria-hidden="true"
                className="shrink-0 text-ember-400"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-cream-50">{food.name}</span>
                <span className="block text-[0.7rem] text-cream-500">
                  {getQualityMeta(favorite.quality).label} ·{' '}
                  {getPlateSizeMeta(favorite.plateSize).label}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => onRemove(favorite.id)}
              aria-label={`Remove ${description} from saved orders`}
              className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-cream-700 transition-colors duration-200 hover:bg-char-700/25 hover:text-char-500"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface FavoriteToggleProps {
  active: boolean;
  onToggle: () => void;
  /** Names the configuration being saved, for assistive technology. */
  description: string;
}

/** The star that puts the currently configured cut into the strip. */
export function FavoriteToggle({ active, onToggle, description }: FavoriteToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      // The name stays constant and aria-pressed carries the state, which is
      // the correct toggle pattern and keeps it distinct from the strip's own
      // remove control.
      aria-label={`Save ${description} as a quick order`}
      className={`flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border transition-colors duration-200 ${
        active
          ? 'border-ember-500 bg-ash-800 text-ember-400'
          : 'border-line bg-ash-800 text-cream-500 hover:border-ember-700 hover:text-cream-100'
      }`}
    >
      <Star size={20} aria-hidden="true" fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}
