'use client';

import { useId, useMemo, useState } from 'react';
import { CategoryTabs } from '@/components/meal/CategoryTabs';
import { FoodCard } from '@/components/meal/FoodCard';
import { PlateSizeSelector } from '@/components/meal/PlateSizeSelector';
import { QualitySelector } from '@/components/meal/QualitySelector';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { foodsInCategory } from '@/data/foods';
import { DEFAULT_PLATE_SIZE, DEFAULT_QUALITY } from '@/lib/constants';
import type { AddItemPayload } from '@/hooks/useMealSession';
import type { FoodCategory, PlateSize, QualityTier } from '@/types/meal';

interface AddCutDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (payload: AddItemPayload) => void;
}

/**
 * Puts a new cut on the quick-log list.
 *
 * The same selectors as the full builder, so a cut configured here is
 * indistinguishable from one configured there — there is only one meal model.
 */
export function AddCutDialog({ open, onClose, onAdd }: AddCutDialogProps) {
  const titleId = useId();
  const panelId = useId();

  const [category, setCategory] = useState<FoodCategory>('beef');
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityTier>(DEFAULT_QUALITY);
  const [plateSize, setPlateSize] = useState<PlateSize>(DEFAULT_PLATE_SIZE);

  const foods = useMemo(() => foodsInCategory(category), [category]);

  function handleAdd() {
    if (!selectedFoodId) {
      return;
    }
    onAdd({ foodId: selectedFoodId, quality, plateSize, quantity: 1 });
    setSelectedFoodId(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add a cut" labelledById={titleId}>
      <CategoryTabs
        value={category}
        onChange={(next) => {
          setCategory(next);
          setSelectedFoodId(null);
        }}
        panelId={panelId}
      />

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`category-tab-${category}`}
        tabIndex={-1}
        className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {foods.map((food) => (
          <FoodCard
            key={food.id}
            food={food}
            selected={food.id === selectedFoodId}
            onSelect={setSelectedFoodId}
          />
        ))}
      </div>

      <div className="mt-5 space-y-4 border-t border-line-soft pt-5">
        <QualitySelector value={quality} onChange={setQuality} />
        <PlateSizeSelector value={plateSize} onChange={setPlateSize} />
        <Button size="lg" fullWidth onClick={handleAdd} disabled={!selectedFoodId}>
          {selectedFoodId ? 'Add to quick log' : 'Choose a cut first'}
        </Button>
      </div>
    </Dialog>
  );
}
