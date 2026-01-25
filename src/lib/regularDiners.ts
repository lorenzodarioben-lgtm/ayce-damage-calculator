import { MAX_DINERS } from '@/lib/constants';
import { isDinerId, normaliseDinerName } from '@/lib/diners';
import type { Diner } from '@/types/meal';

export const REGULAR_DINERS_STORAGE_KEY = 'ayce-damage-regular-diners';
export const REGULAR_DINERS_VERSION = 1;
export const MAX_STORED_REGULAR_DINERS_LENGTH = 16 * 1024;

export type RegularDiner = Pick<Diner, 'id' | 'displayName'>;

interface StoredEnvelope {
  readonly version: number;
  readonly diners: readonly RegularDiner[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalisedNameKey(name: string): string {
  return name.toLocaleLowerCase();
}

export function regularDinerId(name: string): string {
  const slug = normaliseDinerName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `diner-${slug || 'guest'}`;
}

export function nextRegularDinerId(diners: readonly RegularDiner[], name: string): string {
  const base = regularDinerId(name);
  const used = new Set(diners.map((diner) => diner.id));
  if (!used.has(base)) {
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

export function createRegularDiner(name: unknown, id: unknown): RegularDiner | null {
  const displayName = normaliseDinerName(name);
  return displayName && isDinerId(id) ? { id, displayName } : null;
}

export function parseStoredRegularDiners(raw: string | null): readonly RegularDiner[] {
  if (!raw || raw.length > MAX_STORED_REGULAR_DINERS_LENGTH) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (
    !isRecord(parsed) ||
    parsed.version !== REGULAR_DINERS_VERSION ||
    !Array.isArray(parsed.diners)
  ) {
    return [];
  }

  const diners: RegularDiner[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const entry of parsed.diners) {
    const diner = isRecord(entry) ? createRegularDiner(entry.displayName, entry.id) : null;
    const nameKey = diner ? normalisedNameKey(diner.displayName) : '';
    if (diner && !ids.has(diner.id) && !names.has(nameKey)) {
      ids.add(diner.id);
      names.add(nameKey);
      diners.push(diner);
    }
    if (diners.length >= MAX_DINERS) {
      break;
    }
  }
  return diners;
}

/** An existing ID wins; an equal display name replaces its directory entry. */
export function upsertRegularDiner(
  diners: readonly RegularDiner[],
  diner: RegularDiner,
): readonly RegularDiner[] {
  const valid = createRegularDiner(diner.displayName, diner.id);
  if (!valid) {
    return diners;
  }
  const nameKey = normalisedNameKey(valid.displayName);
  return [
    valid,
    ...diners.filter(
      (entry) => entry.id !== valid.id && normalisedNameKey(entry.displayName) !== nameKey,
    ),
  ].slice(0, MAX_DINERS);
}

export function removeRegularDiner(
  diners: readonly RegularDiner[],
  id: string,
): readonly RegularDiner[] {
  return diners.filter((diner) => diner.id !== id);
}

export function loadRegularDiners(): readonly RegularDiner[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    return parseStoredRegularDiners(window.localStorage.getItem(REGULAR_DINERS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveRegularDiners(diners: readonly RegularDiner[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  const envelope: StoredEnvelope = {
    version: REGULAR_DINERS_VERSION,
    diners: diners
      .map((diner) => createRegularDiner(diner.displayName, diner.id))
      .filter((diner): diner is RegularDiner => diner !== null)
      .slice(0, MAX_DINERS),
  };
  const encoded = JSON.stringify(envelope);
  if (encoded.length > MAX_STORED_REGULAR_DINERS_LENGTH) {
    return;
  }
  try {
    window.localStorage.setItem(REGULAR_DINERS_STORAGE_KEY, encoded);
  } catch {
    // Directory persistence is a convenience; the current roster remains usable.
  }
}
