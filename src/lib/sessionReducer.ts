import { clampDinerCount, clampPricePerDiner } from '@/lib/calculations';
import {
  DEFAULT_DINER_COUNT,
  DEFAULT_PRICE_PER_DINER,
  MAX_DINERS,
  MAX_LINE_QUANTITY,
  MIN_QUANTITY,
} from '@/lib/constants';
import { createAdjustment, reconcileAdjustments, type AdjustmentDraft } from '@/lib/adjustments';
import { MAX_BILL_ADJUSTMENTS } from '@/lib/constants';
import { consumedQuantity, reconcileConsumption, withConsumedQuantity } from '@/lib/consumption';
import { withSeparateCharge } from '@/lib/separateCharges';
import { isDinerId, normaliseDinerName, reconcileItemAllocations } from '@/lib/diners';
import { appendMealEvents, mealEventLine, nextEventSeq, sessionLifecycle } from '@/lib/mealEvents';
import { clampMealDuration } from '@/lib/pacing';
import { mealItemId, mergeMealItems } from '@/lib/mealItems';
import { DEFAULT_PRICING_PROFILE_ID } from '@/lib/pricing';
import { normaliseRestaurantNameInput, sanitiseRestaurantName } from '@/lib/storage';
import type {
  BillAdjustment,
  Diner,
  DinerAllocation,
  MealItem,
  MealSession,
  PlateSize,
  QualityTier,
  SessionConfig,
} from '@/types/meal';
import type { MealEvent, MealEventSource, MealLifecycle } from '@/types/mealEvents';

/**
 * The one canonical meal reducer.
 *
 * It owns two things that must not drift apart: the aggregate tab every
 * calculation reads, and the timestamped ledger describing how that tab came to
 * look the way it does. The tab remains authoritative — no total is ever
 * derived from an event — but the ledger is written in the same transition, so
 * a plate cannot land without the moment it landed being recorded.
 *
 * Kept free of React so it stays a plain, exhaustively testable function.
 */

export const INITIAL_SESSION: MealSession = {
  restaurantName: '',
  pricePerDiner: DEFAULT_PRICE_PER_DINER,
  dinerCount: DEFAULT_DINER_COUNT,
  pricingProfileId: DEFAULT_PRICING_PROFILE_ID,
  items: [],
};

/**
 * What a dispatching surface knows that the reducer cannot: the current time,
 * a fresh identifier, and which screen the diner was looking at.
 *
 * Optional throughout, so an action dispatched without it changes the tab and
 * records nothing — which is the honest outcome when there is no moment to
 * record it against.
 */
export interface MealEventMeta {
  readonly id: string;
  readonly at: string;
  readonly source: MealEventSource;
}

export interface AddItemPayload {
  foodId: string;
  quality: QualityTier;
  plateSize: PlateSize;
  quantity: number;
  dinerId?: string;
}

export type SessionAction =
  | { type: 'hydrate'; session: MealSession }
  | { type: 'set-restaurant-name'; value: string }
  | { type: 'set-price-per-diner'; value: number }
  | { type: 'set-pricing-profile'; id: string }
  | { type: 'adjust-diner-count'; delta: number }
  | { type: 'apply-setup'; setup: SessionConfig }
  | { type: 'add-diner'; diner: Diner; meta?: MealEventMeta }
  | { type: 'rename-diner'; id: string; displayName: string }
  | { type: 'set-diner-admission-price'; id: string; value: number | undefined }
  | { type: 'remove-diner'; id: string; meta?: MealEventMeta }
  | { type: 'move-diner'; id: string; direction: -1 | 1 }
  | { type: 'clear-diners'; meta?: MealEventMeta }
  | { type: 'add-item'; payload: AddItemPayload; meta?: MealEventMeta }
  | { type: 'increment-item'; id: string; meta?: MealEventMeta }
  | { type: 'decrement-item'; id: string; meta?: MealEventMeta }
  | {
      type: 'set-item-allocations';
      id: string;
      allocations: readonly DinerAllocation[];
      /** Who splits whatever is left of the line. Omitted means the table. */
      sharedAmong?: readonly string[];
      meta?: MealEventMeta;
    }
  | { type: 'set-item-consumption'; id: string; consumed: number; meta?: MealEventMeta }
  | { type: 'remove-item'; id: string; meta?: MealEventMeta }
  | { type: 'restore-item'; item: MealItem; index: number; meta?: MealEventMeta }
  | { type: 'add-adjustment'; draft: AdjustmentDraft; id: string }
  | { type: 'remove-adjustment'; id: string }
  | { type: 'clear-adjustments' }
  | { type: 'set-meal-duration'; minutes: number | undefined }
  | { type: 'pause-meal'; meta: MealEventMeta }
  | { type: 'resume-meal'; meta: MealEventMeta }
  | { type: 'complete-meal'; meta: MealEventMeta }
  | { type: 'set-item-charge'; id: string; separate: boolean; charge?: number }
  | { type: 'reset' };

/**
 * Attaches a bill list, dropping the key entirely when it is empty.
 *
 * An absent list and an empty one already mean the same thing to every reader,
 * and keeping only one of those shapes is what makes a plain tab serialise to
 * exactly the bytes it did before adjustments existed.
 */
function withAdjustments(
  session: MealSession,
  adjustments: readonly BillAdjustment[],
): MealSession {
  if (adjustments.length === 0) {
    const { adjustments: _adjustments, ...plain } = session;
    return plain;
  }
  return { ...session, adjustments };
}

function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_QUANTITY;
  }
  return Math.min(MAX_LINE_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(value)));
}

function findActiveDinerId(
  diners: readonly Diner[] | undefined,
  id: string | undefined,
): string | null {
  return id && diners?.some((diner) => diner.id === id) ? id : null;
}

/** Applies the tab change only. Ledger bookkeeping happens around it. */
/** Re-keys a line when who paid for it changes, since that is part of its id. */
function rechargedItem(item: MealItem, separate: boolean, charge?: number): MealItem {
  const next = withSeparateCharge(item, separate, charge);
  return { ...next, id: mealItemId(next) };
}

function applySessionAction(state: MealSession, action: SessionAction): MealSession {
  switch (action.type) {
    case 'hydrate':
      return action.session;

    case 'set-restaurant-name': {
      /*
       * Editing the name by hand unlinks the meal from a saved place. The link
       * is a statement that this is that restaurant; typing something else is a
       * statement that it is not, and a wrong link would file the visit under
       * somewhere the diner never went.
       */
      const { restaurantId: _restaurantId, ...unlinked } = state;
      return { ...unlinked, restaurantName: normaliseRestaurantNameInput(action.value) };
    }

    case 'set-price-per-diner':
      return { ...state, pricePerDiner: clampPricePerDiner(action.value) };

    case 'set-pricing-profile':
      return { ...state, pricingProfileId: action.id };

    case 'adjust-diner-count':
      return { ...state, dinerCount: clampDinerCount(state.dinerCount + action.delta) };

    case 'apply-setup': {
      // Replaces the session configuration only. The tab is deliberately
      // untouched: applying a saved restaurant must never cost the user their
      // plates.
      const { restaurantId: _restaurantId, ...base } = state;
      return {
        ...base,
        restaurantName: sanitiseRestaurantName(action.setup.restaurantName),
        pricePerDiner: clampPricePerDiner(action.setup.pricePerDiner),
        dinerCount: clampDinerCount(action.setup.dinerCount),
        pricingProfileId: action.setup.pricingProfileId ?? DEFAULT_PRICING_PROFILE_ID,
        ...(action.setup.restaurantId === undefined
          ? {}
          : { restaurantId: action.setup.restaurantId }),
      };
    }

    case 'add-diner': {
      const displayName = normaliseDinerName(action.diner.displayName);
      if (
        !displayName ||
        !isDinerId(action.diner.id) ||
        state.diners?.some((diner) => diner.id === action.diner.id) ||
        (state.diners?.length ?? 0) >= MAX_DINERS
      ) {
        return state;
      }
      const admissionPrice =
        typeof action.diner.admissionPrice === 'number' &&
        Number.isFinite(action.diner.admissionPrice) &&
        action.diner.admissionPrice > 0
          ? clampPricePerDiner(action.diner.admissionPrice)
          : undefined;
      const diners = [
        ...(state.diners ?? []),
        {
          id: action.diner.id,
          displayName,
          ...(admissionPrice === undefined ? {} : { admissionPrice }),
        },
      ];
      return { ...state, diners, dinerCount: diners.length };
    }

    case 'rename-diner': {
      const displayName = normaliseDinerName(action.displayName);
      if (!displayName || !state.diners?.some((diner) => diner.id === action.id)) {
        return state;
      }
      return {
        ...state,
        diners: state.diners.map((diner) =>
          diner.id === action.id ? { ...diner, displayName } : diner,
        ),
      };
    }

    case 'set-diner-admission-price': {
      if (!state.diners?.some((diner) => diner.id === action.id)) {
        return state;
      }
      const admissionPrice =
        typeof action.value === 'number' && Number.isFinite(action.value) && action.value > 0
          ? clampPricePerDiner(action.value)
          : undefined;
      return {
        ...state,
        diners: state.diners.map((diner) => {
          if (diner.id !== action.id) return diner;
          const { admissionPrice: _admissionPrice, ...defaultDiner } = diner;
          return admissionPrice === undefined ? defaultDiner : { ...defaultDiner, admissionPrice };
        }),
      };
    }

    case 'remove-diner': {
      const diners = state.diners?.filter((diner) => diner.id !== action.id) ?? [];
      if (diners.length === (state.diners?.length ?? 0)) {
        return state;
      }
      const items = state.items.map((item) =>
        reconcileItemAllocations(
          item.allocations
            ? {
                ...item,
                allocations: item.allocations.filter((entry) => entry.dinerId !== action.id),
              }
            : item,
          diners,
        ),
      );
      // A removed diner's own charges become the table's. The money was still
      // spent, so dropping them would make the total disagree with the receipt.
      const adjustments = reconcileAdjustments(state.adjustments, diners);
      if (diners.length === 0) {
        const { diners: _diners, ...sharedSession } = state;
        return withAdjustments({ ...sharedSession, items }, adjustments);
      }
      return withAdjustments(
        {
          ...state,
          diners,
          dinerCount: diners.length,
          // A removed diner's plates become shared-table food. The line total is
          // untouched, so neither value nor nutrition can disappear with them.
          items,
        },
        adjustments,
      );
    }

    case 'move-diner': {
      const diners = [...(state.diners ?? [])];
      const index = diners.findIndex((diner) => diner.id === action.id);
      const destination = index + action.direction;
      if (index < 0 || destination < 0 || destination >= diners.length) {
        return state;
      }
      const [diner] = diners.splice(index, 1);
      diners.splice(destination, 0, diner!);
      return { ...state, diners };
    }

    case 'clear-diners':
      if (!state.diners?.length) {
        return state;
      }
      {
        const { diners: _diners, ...sharedSession } = state;
        return withAdjustments(
          {
            ...sharedSession,
            items: state.items.map((item) => {
              const { allocations: _allocations, ...sharedItem } = item;
              return sharedItem;
            }),
          },
          reconcileAdjustments(state.adjustments, []),
        );
      }

    case 'add-adjustment': {
      const adjustment = createAdjustment(action.draft, action.id);
      const current = state.adjustments ?? [];
      // Silently ignoring an overflowing add keeps the bounded list bounded
      // without the reducer needing to know how a surface would report it.
      if (!adjustment || current.length >= MAX_BILL_ADJUSTMENTS) {
        return state;
      }
      // Scoped through the same reconciler the roster changes use, so an
      // adjustment can never name a diner who is not at this table.
      return withAdjustments(state, reconcileAdjustments([...current, adjustment], state.diners));
    }

    case 'remove-adjustment': {
      const adjustments = (state.adjustments ?? []).filter((entry) => entry.id !== action.id);
      return adjustments.length === (state.adjustments?.length ?? 0)
        ? state
        : withAdjustments(state, adjustments);
    }

    case 'clear-adjustments':
      return state.adjustments?.length ? withAdjustments(state, []) : state;

    case 'add-item': {
      const quantity = clampQuantity(action.payload.quantity);
      const id = mealItemId(action.payload);
      const existing = state.items.find((item) => item.id === id);
      const dinerId = findActiveDinerId(state.diners, action.payload.dinerId);

      if (existing) {
        const nextQuantity = clampQuantity(existing.quantity + quantity);
        const addedQuantity = nextQuantity - existing.quantity;
        const allocations = dinerId
          ? [...(existing.allocations ?? []), { dinerId, quantity: addedQuantity }]
          : existing.allocations;
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === id
              ? reconcileItemAllocations(
                  // New plates arrive to be eaten, so they raise the eaten
                  // figure too; a line nobody has trimmed stays untrimmed.
                  withConsumedQuantity(
                    {
                      ...item,
                      quantity: nextQuantity,
                      ...(allocations?.length ? { allocations } : {}),
                    },
                    item.consumedQuantity === undefined
                      ? undefined
                      : item.consumedQuantity + addedQuantity,
                  ),
                  state.diners,
                )
              : item,
          ),
        };
      }

      const item: MealItem = {
        id,
        foodId: action.payload.foodId,
        quality: action.payload.quality,
        plateSize: action.payload.plateSize,
        quantity,
        ...(dinerId ? { allocations: [{ dinerId, quantity }] } : {}),
      };
      return { ...state, items: [...state.items, item] };
    }

    case 'increment-item':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id
            ? // A plate arriving is a plate to eat, so the eaten figure rises
              // with the order and a line that was clean stays clean.
              withConsumedQuantity(
                { ...item, quantity: clampQuantity(item.quantity + 1) },
                item.consumedQuantity === undefined ? undefined : item.consumedQuantity + 1,
              )
            : item,
        ),
      };

    case 'decrement-item':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id
            ? // Reconciled, because a shrinking order has to bring what was
              // eaten down with it rather than claim more was eaten than came.
              reconcileConsumption(
                reconcileItemAllocations(
                  { ...item, quantity: clampQuantity(item.quantity - 1) },
                  state.diners,
                ),
              )
            : item,
        ),
      };

    case 'set-item-consumption':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? withConsumedQuantity(item, action.consumed) : item,
        ),
      };

    case 'set-item-charge':
      return {
        ...state,
        // Merged afterwards because who paid for a line is part of its
        // identity: moving a plate on or off the buffet re-keys it, and it has
        // to join the line it now belongs to rather than sit beside it.
        items: mergeMealItems(
          state.items.map((item) =>
            item.id === action.id ? rechargedItem(item, action.separate, action.charge) : item,
          ),
        ),
      };

    case 'set-item-allocations':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id
            ? reconcileItemAllocations(
                {
                  ...item,
                  allocations: action.allocations,
                  ...(action.sharedAmong === undefined ? {} : { sharedAmong: action.sharedAmong }),
                },
                state.diners,
              )
            : item,
        ),
      };

    case 'remove-item':
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };

    case 'restore-item': {
      // Undoing a removal has to be a no-op if the same line is already back —
      // the tab is keyed by configuration, so re-adding it by hand first and
      // then taking the undo must not produce a duplicate.
      if (state.items.some((item) => item.id === action.item.id)) {
        return state;
      }
      const items = [...state.items];
      // The index is where the line used to be. Anything outside the current
      // bounds simply lands at the end rather than being rejected.
      items.splice(Math.min(Math.max(0, action.index), items.length), 0, {
        ...action.item,
        quantity: clampQuantity(action.item.quantity),
      });
      return { ...state, items };
    }

    case 'set-meal-duration': {
      // Choosing or clearing a time limit is a plan, not meal activity: it
      // never starts the meal and never touches the tab.
      const { plannedDurationMinutes: _planned, ...untimed } = state;
      return action.minutes === undefined
        ? untimed
        : { ...untimed, plannedDurationMinutes: clampMealDuration(action.minutes) };
    }

    case 'pause-meal':
    case 'resume-meal':
    case 'complete-meal':
      // Purely a lifecycle transition; the tab itself does not move.
      return state;

    case 'reset':
      return INITIAL_SESSION;
  }
}

/** Distributes over the union, so each variant keeps its own discriminant. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An event with everything but its identity, which the ledger assigns. */
type MealEventDraft = DistributiveOmit<MealEvent, 'id' | 'at' | 'seq' | 'source'>;

function quantityOf(session: MealSession, id: string): number {
  return session.items.find((item) => item.id === id)?.quantity ?? 0;
}

function allocationsEqual(
  a: readonly DinerAllocation[] | undefined,
  b: readonly DinerAllocation[] | undefined,
): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.dinerId === right[index]?.dinerId && entry.quantity === right[index]?.quantity,
    )
  );
}

/** Describes what actually changed, so a no-op action records nothing. */
function draftsForAction(
  before: MealSession,
  after: MealSession,
  action: SessionAction,
): readonly MealEventDraft[] {
  switch (action.type) {
    case 'add-item': {
      const id = mealItemId(action.payload);
      const added = quantityOf(after, id) - quantityOf(before, id);
      if (added <= 0) {
        return [];
      }
      const line = after.items.find((item) => item.id === id);
      const dinerId = findActiveDinerId(before.diners, action.payload.dinerId);
      return [
        {
          type: 'plates-added',
          line: mealEventLine(line ?? action.payload),
          quantity: added,
          ...(dinerId ? { dinerId } : {}),
        },
      ];
    }

    case 'increment-item': {
      const added = quantityOf(after, action.id) - quantityOf(before, action.id);
      const line = after.items.find((item) => item.id === action.id);
      return added > 0 && line
        ? [{ type: 'plates-added', line: mealEventLine(line), quantity: added }]
        : [];
    }

    case 'decrement-item': {
      const removed = quantityOf(before, action.id) - quantityOf(after, action.id);
      const line = before.items.find((item) => item.id === action.id);
      return removed > 0 && line
        ? [{ type: 'plates-reduced', line: mealEventLine(line), quantity: removed }]
        : [];
    }

    case 'set-item-consumption': {
      const previous = before.items.find((item) => item.id === action.id);
      const line = after.items.find((item) => item.id === action.id);
      if (!line || !previous || consumedQuantity(previous) === consumedQuantity(line)) {
        return [];
      }
      return [
        {
          type: 'consumption-changed',
          line: mealEventLine(line),
          consumedQuantity: consumedQuantity(line),
          quantity: line.quantity,
        },
      ];
    }

    case 'remove-item': {
      const line = before.items.find((item) => item.id === action.id);
      return line && !after.items.some((item) => item.id === action.id)
        ? [{ type: 'line-removed', line: mealEventLine(line), quantity: line.quantity }]
        : [];
    }

    case 'restore-item': {
      const line = after.items.find((item) => item.id === action.item.id);
      return line && !before.items.some((item) => item.id === action.item.id)
        ? [{ type: 'line-restored', line: mealEventLine(line), quantity: line.quantity }]
        : [];
    }

    case 'set-item-allocations': {
      const previous = before.items.find((item) => item.id === action.id);
      const line = after.items.find((item) => item.id === action.id);
      if (!line || !previous || allocationsEqual(previous.allocations, line.allocations)) {
        return [];
      }
      return [
        {
          type: 'allocation-changed',
          line: mealEventLine(line),
          allocations: line.allocations ?? [],
        },
      ];
    }

    case 'add-diner':
      return after.diners?.some((diner) => diner.id === action.diner.id) &&
        !before.diners?.some((diner) => diner.id === action.diner.id)
        ? [{ type: 'diner-joined', dinerId: action.diner.id }]
        : [];

    case 'remove-diner':
      return before.diners?.some((diner) => diner.id === action.id) &&
        !after.diners?.some((diner) => diner.id === action.id)
        ? [{ type: 'diner-left', dinerId: action.id }]
        : [];

    case 'clear-diners':
      return before.diners?.length && !after.diners?.length ? [{ type: 'table-cleared' }] : [];

    default:
      return [];
  }
}

function elapsedSince(from: string, to: string): number {
  const span = Date.parse(to) - Date.parse(from);
  return Number.isFinite(span) && span > 0 ? span : 0;
}

/** Closes an open pause, folding its duration into the running total. */
function settlePause(lifecycle: MealLifecycle, at: string): MealLifecycle {
  if (lifecycle.status !== 'paused' || !lifecycle.pausedAt) {
    return lifecycle;
  }
  const { pausedAt, ...rest } = lifecycle;
  return { ...rest, status: 'active', pausedMs: lifecycle.pausedMs + elapsedSince(pausedAt, at) };
}

interface LedgerTransition {
  readonly lifecycle: MealLifecycle;
  readonly leading: readonly MealEventDraft[];
}

/**
 * Moves the meal's lifecycle on, given what just happened.
 *
 * Only meal activity starts a meal. Renaming the restaurant, choosing a pricing
 * profile or adding a diner deliberately do not, because none of them is
 * evidence that anyone has started eating.
 */
function advanceLifecycle(
  lifecycle: MealLifecycle,
  action: SessionAction,
  drafts: readonly MealEventDraft[],
  at: string,
): LedgerTransition {
  if (action.type === 'pause-meal') {
    return lifecycle.status === 'active' && lifecycle.startedAt
      ? {
          lifecycle: { ...lifecycle, status: 'paused', pausedAt: at },
          leading: [{ type: 'meal-paused' }],
        }
      : { lifecycle, leading: [] };
  }

  if (action.type === 'resume-meal') {
    return lifecycle.status === 'paused'
      ? { lifecycle: settlePause(lifecycle, at), leading: [{ type: 'meal-resumed' }] }
      : { lifecycle, leading: [] };
  }

  if (action.type === 'complete-meal') {
    if (lifecycle.status !== 'active' && lifecycle.status !== 'paused') {
      return { lifecycle, leading: [] };
    }
    const settled = settlePause(lifecycle, at);
    return {
      lifecycle: { ...settled, status: 'completed', completedAt: at },
      leading: [{ type: 'meal-completed' }],
    };
  }

  const startsTheMeal = drafts.some((draft) => draft.type === 'plates-added');
  if (!startsTheMeal) {
    return { lifecycle, leading: [] };
  }

  if (lifecycle.status === 'idle') {
    return {
      lifecycle: { status: 'active', startedAt: at, pausedMs: 0 },
      leading: [{ type: 'meal-started' }],
    };
  }
  if (lifecycle.status === 'paused') {
    return { lifecycle: settlePause(lifecycle, at), leading: [{ type: 'meal-resumed' }] };
  }
  if (lifecycle.status === 'completed') {
    // Ordering again after calling it a night reopens the meal rather than
    // recording plates against a session that claims to be over.
    const { completedAt: _completedAt, ...rest } = lifecycle;
    return { lifecycle: { ...rest, status: 'active' }, leading: [{ type: 'meal-resumed' }] };
  }
  return { lifecycle, leading: [] };
}

function materialise(
  drafts: readonly MealEventDraft[],
  meta: MealEventMeta,
  startSeq: number,
): readonly MealEvent[] {
  return drafts.map((draft, index) => ({
    ...draft,
    id: `${meta.id}-${index}`,
    at: meta.at,
    seq: startSeq + index,
    source: meta.source,
  }));
}

function actionMeta(action: SessionAction): MealEventMeta | undefined {
  return 'meta' in action ? action.meta : undefined;
}

export function sessionReducer(state: MealSession, action: SessionAction): MealSession {
  const next = applySessionAction(state, action);

  const meta = actionMeta(action);
  if (!meta) {
    return next;
  }

  const drafts = draftsForAction(state, next, action);
  const { lifecycle, leading } = advanceLifecycle(
    sessionLifecycle(state.lifecycle),
    action,
    drafts,
    meta.at,
  );

  const appended = [...leading, ...drafts];
  if (appended.length === 0) {
    return next;
  }

  return {
    ...next,
    events: appendMealEvents(next.events, materialise(appended, meta, nextEventSeq(next.events))),
    // An untouched meal carries no lifecycle at all, so a session that has only
    // seen roster edits still persists as one nobody has started eating.
    ...(lifecycle.status === 'idle' ? {} : { lifecycle }),
  };
}
