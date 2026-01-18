'use client';

import { useCallback, useState } from 'react';
import {
  allPricingProfiles,
  loadPricingProfiles,
  removePricingProfile,
  savePricingProfiles,
  upsertPricingProfile,
} from '@/lib/pricingProfiles';
import type { PricingProfile, PricingProfileId } from '@/types/pricing';

interface State {
  readonly customProfiles: readonly PricingProfile[];
  readonly hydrated: boolean;
}

const INITIAL: State = { customProfiles: [], hydrated: false };

export interface UsePricingProfilesResult {
  readonly profiles: readonly PricingProfile[];
  readonly hydrated: boolean;
  readonly save: (profile: PricingProfile) => void;
  readonly remove: (id: PricingProfileId) => void;
}

/** Pricing assumptions are personal device data, with the AU profile always available. */
export function usePricingProfiles(): UsePricingProfilesResult {
  const [state, setState] = useState<State>(INITIAL);

  if (!state.hydrated && typeof window !== 'undefined') {
    setState({ customProfiles: loadPricingProfiles(), hydrated: true });
  }

  const save = useCallback((profile: PricingProfile) => {
    setState((current) => {
      const customProfiles = upsertPricingProfile(current.customProfiles, profile);
      savePricingProfiles(customProfiles);
      return { customProfiles, hydrated: true };
    });
  }, []);

  const remove = useCallback((id: PricingProfileId) => {
    setState((current) => {
      const customProfiles = removePricingProfile(current.customProfiles, id);
      savePricingProfiles(customProfiles);
      return { customProfiles, hydrated: true };
    });
  }, []);

  return {
    profiles: allPricingProfiles(state.customProfiles),
    hydrated: state.hydrated,
    save,
    remove,
  };
}
