import { MAX_LINE_QUANTITY } from '@/lib/constants';
import type { MealItem, PlateSize, QualityTier } from '@/types/meal';

/**
 * The identity of a tab line is its complete configuration. Sharing this
 * derivation keeps reducer lines, favourites and restored records aligned.
 */
export function mealItemId(config: {
  foodId: string;
  quality: QualityTier;
  plateSize: PlateSize;
}): string {
  return `${config.foodId}__${config.quality}__${config.plateSize}`;
}

/** Combines equivalent configurations while preserving the first-seen order. */
export function mergeMealItems(items: readonly MealItem[]): readonly MealItem[] {
  const byId = new Map<string, MealItem>();

  for (const item of items) {
    const id = mealItemId(item);
    const existing = byId.get(id);
    byId.set(
      id,
      existing
        ? { ...existing, quantity: Math.min(MAX_LINE_QUANTITY, existing.quantity + item.quantity) }
        : { ...item, id },
    );
  }

  return [...byId.values()];
}
