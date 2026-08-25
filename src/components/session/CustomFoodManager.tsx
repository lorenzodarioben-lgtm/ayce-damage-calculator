'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { CATEGORY_META } from '@/lib/constants';
import { createCustomFood, nextCustomFoodId } from '@/lib/customFoods';
import type { CustomFood } from '@/types/customFoods';
import type { FoodCategory, ValuationModel } from '@/types/meal';

interface CustomFoodManagerProps {
  foods: readonly CustomFood[];
  onSave: (food: CustomFood) => void;
  onRemove: (id: string) => void;
  onStatus: (message: string) => void;
}

/**
 * The form holds one set of strings and interprets them by model.
 *
 * Keeping a single draft shape rather than two means switching between the
 * models does not throw away what someone has already typed into the fields
 * both share — the name, the category, the description.
 */
interface DraftState {
  readonly name: string;
  readonly shortName: string;
  readonly category: FoodCategory;
  readonly description: string;
  readonly valuation: ValuationModel;
  /** Read as a rate per kilogram or a price per serving, by model. */
  readonly retailPrice: string;
  readonly restaurantCost: string;
  /** Only meaningful for a per-serving item; a plate size supplies the rest. */
  readonly gramsPerServing: string;
  readonly calories: string;
  readonly protein: string;
  readonly fat: string;
  readonly carbs: string;
}

function draftFrom(food: CustomFood | null): DraftState {
  const shared = {
    name: food?.name ?? '',
    shortName: food?.shortName ?? '',
    category: food?.category ?? ('beef' as FoodCategory),
    description: food?.description ?? '',
  };

  if (food?.valuation === 'by-serving') {
    return {
      ...shared,
      valuation: 'by-serving',
      retailPrice: String(food.retailPricePerServing),
      restaurantCost: String(food.restaurantCostPerServing),
      gramsPerServing: String(food.gramsPerServing),
      calories: optional(food.caloriesPerServing),
      protein: optional(food.proteinPerServing),
      fat: optional(food.fatPerServing),
      carbs: optional(food.carbsPerServing),
    };
  }

  return {
    ...shared,
    valuation: 'by-weight',
    retailPrice: food ? String(food.retailPricePerKg) : '',
    restaurantCost: food ? String(food.restaurantCostPerKg) : '',
    gramsPerServing: '0',
    // Blank rather than zero: an unstated macro is unknown, and prefilling a
    // confident nought would put words in the diner's mouth.
    calories: optional(food?.caloriesPer100g),
    protein: optional(food?.proteinPer100g),
    fat: optional(food?.fatPer100g),
    carbs: optional(food?.carbsPer100g),
  };
}

/** Renders an optional figure as a field value, keeping unknown blank. */
function optional(value: number | undefined): string {
  return typeof value === 'number' ? String(value) : '';
}

function numberFrom(value: string): number {
  return Number(value);
}

/**
 * A macro someone left blank, which means they do not know it.
 *
 * Returning undefined rather than zero is the whole point: "we have no figure
 * for this side" and "this side has no calories" are different claims, and the
 * report says which one it is holding.
 */
function macroFrom(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : Number(trimmed);
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

  const perServing = draft.valuation === 'by-serving';

  function handleSave() {
    const shared = {
      name: draft.name,
      shortName: draft.shortName,
      category: draft.category,
      description: draft.description,
    };
    const created = createCustomFood(
      perServing
        ? {
            ...shared,
            valuation: 'by-serving',
            retailPricePerServing: numberFrom(draft.retailPrice),
            restaurantCostPerServing: numberFrom(draft.restaurantCost),
            gramsPerServing: numberFrom(draft.gramsPerServing),
            ...macroFields({
              caloriesPerServing: macroFrom(draft.calories),
              proteinPerServing: macroFrom(draft.protein),
              fatPerServing: macroFrom(draft.fat),
              carbsPerServing: macroFrom(draft.carbs),
            }),
          }
        : {
            ...shared,
            valuation: 'by-weight',
            retailPricePerKg: numberFrom(draft.retailPrice),
            restaurantCostPerKg: numberFrom(draft.restaurantCost),
            ...macroFields({
              caloriesPer100g: macroFrom(draft.calories),
              proteinPer100g: macroFrom(draft.protein),
              fatPer100g: macroFrom(draft.fat),
              carbsPer100g: macroFrom(draft.carbs),
            }),
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

        <fieldset>
          <legend className="micro-label mb-2">How it is priced</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['by-weight', 'By weight', 'A cut you order plates of, priced per kilogram.'],
                ['by-serving', 'By serving', 'One thing at one price — a soup, a scoop, a bottle.'],
              ] as const
            ).map(([model, label, hint]) => (
              <label
                key={model}
                className={`block cursor-pointer rounded-[10px] border px-3 py-2 transition-colors duration-200 ${
                  draft.valuation === model
                    ? 'border-ember-600 bg-ash-800'
                    : 'border-line bg-ash-900 hover:border-line-ember'
                }`}
              >
                <input
                  type="radio"
                  name="valuation"
                  value={model}
                  checked={draft.valuation === model}
                  onChange={() => set('valuation', model)}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold text-cream-100">{label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-cream-700">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-cream-300">
            {perServing ? 'Retail per serving' : 'Retail per kg'}
            <input
              aria-label={perServing ? 'Retail price per serving' : 'Retail price per kg'}
              type="number"
              min="0"
              step="0.01"
              value={draft.retailPrice}
              onChange={(event) => set('retailPrice', event.target.value)}
              className="mt-1.5 h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 font-normal text-cream-50 focus:border-ember-600"
            />
          </label>
          <label className="block text-sm font-semibold text-cream-300">
            {perServing ? 'Restaurant cost per serving' : 'Restaurant cost per kg'}
            <input
              aria-label={perServing ? 'Restaurant cost per serving' : 'Restaurant cost per kg'}
              type="number"
              min="0"
              step="0.01"
              value={draft.restaurantCost}
              onChange={(event) => set('restaurantCost', event.target.value)}
              className="mt-1.5 h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 font-normal text-cream-50 focus:border-ember-600"
            />
          </label>
        </div>

        {/*
          Plate size is what supplies a weight-valued cut's grams, so it is only
          a per-serving item that has to state its own. Zero is a legitimate
          answer — nobody weighs a bowl of soup — and the interface reports it
          as unweighed rather than as nothing.
        */}
        {perServing && (
          <label className="block text-sm font-semibold text-cream-300">
            Grams per serving <span className="font-normal text-cream-700">(optional)</span>
            <input
              aria-label="Grams per serving"
              type="number"
              min="0"
              step="1"
              value={draft.gramsPerServing}
              onChange={(event) => set('gramsPerServing', event.target.value)}
              className="mt-1.5 h-11 w-full rounded-[10px] border border-line bg-ash-900 px-3 font-normal text-cream-50 focus:border-ember-600"
            />
            <span className="mt-1 block text-xs font-normal leading-snug text-cream-700">
              Leave it at zero if you do not know. The item still counts towards value and
              nutrition; it just will not add weight to the meal, and the report says so.
            </span>
          </label>
        )}

        <fieldset>
          <legend className="micro-label mb-2">
            {perServing ? 'Nutrition per serving' : 'Nutrition per 100 g'}
          </legend>
          <p className="mb-2 text-xs leading-relaxed text-cream-700">
            Leave a field blank if you do not know it. The report says the figure is not recorded
            rather than counting it as nothing.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ['calories', 'Calories'],
                ['protein', 'Protein g'],
                ['fat', 'Fat g'],
                ['carbs', 'Carbs g'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-xs font-semibold text-cream-500">
                {label}
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Unknown"
                  value={draft[key]}
                  onChange={(event) => set(key, event.target.value)}
                  className="mt-1 h-10 w-full rounded-[8px] border border-line bg-ash-900 px-2 text-sm font-normal text-cream-50 placeholder:text-cream-700 focus:border-ember-600"
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

/** Drops the macros nobody filled in, so absence reaches the model as absence. */
function macroFields<Keys extends string>(
  values: Readonly<Record<Keys, number | undefined>>,
): Partial<Record<Keys, number>> {
  const kept: Partial<Record<Keys, number>> = {};
  for (const [key, value] of Object.entries(values) as [Keys, number | undefined][]) {
    if (value !== undefined) {
      kept[key] = value;
    }
  }
  return kept;
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
                  {food.category} ·{' '}
                  {food.valuation === 'by-serving'
                    ? `${food.retailPricePerServing}/serving retail`
                    : `${food.retailPricePerKg}/kg retail`}
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
