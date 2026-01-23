'use client';

import { useCallback, useState } from 'react';
import {
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

  return { foods: state.foods, hydrated: state.hydrated, save, remove };
}
