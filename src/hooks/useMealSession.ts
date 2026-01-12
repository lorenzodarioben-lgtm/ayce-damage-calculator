'use client';

import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { buildDamageReport, clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import {
  DEFAULT_DINER_COUNT,
  DEFAULT_PRICE_PER_DINER,
  MAX_LINE_QUANTITY,
  MIN_QUANTITY,
} from '@/lib/constants';
import {
  clearSession,
  loadSession,
  normaliseRestaurantNameInput,
  sanitiseRestaurantName,
  saveSession,
} from '@/lib/storage';
import type {
  DamageReport,
  MealItem,
  MealSession,
  PlateSize,
  QualityTier,
  SessionConfig,
} from '@/types/meal';

export const INITIAL_SESSION: MealSession = {
  restaurantName: '',
  pricePerDiner: DEFAULT_PRICE_PER_DINER,
  dinerCount: DEFAULT_DINER_COUNT,
  items: [],
};

export interface AddItemPayload {
  foodId: string;
  quality: QualityTier;
  plateSize: PlateSize;
  quantity: number;
}

export type SessionAction =
  | { type: 'hydrate'; session: MealSession }
  | { type: 'set-restaurant-name'; value: string }
  | { type: 'set-price-per-diner'; value: number }
  | { type: 'adjust-diner-count'; delta: number }
  | { type: 'apply-setup'; setup: SessionConfig }
  | { type: 'add-item'; payload: AddItemPayload }
  | { type: 'increment-item'; id: string }
  | { type: 'decrement-item'; id: string }
  | { type: 'remove-item'; id: string }
  | { type: 'restore-item'; item: MealItem; index: number }
  | { type: 'reset' };

function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_QUANTITY;
  }
  return Math.min(MAX_LINE_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(value)));
}

function createItemId(payload: AddItemPayload): string {
  return `${payload.foodId}__${payload.quality}__${payload.plateSize}`;
}

export function sessionReducer(state: MealSession, action: SessionAction): MealSession {
  switch (action.type) {
    case 'hydrate':
      return action.session;

    case 'set-restaurant-name':
      return { ...state, restaurantName: normaliseRestaurantNameInput(action.value) };

    case 'set-price-per-diner':
      return { ...state, pricePerDiner: clampPricePerDiner(action.value) };

    case 'adjust-diner-count':
      return { ...state, dinerCount: clampDinerCount(state.dinerCount + action.delta) };

    case 'apply-setup':
      // Replaces the session configuration only. The tab is deliberately
      // untouched: applying a preset must never cost the user their plates.
      return {
        ...state,
        restaurantName: sanitiseRestaurantName(action.setup.restaurantName),
        pricePerDiner: clampPricePerDiner(action.setup.pricePerDiner),
        dinerCount: clampDinerCount(action.setup.dinerCount),
      };

    case 'add-item': {
      const quantity = clampQuantity(action.payload.quantity);
      const id = createItemId(action.payload);
      const existing = state.items.find((item) => item.id === id);

      if (existing) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === id ? { ...item, quantity: clampQuantity(item.quantity + quantity) } : item,
          ),
        };
      }

      const item: MealItem = {
        id,
        foodId: action.payload.foodId,
        quality: action.payload.quality,
        plateSize: action.payload.plateSize,
        quantity,
      };
      return { ...state, items: [...state.items, item] };
    }

    case 'increment-item':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, quantity: clampQuantity(item.quantity + 1) } : item,
        ),
      };

    case 'decrement-item':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, quantity: clampQuantity(item.quantity - 1) } : item,
        ),
      };

    case 'remove-item':
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };

    case 'restore-item': {
      // Undoing a removal has to be a no-op if the same line is already back —
      // the tab is keyed by configuration, so re-adding it by hand first and
      // then taking the undo must not produce a duplicate.
      if (state.items.some((item) => item.id === action.item.id)) {
        return state;
      }
      const items = [...state.items];
      // The index is where the line used to be. Anything outside the current
      // bounds simply lands at the end rather than being rejected.
      items.splice(Math.min(Math.max(0, action.index), items.length), 0, {
        ...action.item,
        quantity: clampQuantity(action.item.quantity),
      });
      return { ...state, items };
    }

    case 'reset':
      return INITIAL_SESSION;
  }
}

export interface UseMealSessionResult {
  session: MealSession;
  report: DamageReport;
  /** False until the stored session has been read, so callers can wait for it. */
  hydrated: boolean;
  setRestaurantName: (value: string) => void;
  setPricePerDiner: (value: number) => void;
  adjustDinerCount: (delta: number) => void;
  applySetup: (setup: SessionConfig) => void;
  addItem: (payload: AddItemPayload) => void;
  incrementItem: (id: string) => void;
  decrementItem: (id: string) => void;
  removeItem: (id: string) => void;
  /** Puts a removed line back where it was, so a removal can be undone. */
  restoreItem: (item: MealItem, index: number) => void;
  resetSession: () => void;
}

interface HydrationState {
  readonly session: MealSession;
  /** False until the stored session has been read and applied. */
  readonly hydrated: boolean;
}

const INITIAL_STATE: HydrationState = { session: INITIAL_SESSION, hydrated: false };

/**
 * Carries the hydration flag alongside the session so persistence can key off
 * committed state. Tracking it in a ref would let the save effect fire on the
 * mount commit, writing the empty initial session over a stored tab.
 */
function hydrationReducer(state: HydrationState, action: SessionAction): HydrationState {
  if (action.type === 'hydrate') {
    return { session: action.session, hydrated: true };
  }
  return { session: sessionReducer(state.session, action), hydrated: state.hydrated };
}

export function useMealSession(): UseMealSessionResult {
  const [{ session, hydrated }, dispatch] = useReducer(hydrationReducer, INITIAL_STATE);

  useEffect(() => {
    dispatch({ type: 'hydrate', session: loadSession() ?? INITIAL_SESSION });
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    // A reset returns the shared INITIAL_SESSION object, so an identity check
    // distinguishes "nothing to remember" from a session that merely looks
    // untouched, and leaves no stale key behind.
    if (session === INITIAL_SESSION) {
      clearSession();
      return;
    }
    saveSession(session);
  }, [session, hydrated]);

  const report = useMemo(() => buildDamageReport(session.items, session), [session]);

  const setRestaurantName = useCallback((value: string) => {
    dispatch({ type: 'set-restaurant-name', value });
  }, []);

  const setPricePerDiner = useCallback((value: number) => {
    dispatch({ type: 'set-price-per-diner', value });
  }, []);

  const adjustDinerCount = useCallback((delta: number) => {
    dispatch({ type: 'adjust-diner-count', delta });
  }, []);

  const applySetup = useCallback((setup: SessionConfig) => {
    dispatch({ type: 'apply-setup', setup });
  }, []);

  const addItem = useCallback((payload: AddItemPayload) => {
    dispatch({ type: 'add-item', payload });
  }, []);

  const incrementItem = useCallback((id: string) => {
    dispatch({ type: 'increment-item', id });
  }, []);

  const decrementItem = useCallback((id: string) => {
    dispatch({ type: 'decrement-item', id });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: 'remove-item', id });
  }, []);

  const restoreItem = useCallback((item: MealItem, index: number) => {
    dispatch({ type: 'restore-item', item, index });
  }, []);

  const resetSession = useCallback(() => {
    clearSession();
    dispatch({ type: 'reset' });
  }, []);

  return {
    session,
    report,
    hydrated,
    setRestaurantName,
    setPricePerDiner,
    adjustDinerCount,
    applySetup,
    addItem,
    incrementItem,
    decrementItem,
    removeItem,
    restoreItem,
    resetSession,
  };
}
