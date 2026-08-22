'use client';

import { useCallback, useState } from 'react';
import { FOODS } from '@/data/foods';
import {
  isFavorited,
  loadFavorites,
  removeFavorite,
  saveFavorites,
  toggleFavorite,
  type FavoriteConfig,
  type MealFavorite,
} from '@/lib/favorites';
import type { FoodItem } from '@/types/meal';

export interface UseFavoritesResult {
  favorites: readonly MealFavorite[];
  /** False until storage has been read, so the strip does not flash empty. */
  hydrated: boolean;
  toggle: (config: FavoriteConfig) => void;
  remove: (id: string) => void;
  has: (config: FavoriteConfig) => boolean;
}

interface State {
  readonly favorites: readonly MealFavorite[];
  readonly hydrated: boolean;
}

const INITIAL: State = { favorites: [], hydrated: false };

/**
 * Favourites, held on this device.
 *
 * Reads once during the first client render rather than in an effect: the list
 * is small and synchronous, and doing it here avoids a frame where a returning
 * user is shown the empty state they have already dismissed.
 */
export function useFavorites(foods: readonly FoodItem[] = FOODS): UseFavoritesResult {
  const [state, setState] = useState<State>(INITIAL);

  if (!state.hydrated && typeof window !== 'undefined') {
    setState({ favorites: loadFavorites(foods), hydrated: true });
  }

  const toggle = useCallback((config: FavoriteConfig) => {
    setState((current) => {
      const next = toggleFavorite(current.favorites, config, new Date().toISOString());
      saveFavorites(next);
      return { favorites: next, hydrated: true };
    });
  }, []);

  const remove = useCallback((id: string) => {
    setState((current) => {
      const next = removeFavorite(current.favorites, id);
      saveFavorites(next);
      return { favorites: next, hydrated: true };
    });
  }, []);

  const has = useCallback(
    (config: FavoriteConfig) => isFavorited(state.favorites, config),
    [state.favorites],
  );

  return { favorites: state.favorites, hydrated: state.hydrated, toggle, remove, has };
}
