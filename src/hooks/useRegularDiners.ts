'use client';

import { useCallback, useState } from 'react';
import {
  loadRegularDiners,
  removeRegularDiner,
  saveRegularDiners,
  upsertRegularDiner,
} from '@/lib/regularDiners';
import type { RegularDiner } from '@/lib/regularDiners';

interface State {
  readonly diners: readonly RegularDiner[];
  readonly hydrated: boolean;
}

const INITIAL: State = { diners: [], hydrated: false };

/** A small on-device directory for people the diner regularly eats with. */
export function useRegularDiners() {
  const [state, setState] = useState<State>(INITIAL);
  if (!state.hydrated && typeof window !== 'undefined') {
    setState({ diners: loadRegularDiners(), hydrated: true });
  }

  const save = useCallback((diner: RegularDiner) => {
    setState((current) => {
      const diners = upsertRegularDiner(current.diners, diner);
      saveRegularDiners(diners);
      return { diners, hydrated: true };
    });
  }, []);

  const remove = useCallback((id: string) => {
    setState((current) => {
      const diners = removeRegularDiner(current.diners, id);
      saveRegularDiners(diners);
      return { diners, hydrated: true };
    });
  }, []);

  return { diners: state.diners, hydrated: state.hydrated, save, remove };
}
