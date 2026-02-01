'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { buildDamageReport } from '@/lib/calculations';
import type { AdjustmentDraft } from '@/lib/adjustments';
import { createId } from '@/lib/id';
import { sessionLifecycle } from '@/lib/mealEvents';
import {
  INITIAL_SESSION,
  sessionReducer,
  type AddItemPayload,
  type MealEventMeta,
  type SessionAction,
} from '@/lib/sessionReducer';
import { clearSession, loadSession, saveSession } from '@/lib/storage';
import { resolvePricingProfile } from '@/lib/pricingProfiles';
import { foodCatalogue } from '@/lib/foodCatalogue';
import type {
  DamageReport,
  Diner,
  DinerAllocation,
  MealItem,
  MealSession,
  SessionConfig,
} from '@/types/meal';
import type { MealEventSource, MealLifecycle } from '@/types/mealEvents';
import type { PricingProfile } from '@/types/pricing';
import type { CustomFood } from '@/types/customFoods';

/**
 * Re-exported so every existing caller keeps importing the meal model from one
 * place, even though the reducer itself now lives in `@/lib/sessionReducer`
 * where it can be read and tested without React in the way.
 */
export { INITIAL_SESSION, sessionReducer };
export type { AddItemPayload, MealEventMeta, SessionAction };

export interface UseMealSessionResult {
  session: MealSession;
  report: DamageReport;
  /** False until the stored session has been read, so callers can wait for it. */
  hydrated: boolean;
  /** Where the meal is in its own life; `idle` until food is actually logged. */
  lifecycle: MealLifecycle;
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
  addAdjustment: (draft: AdjustmentDraft, id: string) => void;
  removeAdjustment: (id: string) => void;
  clearAdjustments: () => void;
  addItem: (payload: AddItemPayload) => void;
  incrementItem: (id: string) => void;
  decrementItem: (id: string) => void;
  setItemConsumption: (id: string, consumed: number) => void;
  setItemAllocations: (id: string, allocations: readonly DinerAllocation[]) => void;
  removeItem: (id: string) => void;
  /** Puts a removed line back where it was, so a removal can be undone. */
  restoreItem: (item: MealItem, index: number) => void;
  /** Books a meal window, or clears it with `undefined`. Never starts the meal. */
  setMealDuration: (minutes: number | undefined) => void;
  /** Marks a line as bought outside the buffet price, at a stated amount. */
  setItemCharge: (id: string, separate: boolean, charge?: number) => void;
  pauseMeal: () => void;
  resumeMeal: () => void;
  completeMeal: () => void;
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

export interface UseMealSessionOptions {
  /**
   * Which surface is dispatching, recorded on every event so a replay can say
   * whether a plate was logged at the table or added in the full builder.
   */
  readonly source?: MealEventSource;
}

export function useMealSession(
  pricingProfiles: readonly PricingProfile[] = [],
  customFoods: readonly CustomFood[] = [],
  options: UseMealSessionOptions = {},
): UseMealSessionResult & { pricingProfile: PricingProfile } {
  const [{ session, hydrated }, dispatch] = useReducer(hydrationReducer, INITIAL_STATE);
  const foods = useMemo(() => foodCatalogue(customFoods), [customFoods]);
  const loaded = useRef(false);

  const source = options.source ?? 'builder';
  // The reducer is pure, so the moment an action happened has to be handed to
  // it. This is the only place in the meal model that reads a clock.
  const meta = useCallback(
    (): MealEventMeta => ({ id: createId(), at: new Date().toISOString(), source }),
    [source],
  );

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

  const addDiner = useCallback(
    (diner: Diner) => {
      dispatch({ type: 'add-diner', diner, meta: meta() });
    },
    [meta],
  );

  const renameDiner = useCallback((id: string, displayName: string) => {
    dispatch({ type: 'rename-diner', id, displayName });
  }, []);

  const setDinerAdmissionPrice = useCallback((id: string, value: number | undefined) => {
    dispatch({ type: 'set-diner-admission-price', id, value });
  }, []);

  const removeDiner = useCallback(
    (id: string) => {
      dispatch({ type: 'remove-diner', id, meta: meta() });
    },
    [meta],
  );

  const moveDiner = useCallback((id: string, direction: -1 | 1) => {
    dispatch({ type: 'move-diner', id, direction });
  }, []);

  const clearDiners = useCallback(() => {
    dispatch({ type: 'clear-diners', meta: meta() });
  }, [meta]);

  const addAdjustment = useCallback((draft: AdjustmentDraft, id: string) => {
    dispatch({ type: 'add-adjustment', draft, id });
  }, []);

  const removeAdjustment = useCallback((id: string) => {
    dispatch({ type: 'remove-adjustment', id });
  }, []);

  const clearAdjustments = useCallback(() => {
    dispatch({ type: 'clear-adjustments' });
  }, []);

  const setItemConsumption = useCallback(
    (id: string, consumed: number) => {
      dispatch({ type: 'set-item-consumption', id, consumed, meta: meta() });
    },
    [meta],
  );

  const addItem = useCallback(
    (payload: AddItemPayload) => {
      dispatch({ type: 'add-item', payload, meta: meta() });
    },
    [meta],
  );

  const incrementItem = useCallback(
    (id: string) => {
      dispatch({ type: 'increment-item', id, meta: meta() });
    },
    [meta],
  );

  const decrementItem = useCallback(
    (id: string) => {
      dispatch({ type: 'decrement-item', id, meta: meta() });
    },
    [meta],
  );

  const setItemAllocations = useCallback(
    (id: string, allocations: readonly DinerAllocation[]) => {
      dispatch({ type: 'set-item-allocations', id, allocations, meta: meta() });
    },
    [meta],
  );

  const removeItem = useCallback(
    (id: string) => {
      dispatch({ type: 'remove-item', id, meta: meta() });
    },
    [meta],
  );

  const restoreItem = useCallback(
    (item: MealItem, index: number) => {
      dispatch({ type: 'restore-item', item, index, meta: meta() });
    },
    [meta],
  );

  const setMealDuration = useCallback((minutes: number | undefined) => {
    dispatch({ type: 'set-meal-duration', minutes });
  }, []);

  const pauseMeal = useCallback(() => {
    dispatch({ type: 'pause-meal', meta: meta() });
  }, [meta]);

  const resumeMeal = useCallback(() => {
    dispatch({ type: 'resume-meal', meta: meta() });
  }, [meta]);

  const completeMeal = useCallback(() => {
    dispatch({ type: 'complete-meal', meta: meta() });
  }, [meta]);

  const setItemCharge = useCallback((id: string, separate: boolean, charge?: number) => {
    dispatch({
      type: 'set-item-charge',
      id,
      separate,
      ...(charge === undefined ? {} : { charge }),
    });
  }, []);

  const resetSession = useCallback(() => {
    clearSession();
    dispatch({ type: 'reset' });
  }, []);

  return {
    session,
    report,
    hydrated,
    lifecycle: sessionLifecycle(session.lifecycle),
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
    addAdjustment,
    removeAdjustment,
    clearAdjustments,
    addItem,
    incrementItem,
    decrementItem,
    setItemConsumption,
    setItemAllocations,
    removeItem,
    restoreItem,
    setMealDuration,
    pauseMeal,
    resumeMeal,
    completeMeal,
    setItemCharge,
    resetSession,
    pricingProfile,
  };
}
