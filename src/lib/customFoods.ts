import { FOOD_CATEGORIES } from '@/lib/constants';
import {
  CUSTOM_FOOD_VARIANT_BY_CATEGORY,
  type CustomFood,
  type CustomFoodDraft,
} from '@/types/customFoods';
import type { FoodCategory } from '@/types/meal';

export const CUSTOM_FOODS_STORAGE_KEY = 'ayce-damage-custom-foods';
export const CUSTOM_FOODS_VERSION = 1;
export const MAX_STORED_CUSTOM_FOODS_LENGTH = 64 * 1024;
export const MAX_CUSTOM_FOODS = 32;
export const MAX_CUSTOM_FOOD_NAME_LENGTH = 48;
export const MAX_CUSTOM_FOOD_DESCRIPTION_LENGTH = 140;

interface StoredEnvelope {
  readonly version: number;
  readonly foods: readonly CustomFood[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normaliseText(value: unknown, length: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, length) : '';
}

function isFoodCategory(value: unknown): value is FoodCategory {
  return typeof value === 'string' && FOOD_CATEGORIES.includes(value as FoodCategory);
}

export function normaliseCustomFoodName(value: unknown): string {
  return normaliseText(value, MAX_CUSTOM_FOOD_NAME_LENGTH);
}

export function customFoodId(name: string): string {
  const slug = normaliseCustomFoodName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `custom-food-${slug || 'item'}`;
}

export function nextCustomFoodId(foods: readonly CustomFood[], name: string): string {
  const base = customFoodId(name);
  const ids = new Set(foods.map((food) => food.id));
  if (!ids.has(base)) {
    return base;
  }
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function amount(value: unknown): number {
  return nonNegative(value) ? value : 0;
}

/**
 * Builds a custom item under whichever valuation model the draft declares.
 *
 * A draft with no model is priced by weight, which is what every draft written
 * before per-serving items existed meant — and what the form still defaults to,
 * because grilled meat is the reason this app exists.
 */
export function createCustomFood(draft: CustomFoodDraft, id: string): CustomFood | null {
  const name = normaliseCustomFoodName(draft.name);
  if (
    !name ||
    !/^custom-food-[a-z0-9][a-z0-9_-]{0,79}$/.test(id) ||
    !isFoodCategory(draft.category)
  ) {
    return null;
  }

  const shortName = normaliseText(draft.shortName, MAX_CUSTOM_FOOD_NAME_LENGTH) || name;
  const description = normaliseText(draft.description, MAX_CUSTOM_FOOD_DESCRIPTION_LENGTH);
  const base = {
    id,
    name,
    shortName: shortName.slice(0, name.length),
    category: draft.category,
    description: description || `A custom ${draft.category} menu item.`,
    visualVariant: CUSTOM_FOOD_VARIANT_BY_CATEGORY[draft.category],
    isCustom: true,
  } as const;

  if (draft.valuation === 'by-serving') {
    if (!nonNegative(draft.retailPricePerServing) || !nonNegative(draft.restaurantCostPerServing)) {
      return null;
    }
    return {
      ...base,
      valuation: 'by-serving',
      retailPricePerServing: draft.retailPricePerServing,
      restaurantCostPerServing: draft.restaurantCostPerServing,
      // Zero means nobody weighed it, which is a fact the interface reports
      // rather than a weight it asserts.
      gramsPerServing: amount(draft.gramsPerServing),
      caloriesPerServing: amount(draft.caloriesPerServing),
      proteinPerServing: amount(draft.proteinPerServing),
      fatPerServing: amount(draft.fatPerServing),
      carbsPerServing: amount(draft.carbsPerServing),
    };
  }

  if (!nonNegative(draft.retailPricePerKg) || !nonNegative(draft.restaurantCostPerKg)) {
    return null;
  }
  return {
    ...base,
    valuation: 'by-weight',
    retailPricePerKg: draft.retailPricePerKg,
    restaurantCostPerKg: draft.restaurantCostPerKg,
    caloriesPer100g: amount(draft.caloriesPer100g),
    proteinPer100g: amount(draft.proteinPer100g),
    fatPer100g: amount(draft.fatPer100g),
    carbsPer100g: amount(draft.carbsPer100g),
  };
}

export function upsertCustomFood(
  foods: readonly CustomFood[],
  food: CustomFood,
): readonly CustomFood[] {
  return [food, ...foods.filter((entry) => entry.id !== food.id)].slice(0, MAX_CUSTOM_FOODS);
}

export function removeCustomFood(foods: readonly CustomFood[], id: string): readonly CustomFood[] {
  return foods.filter((food) => food.id !== id);
}

export function findCustomFood(foods: readonly CustomFood[], id: string): CustomFood | undefined {
  return foods.find((food) => food.id === id);
}

/** Reads a numeric field only when it genuinely is one. */
function figure(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/**
 * Validates one stored, shared or imported item.
 *
 * A record with no valuation key is priced by weight. That is a reading rather
 * than a fallback: every custom food written before per-serving items existed
 * was a per-kilogram one, and continues to calculate exactly as it did.
 */
export function parseCustomFood(value: unknown): CustomFood | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  const shared = {
    name: typeof value.name === 'string' ? value.name : '',
    ...(typeof value.shortName === 'string' ? { shortName: value.shortName } : {}),
    category: value.category as FoodCategory,
    ...(typeof value.description === 'string' ? { description: value.description } : {}),
  };

  if (value.valuation === 'by-serving') {
    const grams = figure(value.gramsPerServing);
    const calories = figure(value.caloriesPerServing);
    const protein = figure(value.proteinPerServing);
    const fat = figure(value.fatPerServing);
    const carbs = figure(value.carbsPerServing);
    return createCustomFood(
      {
        ...shared,
        valuation: 'by-serving',
        retailPricePerServing: value.retailPricePerServing as number,
        restaurantCostPerServing: value.restaurantCostPerServing as number,
        ...(grams === undefined ? {} : { gramsPerServing: grams }),
        ...(calories === undefined ? {} : { caloriesPerServing: calories }),
        ...(protein === undefined ? {} : { proteinPerServing: protein }),
        ...(fat === undefined ? {} : { fatPerServing: fat }),
        ...(carbs === undefined ? {} : { carbsPerServing: carbs }),
      },
      value.id,
    );
  }

  const calories = figure(value.caloriesPer100g);
  const protein = figure(value.proteinPer100g);
  const fat = figure(value.fatPer100g);
  const carbs = figure(value.carbsPer100g);
  return createCustomFood(
    {
      ...shared,
      valuation: 'by-weight',
      retailPricePerKg: value.retailPricePerKg as number,
      restaurantCostPerKg: value.restaurantCostPerKg as number,
      ...(calories === undefined ? {} : { caloriesPer100g: calories }),
      ...(protein === undefined ? {} : { proteinPer100g: protein }),
      ...(fat === undefined ? {} : { fatPer100g: fat }),
      ...(carbs === undefined ? {} : { carbsPer100g: carbs }),
    },
    value.id,
  );
}

export function parseStoredCustomFoods(raw: string | null): readonly CustomFood[] {
  if (!raw || raw.length > MAX_STORED_CUSTOM_FOODS_LENGTH) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (
    !isRecord(parsed) ||
    parsed.version !== CUSTOM_FOODS_VERSION ||
    !Array.isArray(parsed.foods)
  ) {
    return [];
  }

  const foods: CustomFood[] = [];
  const ids = new Set<string>();
  for (const entry of parsed.foods) {
    const food = parseCustomFood(entry);
    if (food && !ids.has(food.id)) {
      ids.add(food.id);
      foods.push(food);
    }
    if (foods.length >= MAX_CUSTOM_FOODS) {
      break;
    }
  }
  return foods;
}

export function loadCustomFoods(): readonly CustomFood[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    return parseStoredCustomFoods(window.localStorage.getItem(CUSTOM_FOODS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveCustomFoods(foods: readonly CustomFood[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  const envelope: StoredEnvelope = {
    version: CUSTOM_FOODS_VERSION,
    foods: foods.slice(0, MAX_CUSTOM_FOODS),
  };
  try {
    window.localStorage.setItem(CUSTOM_FOODS_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // A failed write only costs persistence, never the menu being edited.
  }
}
