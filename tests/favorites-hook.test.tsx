import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { FOODS } from '@/data/foods';
import { useFavorites } from '@/hooks/useFavorites';
import { FAVORITES_STORAGE_KEY, FAVORITES_VERSION, type FavoriteConfig } from '@/lib/favorites';
import type { FoodItem } from '@/types/meal';

/*
 * The hook reads storage during the first client render rather than in an
 * effect, so what it hands back on that render is part of the contract: a
 * returning diner must never be shown the empty strip they already dismissed.
 */

const RIBEYE: FavoriteConfig = {
  foodId: 'beef-ribeye',
  quality: 'standard',
  plateSize: 'regular',
};

const BRISKET: FavoriteConfig = {
  foodId: 'beef-brisket',
  quality: 'premium',
  plateSize: 'large',
};

function store(favorites: readonly unknown[]) {
  window.localStorage.setItem(
    FAVORITES_STORAGE_KEY,
    JSON.stringify({ version: FAVORITES_VERSION, favorites }),
  );
}

function stored(): readonly { id: string }[] {
  const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
  return raw === null ? [] : JSON.parse(raw).favorites;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('useFavorites', () => {
  it('has already read storage by the time the first render returns', () => {
    store([{ ...RIBEYE, createdAt: '2026-08-16T12:00:00.000Z' }]);

    const { result } = renderHook(() => useFavorites());

    expect(result.current.hydrated).toBe(true);
    expect(result.current.favorites.map((favorite) => favorite.foodId)).toEqual(['beef-ribeye']);
  });

  it('reports an empty list as read rather than as still loading', () => {
    const { result } = renderHook(() => useFavorites());

    expect(result.current.hydrated).toBe(true);
    expect(result.current.favorites).toEqual([]);
  });

  it('pins a configuration and writes it through to storage', () => {
    const { result } = renderHook(() => useFavorites());

    act(() => result.current.toggle(RIBEYE));

    expect(result.current.has(RIBEYE)).toBe(true);
    expect(stored()).toHaveLength(1);
  });

  it('unpins the same configuration on a second toggle', () => {
    const { result } = renderHook(() => useFavorites());

    act(() => result.current.toggle(RIBEYE));
    act(() => result.current.toggle(RIBEYE));

    expect(result.current.has(RIBEYE)).toBe(false);
    expect(stored()).toEqual([]);
  });

  it('treats a different grade or serving size as its own favourite', () => {
    const { result } = renderHook(() => useFavorites());

    act(() => result.current.toggle(RIBEYE));
    act(() => result.current.toggle({ ...RIBEYE, quality: 'premium' }));

    expect(result.current.favorites).toHaveLength(2);
    expect(result.current.has(RIBEYE)).toBe(true);
  });

  it('keeps the newest pin first', () => {
    const { result } = renderHook(() => useFavorites());

    act(() => result.current.toggle(RIBEYE));
    act(() => result.current.toggle(BRISKET));

    expect(result.current.favorites.map((favorite) => favorite.foodId)).toEqual([
      'beef-brisket',
      'beef-ribeye',
    ]);
  });

  it('removes a favourite by id and persists the shorter list', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.toggle(RIBEYE));
    const [favorite] = result.current.favorites;

    act(() => result.current.remove(favorite!.id));

    expect(result.current.favorites).toEqual([]);
    expect(stored()).toEqual([]);
  });

  it('ignores a removal that matches nothing', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.toggle(RIBEYE));
    const before = result.current.favorites;

    act(() => result.current.remove('not-a-favourite'));

    expect(result.current.favorites).toEqual(before);
  });

  it('drops a stored favourite whose cut is no longer on the menu', () => {
    store([
      { foodId: 'beef-retired-cut', quality: 'standard', plateSize: 'regular' },
      { ...RIBEYE, createdAt: '2026-08-16T12:00:00.000Z' },
    ]);

    const { result } = renderHook(() => useFavorites());

    expect(result.current.favorites.map((favorite) => favorite.foodId)).toEqual(['beef-ribeye']);
  });

  it('resolves favourites against the catalogue it is given', () => {
    // A diner-authored cut only exists in the catalogue passed in, so pinning
    // one proves the hook is not silently reading the built-in dataset.
    const custom: FoodItem = { ...FOODS[0]!, id: 'house-special', name: 'House special' };
    const config: FavoriteConfig = {
      foodId: 'house-special',
      quality: 'standard',
      plateSize: 'regular',
    };
    const { result } = renderHook(() => useFavorites([custom]));

    act(() => result.current.toggle(config));

    expect(result.current.has(config)).toBe(true);
    expect(result.current.favorites[0]?.foodId).toBe('house-special');
  });
});
