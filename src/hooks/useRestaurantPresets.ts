'use client';

import { useCallback, useState } from 'react';
import {
  createPreset,
  loadPresets,
  removePreset,
  savePresets,
  upsertPreset,
  type PresetDraft,
  type RestaurantPreset,
} from '@/lib/presets';

export interface UseRestaurantPresetsResult {
  presets: readonly RestaurantPreset[];
  /** Returns the saved preset, or null when the draft had no usable name. */
  save: (draft: PresetDraft) => RestaurantPreset | null;
  remove: (id: string) => void;
}

interface State {
  readonly presets: readonly RestaurantPreset[];
  readonly hydrated: boolean;
}

const INITIAL: State = { presets: [], hydrated: false };

/** Restaurant presets, held on this device. Mirrors the favourites hook. */
export function useRestaurantPresets(): UseRestaurantPresetsResult {
  const [state, setState] = useState<State>(INITIAL);

  if (!state.hydrated && typeof window !== 'undefined') {
    setState({ presets: loadPresets(), hydrated: true });
  }

  const save = useCallback((draft: PresetDraft) => {
    const preset = createPreset(draft, new Date().toISOString());
    if (!preset) {
      return null;
    }
    setState((current) => {
      const next = upsertPreset(current.presets, preset);
      savePresets(next);
      return { presets: next, hydrated: true };
    });
    return preset;
  }, []);

  const remove = useCallback((id: string) => {
    setState((current) => {
      const next = removePreset(current.presets, id);
      savePresets(next);
      return { presets: next, hydrated: true };
    });
  }, []);

  return { presets: state.presets, save, remove };
}
