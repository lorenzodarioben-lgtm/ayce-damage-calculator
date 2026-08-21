import { describe, expect, it } from 'vitest';
import { INITIAL_SESSION, sessionReducer } from '@/hooks/useMealSession';
import { DEFAULT_PRICING_PROFILE_ID } from '@/lib/pricing';
import type { MealSession } from '@/types/meal';

const addRibeye = {
  type: 'add-item',
  payload: { foodId: 'beef-ribeye', quality: 'premium', plateSize: 'regular', quantity: 2 },
} as const;

describe('sessionReducer', () => {
  it('starts every new session in the built-in pricing context', () => {
    expect(INITIAL_SESSION.pricingProfileId).toBe(DEFAULT_PRICING_PROFILE_ID);
  });

  it('changes only the active pricing profile when one is selected', () => {
    const next = sessionReducer(INITIAL_SESSION, {
      type: 'set-pricing-profile',
      id: 'custom-downtown-lunch',
    });
    expect(next.pricingProfileId).toBe('custom-downtown-lunch');
    expect(next.items).toBe(INITIAL_SESSION.items);
    expect(next.pricePerDiner).toBe(INITIAL_SESSION.pricePerDiner);
  });
  it('merges identical food, quality and plate size into one line', () => {
    const once = sessionReducer(INITIAL_SESSION, addRibeye);
    const twice = sessionReducer(once, addRibeye);

    expect(twice.items).toHaveLength(1);
    expect(twice.items[0]?.quantity).toBe(4);
  });

  it('attributes added plates to the selected diner while Table additions remain shared', () => {
    let state = sessionReducer(INITIAL_SESSION, {
      type: 'add-diner',
      diner: { id: 'lorenzo', displayName: 'Lorenzo' },
    });
    state = sessionReducer(state, {
      ...addRibeye,
      payload: { ...addRibeye.payload, dinerId: 'lorenzo' },
    });
    state = sessionReducer(state, addRibeye);

    expect(state.items[0]?.quantity).toBe(4);
    expect(state.items[0]?.allocations).toEqual([{ dinerId: 'lorenzo', quantity: 2 }]);
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

  it('keeps roster management optional and returns removed allocations to Table', () => {
    let state = sessionReducer(INITIAL_SESSION, {
      type: 'add-diner',
      diner: { id: 'lorenzo', displayName: 'Lorenzo' },
    });
    state = sessionReducer(state, {
      type: 'add-diner',
      diner: { id: 'omar', displayName: 'Omar' },
    });
    state = sessionReducer(state, {
      type: 'add-item',
      payload: { foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular', quantity: 2 },
    });
    const line = state.items[0]!;
    state = {
      ...state,
      items: [{ ...line, allocations: [{ dinerId: 'lorenzo', quantity: 2 }] }],
    };

    state = sessionReducer(state, { type: 'remove-diner', id: 'lorenzo' });

    expect(state.diners).toEqual([{ id: 'omar', displayName: 'Omar' }]);
    expect(state.dinerCount).toBe(1);
    expect(state.items[0]?.quantity).toBe(2);
    expect(state.items[0]?.allocations).toBeUndefined();
  });

  it('renames, reorders and clears a roster without altering table plates', () => {
    let state = sessionReducer(INITIAL_SESSION, {
      type: 'add-diner',
      diner: { id: 'lorenzo', displayName: 'Lorenzo' },
    });
    state = sessionReducer(state, {
      type: 'add-diner',
      diner: { id: 'omar', displayName: 'Omar' },
    });
    state = sessionReducer(state, {
      type: 'add-item',
      payload: { foodId: 'pork-belly', quality: 'standard', plateSize: 'small', quantity: 3 },
    });
    state = sessionReducer(state, { type: 'rename-diner', id: 'omar', displayName: '  Omar K. ' });
    state = sessionReducer(state, { type: 'move-diner', id: 'omar', direction: -1 });
    state = sessionReducer(state, { type: 'clear-diners' });

    expect(state.diners).toBeUndefined();
    expect(state.items[0]?.quantity).toBe(3);
  });

  it('clamps individual admission prices and falls back to the session default when cleared', () => {
    let state = sessionReducer(INITIAL_SESSION, {
      type: 'add-diner',
      diner: { id: 'lorenzo', displayName: 'Lorenzo' },
    });
    state = sessionReducer(state, {
      type: 'set-diner-admission-price',
      id: 'lorenzo',
      value: 9999,
    });
    expect(state.diners?.[0]?.admissionPrice).toBe(500);

    state = sessionReducer(state, {
      type: 'set-diner-admission-price',
      id: 'lorenzo',
      value: undefined,
    });
    expect(state.diners?.[0]?.admissionPrice).toBeUndefined();
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

  it('restores a removed line to the position it was taken from', () => {
    let state = sessionReducer(INITIAL_SESSION, {
      type: 'add-item',
      payload: { foodId: 'beef-brisket', quality: 'standard', plateSize: 'regular', quantity: 1 },
    });
    state = sessionReducer(state, addRibeye);
    state = sessionReducer(state, {
      type: 'add-item',
      payload: { foodId: 'pork-belly', quality: 'standard', plateSize: 'large', quantity: 3 },
    });

    const removed = state.items[1];
    expect(removed).toBeDefined();

    const without = sessionReducer(state, { type: 'remove-item', id: removed!.id });
    expect(without.items).toHaveLength(2);

    const restored = sessionReducer(without, { type: 'restore-item', item: removed!, index: 1 });
    expect(restored.items).toEqual(state.items);
  });

  it('restores the removed quantity, not a fresh plate', () => {
    const state = sessionReducer(INITIAL_SESSION, addRibeye);
    const removed = state.items[0];
    expect(removed?.quantity).toBe(2);

    const restored = sessionReducer(INITIAL_SESSION, {
      type: 'restore-item',
      item: removed!,
      index: 0,
    });
    expect(restored.items[0]?.quantity).toBe(2);
  });

  it('clamps a restored quantity that is out of bounds', () => {
    const state = sessionReducer(INITIAL_SESSION, addRibeye);
    const removed = state.items[0];

    const restored = sessionReducer(INITIAL_SESSION, {
      type: 'restore-item',
      item: { ...removed!, quantity: 5000 },
      index: 0,
    });
    expect(restored.items[0]?.quantity).toBe(99);
  });

  it('appends a restored line when its old position no longer exists', () => {
    const state = sessionReducer(INITIAL_SESSION, addRibeye);
    const removed = state.items[0];

    const restored = sessionReducer(INITIAL_SESSION, {
      type: 'restore-item',
      item: removed!,
      index: 42,
    });
    expect(restored.items).toHaveLength(1);
  });

  it('does not duplicate a line that is already back on the tab', () => {
    const state = sessionReducer(INITIAL_SESSION, addRibeye);
    const removed = state.items[0];

    const restored = sessionReducer(state, { type: 'restore-item', item: removed!, index: 0 });
    expect(restored).toBe(state);
  });

  it('clears everything on reset', () => {
    let state = sessionReducer(INITIAL_SESSION, addRibeye);
    state = sessionReducer(state, { type: 'set-restaurant-name', value: 'Seoul Garden' });
    state = sessionReducer(state, { type: 'reset' });
    expect(state).toEqual(INITIAL_SESSION);
  });
});
