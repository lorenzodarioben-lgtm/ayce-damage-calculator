import { calculateAdmission, calculateLineItem } from '@/lib/calculations';
import { findFoodInCatalogue, foodCatalogue } from '@/lib/foodCatalogue';
import { normaliseConsumedQuantity } from '@/lib/consumption';
import { compareMealEvents } from '@/lib/mealEvents';
import { mealItemId } from '@/lib/mealItems';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import type { SavedMealSession } from '@/types/history';
import type { DinerAllocation, FoodItem, MealItem } from '@/types/meal';
import type { MealEvent, MealEventLine } from '@/types/mealEvents';

/**
 * Reconstructs how a filed meal actually unfolded.
 *
 * The engine replays the ledger rather than interpolating between a start and
 * an end: at any recorded instant it knows exactly which plates were on the tab
 * and runs them through the same calculation engine the report uses, so a
 * point on the timeline and the filed total agree by construction.
 *
 * Pure and deterministic. Given the same record it produces the same series
 * every time, in the same order, with no clock and no randomness anywhere.
 */

/** How wide a window counts as one burst of ordering. */
export const BURST_WINDOW_MS = 10 * 60_000;

/** Shorter gaps than this are just chewing, not a lull worth naming. */
export const MIN_NOTABLE_GAP_MS = 5 * 60_000;

export interface ReplayPoint {
  /** The event that produced this state. */
  readonly eventId: string;
  readonly at: string;
  /** Milliseconds from the first recorded event. */
  readonly offsetMs: number;
  readonly plates: number;
  readonly weightG: number;
  readonly retailValue: number;
  /** retailValue / admission × 100, using the record's own admission. */
  readonly recoveryPercent: number;
  /** Plates attributed to each roster member. Empty without Table Mode data. */
  readonly dinerPlates: Readonly<Record<string, number>>;
}

export type ReplayMomentId =
  | 'first-plate'
  | 'break-even'
  | 'busiest-window'
  | 'longest-gap'
  | 'last-plate'
  | 'completed';

export interface ReplayMoment {
  readonly id: ReplayMomentId;
  readonly label: string;
  readonly offsetMs: number;
  /** A short, factual reading of what happened. */
  readonly detail: string;
}

export interface MealReplay {
  /** False for a record filed before the ledger existed. */
  readonly available: boolean;
  readonly points: readonly ReplayPoint[];
  readonly moments: readonly ReplayMoment[];
  readonly durationMs: number;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  /**
   * True when the ledger no longer reaches the beginning of the meal, so the
   * replay starts partway in. Said plainly rather than quietly rescaled.
   */
  readonly truncated: boolean;
  /** The roster ids the timeline has attribution for, in roster order. */
  readonly dinerIds: readonly string[];
}

export const EMPTY_REPLAY: MealReplay = {
  available: false,
  points: [],
  moments: [],
  durationMs: 0,
  startedAt: null,
  finishedAt: null,
  truncated: false,
  dinerIds: [],
};

function lineKey(line: MealEventLine): string {
  return mealItemId(line);
}

interface ReplayLine {
  readonly line: MealEventLine;
  quantity: number;
  /** Undefined until someone said otherwise, meaning the line went clean. */
  consumedQuantity: number | undefined;
  allocations: readonly DinerAllocation[];
}

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

/** Applies one event to the running tab. Unknown lines are simply ignored. */
function applyEvent(lines: Map<string, ReplayLine>, event: MealEvent): void {
  if (
    event.type !== 'plates-added' &&
    event.type !== 'plates-reduced' &&
    event.type !== 'consumption-changed' &&
    event.type !== 'line-removed' &&
    event.type !== 'line-restored' &&
    event.type !== 'allocation-changed'
  ) {
    return;
  }

  const key = lineKey(event.line);
  const existing = lines.get(key) ?? {
    line: event.line,
    quantity: 0,
    consumedQuantity: undefined,
    allocations: [],
  };

  switch (event.type) {
    case 'plates-added': {
      existing.quantity += event.quantity;
      if (event.dinerId) {
        const dinerId = event.dinerId;
        const current = existing.allocations.find((entry) => entry.dinerId === dinerId);
        existing.allocations = current
          ? existing.allocations.map((entry) =>
              entry.dinerId === dinerId
                ? { dinerId, quantity: entry.quantity + event.quantity }
                : entry,
            )
          : [...existing.allocations, { dinerId, quantity: event.quantity }];
      }
      break;
    }
    case 'plates-reduced':
      existing.quantity = Math.max(0, existing.quantity - event.quantity);
      break;
    case 'consumption-changed':
      existing.consumedQuantity = event.consumedQuantity;
      break;
    case 'line-removed':
      existing.quantity = 0;
      existing.consumedQuantity = undefined;
      existing.allocations = [];
      break;
    case 'line-restored':
      existing.quantity = event.quantity;
      existing.consumedQuantity = undefined;
      break;
    case 'allocation-changed':
      existing.allocations = event.allocations;
      break;
  }

  // Nor can what was eaten exceed what is on the line — reducing an order past
  // the recorded consumption brings the consumption down with it.
  existing.consumedQuantity = normaliseConsumedQuantity(
    existing.consumedQuantity,
    existing.quantity,
  );

  // Attribution can never exceed the plates that are actually on the line.
  let budget = existing.quantity;
  existing.allocations = existing.allocations
    .map((entry) => {
      const quantity = Math.max(0, Math.min(entry.quantity, budget));
      budget -= quantity;
      return { dinerId: entry.dinerId, quantity };
    })
    .filter((entry) => entry.quantity > 0);

  lines.set(key, existing);
}

function toMealItems(lines: Map<string, ReplayLine>): readonly MealItem[] {
  const items: MealItem[] = [];
  for (const [id, entry] of lines) {
    if (entry.quantity > 0) {
      items.push({
        id,
        foodId: entry.line.foodId,
        quality: entry.line.quality,
        plateSize: entry.line.plateSize,
        quantity: entry.quantity,
        ...(entry.consumedQuantity === undefined
          ? {}
          : { consumedQuantity: entry.consumedQuantity }),
        ...(entry.allocations.length ? { allocations: entry.allocations } : {}),
      });
    }
  }
  return items;
}

interface Totals {
  readonly plates: number;
  readonly weightG: number;
  readonly retailValue: number;
}

function totalsFor(
  items: readonly MealItem[],
  foods: readonly FoodItem[],
  profile: SavedMealSession['pricingProfile'],
): Totals {
  let plates = 0;
  let weightG = 0;
  let retailValue = 0;
  for (const item of items) {
    const food = findFoodInCatalogue(foods, item.foodId);
    if (!food) continue;
    const totals = calculateLineItem(item, food, profile);
    plates += totals.plates;
    weightG += totals.weightG;
    retailValue += totals.retailValue;
  }
  return { plates, weightG, retailValue };
}

function platesByDiner(items: readonly MealItem[]): Record<string, number> {
  const byDiner: Record<string, number> = {};
  for (const item of items) {
    for (const allocation of item.allocations ?? []) {
      byDiner[allocation.dinerId] = (byDiner[allocation.dinerId] ?? 0) + allocation.quantity;
    }
  }
  return byDiner;
}

function describeGap(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} without a plate`;
}

function buildMoments(
  points: readonly ReplayPoint[],
  events: readonly MealEvent[],
  firstAt: number,
): readonly ReplayMoment[] {
  if (points.length === 0) {
    return [];
  }

  const moments: ReplayMoment[] = [];
  const plateEvents = events.filter((event) => event.type === 'plates-added');

  const first = plateEvents[0];
  if (first) {
    moments.push({
      id: 'first-plate',
      label: 'First plate',
      offsetMs: Date.parse(first.at) - firstAt,
      detail: 'The meal begins.',
    });
  }

  const breakEven = points.find((point) => point.recoveryPercent >= 100);
  if (breakEven) {
    moments.push({
      id: 'break-even',
      label: 'Break-even',
      offsetMs: breakEven.offsetMs,
      detail: 'Estimated retail value reaches admission.',
    });
  }

  /*
   * The busiest window is the ten minutes that moved the most retail value.
   * Scanned forward with the earliest maximum winning, so a meal with two
   * equally heavy bursts always names the same one.
   */
  let bestGain = 0;
  let bestEnd: ReplayPoint | null = null;
  let windowStart = 0;
  for (const point of points) {
    while (point.offsetMs - (points[windowStart]?.offsetMs ?? 0) > BURST_WINDOW_MS) {
      windowStart += 1;
    }
    // The value already on the tab when this window opened.
    const baseline = windowStart === 0 ? 0 : (points[windowStart - 1]?.retailValue ?? 0);
    const gain = point.retailValue - baseline;
    // Strictly greater, so two equally heavy bursts always name the earlier.
    if (gain > bestGain) {
      bestGain = gain;
      bestEnd = point;
    }
  }
  if (bestEnd && bestGain > 0) {
    moments.push({
      id: 'busiest-window',
      label: 'Busiest run',
      offsetMs: bestEnd.offsetMs,
      detail: 'The heaviest ten minutes of the meal.',
    });
  }

  let longestGap = 0;
  let gapEnd: number | null = null;
  for (let index = 1; index < plateEvents.length; index += 1) {
    const previous = Date.parse(plateEvents[index - 1]?.at ?? '');
    const current = Date.parse(plateEvents[index]?.at ?? '');
    const gap = current - previous;
    if (Number.isFinite(gap) && gap > longestGap) {
      longestGap = gap;
      gapEnd = current - firstAt;
    }
  }
  if (gapEnd !== null && longestGap >= MIN_NOTABLE_GAP_MS) {
    moments.push({
      id: 'longest-gap',
      label: 'Longest lull',
      offsetMs: gapEnd,
      detail: describeGap(longestGap),
    });
  }

  const last = plateEvents[plateEvents.length - 1];
  if (last && plateEvents.length > 1) {
    moments.push({
      id: 'last-plate',
      label: 'Last plate',
      offsetMs: Date.parse(last.at) - firstAt,
      detail: 'Nothing further was ordered.',
    });
  }

  const completed = events.find((event) => event.type === 'meal-completed');
  if (completed) {
    moments.push({
      id: 'completed',
      label: 'Meal called',
      offsetMs: Date.parse(completed.at) - firstAt,
      detail: 'The table declared the meal over.',
    });
  }

  return moments.sort((a, b) => a.offsetMs - b.offsetMs);
}

/**
 * Builds the whole timeline for a filed record.
 *
 * A record with no ledger returns an unavailable replay rather than a
 * fabricated one: a meal from before the app recorded timing is a meal nobody
 * timed, and saying so is more useful than drawing a line between two guesses.
 */
export function buildMealReplay(record: SavedMealSession): MealReplay {
  const events = [...(record.events ?? [])].sort(compareMealEvents);
  if (events.length === 0) {
    return EMPTY_REPLAY;
  }

  const foods = foodCatalogue(record.customFoods);
  const profile = record.pricingProfile ?? DEFAULT_PRICING_PROFILE;
  const admission = calculateAdmission({
    pricePerDiner: record.pricePerDiner,
    dinerCount: record.dinerCount,
    ...(record.diners ? { diners: record.diners } : {}),
  });

  const firstAt = Date.parse(events[0]?.at ?? '');
  if (!Number.isFinite(firstAt)) {
    return EMPTY_REPLAY;
  }

  const lines = new Map<string, ReplayLine>();
  const points: ReplayPoint[] = [];

  for (const event of events) {
    applyEvent(lines, event);
    const items = toMealItems(lines);
    const totals = totalsFor(items, foods, profile);
    points.push({
      eventId: event.id,
      at: event.at,
      offsetMs: Math.max(0, Date.parse(event.at) - firstAt),
      plates: totals.plates,
      weightG: totals.weightG,
      retailValue: totals.retailValue,
      recoveryPercent: safeRatio(totals.retailValue, admission) * 100,
      dinerPlates: platesByDiner(items),
    });
  }

  const finalPlates = points[points.length - 1]?.plates ?? 0;
  const recordedPlates = record.items.reduce((sum, item) => sum + item.quantity, 0);

  const lastEvent = events[events.length - 1];
  const completed = [...events].reverse().find((event) => event.type === 'meal-completed');

  return {
    available: true,
    points,
    moments: buildMoments(points, events, firstAt),
    durationMs: points[points.length - 1]?.offsetMs ?? 0,
    startedAt: events[0]?.at ?? null,
    finishedAt: completed?.at ?? lastEvent?.at ?? null,
    // A trimmed ledger cannot account for every plate the record holds.
    truncated: finalPlates < recordedPlates,
    dinerIds: (record.diners ?? [])
      .map((diner) => diner.id)
      .filter((id) => points.some((point) => (point.dinerPlates[id] ?? 0) > 0)),
  };
}

/** The state of the meal at a scrub position, or a zeroed state before it began. */
export function replayAt(replay: MealReplay, offsetMs: number): ReplayPoint | null {
  if (replay.points.length === 0) {
    return null;
  }
  let found: ReplayPoint | null = null;
  for (const point of replay.points) {
    if (point.offsetMs <= offsetMs) {
      found = point;
    } else {
      break;
    }
  }
  return found ?? replay.points[0] ?? null;
}
