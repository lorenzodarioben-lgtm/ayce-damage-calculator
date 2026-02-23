import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRegularDiners } from '@/hooks/useRegularDiners';
import {
  REGULAR_DINERS_STORAGE_KEY,
  REGULAR_DINERS_VERSION,
  type RegularDiner,
} from '@/lib/regularDiners';

/*
 * The directory is the one place a name outlives the meal it was typed into,
 * so what the hook holds and what storage holds have to agree after every
 * edit: a returning diner is shown the list, not a re-read of it.
 */

const ALEX: RegularDiner = { id: 'diner-alex', displayName: 'Alex' };
const SAM: RegularDiner = { id: 'diner-sam', displayName: 'Sam' };

function store(diners: readonly unknown[]) {
  window.localStorage.setItem(
    REGULAR_DINERS_STORAGE_KEY,
    JSON.stringify({ version: REGULAR_DINERS_VERSION, diners }),
  );
}

function stored(): readonly RegularDiner[] {
  const raw = window.localStorage.getItem(REGULAR_DINERS_STORAGE_KEY);
  return raw === null ? [] : JSON.parse(raw).diners;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('useRegularDiners', () => {
  it('has already read the directory by the time the first render returns', () => {
    store([ALEX]);

    const { result } = renderHook(() => useRegularDiners());

    expect(result.current.hydrated).toBe(true);
    expect(result.current.diners).toEqual([ALEX]);
  });

  it('reports an empty directory as read rather than as still loading', () => {
    const { result } = renderHook(() => useRegularDiners());

    expect(result.current.hydrated).toBe(true);
    expect(result.current.diners).toEqual([]);
  });

  it('files a new person and writes the directory through', () => {
    const { result } = renderHook(() => useRegularDiners());

    act(() => result.current.save(ALEX));

    expect(result.current.diners).toEqual([ALEX]);
    expect(stored()).toEqual([ALEX]);
  });

  it('puts the person just saved at the front', () => {
    store([ALEX]);
    const { result } = renderHook(() => useRegularDiners());

    act(() => result.current.save(SAM));

    expect(result.current.diners.map((diner) => diner.id)).toEqual(['diner-sam', 'diner-alex']);
  });

  it('replaces an entry rather than repeating it when the id comes back', () => {
    store([ALEX]);
    const { result } = renderHook(() => useRegularDiners());

    act(() => result.current.save({ id: 'diner-alex', displayName: 'Alexandra' }));

    expect(result.current.diners).toEqual([{ id: 'diner-alex', displayName: 'Alexandra' }]);
  });

  it('refuses a nameless entry, which nothing could tell apart later', () => {
    const { result } = renderHook(() => useRegularDiners());

    act(() => result.current.save({ id: 'diner-blank', displayName: '   ' }));

    expect(result.current.diners).toEqual([]);
  });

  it('removes a person by id and persists the shorter directory', () => {
    store([ALEX, SAM]);
    const { result } = renderHook(() => useRegularDiners());

    act(() => result.current.remove('diner-alex'));

    expect(result.current.diners).toEqual([SAM]);
    expect(stored()).toEqual([SAM]);
  });

  it('ignores a removal that matches nobody', () => {
    store([ALEX]);
    const { result } = renderHook(() => useRegularDiners());

    act(() => result.current.remove('diner-nobody'));

    expect(result.current.diners).toEqual([ALEX]);
  });

  it('starts empty when the stored directory is unreadable', () => {
    window.localStorage.setItem(REGULAR_DINERS_STORAGE_KEY, '{ not json');

    const { result } = renderHook(() => useRegularDiners());

    expect(result.current.hydrated).toBe(true);
    expect(result.current.diners).toEqual([]);
  });
});
