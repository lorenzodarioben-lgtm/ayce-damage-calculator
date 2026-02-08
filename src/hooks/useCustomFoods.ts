'use client';

import { useCallback, useState } from 'react';
import {
  MAX_CUSTOM_FOODS,
  loadCustomFoods,
  removeCustomFood,
  saveCustomFoods,
  upsertCustomFood,
} from '@/lib/customFoods';
import type { CustomFood } from '@/types/customFoods';

interface State {
  readonly foods: readonly CustomFood[];
  readonly hydrated: boolean;
}

const INITIAL: State = { foods: [], hydrated: false };

export function useCustomFoods() {
  const [state, setState] = useState<State>(INITIAL);
  if (!state.hydrated && typeof window !== 'undefined') {
    setState({ foods: loadCustomFoods(), hydrated: true });
  }

  const save = useCallback((food: CustomFood) => {
    setState((current) => {
      const foods = upsertCustomFood(current.foods, food);
      saveCustomFoods(foods);
      return { foods, hydrated: true };
    });
  }, []);

  const remove = useCallback((id: string) => {
    setState((current) => {
      const foods = removeCustomFood(current.foods, id);
      saveCustomFoods(foods);
      return { foods, hydrated: true };
    });
  }, []);

  /**
   * Replaces the whole menu in one write.
   *
   * Used by the CSV import, which has already worked out exactly what the
   * resulting menu should be. Committing it as one update is what makes the
   * import atomic — there is no moment where half a file has been applied.
   */
  const replaceAll = useCallback((foods: readonly CustomFood[]) => {
    setState(() => {
      const next = foods.slice(0, MAX_CUSTOM_FOODS);
      saveCustomFoods(next);
      return { foods: next, hydrated: true };
    });
  }, []);

  return { foods: state.foods, hydrated: state.hydrated, save, remove, replaceAll };
}
