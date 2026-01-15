import type { PlateSize, QualityTier } from '@/types/meal';

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
