'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildDamageReport } from '@/lib/calculations';
import { createId } from '@/lib/id';
import { sessionLifecycle } from '@/lib/mealEvents';
import {
  INITIAL_SESSION,
  sessionReducer,
  type AddItemPayload,
  type MealEventMeta,
  type SessionAction,
} from '@/lib/sessionReducer';
import {
  clearSession,
  loadSessionState,
  parseStoredSessionState,
  saveSession,
  STORAGE_KEY,
  type StoredSessionState,
} from '@/lib/storage';
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
  addItem: (payload: AddItemPayload) => void;
  incrementItem: (id: string) => void;
  decrementItem: (id: string) => void;
  setItemAllocations: (id: string, allocations: readonly DinerAllocation[]) => void;
  removeItem: (id: string) => void;
  /** Puts a removed line back where it was, so a removal can be undone. */
  restoreItem: (item: MealItem, index: number) => void;
  /** Books a meal window, or clears it with `undefined`. Never starts the meal. */
  setMealDuration: (minutes: number | undefined) => void;
  pauseMeal: () => void;
  resumeMeal: () => void;
  completeMeal: () => void;
  resetSession: () => void;
  /** Present only when another browser tab changed a meal this tab has edited. */
  sessionConflict: SessionConflict | null;
  loadExternalSession: () => void;
  keepCurrentSession: () => void;
}

export interface SessionConflict {
  readonly kind: 'update' | 'reset';
  readonly revision: number;
  readonly session: MealSession | null;
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
  const writerId = useRef<string | null>(null);
  const revision = useRef(0);
  const hasLocalChanges = useRef(false);
  const skipNextPersist = useRef(false);
  const sessionRef = useRef(session);
  const [sessionConflict, setSessionConflict] = useState<SessionConflict | null>(null);

  const source = options.source ?? 'builder';
  // The reducer is pure, so the moment an action happened has to be handed to
  // it. This is the only place in the meal model that reads a clock.
  const meta = useCallback(
    (): MealEventMeta => ({ id: createId(), at: new Date().toISOString(), source }),
    [source],
  );

  const getWriterId = useCallback(() => {
    if (!writerId.current) {
      writerId.current = createId();
    }
    return writerId.current;
  }, []);

  const markLocalChange = useCallback((action: SessionAction) => {
    hasLocalChanges.current = true;
    dispatch(action);
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (loaded.current) {
      return;
    }
    loaded.current = true;
    const stored = loadSessionState(foods);
    revision.current = stored?.revision ?? 0;
    // The first hydrated commit is already represented in storage. Rewriting
    // it would turn a passive reload into a competing tab edit.
    skipNextPersist.current = true;
    dispatch({
      type: 'hydrate',
      session: stored?.session ?? INITIAL_SESSION,
    });
  }, [foods]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    // A reset returns the shared INITIAL_SESSION object, so an identity check
    // distinguishes "nothing to remember" from a session that merely looks
    // untouched, and leaves no stale key behind.
    if (session === INITIAL_SESSION) {
      clearSession();
      return;
    }
    const stored = saveSession(session, {
      writerId: getWriterId(),
      knownRevision: revision.current,
    });
    if (stored) {
      revision.current = stored.revision;
    }
  }, [session, hydrated, getWriterId]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    function receiveExternalState(event: StorageEvent) {
      if (
        event.key !== STORAGE_KEY ||
        (event.storageArea && event.storageArea !== window.localStorage)
      ) {
        return;
      }

      if (event.newValue === null) {
        const reset: SessionConflict = {
          kind: 'reset',
          revision: revision.current + 1,
          session: null,
        };
        if (hasLocalChanges.current) {
          setSessionConflict(reset);
          return;
        }
        revision.current = reset.revision;
        skipNextPersist.current = true;
        dispatch({ type: 'hydrate', session: INITIAL_SESSION });
        return;
      }

      const stored: StoredSessionState | null = parseStoredSessionState(event.newValue, foods);
      if (!stored || stored.writerId === writerId.current) {
        return;
      }
      // Current envelopes are written against the latest localStorage value,
      // so an older delayed event can never be the newer state. Legacy writers
      // carry no revision and are treated as a real change for compatibility.
      if (stored.writerId !== null && stored.revision < revision.current) {
        return;
      }

      const conflict: SessionConflict = {
        kind: 'update',
        revision: stored.revision,
        session: stored.session,
      };

      if (hasLocalChanges.current) {
        setSessionConflict(conflict);
        return;
      }

      revision.current = stored.revision;
      skipNextPersist.current = true;
      dispatch({ type: 'hydrate', session: stored.session });
    }

    window.addEventListener('storage', receiveExternalState);
    return () => window.removeEventListener('storage', receiveExternalState);
  }, [foods, hydrated]);

  const loadExternalSession = useCallback(() => {
    if (!sessionConflict) {
      return;
    }
    revision.current = sessionConflict.revision;
    hasLocalChanges.current = false;
    skipNextPersist.current = true;
    dispatch({ type: 'hydrate', session: sessionConflict.session ?? INITIAL_SESSION });
    setSessionConflict(null);
  }, [sessionConflict]);

  const keepCurrentSession = useCallback(() => {
    if (!sessionConflict) {
      return;
    }
    const context = {
      writerId: getWriterId(),
      knownRevision: Math.max(revision.current, sessionConflict.revision),
    };
    let stored: StoredSessionState | null = null;
    if (sessionRef.current === INITIAL_SESSION) {
      clearSession();
    } else {
      stored = saveSession(sessionRef.current, context);
    }
    if (stored) {
      revision.current = stored.revision;
    } else {
      revision.current = context.knownRevision;
    }
    hasLocalChanges.current = true;
    setSessionConflict(null);
  }, [getWriterId, sessionConflict]);

  const pricingProfile = useMemo(
    () => resolvePricingProfile(pricingProfiles, session.pricingProfileId),
    [pricingProfiles, session.pricingProfileId],
  );
  const report = useMemo(
    () => buildDamageReport(session.items, session, pricingProfile, foods),
    [session, pricingProfile, foods],
  );

  const setRestaurantName = useCallback(
    (value: string) => {
      markLocalChange({ type: 'set-restaurant-name', value });
    },
    [markLocalChange],
  );

  const setPricePerDiner = useCallback(
    (value: number) => {
      markLocalChange({ type: 'set-price-per-diner', value });
    },
    [markLocalChange],
  );

  const setPricingProfile = useCallback(
    (id: string) => {
      markLocalChange({ type: 'set-pricing-profile', id });
    },
    [markLocalChange],
  );

  const adjustDinerCount = useCallback(
    (delta: number) => {
      markLocalChange({ type: 'adjust-diner-count', delta });
    },
    [markLocalChange],
  );

  const applySetup = useCallback(
    (setup: SessionConfig) => {
      markLocalChange({ type: 'apply-setup', setup });
    },
    [markLocalChange],
  );

  const addDiner = useCallback(
    (diner: Diner) => {
      markLocalChange({ type: 'add-diner', diner, meta: meta() });
    },
    [markLocalChange, meta],
  );

  const renameDiner = useCallback(
    (id: string, displayName: string) => {
      markLocalChange({ type: 'rename-diner', id, displayName });
    },
    [markLocalChange],
  );

  const setDinerAdmissionPrice = useCallback(
    (id: string, value: number | undefined) => {
      markLocalChange({ type: 'set-diner-admission-price', id, value });
    },
    [markLocalChange],
  );

  const removeDiner = useCallback(
    (id: string) => {
      markLocalChange({ type: 'remove-diner', id, meta: meta() });
    },
    [markLocalChange, meta],
  );

  const moveDiner = useCallback(
    (id: string, direction: -1 | 1) => {
      markLocalChange({ type: 'move-diner', id, direction });
    },
    [markLocalChange],
  );

  const clearDiners = useCallback(() => {
    markLocalChange({ type: 'clear-diners', meta: meta() });
  }, [markLocalChange, meta]);

  const addItem = useCallback(
    (payload: AddItemPayload) => {
      markLocalChange({ type: 'add-item', payload, meta: meta() });
    },
    [markLocalChange, meta],
  );

  const incrementItem = useCallback(
    (id: string) => {
      markLocalChange({ type: 'increment-item', id, meta: meta() });
    },
    [markLocalChange, meta],
  );

  const decrementItem = useCallback(
    (id: string) => {
      markLocalChange({ type: 'decrement-item', id, meta: meta() });
    },
    [markLocalChange, meta],
  );

  const setItemAllocations = useCallback(
    (id: string, allocations: readonly DinerAllocation[]) => {
      markLocalChange({ type: 'set-item-allocations', id, allocations, meta: meta() });
    },
    [markLocalChange, meta],
  );

  const removeItem = useCallback(
    (id: string) => {
      markLocalChange({ type: 'remove-item', id, meta: meta() });
    },
    [markLocalChange, meta],
  );

  const restoreItem = useCallback(
    (item: MealItem, index: number) => {
      markLocalChange({ type: 'restore-item', item, index, meta: meta() });
    },
    [markLocalChange, meta],
  );

  const setMealDuration = useCallback(
    (minutes: number | undefined) => {
      markLocalChange({ type: 'set-meal-duration', minutes });
    },
    [markLocalChange],
  );

  const pauseMeal = useCallback(() => {
    markLocalChange({ type: 'pause-meal', meta: meta() });
  }, [markLocalChange, meta]);

  const resumeMeal = useCallback(() => {
    markLocalChange({ type: 'resume-meal', meta: meta() });
  }, [markLocalChange, meta]);

  const completeMeal = useCallback(() => {
    markLocalChange({ type: 'complete-meal', meta: meta() });
  }, [markLocalChange, meta]);

  const resetSession = useCallback(() => {
    hasLocalChanges.current = true;
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
    addItem,
    incrementItem,
    decrementItem,
    setItemAllocations,
    removeItem,
    restoreItem,
    setMealDuration,
    pauseMeal,
    resumeMeal,
    completeMeal,
    resetSession,
    sessionConflict,
    loadExternalSession,
    keepCurrentSession,
    pricingProfile,
  };
}
