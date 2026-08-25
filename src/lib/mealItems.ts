import { MAX_LINE_QUANTITY } from '@/lib/constants';
import { consumedQuantity, withConsumedQuantity } from '@/lib/consumption';
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
    if (!existing) {
      byId.set(id, { ...item, id });
      continue;
    }
    const allocations = [...(existing.allocations ?? []), ...(item.allocations ?? [])];
    const quantity = Math.min(MAX_LINE_QUANTITY, existing.quantity + item.quantity);
    // Eaten amounts add up like the plates do, so merging two halves of the
    // same line cannot lose or invent food. Clamping is left to the helper,
    // which also drops the key again when the merged line went clean.
    const consumed = consumedQuantity(existing) + consumedQuantity(item);
    byId.set(
      id,
      withConsumedQuantity(
        {
          ...existing,
          quantity,
          ...(allocations.length ? { allocations } : {}),
        },
        consumed,
      ),
    );
  }

  return [...byId.values()];
}
