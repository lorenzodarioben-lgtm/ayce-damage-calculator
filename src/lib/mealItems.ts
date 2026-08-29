import { MAX_LINE_QUANTITY } from '@/lib/constants';
import { consumedQuantity, withConsumedQuantity } from '@/lib/consumption';
import { hasUnpricedCharge, separateCharge } from '@/lib/separateCharges';
import type { MealItem, PlateSize, QualityTier } from '@/types/meal';

/**
 * The identity of a tab line is its complete configuration. Sharing this
 * derivation keeps reducer lines, favourites and restored records aligned.
 *
 * Who paid for it is part of that configuration. A ribeye the buffet price
 * covered and a ribeye charged on top are two different lines on a real bill,
 * and merging them would fold an extra's value back into the buffet's — losing
 * the one distinction the separate charge exists to keep.
 */
export function mealItemId(config: {
  foodId: string;
  quality: QualityTier;
  plateSize: PlateSize;
  separatelyCharged?: true;
}): string {
  const base = `${config.foodId}__${config.quality}__${config.plateSize}`;
  return config.separatelyCharged === true ? `${base}__extra` : base;
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
    // Two halves of the same extra were paid for twice, so their prices add up
    // the way their plates do.
    const charge = separateCharge(existing) + separateCharge(item);
    byId.set(
      id,
      withConsumedQuantity(
        {
          ...existing,
          quantity,
          ...(allocations.length ? { allocations } : {}),
          ...(existing.separatelyCharged === true && (charge > 0 || !hasUnpricedCharge(existing))
            ? { separateCharge: charge }
            : {}),
        },
        consumed,
      ),
    );
  }

  return [...byId.values()];
}
