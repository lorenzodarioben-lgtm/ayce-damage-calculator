import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRestaurants } from '@/hooks/useRestaurants';
import { PRESETS_STORAGE_KEY, PRESETS_VERSION } from '@/lib/presets';
import {
  RESTAURANTS_STORAGE_KEY,
  RESTAURANTS_VERSION,
  type RestaurantProfile,
} from '@/lib/restaurants';

/*
 * Saving is the only place a profile is created, so the hook is where the
 * draft rules bite: a nameless draft has to come back as null instead of
 * quietly becoming a place the diner cannot tell apart from any other.
 */

function storeRestaurants(restaurants: readonly unknown[]) {
  window.localStorage.setItem(
    RESTAURANTS_STORAGE_KEY,
    JSON.stringify({ version: RESTAURANTS_VERSION, restaurants }),
  );
}

function storePresets(presets: readonly unknown[]) {
  window.localStorage.setItem(
    PRESETS_STORAGE_KEY,
    JSON.stringify({ version: PRESETS_VERSION, presets }),
  );
}

function stored(): readonly RestaurantProfile[] {
  const raw = window.localStorage.getItem(RESTAURANTS_STORAGE_KEY);
  return raw === null ? [] : JSON.parse(raw).restaurants;
}

const SEOUL_GARDEN = {
  id: 'seoul-garden',
  name: 'Seoul Garden',
  pricePerDiner: 59.9,
  dinerCount: 2,
  pricingProfileId: 'retail',
  note: '',
  createdAt: '2026-08-10T12:00:00.000Z',
  updatedAt: '2026-08-10T12:00:00.000Z',
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('useRestaurants', () => {
  it('has already read the list by the time the first render returns', () => {
    storeRestaurants([SEOUL_GARDEN]);

    const { result } = renderHook(() => useRestaurants());

    expect(result.current.hydrated).toBe(true);
    expect(result.current.restaurants.map((entry) => entry.id)).toEqual(['seoul-garden']);
  });

  it('reports an empty list as read rather than as still loading', () => {
    const { result } = renderHook(() => useRestaurants());

    expect(result.current.hydrated).toBe(true);
    expect(result.current.restaurants).toEqual([]);
  });

  it('brings the old presets forward the first time, keeping their ids', () => {
    storePresets([
      {
        id: 'little-seoul',
        name: 'Little Seoul',
        pricePerDiner: 45,
        dinerCount: 4,
        pricingProfileId: 'retail',
        createdAt: '2026-08-01T12:00:00.000Z',
      },
    ]);

    const { result } = renderHook(() => useRestaurants());

    expect(result.current.restaurants.map((entry) => entry.id)).toEqual(['little-seoul']);
    expect(result.current.restaurants[0]?.note).toBe('');
  });

  it('prefers a saved list over the presets once one exists', () => {
    storePresets([
      {
        id: 'little-seoul',
        name: 'Little Seoul',
        pricePerDiner: 45,
        dinerCount: 4,
        pricingProfileId: 'retail',
        createdAt: '2026-08-01T12:00:00.000Z',
      },
    ]);
    storeRestaurants([SEOUL_GARDEN]);

    const { result } = renderHook(() => useRestaurants());

    expect(result.current.restaurants.map((entry) => entry.id)).toEqual(['seoul-garden']);
  });

  it('saves a draft, returns the profile and writes the list through', () => {
    const { result } = renderHook(() => useRestaurants());

    let saved: RestaurantProfile | null = null;
    act(() => {
      saved = result.current.save({ name: 'Seoul Garden', pricePerDiner: 59.9, dinerCount: 2 });
    });

    expect(saved).not.toBeNull();
    expect(saved!.id).toBe('seoul-garden');
    expect(result.current.restaurants).toHaveLength(1);
    expect(stored()).toHaveLength(1);
  });

  it('returns null for a draft with no usable name, and saves nothing', () => {
    const { result } = renderHook(() => useRestaurants());

    let saved: RestaurantProfile | null = null;
    act(() => {
      saved = result.current.save({ name: '   ', pricePerDiner: 59.9, dinerCount: 2 });
    });

    expect(saved).toBeNull();
    expect(result.current.restaurants).toEqual([]);
    expect(window.localStorage.getItem(RESTAURANTS_STORAGE_KEY)).toBeNull();
  });

  it('updates a place in place when the same name is saved again', () => {
    storeRestaurants([SEOUL_GARDEN]);
    const { result } = renderHook(() => useRestaurants());

    act(() => {
      result.current.save({ name: 'seoul garden', pricePerDiner: 65, dinerCount: 3 });
    });

    expect(result.current.restaurants).toHaveLength(1);
    expect(result.current.restaurants[0]?.pricePerDiner).toBe(65);
    // The place is the same place, so the date it was first filed survives.
    expect(result.current.restaurants[0]?.createdAt).toBe('2026-08-10T12:00:00.000Z');
  });

  it('clamps a price and a table size a draft could not really have', () => {
    const { result } = renderHook(() => useRestaurants());

    let saved: RestaurantProfile | null = null;
    act(() => {
      saved = result.current.save({ name: 'Seoul Garden', pricePerDiner: 5000, dinerCount: 0 });
    });

    expect(saved!.pricePerDiner).toBe(500);
    expect(saved!.dinerCount).toBe(1);
  });

  it('removes a place by id and persists the shorter list', () => {
    storeRestaurants([SEOUL_GARDEN]);
    const { result } = renderHook(() => useRestaurants());

    act(() => result.current.remove('seoul-garden'));

    expect(result.current.restaurants).toEqual([]);
    expect(stored()).toEqual([]);
  });

  it('ignores a removal that matches no place', () => {
    storeRestaurants([SEOUL_GARDEN]);
    const { result } = renderHook(() => useRestaurants());

    act(() => result.current.remove('somewhere-else'));

    expect(result.current.restaurants).toHaveLength(1);
  });
});
