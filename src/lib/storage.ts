import { FOODS } from '@/data/foods';
import { clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import {
  MAX_DINERS,
  MAX_LINE_QUANTITY,
  MAX_RESTAURANT_NAME_LENGTH,
  MIN_QUANTITY,
  isPlateSize,
  isQualityTier,
} from '@/lib/constants';
import { mealItemId, mergeMealItems } from '@/lib/mealItems';
import { IDLE_LIFECYCLE, parseMealEvents, parseMealLifecycle } from '@/lib/mealEvents';
import { parseMealDuration } from '@/lib/pacing';
import { isRestaurantId } from '@/lib/restaurants';
import { findFoodInCatalogue } from '@/lib/foodCatalogue';
import {
  isDinerId,
  normaliseAllocations,
  normaliseDinerName,
  reconcileItemAllocations,
} from '@/lib/diners';
import type { Diner, DinerAllocation, FoodItem } from '@/types/meal';
import { DEFAULT_PRICING_PROFILE_ID, isPricingProfileId } from '@/lib/pricing';
import type { MealItem, MealSession } from '@/types/meal';

export const STORAGE_KEY = 'ayce-damage-calculator';

/**
 * 1 — the original tab.
 * 2 — pricing context.
 * 3 — the Table Mode roster and plate attribution.
 * 4 — the timestamped meal event ledger and lifecycle metadata.
 * 5 — the optional booked meal duration.
 * 6 — the local restaurant profile the meal was started from.
 * 7 — a monotonic revision and writer id for safe tab sync.
 */
export const STORAGE_VERSION = 7;

/** Versions `parseStoredSession` can read, current one included. */
export const SUPPORTED_STORAGE_VERSIONS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * A tab is small; a full evening's ledger is still only tens of kilobytes.
 * Generous enough for the longest bounded meal, and a hard stop before parsing
 * an entry someone has edited into something else.
 */
export const MAX_STORED_SESSION_LENGTH = 192 * 1024;

const MAX_WRITER_ID_LENGTH = 128;

interface StoredEnvelope {
  readonly version: number;
  readonly revision?: number;
  readonly writerId?: string;
  readonly kind?: 'session';
  readonly session?: MealSession;
}

export interface StoredSessionState {
  readonly kind: 'session';
  readonly revision: number;
  /** Null identifies an envelope written before concurrent-tab protection. */
  readonly writerId: string | null;
  readonly session: MealSession;
}

export interface SessionWriteContext {
  readonly writerId: string;
  /** The newest revision this tab has observed before making its change. */
  readonly knownRevision: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWriterId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_WRITER_ID_LENGTH;
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

export function sanitiseRestaurantName(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  // Collapse whitespace so pasted names cannot break the report layout.
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_RESTAURANT_NAME_LENGTH);
}

/**
 * Normalises an in-progress field without swallowing the space a diner has
 * just typed before the next word. Completed and persisted names use the
 * fully trimmed form above.
 */
export function normaliseRestaurantNameInput(value: string): string {
  return value.replace(/\s+/g, ' ').trimStart().slice(0, MAX_RESTAURANT_NAME_LENGTH);
}

function parseDiners(value: unknown): readonly Diner[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const diners: Diner[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry) || !isDinerId(entry.id) || ids.has(entry.id)) {
      continue;
    }
    const displayName = normaliseDinerName(entry.displayName);
    if (!displayName) {
      continue;
    }
    ids.add(entry.id);
    const admissionPrice =
      typeof entry.admissionPrice === 'number' &&
      Number.isFinite(entry.admissionPrice) &&
      entry.admissionPrice > 0
        ? clampPricePerDiner(entry.admissionPrice)
        : undefined;
    diners.push({
      id: entry.id,
      displayName,
      ...(admissionPrice === undefined ? {} : { admissionPrice }),
    });
    if (diners.length >= MAX_DINERS) {
      break;
    }
  }
  return diners;
}

function parseMealItem(
  value: unknown,
  foods: readonly FoodItem[],
  diners: readonly Diner[],
): MealItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const { foodId, quality, plateSize, quantity } = value;

  if (typeof foodId !== 'string' || !findFoodInCatalogue(foods, foodId)) {
    return null;
  }
  if (!isQualityTier(quality) || !isPlateSize(plateSize)) {
    return null;
  }
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    return null;
  }

  const safeQuantity = Math.min(MAX_LINE_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(quantity)));

  const base = {
    id: mealItemId({ foodId, quality, plateSize }),
    foodId,
    quality,
    plateSize,
    quantity: safeQuantity,
  };
  const allocations = normaliseAllocations(
    Array.isArray(value.allocations)
      ? (value.allocations as readonly DinerAllocation[])
      : undefined,
    safeQuantity,
    diners,
  );
  return allocations.length > 0 ? { ...base, allocations } : base;
}

/** Returns null whenever stored data is absent, stale or untrustworthy. */
function parseSession(
  session: Record<string, unknown>,
  version: number,
  foods: readonly FoodItem[],
): MealSession | null {
  const rawItems = Array.isArray(session.items) ? session.items : [];
  // V1 and V2 had no roster by design; their full tabs continue as shared food.
  const diners = version >= 3 ? parseDiners(session.diners) : [];

  const items = mergeMealItems(
    rawItems
      .map((item) => parseMealItem(item, foods, diners))
      .filter((item): item is MealItem => item !== null),
  ).map((item) => reconcileItemAllocations(item, diners));

  const pricePerDiner =
    typeof session.pricePerDiner === 'number' ? clampPricePerDiner(session.pricePerDiner) : null;
  const dinerCount =
    typeof session.dinerCount === 'number' ? clampDinerCount(session.dinerCount) : null;

  if (pricePerDiner === null || dinerCount === null) {
    return null;
  }

  /*
   * A session written before version 4 has no ledger, and inventing one would
   * mean stamping made-up times on a meal nobody timed. It stays a valid,
   * fully usable session that simply has no timeline.
   */
  const events = version >= 4 ? parseMealEvents(session.events, foods) : [];
  const lifecycle = version >= 4 ? parseMealLifecycle(session.lifecycle) : IDLE_LIFECYCLE;
  const plannedDurationMinutes =
    version >= 5 ? parseMealDuration(session.plannedDurationMinutes) : undefined;
  const linkedRestaurantId =
    version >= 6 && isRestaurantId(session.restaurantId) ? session.restaurantId : undefined;

  return {
    restaurantName: sanitiseRestaurantName(session.restaurantName),
    pricePerDiner,
    dinerCount,
    pricingProfileId: isPricingProfileId(session.pricingProfileId)
      ? session.pricingProfileId
      : DEFAULT_PRICING_PROFILE_ID,
    items,
    ...(diners.length > 0 ? { diners } : {}),
    ...(events.length > 0 ? { events } : {}),
    ...(lifecycle.status === 'idle' ? {} : { lifecycle }),
    ...(plannedDurationMinutes === undefined ? {} : { plannedDurationMinutes }),
    ...(linkedRestaurantId === undefined ? {} : { restaurantId: linkedRestaurantId }),
  };
}

/**
 * Parses the complete active-session envelope, including the information a
 * second tab needs to identify an update. A missing storage key remains the
 * explicit reset signal, preserving the established reset semantics. Older
 * envelopes are deliberately read as revision zero rather than rewritten.
 */
export function parseStoredSessionState(
  raw: string | null,
  foods: readonly FoodItem[] = FOODS,
): StoredSessionState | null {
  if (!raw || raw.length > MAX_STORED_SESSION_LENGTH) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    !isRecord(parsed) ||
    typeof parsed.version !== 'number' ||
    !SUPPORTED_STORAGE_VERSIONS.some((version) => version === parsed.version)
  ) {
    return null;
  }

  const version = parsed.version;
  if (version === STORAGE_VERSION) {
    if (!isRevision(parsed.revision) || !isWriterId(parsed.writerId)) {
      return null;
    }
    if (parsed.kind !== 'session' || !isRecord(parsed.session)) {
      return null;
    }
    const session = parseSession(parsed.session, version, foods);
    return session
      ? { kind: 'session', revision: parsed.revision, writerId: parsed.writerId, session }
      : null;
  }

  if (!isRecord(parsed.session)) {
    return null;
  }
  const session = parseSession(parsed.session, version, foods);
  return session ? { kind: 'session', revision: 0, writerId: null, session } : null;
}

/** Returns just the meal for callers that do not need synchronization metadata. */
export function parseStoredSession(
  raw: string | null,
  foods: readonly FoodItem[] = FOODS,
): MealSession | null {
  const state = parseStoredSessionState(raw, foods);
  return state?.session ?? null;
}

export function loadSession(foods: readonly FoodItem[] = FOODS): MealSession | null {
  const state = loadSessionState(foods);
  return state?.session ?? null;
}

export function loadSessionState(foods: readonly FoodItem[] = FOODS): StoredSessionState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return parseStoredSessionState(window.localStorage.getItem(STORAGE_KEY), foods);
  } catch {
    // Storage can be unavailable in private modes or when quota-blocked.
    return null;
  }
}

function nextRevision(knownRevision: number, stored: StoredSessionState | null): number {
  const safeKnownRevision = isRevision(knownRevision) ? knownRevision : 0;
  const currentRevision = stored?.revision ?? 0;
  return Math.max(safeKnownRevision, currentRevision) + 1;
}

function writeState(
  state: Omit<StoredSessionState, 'revision'>,
  context: SessionWriteContext,
): StoredSessionState | null {
  if (typeof window === 'undefined' || !isWriterId(context.writerId)) {
    return null;
  }
  try {
    const current = parseStoredSessionState(window.localStorage.getItem(STORAGE_KEY));
    const revision = nextRevision(context.knownRevision, current);
    const next: StoredSessionState = { ...state, revision };
    const envelope: StoredEnvelope = {
      version: STORAGE_VERSION,
      revision,
      writerId: context.writerId,
      kind: 'session',
      session: next.session,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return next;
  } catch {
    // A failed write only costs persistence, never the running session.
    return null;
  }
}

/** Writes an envelope with a revision later than any session this tab has observed. */
export function saveSession(
  session: MealSession,
  context: SessionWriteContext = { writerId: 'single-tab', knownRevision: 0 },
): StoredSessionState | null {
  return writeState({ kind: 'session', writerId: context.writerId, session }, context);
}

export function clearSession(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to recover from; the in-memory session is already reset.
  }
}
