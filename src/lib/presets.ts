import { clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import { isIsoTimestamp } from '@/lib/datetime';
import { sanitiseRestaurantName } from '@/lib/storage';

export const PRESETS_STORAGE_KEY = 'ayce-damage-presets';
export const PRESETS_VERSION = 1;

/** Presets are a short personal list, not an unbounded JSON document. */
export const MAX_STORED_PRESETS_LENGTH = 32 * 1024;

/** A short list by design: this is a personal set of regular haunts. */
export const MAX_PRESETS = 12;

/**
 * A reusable session setup the user wrote themselves.
 *
 * There is deliberately no bundled database of real restaurants — prices vary
 * by city, branch and night, and inventing them would put made-up figures in
 * front of the user under the app's own name.
 */
export interface RestaurantPreset {
  readonly id: string;
  readonly name: string;
  readonly pricePerDiner: number;
  readonly dinerCount: number;
  readonly createdAt: string;
}

export interface PresetDraft {
  readonly name: string;
  readonly pricePerDiner: number;
  readonly dinerCount: number;
}

interface StoredEnvelope {
  version: number;
  presets: readonly RestaurantPreset[];
}

/**
 * Identity is the name, case- and space-insensitively.
 *
 * Saving "Seoul Garden" twice updates the one preset rather than making a
 * second, which is what turns "save" into "save or edit" without a separate
 * editing mode.
 */
export function presetId(name: string): string {
  return sanitiseRestaurantName(name).trim().toLowerCase().replace(/\s+/g, '-');
}

export function createPreset(draft: PresetDraft, createdAt: string): RestaurantPreset | null {
  const name = sanitiseRestaurantName(draft.name).trim();
  // A preset with no name could not be told apart from any other.
  if (name.length === 0) {
    return null;
  }

  return {
    id: presetId(name),
    name,
    pricePerDiner: clampPricePerDiner(draft.pricePerDiner),
    dinerCount: clampDinerCount(draft.dinerCount),
    createdAt,
  };
}

/** Adds or replaces by id, newest first. */
export function upsertPreset(
  presets: readonly RestaurantPreset[],
  preset: RestaurantPreset,
): readonly RestaurantPreset[] {
  const without = presets.filter((entry) => entry.id !== preset.id);
  return [preset, ...without].slice(0, MAX_PRESETS);
}

export function removePreset(
  presets: readonly RestaurantPreset[],
  id: string,
): readonly RestaurantPreset[] {
  return presets.filter((preset) => preset.id !== id);
}

export function findPreset(
  presets: readonly RestaurantPreset[],
  id: string,
): RestaurantPreset | undefined {
  return presets.find((preset) => preset.id === id);
}

/** Whether applying this preset would actually change the session setup. */
export function presetMatchesSetup(preset: RestaurantPreset, setup: PresetDraft): boolean {
  return (
    presetId(setup.name) === preset.id &&
    Math.abs(clampPricePerDiner(setup.pricePerDiner) - preset.pricePerDiner) < 0.005 &&
    clampDinerCount(setup.dinerCount) === preset.dinerCount
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePreset(value: unknown): RestaurantPreset | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = sanitiseRestaurantName(value.name).trim();
  if (name.length === 0) {
    return null;
  }
  if (typeof value.pricePerDiner !== 'number' || !Number.isFinite(value.pricePerDiner)) {
    return null;
  }
  if (typeof value.dinerCount !== 'number' || !Number.isFinite(value.dinerCount)) {
    return null;
  }

  return {
    id: presetId(name),
    name,
    pricePerDiner: clampPricePerDiner(value.pricePerDiner),
    dinerCount: clampDinerCount(value.dinerCount),
    createdAt: isIsoTimestamp(value.createdAt) ? value.createdAt : new Date(0).toISOString(),
  };
}

export function parseStoredPresets(raw: string | null): readonly RestaurantPreset[] {
  if (!raw || raw.length > MAX_STORED_PRESETS_LENGTH) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!isRecord(parsed) || parsed.version !== PRESETS_VERSION) {
    return [];
  }

  const rawPresets = Array.isArray(parsed.presets) ? parsed.presets : [];
  const seen = new Set<string>();
  const presets: RestaurantPreset[] = [];

  for (const entry of rawPresets) {
    const preset = parsePreset(entry);
    if (preset && !seen.has(preset.id)) {
      seen.add(preset.id);
      presets.push(preset);
    }
    if (presets.length >= MAX_PRESETS) {
      break;
    }
  }

  return presets;
}

export function loadPresets(): readonly RestaurantPreset[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    return parseStoredPresets(window.localStorage.getItem(PRESETS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function savePresets(presets: readonly RestaurantPreset[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  const envelope: StoredEnvelope = { version: PRESETS_VERSION, presets };
  try {
    window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // A failed write only costs persistence, never the running session.
  }
}
