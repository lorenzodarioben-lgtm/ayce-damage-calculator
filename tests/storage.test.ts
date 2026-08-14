import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  clearSession,
  loadSession,
  parseStoredSession,
  sanitiseRestaurantName,
  saveSession,
} from '@/lib/storage';
import type { MealSession } from '@/types/meal';

const validSession: MealSession = {
  restaurantName: 'Seoul Garden',
  pricePerDiner: 59.9,
  dinerCount: 2,
  items: [
    { id: 'a', foodId: 'beef-ribeye', quality: 'premium', plateSize: 'regular', quantity: 3 },
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

  it('rejects an incompatible version', () => {
    expect(parseStoredSession(envelope(validSession, 0))).toBeNull();
    expect(parseStoredSession(envelope(validSession, 99))).toBeNull();
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
    expect(sanitiseRestaurantName('  Seoul   Garden ')).toBe('Seoul Garden ');
    expect(sanitiseRestaurantName('a'.repeat(200))).toHaveLength(60);
  });

  it('returns an empty string for non-strings', () => {
    expect(sanitiseRestaurantName(undefined)).toBe('');
    expect(sanitiseRestaurantName({ name: 'x' })).toBe('');
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
