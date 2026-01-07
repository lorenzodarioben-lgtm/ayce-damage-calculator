'use client';

import { useId, useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import { FavoriteQuickAdd, FavoriteToggle } from '@/components/favorites/FavoriteQuickAdd';
import { CategoryTabs } from '@/components/meal/CategoryTabs';
import { FoodCard } from '@/components/meal/FoodCard';
import { PlateSizeSelector } from '@/components/meal/PlateSizeSelector';
import { QualitySelector } from '@/components/meal/QualitySelector';
import { QuantityStepper } from '@/components/meal/QuantityStepper';
import { Button } from '@/components/ui/Button';
import { FOOD_COUNT, foodsInCategory } from '@/data/foods';
import { calculateLineItem } from '@/lib/calculations';
import {
  DEFAULT_PLATE_SIZE,
  DEFAULT_QUALITY,
  MAX_QUANTITY_PER_ADD,
  MIN_QUANTITY,
  getPlateSizeMeta,
} from '@/lib/constants';
import { describeFavorite } from '@/lib/favorites';
import { formatGrams, formatMoney } from '@/lib/formatting';
import { useFavorites } from '@/hooks/useFavorites';
import type { AddItemPayload } from '@/hooks/useMealSession';
import type { FoodCategory, PlateSize, QualityTier } from '@/types/meal';

interface MealBuilderProps {
  onAdd: (payload: AddItemPayload, confirmation: string) => void;
}

export function MealBuilder({ onAdd }: MealBuilderProps) {
  const panelId = useId();
  const { favorites, toggle, remove, has } = useFavorites();

  const [category, setCategory] = useState<FoodCategory>('beef');
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityTier>(DEFAULT_QUALITY);
  const [plateSize, setPlateSize] = useState<PlateSize>(DEFAULT_PLATE_SIZE);
  const [quantity, setQuantity] = useState(1);

  const foods = useMemo(() => foodsInCategory(category), [category]);
  const selectedFood = foods.find((food) => food.id === selectedFoodId) ?? null;

  const preview = useMemo(() => {
    if (!selectedFood) {
      return null;
    }
    return calculateLineItem(
      { id: 'preview', foodId: selectedFood.id, quality, plateSize, quantity },
      selectedFood,
    );
  }, [selectedFood, quality, plateSize, quantity]);

  function handleCategoryChange(next: FoodCategory) {
    setCategory(next);
    setSelectedFoodId(null);
  }

  function handleAdd() {
    if (!selectedFood) {
      return;
    }
    const plateLabel = quantity === 1 ? 'plate' : 'plates';
    onAdd(
      { foodId: selectedFood.id, quality, plateSize, quantity },
      `${quantity} ${plateLabel} of ${selectedFood.name} added to your tab.`,
    );
    setQuantity(1);
  }

  return (
    <section aria-labelledby="builder-heading" className="panel p-4 sm:p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="builder-heading" className="display-type text-2xl text-cream-50 sm:text-3xl">
          Build the meal
        </h2>
        <p className="text-xs text-cream-700">{FOOD_COUNT} cuts</p>
      </div>

      {/* Saved orders sit above the picker: for a repeat visit they are the
          fastest path, and they cost nothing when the list is empty. */}
      <section aria-labelledby="saved-orders-heading" className="mb-4">
        <h3 id="saved-orders-heading" className="micro-label mb-2">
          Saved orders
        </h3>
        <FavoriteQuickAdd favorites={favorites} onAdd={onAdd} onRemove={remove} />
      </section>

      <CategoryTabs value={category} onChange={handleCategoryChange} panelId={panelId} />

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`category-tab-${category}`}
        tabIndex={-1}
        className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3"
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

      <div className="mt-5 border-t border-line-soft pt-5">
        {selectedFood ? (
          <div className="animate-fade-up space-y-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="micro-label">Configuring</span>
              <span className="display-type text-xl text-ember-400">{selectedFood.name}</span>
            </div>

            <QualitySelector value={quality} onChange={setQuality} />
            <PlateSizeSelector value={plateSize} onChange={setPlateSize} />

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="micro-label mb-2 block">Plates</span>
                <QuantityStepper
                  label="plates to add"
                  value={quantity}
                  min={MIN_QUANTITY}
                  max={MAX_QUANTITY_PER_ADD}
                  onIncrement={() => setQuantity((q) => Math.min(MAX_QUANTITY_PER_ADD, q + 1))}
                  onDecrement={() => setQuantity((q) => Math.max(MIN_QUANTITY, q - 1))}
                  decrementLabel="Remove a plate from this order"
                  incrementLabel="Add a plate to this order"
                />
              </div>

              {preview && (
                <dl className="tabular text-right text-sm">
                  <div className="flex items-baseline justify-end gap-2">
                    <dt className="text-cream-700">Weight</dt>
                    <dd className="font-semibold text-cream-100">
                      {formatGrams(getPlateSizeMeta(plateSize).grams * quantity)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-end gap-2">
                    <dt className="text-cream-700">Retail value</dt>
                    <dd className="font-semibold text-ember-400">
                      {formatMoney(preview.retailValue)}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            <div className="flex items-stretch gap-2">
              <Button size="lg" fullWidth onClick={handleAdd}>
                <Flame size={18} aria-hidden="true" />
                Add to my damage
              </Button>
              <FavoriteToggle
                active={has({ foodId: selectedFood.id, quality, plateSize })}
                onToggle={() => toggle({ foodId: selectedFood.id, quality, plateSize })}
                description={
                  describeFavorite({ foodId: selectedFood.id, quality, plateSize }) ??
                  selectedFood.name
                }
              />
            </div>
          </div>
        ) : (
          <p className="py-2 text-center text-sm text-cream-700">
            Choose a cut above to set quality, plate size and quantity.
          </p>
        )}
      </div>
    </section>
  );
}
