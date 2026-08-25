import { MAX_LINE_QUANTITY, MIN_QUANTITY, isPlateSize, isQualityTier } from '@/lib/constants';
import { isIsoTimestamp } from '@/lib/datetime';
import { isDinerId } from '@/lib/diners';
import { normaliseConsumedQuantity } from '@/lib/consumption';
import { findFoodInCatalogue } from '@/lib/foodCatalogue';
import {
  MEAL_EVENT_SOURCES,
  MEAL_EVENT_TYPES,
  type MealEvent,
  type MealEventLine,
  type MealEventSource,
  type MealEventType,
  type MealLifecycle,
  type MealLifecycleStatus,
} from '@/types/mealEvents';
import type { DinerAllocation, FoodItem, MealItem } from '@/types/meal';

/**
 * Pure helpers over the meal event ledger.
 *
 * Nothing here reads a clock or touches storage: every timestamp arrives from
 * the caller. That is what lets the reducer stay a pure function of its inputs,
 * and lets a replay be tested without simulating an evening.
 */

/**
 * A long meal is a couple of hundred taps. Past this the oldest events are
 * dropped so a session that is never reset cannot grow without bound; the
 * aggregate tab is unaffected, because it was never derived from them.
 */
export const MAX_MEAL_EVENTS = 400;

/** Event ids share the alphabet and bound used for every other local id. */
export const MAX_MEAL_EVENT_ID_LENGTH = 100;

/** More allocations than the roster can hold; a bound, not a business rule. */
const MAX_EVENT_ALLOCATIONS = 12;

const EVENT_ID = /^[A-Za-z0-9_-]+$/;

export const IDLE_LIFECYCLE: MealLifecycle = { status: 'idle', pausedMs: 0 };

const LIFECYCLE_STATUSES: readonly MealLifecycleStatus[] = [
  'idle',
  'active',
  'paused',
  'completed',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isMealEventType(value: unknown): value is MealEventType {
  return typeof value === 'string' && MEAL_EVENT_TYPES.some((type) => type === value);
}

export function isMealEventSource(value: unknown): value is MealEventSource {
  return typeof value === 'string' && MEAL_EVENT_SOURCES.some((source) => source === value);
}

export function isMealEventId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_MEAL_EVENT_ID_LENGTH &&
    EVENT_ID.test(value)
  );
}

/**
 * Total order over the ledger.
 *
 * Time first, because that is what the timeline means; then the sequence
 * number, which breaks a same-millisecond tie deterministically; then the id,
 * so even two events merged from different surfaces cannot compare equal.
 */
export function compareMealEvents(a: MealEvent, b: MealEvent): number {
  const byTime = Date.parse(a.at) - Date.parse(b.at);
  if (Number.isFinite(byTime) && byTime !== 0) {
    return byTime;
  }
  if (a.seq !== b.seq) {
    return a.seq - b.seq;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortMealEvents(events: readonly MealEvent[]): readonly MealEvent[] {
  return [...events].sort(compareMealEvents);
}

/** The next sequence number for a session, one past the highest already used. */
export function nextEventSeq(events: readonly MealEvent[] | undefined): number {
  let highest = -1;
  for (const event of events ?? []) {
    if (event.seq > highest) {
      highest = event.seq;
    }
  }
  return highest + 1;
}

/** Appends within the ledger bound, dropping the oldest events first. */
export function appendMealEvents(
  events: readonly MealEvent[] | undefined,
  appended: readonly MealEvent[],
): readonly MealEvent[] {
  if (appended.length === 0) {
    return events ?? [];
  }
  const combined = [...(events ?? []), ...appended];
  return combined.length <= MAX_MEAL_EVENTS ? combined : combined.slice(-MAX_MEAL_EVENTS);
}

/** The line descriptor an event carries, taken from a tab line's configuration. */
export function mealEventLine(
  item: Pick<MealItem, 'foodId' | 'quality' | 'plateSize'>,
): MealEventLine {
  return { foodId: item.foodId, quality: item.quality, plateSize: item.plateSize };
}

function parseLine(value: unknown, foods: readonly FoodItem[] | undefined): MealEventLine | null {
  if (!isRecord(value)) {
    return null;
  }
  const { foodId, quality, plateSize } = value;
  if (typeof foodId !== 'string' || foodId.length === 0 || foodId.length > 120) {
    return null;
  }
  // A food retired from the catalogue leaves an event nothing can name, so it
  // is dropped rather than kept as an unrenderable line.
  if (foods && !findFoodInCatalogue(foods, foodId)) {
    return null;
  }
  if (!isQualityTier(quality) || !isPlateSize(plateSize)) {
    return null;
  }
  return { foodId, quality, plateSize };
}

function parseQuantity(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const whole = Math.floor(value);
  if (whole < MIN_QUANTITY) {
    return null;
  }
  return Math.min(MAX_LINE_QUANTITY, whole);
}

function parseAllocations(value: unknown): readonly DinerAllocation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const allocations: DinerAllocation[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !isDinerId(entry.dinerId)) {
      continue;
    }
    const quantity = parseQuantity(entry.quantity);
    if (quantity === null) {
      continue;
    }
    allocations.push({ dinerId: entry.dinerId, quantity });
    if (allocations.length >= MAX_EVENT_ALLOCATIONS) {
      break;
    }
  }
  return allocations;
}

/**
 * Validates one stored event.
 *
 * Every event read back — from localStorage, from a filed record, from a
 * restored backup — is untrusted in exactly the way a share token is. A
 * malformed event returns null and is dropped; it can never throw, and it can
 * never describe a plate the calculator itself could not have produced.
 */
export function parseMealEvent(value: unknown, foods?: readonly FoodItem[]): MealEvent | null {
  if (!isRecord(value) || !isMealEventType(value.type) || !isMealEventId(value.id)) {
    return null;
  }
  if (!isIsoTimestamp(value.at) || !isMealEventSource(value.source)) {
    return null;
  }
  if (typeof value.seq !== 'number' || !Number.isFinite(value.seq) || value.seq < 0) {
    return null;
  }

  const base = {
    id: value.id,
    at: value.at,
    seq: Math.floor(value.seq),
    source: value.source,
  } as const;

  switch (value.type) {
    case 'plates-added': {
      const line = parseLine(value.line, foods);
      const quantity = parseQuantity(value.quantity);
      if (!line || quantity === null) {
        return null;
      }
      return {
        ...base,
        type: 'plates-added',
        line,
        quantity,
        ...(isDinerId(value.dinerId) ? { dinerId: value.dinerId } : {}),
      };
    }
    case 'consumption-changed': {
      const line = parseLine(value.line, foods);
      const quantity = parseQuantity(value.quantity);
      if (!line || quantity === null) {
        return null;
      }
      // Normalised against the quantity the event itself records, so a
      // hand-edited ledger can never claim more was eaten than arrived.
      const consumed = normaliseConsumedQuantity(value.consumedQuantity, quantity);
      return {
        ...base,
        type: 'consumption-changed',
        line,
        quantity,
        consumedQuantity: consumed ?? quantity,
      };
    }
    case 'plates-reduced':
    case 'line-removed':
    case 'line-restored': {
      const line = parseLine(value.line, foods);
      const quantity = parseQuantity(value.quantity);
      if (!line || quantity === null) {
        return null;
      }
      return { ...base, type: value.type, line, quantity };
    }
    case 'allocation-changed': {
      const line = parseLine(value.line, foods);
      if (!line) {
        return null;
      }
      return {
        ...base,
        type: 'allocation-changed',
        line,
        allocations: parseAllocations(value.allocations),
      };
    }
    case 'diner-joined':
    case 'diner-left': {
      if (!isDinerId(value.dinerId)) {
        return null;
      }
      return { ...base, type: value.type, dinerId: value.dinerId };
    }
    case 'table-cleared':
      return { ...base, type: 'table-cleared' };
    case 'meal-started':
    case 'meal-paused':
    case 'meal-resumed':
    case 'meal-completed':
      return { ...base, type: value.type };
  }
}

/** Drops unreadable events, de-duplicates ids and returns a bounded, ordered ledger. */
export function parseMealEvents(value: unknown, foods?: readonly FoodItem[]): readonly MealEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const events: MealEvent[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    const event = parseMealEvent(entry, foods);
    if (event && !ids.has(event.id)) {
      ids.add(event.id);
      events.push(event);
    }
    if (events.length >= MAX_MEAL_EVENTS) {
      break;
    }
  }
  return sortMealEvents(events);
}

function isLifecycleStatus(value: unknown): value is MealLifecycleStatus {
  return typeof value === 'string' && LIFECYCLE_STATUSES.some((status) => status === value);
}

/**
 * Validates stored lifecycle metadata, keeping it internally consistent.
 *
 * A status is only honoured when the timestamps that give it meaning are also
 * present: a meal cannot be paused without a moment it started, and a
 * hand-edited "completed" with no completion time falls back to a running meal
 * rather than inventing one.
 */
export function parseMealLifecycle(value: unknown): MealLifecycle {
  if (!isRecord(value) || !isLifecycleStatus(value.status)) {
    return IDLE_LIFECYCLE;
  }

  const startedAt = isIsoTimestamp(value.startedAt) ? value.startedAt : undefined;
  if (value.status === 'idle' || !startedAt) {
    return IDLE_LIFECYCLE;
  }

  const pausedMs =
    typeof value.pausedMs === 'number' && Number.isFinite(value.pausedMs) && value.pausedMs >= 0
      ? Math.floor(value.pausedMs)
      : 0;
  const completedAt = isIsoTimestamp(value.completedAt) ? value.completedAt : undefined;
  const pausedAt = isIsoTimestamp(value.pausedAt) ? value.pausedAt : undefined;

  if (value.status === 'completed') {
    return completedAt
      ? { status: 'completed', startedAt, completedAt, pausedMs }
      : { status: 'active', startedAt, pausedMs };
  }
  if (value.status === 'paused') {
    return pausedAt
      ? { status: 'paused', startedAt, pausedAt, pausedMs }
      : { status: 'active', startedAt, pausedMs };
  }
  return { status: 'active', startedAt, pausedMs };
}

/** The lifecycle a session is in, defaulting to the untouched one. */
export function sessionLifecycle(lifecycle: MealLifecycle | undefined): MealLifecycle {
  return lifecycle ?? IDLE_LIFECYCLE;
}

export function hasStarted(lifecycle: MealLifecycle | undefined): boolean {
  return sessionLifecycle(lifecycle).status !== 'idle';
}
