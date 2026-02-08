'use client';

import { useId, useMemo, useState } from 'react';
import { CategoryTabs } from '@/components/meal/CategoryTabs';
import { FoodCard } from '@/components/meal/FoodCard';
import { PlateSizeSelector } from '@/components/meal/PlateSizeSelector';
import { usesPlateSize } from '@/lib/valuation';
import { QualitySelector } from '@/components/meal/QualitySelector';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { DEFAULT_PLATE_SIZE, DEFAULT_QUALITY } from '@/lib/constants';
import { foodsInCatalogueCategory } from '@/lib/foodCatalogue';
import type { AddItemPayload } from '@/hooks/useMealSession';
import type { FoodCategory, FoodItem, PlateSize, QualityTier } from '@/types/meal';

interface AddCutDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (payload: AddItemPayload) => void;
  foods: readonly FoodItem[];
}

/**
 * Puts a new cut on the quick-log list.
 *
 * The same selectors as the full builder, so a cut configured here is
 * indistinguishable from one configured there — there is only one meal model.
 */
export function AddCutDialog({ open, onClose, onAdd, foods: catalogue }: AddCutDialogProps) {
  const titleId = useId();
  const panelId = useId();

  const [category, setCategory] = useState<FoodCategory>('beef');
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityTier>(DEFAULT_QUALITY);
  const [plateSize, setPlateSize] = useState<PlateSize>(DEFAULT_PLATE_SIZE);

  const foods = useMemo(() => foodsInCatalogueCategory(catalogue, category), [catalogue, category]);
  const selected = foods.find((food) => food.id === selectedFoodId);

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
        foods={catalogue}
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
        {/* A serving is whatever the restaurant serves; plate size says nothing. */}
        {(!selected || usesPlateSize(selected)) && (
          <PlateSizeSelector value={plateSize} onChange={setPlateSize} />
        )}
        <Button size="lg" fullWidth onClick={handleAdd} disabled={!selectedFoodId}>
          {selectedFoodId ? 'Add to quick log' : 'Choose a cut first'}
        </Button>
      </div>
    </Dialog>
  );
}
