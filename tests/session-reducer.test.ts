import { describe, expect, it } from 'vitest';
import { INITIAL_SESSION, sessionReducer } from '@/hooks/useMealSession';
import type { MealSession } from '@/types/meal';

const addRibeye = {
  type: 'add-item',
  payload: { foodId: 'beef-ribeye', quality: 'premium', plateSize: 'regular', quantity: 2 },
} as const;

describe('sessionReducer', () => {
  it('merges identical food, quality and plate size into one line', () => {
    const once = sessionReducer(INITIAL_SESSION, addRibeye);
    const twice = sessionReducer(once, addRibeye);

    expect(twice.items).toHaveLength(1);
    expect(twice.items[0]?.quantity).toBe(4);
  });

  it('keeps separate lines when configuration differs', () => {
    const once = sessionReducer(INITIAL_SESSION, addRibeye);
    const twice = sessionReducer(once, {
      type: 'add-item',
      payload: { foodId: 'beef-ribeye', quality: 'house', plateSize: 'regular', quantity: 1 },
    });
    expect(twice.items).toHaveLength(2);
  });

  it('never decrements below one plate', () => {
    let state: MealSession = sessionReducer(INITIAL_SESSION, {
      type: 'add-item',
      payload: { foodId: 'pork-belly', quality: 'standard', plateSize: 'small', quantity: 1 },
    });
    const id = state.items[0]!.id;

    state = sessionReducer(state, { type: 'decrement-item', id });
    state = sessionReducer(state, { type: 'decrement-item', id });

    expect(state.items[0]?.quantity).toBe(1);
  });

  it('caps a line at the maximum quantity', () => {
    let state = sessionReducer(INITIAL_SESSION, {
      type: 'add-item',
      payload: { foodId: 'pork-belly', quality: 'standard', plateSize: 'small', quantity: 20 },
    });
    for (let i = 0; i < 10; i += 1) {
      state = sessionReducer(state, {
        type: 'add-item',
        payload: { foodId: 'pork-belly', quality: 'standard', plateSize: 'small', quantity: 20 },
      });
    }
    expect(state.items[0]?.quantity).toBe(99);
  });

  it('accumulates diner adjustments so batched taps are not lost', () => {
    let state = INITIAL_SESSION;
    for (let i = 0; i < 3; i += 1) {
      state = sessionReducer(state, { type: 'adjust-diner-count', delta: 1 });
    }
    expect(state.dinerCount).toBe(4);
  });

  it('removes a line', () => {
    const state = sessionReducer(INITIAL_SESSION, addRibeye);
    const id = state.items[0]!.id;
    expect(sessionReducer(state, { type: 'remove-item', id }).items).toHaveLength(0);
  });

  it('clamps session configuration', () => {
    let state = sessionReducer(INITIAL_SESSION, { type: 'set-price-per-diner', value: -5 });
    expect(state.pricePerDiner).toBe(1);

    state = sessionReducer(state, { type: 'set-price-per-diner', value: Number.NaN });
    expect(state.pricePerDiner).toBe(1);

    state = sessionReducer(state, { type: 'adjust-diner-count', delta: 40 });
    expect(state.dinerCount).toBe(12);

    state = sessionReducer(state, { type: 'adjust-diner-count', delta: -40 });
    expect(state.dinerCount).toBe(1);
  });

  it('sanitises the restaurant name', () => {
    const state = sessionReducer(INITIAL_SESSION, {
      type: 'set-restaurant-name',
      value: 'x'.repeat(120),
    });
    expect(state.restaurantName).toHaveLength(60);
  });

  it('clears everything on reset', () => {
    let state = sessionReducer(INITIAL_SESSION, addRibeye);
    state = sessionReducer(state, { type: 'set-restaurant-name', value: 'Seoul Garden' });
    state = sessionReducer(state, { type: 'reset' });
    expect(state).toEqual(INITIAL_SESSION);
  });
});
