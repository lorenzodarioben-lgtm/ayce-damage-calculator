import type { DinerAllocation, PlateSize, QualityTier } from '@/types/meal';

/**
 * A durable, timestamped record of how a meal developed.
 *
 * The aggregate tab in `MealSession.items` remains the authoritative meal: every
 * total, verdict and report is derived from it and from nothing here. The ledger
 * exists alongside it to answer a question the aggregate cannot — *when* the
 * meal happened — which is what a pacing forecast and a replay both need.
 *
 * Nothing in an event identifies a person. Diner references are the same opaque
 * local ids the roster already uses, never display names.
 */

/** Which surface the diner was using when the action was taken. */
export type MealEventSource = 'builder' | 'live';

export const MEAL_EVENT_SOURCES: readonly MealEventSource[] = ['builder', 'live'];

export const MEAL_EVENT_TYPES = [
  'meal-started',
  'plates-added',
  'plates-reduced',
  'consumption-changed',
  'line-removed',
  'line-restored',
  'allocation-changed',
  'diner-joined',
  'diner-left',
  'table-cleared',
  'meal-paused',
  'meal-resumed',
  'meal-completed',
] as const;

export type MealEventType = (typeof MEAL_EVENT_TYPES)[number];

/** Identifies the tab line an event acted on, in the same terms the tab uses. */
export interface MealEventLine {
  readonly foodId: string;
  readonly quality: QualityTier;
  readonly plateSize: PlateSize;
}

interface MealEventBase {
  /** Stable for the life of the event, so replays and merges can key on it. */
  readonly id: string;
  /** ISO-8601, written by the surface that dispatched the action. */
  readonly at: string;
  /**
   * A monotonic counter within one session.
   *
   * Two taps inside the same millisecond are entirely ordinary at a table, and
   * a timestamp alone cannot order them. The sequence number is what makes the
   * ledger deterministic rather than merely usually-correct.
   */
  readonly seq: number;
  readonly source: MealEventSource;
}

export interface PlatesAddedEvent extends MealEventBase {
  readonly type: 'plates-added';
  readonly line: MealEventLine;
  /** Plates that actually landed on the tab, after clamping. */
  readonly quantity: number;
  /** Present only when the plates were attributed to a roster member. */
  readonly dinerId?: string;
}

export interface PlatesReducedEvent extends MealEventBase {
  readonly type: 'plates-reduced';
  readonly line: MealEventLine;
  /** Positive count of plates taken back off the line. */
  readonly quantity: number;
}

/**
 * Someone said how much of a line was actually eaten.
 *
 * Recorded because it is a thing that happened at a time, exactly like a plate
 * arriving — and because a replay that showed the retail value of food nobody
 * ate would disagree with the report it sits beside.
 */
export interface ConsumptionChangedEvent extends MealEventBase {
  readonly type: 'consumption-changed';
  readonly line: MealEventLine;
  /** Plates eaten from this line, in quarters. Never more than were ordered. */
  readonly consumedQuantity: number;
  /** What the line held when the change was made. */
  readonly quantity: number;
}

export interface LineRemovedEvent extends MealEventBase {
  readonly type: 'line-removed';
  readonly line: MealEventLine;
  /** What the line held when it left the tab. */
  readonly quantity: number;
}

export interface LineRestoredEvent extends MealEventBase {
  readonly type: 'line-restored';
  readonly line: MealEventLine;
  readonly quantity: number;
}

export interface AllocationChangedEvent extends MealEventBase {
  readonly type: 'allocation-changed';
  readonly line: MealEventLine;
  readonly allocations: readonly DinerAllocation[];
}

export interface DinerJoinedEvent extends MealEventBase {
  readonly type: 'diner-joined';
  readonly dinerId: string;
}

export interface DinerLeftEvent extends MealEventBase {
  readonly type: 'diner-left';
  readonly dinerId: string;
}

export interface TableClearedEvent extends MealEventBase {
  readonly type: 'table-cleared';
}

export type MealLifecycleEventType =
  | 'meal-started'
  | 'meal-paused'
  | 'meal-resumed'
  | 'meal-completed';

export interface MealLifecycleEvent extends MealEventBase {
  readonly type: MealLifecycleEventType;
}

export type MealEvent =
  | PlatesAddedEvent
  | PlatesReducedEvent
  | ConsumptionChangedEvent
  | LineRemovedEvent
  | LineRestoredEvent
  | AllocationChangedEvent
  | DinerJoinedEvent
  | DinerLeftEvent
  | TableClearedEvent
  | MealLifecycleEvent;

/** Events that carry a tab line, which is what a replay reconstructs from. */
export type MealLineEvent =
  | PlatesAddedEvent
  | PlatesReducedEvent
  | ConsumptionChangedEvent
  | LineRemovedEvent
  | LineRestoredEvent
  | AllocationChangedEvent;

export type MealLifecycleStatus = 'idle' | 'active' | 'paused' | 'completed';

/**
 * Where the meal is in its own life.
 *
 * Deliberately not derived from the events: a meal is *active* because someone
 * put food on the grill, and that has to survive the ledger being trimmed.
 */
export interface MealLifecycle {
  readonly status: MealLifecycleStatus;
  /** Set by the first meaningful meal activity, never by editing configuration. */
  readonly startedAt?: string;
  /** Set when the diner declares the meal over. Cleared if they carry on eating. */
  readonly completedAt?: string;
  /** When the current pause began. Only ever set while paused. */
  readonly pausedAt?: string;
  /** Time already spent paused, in milliseconds, excluding any current pause. */
  readonly pausedMs: number;
}
