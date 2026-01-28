'use client';

import { useCallback, useState } from 'react';
import {
  createRestaurantProfile,
  loadRestaurants,
  removeRestaurant,
  saveRestaurants,
  upsertRestaurant,
  type RestaurantDraft,
  type RestaurantProfile,
} from '@/lib/restaurants';

export interface UseRestaurantsResult {
  readonly restaurants: readonly RestaurantProfile[];
  readonly hydrated: boolean;
  /** Returns the saved profile, or null when the draft had no usable name. */
  readonly save: (draft: RestaurantDraft) => RestaurantProfile | null;
  readonly remove: (id: string) => void;
}

interface State {
  readonly restaurants: readonly RestaurantProfile[];
  readonly hydrated: boolean;
}

const INITIAL: State = { restaurants: [], hydrated: false };

/**
 * The local restaurant list, migrating the old presets on first read.
 *
 * Deleting a profile only removes the profile. Filed visits keep their own
 * snapshot of the name, price and menu context they were recorded with, so no
 * history is ever lost with a place.
 */
export function useRestaurants(): UseRestaurantsResult {
  const [state, setState] = useState<State>(INITIAL);

  if (!state.hydrated && typeof window !== 'undefined') {
    setState({ restaurants: loadRestaurants(), hydrated: true });
  }

  const save = useCallback((draft: RestaurantDraft) => {
    const profile = createRestaurantProfile(draft, new Date().toISOString());
    if (!profile) {
      return null;
    }
    setState((current) => {
      const restaurants = upsertRestaurant(current.restaurants, profile);
      saveRestaurants(restaurants);
      return { restaurants, hydrated: true };
    });
    return profile;
  }, []);

  const remove = useCallback((id: string) => {
    setState((current) => {
      const restaurants = removeRestaurant(current.restaurants, id);
      saveRestaurants(restaurants);
      return { restaurants, hydrated: true };
    });
  }, []);

  return { restaurants: state.restaurants, hydrated: state.hydrated, save, remove };
}
