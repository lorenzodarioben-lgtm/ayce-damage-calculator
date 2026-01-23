'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { CATEGORY_META } from '@/lib/constants';
import { createCustomFood, nextCustomFoodId } from '@/lib/customFoods';
import type { CustomFood } from '@/types/customFoods';
import type { FoodCategory } from '@/types/meal';

interface CustomFoodManagerProps {
  foods: readonly CustomFood[];
  onSave: (food: CustomFood) => void;
  onRemove: (id: string) => void;
  onStatus: (message: string) => void;
}

interface DraftState {
  readonly name: string;
  readonly shortName: string;
  readonly category: FoodCategory;
  readonly description: string;
  readonly retailPricePerKg: string;
  readonly restaurantCostPerKg: string;
  readonly caloriesPer100g: string;
  readonly proteinPer100g: string;
  readonly fatPer100g: string;
  readonly carbsPer100g: string;
}

function draftFrom(food: CustomFood | null): DraftState {
  return {
    name: food?.name ?? '',
    shortName: food?.shortName ?? '',
    category: food?.category ?? 'beef',
    description: food?.description ?? '',
    retailPricePerKg: food ? String(food.retailPricePerKg) : '',
    restaurantCostPerKg: food ? String(food.restaurantCostPerKg) : '',
    caloriesPer100g: food ? String(food.caloriesPer100g) : '0',
    proteinPer100g: food ? String(food.proteinPer100g) : '0',
    fatPer100g: food ? String(food.fatPer100g) : '0',
    carbsPer100g: food ? String(food.carbsPer100g) : '0',
  };
}

function numberFrom(value: string): number {
  return Number(value);
}

function CustomFoodEditor({
  food,
  foods,
  onClose,
  onSave,
}: {
  food: CustomFood | null;
  foods: readonly CustomFood[];
  onClose: () => void;
  onSave: (food: CustomFood) => void;
}) {
  const titleId = useId();
  const [draft, setDraft] = useState<DraftState>(() => draftFrom(food));
  const [error, setError] = useState<string | null>(null);
  const set = <Key extends keyof DraftState>(key: Key, value: DraftState[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function handleSave() {
    const created = createCustomFood(
      {
        name: draft.name,
        shortName: draft.shortName,
        category: draft.category,
        description: draft.description,
        retailPricePerKg: numberFrom(draft.retailPricePerKg),
        restaurantCostPerKg: numberFrom(draft.restaurantCostPerKg),
        caloriesPer100g: numberFrom(draft.caloriesPer100g),
        proteinPer100g: numberFrom(draft.proteinPer100g),
        fatPer100g: numberFrom(draft.fatPer100g),
        carbsPer100g: numberFrom(draft.carbsPer100g),
      },
      food?.id ?? nextCustomFoodId(foods, draft.name),
    );
    if (!created) {
      setError('Add a name, choose a category and use zero or a positive number for every figure.');
      return;
    }
    onSave(created);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={food ? 'Edit custom food' : 'Add custom food'}
      labelledById={titleId}
    >
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-cream-500">
          Add a cut or side your regular menu has but the calculator does not. It stays on this
          device until you export it.
        </p>

        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <label className="block text-sm font-semibold text-cream-300">
            Name
            <input
              value={draft.name}
              onChange={(event) => set('name', event.target.value)}
              autoComplete="off"
              placeholder="e.g. Honey soy chicken"
              className="mt-1.5 h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 font-normal text-cream-50 placeholder:text-cream-700 focus:border-ember-600"
            />
          </label>
          <label className="block text-sm font-semibold text-cream-300">
            Category
            <select
              value={draft.category}
              onChange={(event) => set('category', event.target.value as FoodCategory)}
              className="mt-1.5 h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 font-normal text-cream-50 focus:border-ember-600"
            >
              {CATEGORY_META.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm font-semibold text-cream-300">
          Short name <span className="font-normal text-cream-700">(optional)</span>
          <input
            value={draft.shortName}
            onChange={(event) => set('shortName', event.target.value)}
            autoComplete="off"
            placeholder="Used where space is tight"
            className="mt-1.5 h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 font-normal text-cream-50 placeholder:text-cream-700 focus:border-ember-600"
          />
        </label>

        <label className="block text-sm font-semibold text-cream-300">
          What is it? <span className="font-normal text-cream-700">(optional)</span>
          <textarea
            rows={2}
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder="A quick note to distinguish it on the menu"
            className="mt-1.5 w-full resize-none rounded-[10px] border border-line bg-ash-900 px-3 py-2 font-normal text-cream-50 placeholder:text-cream-700 focus:border-ember-600"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-cream-300">
            Retail per kg
            <input
              aria-label="Retail price per kg"
              type="number"
              min="0"
              step="0.01"
              value={draft.retailPricePerKg}
              onChange={(event) => set('retailPricePerKg', event.target.value)}
              className="mt-1.5 h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 font-normal text-cream-50 focus:border-ember-600"
            />
          </label>
          <label className="block text-sm font-semibold text-cream-300">
            Restaurant cost per kg
            <input
              aria-label="Restaurant cost per kg"
              type="number"
              min="0"
              step="0.01"
              value={draft.restaurantCostPerKg}
              onChange={(event) => set('restaurantCostPerKg', event.target.value)}
              className="mt-1.5 h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 font-normal text-cream-50 focus:border-ember-600"
            />
          </label>
        </div>

        <fieldset>
          <legend className="micro-label mb-2">Nutrition per 100 g</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ['caloriesPer100g', 'Calories'],
                ['proteinPer100g', 'Protein g'],
                ['fatPer100g', 'Fat g'],
                ['carbsPer100g', 'Carbs g'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-xs font-semibold text-cream-500">
                {label}
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={draft[key]}
                  onChange={(event) => set(key, event.target.value)}
                  className="mt-1 h-10 w-full rounded-[8px] border border-line bg-ash-900 px-2 text-sm font-normal text-cream-50 focus:border-ember-600"
                />
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm font-semibold text-char-500">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-[9px] px-3 text-xs font-semibold uppercase tracking-[0.1em] text-cream-400 hover:bg-ash-800 hover:text-cream-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-10 rounded-[9px] bg-ember-500 px-4 text-xs font-bold uppercase tracking-[0.1em] text-ash-950 hover:bg-ember-400"
          >
            Save to my menu
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/** Personal menu controls, shaped like the rest of the setup rather than an admin screen. */
export function CustomFoodManager({ foods, onSave, onRemove, onStatus }: CustomFoodManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const editing = foods.find((food) => food.id === editingId) ?? null;

  function close() {
    setCreating(false);
    setEditingId(null);
  }

  return (
    <section aria-labelledby="custom-foods-heading" className="mt-4 border-t border-line-soft pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 id="custom-foods-heading" className="micro-label">
            Your menu
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-cream-700">
            Add the cuts and sides that make your regular haunt distinct.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[8px] px-2 text-xs font-semibold uppercase tracking-[0.1em] text-ember-500 transition-colors hover:bg-ash-800"
        >
          <Plus size={14} aria-hidden="true" />
          Add food
        </button>
      </div>

      {foods.length === 0 ? (
        <p className="mt-3 rounded-[10px] border border-dashed border-line bg-ash-900/60 px-4 py-3 text-center text-xs leading-relaxed text-cream-700">
          No custom items yet. Your menu is optional; the built-in cuts remain ready to go.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {foods.map((food) => (
            <li
              key={food.id}
              className="flex min-h-12 items-center justify-between gap-3 rounded-[10px] border border-line bg-ash-900/70 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-cream-100">{food.name}</p>
                <p className="text-xs text-cream-600">
                  {food.category} · {food.retailPricePerKg}/kg retail
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingId(food.id)}
                  aria-label={`Edit ${food.name}`}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-[8px] text-cream-500 transition-colors hover:bg-ash-800 hover:text-ember-400"
                >
                  <Pencil size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRemove(food.id);
                    onStatus(`${food.name} removed from your menu.`);
                  }}
                  aria-label={`Delete ${food.name}`}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-[8px] text-cream-600 transition-colors hover:bg-char-700/25 hover:text-char-500"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <CustomFoodEditor
          key={editing?.id ?? 'new'}
          food={editing}
          foods={foods}
          onClose={close}
          onSave={(food) => {
            onSave(food);
            close();
            onStatus(`${food.name} saved to your menu.`);
          }}
        />
      )}
    </section>
  );
}
