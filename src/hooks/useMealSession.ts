'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
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
import { mealItemId } from '@/lib/mealItems';
import { isDinerId, normaliseDinerName, reconcileItemAllocations } from '@/lib/diners';
import { DEFAULT_PRICING_PROFILE_ID } from '@/lib/pricing';
import { resolvePricingProfile } from '@/lib/pricingProfiles';
import { foodCatalogue } from '@/lib/foodCatalogue';
import type {
  DamageReport,
  Diner,
  MealItem,
  MealSession,
  PlateSize,
  QualityTier,
  SessionConfig,
} from '@/types/meal';
import type { PricingProfile } from '@/types/pricing';
import type { CustomFood } from '@/types/customFoods';

export const INITIAL_SESSION: MealSession = {
  restaurantName: '',
  pricePerDiner: DEFAULT_PRICE_PER_DINER,
  dinerCount: DEFAULT_DINER_COUNT,
  pricingProfileId: DEFAULT_PRICING_PROFILE_ID,
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
  | { type: 'set-pricing-profile'; id: string }
  | { type: 'adjust-diner-count'; delta: number }
  | { type: 'apply-setup'; setup: SessionConfig }
  | { type: 'add-diner'; diner: Diner }
  | { type: 'rename-diner'; id: string; displayName: string }
  | { type: 'set-diner-admission-price'; id: string; value: number | undefined }
  | { type: 'remove-diner'; id: string }
  | { type: 'move-diner'; id: string; direction: -1 | 1 }
  | { type: 'clear-diners' }
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

export function sessionReducer(state: MealSession, action: SessionAction): MealSession {
  switch (action.type) {
    case 'hydrate':
      return action.session;

    case 'set-restaurant-name':
      return { ...state, restaurantName: normaliseRestaurantNameInput(action.value) };

    case 'set-price-per-diner':
      return { ...state, pricePerDiner: clampPricePerDiner(action.value) };

    case 'set-pricing-profile':
      return { ...state, pricingProfileId: action.id };

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
        pricingProfileId: action.setup.pricingProfileId ?? DEFAULT_PRICING_PROFILE_ID,
      };

    case 'add-diner': {
      const displayName = normaliseDinerName(action.diner.displayName);
      if (
        !displayName ||
        !isDinerId(action.diner.id) ||
        state.diners?.some((diner) => diner.id === action.diner.id) ||
        (state.diners?.length ?? 0) >= 12
      ) {
        return state;
      }
      const admissionPrice =
        typeof action.diner.admissionPrice === 'number' &&
        Number.isFinite(action.diner.admissionPrice) &&
        action.diner.admissionPrice > 0
          ? clampPricePerDiner(action.diner.admissionPrice)
          : undefined;
      const diners = [
        ...(state.diners ?? []),
        {
          id: action.diner.id,
          displayName,
          ...(admissionPrice === undefined ? {} : { admissionPrice }),
        },
      ];
      return { ...state, diners, dinerCount: diners.length };
    }

    case 'rename-diner': {
      const displayName = normaliseDinerName(action.displayName);
      if (!displayName || !state.diners?.some((diner) => diner.id === action.id)) {
        return state;
      }
      return {
        ...state,
        diners: state.diners.map((diner) =>
          diner.id === action.id ? { ...diner, displayName } : diner,
        ),
      };
    }

    case 'set-diner-admission-price': {
      if (!state.diners?.some((diner) => diner.id === action.id)) {
        return state;
      }
      const admissionPrice =
        typeof action.value === 'number' && Number.isFinite(action.value) && action.value > 0
          ? clampPricePerDiner(action.value)
          : undefined;
      return {
        ...state,
        diners: state.diners.map((diner) => {
          if (diner.id !== action.id) return diner;
          const { admissionPrice: _admissionPrice, ...defaultDiner } = diner;
          return admissionPrice === undefined ? defaultDiner : { ...defaultDiner, admissionPrice };
        }),
      };
    }

    case 'remove-diner': {
      const diners = state.diners?.filter((diner) => diner.id !== action.id) ?? [];
      if (diners.length === (state.diners?.length ?? 0)) {
        return state;
      }
      const items = state.items.map((item) =>
        reconcileItemAllocations(
          item.allocations
            ? {
                ...item,
                allocations: item.allocations.filter((entry) => entry.dinerId !== action.id),
              }
            : item,
          diners,
        ),
      );
      if (diners.length === 0) {
        const { diners: _diners, ...sharedSession } = state;
        return { ...sharedSession, items };
      }
      return {
        ...state,
        diners,
        dinerCount: diners.length,
        // A removed diner's plates become shared-table food. The line total is
        // untouched, so neither value nor nutrition can disappear with them.
        items,
      };
    }

    case 'move-diner': {
      const diners = [...(state.diners ?? [])];
      const index = diners.findIndex((diner) => diner.id === action.id);
      const destination = index + action.direction;
      if (index < 0 || destination < 0 || destination >= diners.length) {
        return state;
      }
      const [diner] = diners.splice(index, 1);
      diners.splice(destination, 0, diner!);
      return { ...state, diners };
    }

    case 'clear-diners':
      if (!state.diners?.length) {
        return state;
      }
      {
        const { diners: _diners, ...sharedSession } = state;
        return {
          ...sharedSession,
          items: state.items.map((item) => {
            const { allocations: _allocations, ...sharedItem } = item;
            return sharedItem;
          }),
        };
      }

    case 'add-item': {
      const quantity = clampQuantity(action.payload.quantity);
      const id = mealItemId(action.payload);
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
  setPricingProfile: (id: string) => void;
  adjustDinerCount: (delta: number) => void;
  applySetup: (setup: SessionConfig) => void;
  addDiner: (diner: Diner) => void;
  renameDiner: (id: string, displayName: string) => void;
  setDinerAdmissionPrice: (id: string, value: number | undefined) => void;
  removeDiner: (id: string) => void;
  moveDiner: (id: string, direction: -1 | 1) => void;
  clearDiners: () => void;
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

export function useMealSession(
  pricingProfiles: readonly PricingProfile[] = [],
  customFoods: readonly CustomFood[] = [],
): UseMealSessionResult & { pricingProfile: PricingProfile } {
  const [{ session, hydrated }, dispatch] = useReducer(hydrationReducer, INITIAL_STATE);
  const foods = useMemo(() => foodCatalogue(customFoods), [customFoods]);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) {
      return;
    }
    loaded.current = true;
    dispatch({ type: 'hydrate', session: loadSession(foods) ?? INITIAL_SESSION });
  }, [foods]);

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

  const pricingProfile = useMemo(
    () => resolvePricingProfile(pricingProfiles, session.pricingProfileId),
    [pricingProfiles, session.pricingProfileId],
  );
  const report = useMemo(
    () => buildDamageReport(session.items, session, pricingProfile, foods),
    [session, pricingProfile, foods],
  );

  const setRestaurantName = useCallback((value: string) => {
    dispatch({ type: 'set-restaurant-name', value });
  }, []);

  const setPricePerDiner = useCallback((value: number) => {
    dispatch({ type: 'set-price-per-diner', value });
  }, []);

  const setPricingProfile = useCallback((id: string) => {
    dispatch({ type: 'set-pricing-profile', id });
  }, []);

  const adjustDinerCount = useCallback((delta: number) => {
    dispatch({ type: 'adjust-diner-count', delta });
  }, []);

  const applySetup = useCallback((setup: SessionConfig) => {
    dispatch({ type: 'apply-setup', setup });
  }, []);

  const addDiner = useCallback((diner: Diner) => {
    dispatch({ type: 'add-diner', diner });
  }, []);

  const renameDiner = useCallback((id: string, displayName: string) => {
    dispatch({ type: 'rename-diner', id, displayName });
  }, []);

  const setDinerAdmissionPrice = useCallback((id: string, value: number | undefined) => {
    dispatch({ type: 'set-diner-admission-price', id, value });
  }, []);

  const removeDiner = useCallback((id: string) => {
    dispatch({ type: 'remove-diner', id });
  }, []);

  const moveDiner = useCallback((id: string, direction: -1 | 1) => {
    dispatch({ type: 'move-diner', id, direction });
  }, []);

  const clearDiners = useCallback(() => {
    dispatch({ type: 'clear-diners' });
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
    setPricingProfile,
    adjustDinerCount,
    applySetup,
    addDiner,
    renameDiner,
    setDinerAdmissionPrice,
    removeDiner,
    moveDiner,
    clearDiners,
    addItem,
    incrementItem,
    decrementItem,
    removeItem,
    restoreItem,
    resetSession,
    pricingProfile,
  };
}
