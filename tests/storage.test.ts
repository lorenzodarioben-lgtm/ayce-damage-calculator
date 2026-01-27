import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  MAX_STORED_SESSION_LENGTH,
  clearSession,
  loadSession,
  normaliseRestaurantNameInput,
  parseStoredSession,
  sanitiseRestaurantName,
  saveSession,
} from '@/lib/storage';
import { DEFAULT_PRICING_PROFILE_ID } from '@/lib/pricing';
import type { MealSession } from '@/types/meal';

const validSession: MealSession = {
  restaurantName: 'Seoul Garden',
  pricePerDiner: 59.9,
  dinerCount: 2,
  pricingProfileId: DEFAULT_PRICING_PROFILE_ID,
  items: [
    {
      id: 'beef-ribeye__premium__regular',
      foodId: 'beef-ribeye',
      quality: 'premium',
      plateSize: 'regular',
      quantity: 3,
    },
  ],
};

function envelope(session: unknown, version: number = STORAGE_VERSION) {
  return JSON.stringify({ version, session });
}

describe('parseStoredSession', () => {
  it('restores a valid session', () => {
    expect(parseStoredSession(envelope(validSession))).toEqual(validSession);
  });

  it('rejects missing storage', () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession('')).toBeNull();
  });

  it('rejects corrupt JSON', () => {
    expect(parseStoredSession('{ not json')).toBeNull();
    expect(parseStoredSession('"a string"')).toBeNull();
    expect(parseStoredSession('[1,2,3]')).toBeNull();
  });

  it('refuses an oversized storage entry before parsing it', () => {
    expect(parseStoredSession('x'.repeat(MAX_STORED_SESSION_LENGTH + 1))).toBeNull();
  });

  it('rejects an incompatible version', () => {
    expect(parseStoredSession(envelope(validSession, 0))).toBeNull();
    expect(parseStoredSession(envelope(validSession, 99))).toBeNull();
  });

  it('migrates the original session schema to the built-in pricing profile', () => {
    const { pricingProfileId: _profile, ...legacy } = validSession;
    const restored = parseStoredSession(envelope(legacy, 1));

    expect(restored?.pricingProfileId).toBe(DEFAULT_PRICING_PROFILE_ID);
  });

  it('continues to load version 2 sessions as a shared table', () => {
    const restored = parseStoredSession(envelope(validSession, 2));

    expect(restored).toEqual(validSession);
    expect(restored?.diners).toBeUndefined();
    expect(restored?.items[0]?.allocations).toBeUndefined();
  });

  it('restores a valid diner roster and bounded allocations from version 3', () => {
    const tableSession: MealSession = {
      ...validSession,
      dinerCount: 2,
      diners: [
        { id: 'lorenzo', displayName: 'Lorenzo', admissionPrice: 45 },
        { id: 'omar', displayName: 'Omar' },
      ],
      items: [
        {
          ...validSession.items[0]!,
          quantity: 3,
          allocations: [{ dinerId: 'lorenzo', quantity: 2 }],
        },
      ],
    };

    expect(parseStoredSession(envelope(tableSession))).toEqual(tableSession);
  });

  it('degrades malformed Table Mode data to a readable shared meal', () => {
    const restored = parseStoredSession(
      envelope({
        ...validSession,
        diners: [
          { id: 'lorenzo', displayName: '  Lorenzo  ' },
          { id: 'lorenzo', displayName: 'Duplicate' },
          { id: 'bad id', displayName: 'Invalid ID' },
          { id: 'omar', displayName: '' },
          { id: 'valid-2', displayName: 'Diner 2', admissionPrice: Number.POSITIVE_INFINITY },
        ],
        items: [
          {
            ...validSession.items[0],
            quantity: 2,
            allocations: [
              { dinerId: 'retired', quantity: 1 },
              { dinerId: 'lorenzo', quantity: -3 },
              { dinerId: 'lorenzo', quantity: 9 },
            ],
          },
        ],
      }),
    );

    expect(restored?.diners).toEqual([
      { id: 'lorenzo', displayName: 'Lorenzo' },
      { id: 'valid-2', displayName: 'Diner 2' },
    ]);
    expect(restored?.items[0]?.allocations).toEqual([{ dinerId: 'lorenzo', quantity: 2 }]);
    expect(restored?.items[0]?.quantity).toBe(2);
  });

  it('keeps allocations while merging hand-edited duplicate Table Mode lines', () => {
    const restored = parseStoredSession(
      envelope({
        ...validSession,
        diners: [
          { id: 'lorenzo', displayName: 'Lorenzo' },
          { id: 'omar', displayName: 'Omar' },
        ],
        items: [
          {
            ...validSession.items[0],
            quantity: 1,
            allocations: [{ dinerId: 'lorenzo', quantity: 1 }],
          },
          {
            ...validSession.items[0],
            quantity: 2,
            allocations: [{ dinerId: 'omar', quantity: 1 }],
          },
        ],
      }),
    );

    expect(restored?.items).toHaveLength(1);
    expect(restored?.items[0]?.quantity).toBe(3);
    expect(restored?.items[0]?.allocations).toEqual([
      { dinerId: 'lorenzo', quantity: 1 },
      { dinerId: 'omar', quantity: 1 },
    ]);
  });

  it('rejects a session missing required numeric fields', () => {
    expect(parseStoredSession(envelope({ ...validSession, pricePerDiner: 'lots' }))).toBeNull();
    expect(parseStoredSession(envelope({ ...validSession, dinerCount: null }))).toBeNull();
  });

  it('clamps out-of-range configuration instead of discarding it', () => {
    const restored = parseStoredSession(
      envelope({ ...validSession, pricePerDiner: -12, dinerCount: 400 }),
    );
    expect(restored?.pricePerDiner).toBe(1);
    expect(restored?.dinerCount).toBe(12);
  });

  it('drops individually invalid items and keeps the rest', () => {
    const restored = parseStoredSession(
      envelope({
        ...validSession,
        items: [
          { id: 'ok', foodId: 'pork-belly', quality: 'house', plateSize: 'small', quantity: 2 },
          { id: 'bad-food', foodId: 'unicorn', quality: 'house', plateSize: 'small', quantity: 2 },
          {
            id: 'bad-tier',
            foodId: 'pork-belly',
            quality: 'gold',
            plateSize: 'small',
            quantity: 2,
          },
          {
            id: 'bad-size',
            foodId: 'pork-belly',
            quality: 'house',
            plateSize: 'huge',
            quantity: 2,
          },
          {
            id: 'bad-qty',
            foodId: 'pork-belly',
            quality: 'house',
            plateSize: 'small',
            quantity: 'x',
          },
          'not an object',
        ],
      }),
    );
    expect(restored?.items).toHaveLength(1);
    expect(restored?.items[0]?.foodId).toBe('pork-belly');
  });

  it('rebuilds a stored line id from its configuration', () => {
    const restored = parseStoredSession(
      envelope({
        ...validSession,
        items: [{ ...validSession.items[0], id: 'hand-edited-id' }],
      }),
    );

    expect(restored?.items[0]?.id).toBe('beef-ribeye__premium__regular');
  });

  it('merges duplicate configurations from a hand-edited session', () => {
    const duplicate = { ...validSession.items[0], quantity: 4, id: 'different-id' };
    const restored = parseStoredSession(
      envelope({ ...validSession, items: [...validSession.items, duplicate] }),
    );

    expect(restored?.items).toHaveLength(1);
    expect(restored?.items[0]?.quantity).toBe(7);
  });

  it('clamps item quantities into range', () => {
    const restored = parseStoredSession(
      envelope({
        ...validSession,
        items: [
          { id: 'lo', foodId: 'pork-belly', quality: 'house', plateSize: 'small', quantity: -4 },
          {
            id: 'hi',
            foodId: 'beef-brisket',
            quality: 'house',
            plateSize: 'small',
            quantity: 5000,
          },
        ],
      }),
    );
    expect(restored?.items[0]?.quantity).toBe(1);
    expect(restored?.items[1]?.quantity).toBe(99);
  });

  it('tolerates a non-array items field', () => {
    const restored = parseStoredSession(envelope({ ...validSession, items: 'nope' }));
    expect(restored?.items).toEqual([]);
  });

  it('sanitises the restaurant name', () => {
    const restored = parseStoredSession(envelope({ ...validSession, restaurantName: 42 }));
    expect(restored?.restaurantName).toBe('');
  });
});

describe('sanitiseRestaurantName', () => {
  it('collapses whitespace and caps length', () => {
    expect(sanitiseRestaurantName('  Seoul   Garden ')).toBe('Seoul Garden');
    expect(sanitiseRestaurantName('a'.repeat(200))).toHaveLength(60);
  });

  it('returns an empty string for non-strings', () => {
    expect(sanitiseRestaurantName(undefined)).toBe('');
    expect(sanitiseRestaurantName({ name: 'x' })).toBe('');
  });
});

describe('normaliseRestaurantNameInput', () => {
  it('keeps a trailing space while the diner is typing the next word', () => {
    expect(normaliseRestaurantNameInput('  Seoul   ')).toBe('Seoul ');
  });
});

describe('browser storage round trip', () => {
  it('saves and reloads a session', () => {
    saveSession(validSession);
    expect(loadSession()).toEqual(validSession);
  });

  it('returns null after clearing', () => {
    saveSession(validSession);
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it('recovers from corrupt stored data', () => {
    window.localStorage.setItem(STORAGE_KEY, '<<<not json>>>');
    expect(loadSession()).toBeNull();
  });
});

describe('the persisted meal ledger', () => {
  const timedSession: MealSession = {
    ...validSession,
    events: [
      {
        id: 'event-0',
        at: '2026-08-16T12:00:00.000Z',
        seq: 0,
        source: 'builder',
        type: 'meal-started',
      },
      {
        id: 'event-1',
        at: '2026-08-16T12:00:00.000Z',
        seq: 1,
        source: 'builder',
        type: 'plates-added',
        line: { foodId: 'beef-ribeye', quality: 'premium', plateSize: 'regular' },
        quantity: 3,
      },
    ],
    lifecycle: { status: 'active', startedAt: '2026-08-16T12:00:00.000Z', pausedMs: 0 },
  };

  it('round trips a timed session through storage', () => {
    saveSession(timedSession);
    expect(loadSession()).toEqual(timedSession);
  });

  it('keeps the readable events and drops the rest', () => {
    const restored = parseStoredSession(
      envelope({
        ...timedSession,
        events: [
          timedSession.events?.[0],
          { id: 'bad', at: 'whenever', seq: 2, source: 'builder', type: 'plates-added' },
          'not an event',
        ],
      }),
    );

    expect(restored?.events).toEqual([timedSession.events?.[0]]);
  });

  it('drops an event referring to a food this catalogue does not have', () => {
    const restored = parseStoredSession(
      envelope({
        ...timedSession,
        events: [
          {
            id: 'event-9',
            at: '2026-08-16T12:00:00.000Z',
            seq: 9,
            source: 'live',
            type: 'plates-added',
            line: { foodId: 'custom-food-retired', quality: 'standard', plateSize: 'regular' },
            quantity: 1,
          },
        ],
      }),
    );

    expect(restored?.events).toBeUndefined();
    expect(restored?.items).toHaveLength(1);
  });

  it('discards lifecycle metadata that contradicts itself', () => {
    const restored = parseStoredSession(
      envelope({ ...timedSession, lifecycle: { status: 'paused', pausedMs: 0 } }),
    );

    expect(restored?.lifecycle).toBeUndefined();
  });

  it('reads a version 3 session as an untimed meal rather than inventing a timeline', () => {
    const restored = parseStoredSession(envelope(timedSession, 3));

    expect(restored?.events).toBeUndefined();
    expect(restored?.lifecycle).toBeUndefined();
    expect(restored?.items).toEqual(validSession.items);
  });

  it('leaves an untimed session without a ledger at all', () => {
    const restored = parseStoredSession(envelope(validSession));

    expect(restored).toEqual(validSession);
    expect(restored).not.toHaveProperty('events');
    expect(restored).not.toHaveProperty('lifecycle');
  });
});

describe('the booked meal window', () => {
  it('round trips a validated duration', () => {
    const timed: MealSession = { ...validSession, plannedDurationMinutes: 90 };
    saveSession(timed);
    expect(loadSession()).toEqual(timed);
  });

  it('drops a stored duration outside the supported range', () => {
    expect(
      parseStoredSession(envelope({ ...validSession, plannedDurationMinutes: 9000 })),
    ).not.toHaveProperty('plannedDurationMinutes');
    expect(
      parseStoredSession(envelope({ ...validSession, plannedDurationMinutes: '90' })),
    ).not.toHaveProperty('plannedDurationMinutes');
  });

  it('reads a version 4 session as having booked no window', () => {
    const restored = parseStoredSession(
      envelope({ ...validSession, plannedDurationMinutes: 90 }, 4),
    );
    expect(restored).not.toHaveProperty('plannedDurationMinutes');
  });
});
