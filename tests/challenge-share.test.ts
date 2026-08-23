import { describe, expect, it } from 'vitest';
import { buildDamageReport } from '@/lib/calculations';
import {
  CHALLENGE_TOKEN_VERSION,
  MAX_CHALLENGE_ITEMS,
  MAX_CHALLENGE_TOKEN_LENGTH,
  challengeLinkPath,
  challengeSideFromRecord,
  comparisonFromChallenge,
  decodeChallengePayload,
  encodeChallengePayload,
} from '@/lib/challengeShare';
import { buildChallengeCardModel, FALLBACK_CHALLENGE_CARD } from '@/lib/challengeCard';
import { compareSessions } from '@/lib/comparison';
import { createCustomFood } from '@/lib/customFoods';
import { createSavedSession } from '@/lib/history';
import { encodeUrlText } from '@/lib/urlText';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { MealItem, MealSession } from '@/types/meal';

function item(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 'beef-ribeye__standard__regular',
    foodId: 'beef-ribeye',
    quality: 'standard',
    plateSize: 'regular',
    quantity: 8,
    ...overrides,
  };
}

function record(
  id: string,
  overrides: Partial<MealSession> = {},
  createdAt = '2026-08-16T12:00:00.000Z',
  options: { customFoods?: Parameters<typeof createSavedSession>[3]['customFoods'] } = {},
): SavedMealSession {
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 59.9,
    dinerCount: 1,
    items: [item()],
    ...overrides,
  };
  const report = buildDamageReport(session.items, session);
  return createSavedSession(session, report, getVerdict(1, 1), {
    id,
    createdAt,
    note: 'Ask for the corner booth.',
    ...(options.customFoods ? { customFoods: options.customFoods } : {}),
  });
}

const EARLIER = record('a', { items: [item({ quantity: 6 })] }, '2026-07-01T12:00:00.000Z');
const LATER = record(
  'b',
  { restaurantName: 'Ember House', items: [item({ quantity: 12 })] },
  '2026-08-01T12:00:00.000Z',
);

function challenge() {
  return {
    previous: challengeSideFromRecord(EARLIER),
    current: challengeSideFromRecord(LATER),
  };
}

describe('challengeSideFromRecord', () => {
  it('carries only what the comparison needs', () => {
    const side = challengeSideFromRecord(EARLIER);

    expect(Object.keys(side).sort()).toEqual([
      'customFoods',
      'dinerCount',
      'items',
      'label',
      'pricePerDiner',
      'pricingProfile',
      'recordedAt',
    ]);
  });

  it('bounds an unreasonably long tab', () => {
    const long = record('long', {
      items: Array.from({ length: 40 }, (_unused, index) =>
        item({ id: `line-${index}`, foodId: 'beef-ribeye' }),
      ),
    });

    expect(challengeSideFromRecord(long).items.length).toBeLessThanOrEqual(MAX_CHALLENGE_ITEMS);
  });
});

describe('encodeChallengePayload', () => {
  it('produces a versioned, URL-safe token', () => {
    const token = encodeChallengePayload(challenge())!;

    expect(token.startsWith(`${CHALLENGE_TOKEN_VERSION}.`)).toBe(true);
    expect(token).toMatch(/^[0-9]+\.[A-Za-z0-9\-_]+$/);
    expect(token.length).toBeLessThanOrEqual(MAX_CHALLENGE_TOKEN_LENGTH);
  });

  it('refuses a side with no meal on it', () => {
    const side = challengeSideFromRecord(EARLIER);
    expect(encodeChallengePayload({ previous: { ...side, items: [] }, current: side })).toBeNull();
  });

  it('refuses two meals too large to fit in an address', () => {
    const foods = Array.from(
      { length: 24 },
      (_unused, index) =>
        createCustomFood(
          {
            name: `A very long diner-authored food name ${index}`,
            category: 'beef',
            description: 'x'.repeat(140),
            retailPricePerKg: 40,
            restaurantCostPerKg: 20,
          },
          `custom-food-long-${index}`,
        )!,
    );
    const heavy = record(
      'heavy',
      { items: foods.map((food, index) => item({ id: `line-${index}`, foodId: food.id })) },
      '2026-08-16T12:00:00.000Z',
      { customFoods: foods },
    );
    const side = challengeSideFromRecord(heavy);

    expect(encodeChallengePayload({ previous: side, current: side })).toBeNull();
  });

  it('builds the path a recipient opens', () => {
    expect(challengeLinkPath(challenge())?.startsWith('/challenge/1.')).toBe(true);
  });
});

describe('decodeChallengePayload', () => {
  it('round trips both meals', () => {
    const decoded = decodeChallengePayload(encodeChallengePayload(challenge()));

    expect(decoded?.previous.label).toBe('Seoul Garden');
    expect(decoded?.current.label).toBe('Ember House');
    expect(decoded?.previous.items[0]?.quantity).toBe(6);
    expect(decoded?.current.items[0]?.quantity).toBe(12);
  });

  it('refuses anything that is not a token', () => {
    expect(decodeChallengePayload(null)).toBeNull();
    expect(decodeChallengePayload(undefined)).toBeNull();
    expect(decodeChallengePayload('')).toBeNull();
    expect(decodeChallengePayload('nonsense')).toBeNull();
  });

  it('refuses a token from a version it does not know', () => {
    const token = encodeChallengePayload(challenge())!;
    expect(decodeChallengePayload(`9${token.slice(1)}`)).toBeNull();
  });

  it('refuses an oversized token before parsing it', () => {
    expect(decodeChallengePayload(`1.${'a'.repeat(MAX_CHALLENGE_TOKEN_LENGTH)}`)).toBeNull();
  });

  it('refuses a token missing a side', () => {
    const one = { a: JSON.parse(JSON.stringify({ p: 59.9, d: 1, x: [] })) };
    expect(decodeChallengePayload(`1.${encodeUrlText(JSON.stringify(one))}`)).toBeNull();
  });

  it('refuses a token naming a cut that does not exist', () => {
    const body = {
      a: { p: 59.9, d: 1, x: [{ f: 'beef-unicorn', q: 'standard', s: 'regular', n: 2 }] },
      b: { p: 59.9, d: 1, x: [{ f: 'beef-ribeye', q: 'standard', s: 'regular', n: 2 }] },
    };
    expect(decodeChallengePayload(`1.${encodeUrlText(JSON.stringify(body))}`)).toBeNull();
  });

  it('refuses a side with more lines than the bound allows', () => {
    const line = { f: 'beef-ribeye', q: 'standard', s: 'regular', n: 1 };
    const body = {
      a: { p: 59.9, d: 1, x: Array.from({ length: MAX_CHALLENGE_ITEMS + 1 }, () => line) },
      b: { p: 59.9, d: 1, x: [line] },
    };
    expect(decodeChallengePayload(`1.${encodeUrlText(JSON.stringify(body))}`)).toBeNull();
  });

  it('clamps hostile figures rather than honouring them', () => {
    const body = {
      a: { p: 1e9, d: 999, x: [{ f: 'beef-ribeye', q: 'standard', s: 'regular', n: 1e9 }] },
      b: { p: -50, d: 0, x: [{ f: 'beef-ribeye', q: 'standard', s: 'regular', n: 1 }] },
    };
    const decoded = decodeChallengePayload(`1.${encodeUrlText(JSON.stringify(body))}`)!;

    expect(decoded.previous.pricePerDiner).toBe(500);
    expect(decoded.previous.dinerCount).toBe(12);
    expect(decoded.previous.items[0]?.quantity).toBe(99);
    expect(decoded.current.pricePerDiner).toBe(1);
    expect(decoded.current.dinerCount).toBe(1);
  });

  it('replaces an unusable timestamp rather than guessing at one', () => {
    const body = {
      a: {
        t: 'yesterday',
        p: 59.9,
        d: 1,
        x: [{ f: 'beef-ribeye', q: 'standard', s: 'regular', n: 1 }],
      },
      b: { p: 59.9, d: 1, x: [{ f: 'beef-ribeye', q: 'standard', s: 'regular', n: 1 }] },
    };
    const decoded = decodeChallengePayload(`1.${encodeUrlText(JSON.stringify(body))}`)!;

    expect(decoded.previous.recordedAt).toBe(new Date(0).toISOString());
  });

  it('never throws, whatever it is handed', () => {
    for (const token of [
      '1',
      '1.',
      '.',
      '1.!!!',
      `1.${encodeUrlText('null')}`,
      `1.${'-'.repeat(400)}`,
    ]) {
      expect(() => decodeChallengePayload(token)).not.toThrow();
    }
  });
});

describe('what a challenge link does not carry', () => {
  it('leaves diner names, attribution and notes on the device', () => {
    const withRoster = record('roster', {
      dinerCount: 2,
      diners: [
        { id: 'lorenzo', displayName: 'Lorenzo' },
        { id: 'omar', displayName: 'Omar' },
      ],
      items: [item({ quantity: 4, allocations: [{ dinerId: 'lorenzo', quantity: 3 }] })],
    });
    const token = encodeChallengePayload({
      previous: challengeSideFromRecord(withRoster),
      current: challengeSideFromRecord(LATER),
    })!;
    const body = Buffer.from(
      token.slice(2).replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf-8');

    expect(body).not.toContain('Lorenzo');
    expect(body).not.toContain('Omar');
    expect(body).not.toContain('allocations');
    expect(body).not.toContain('corner booth');
  });

  it('carries no meal ledger', () => {
    const timed = record('timed', {
      events: [
        {
          id: 'event-0',
          at: '2026-08-16T12:00:00.000Z',
          seq: 0,
          source: 'live',
          type: 'meal-started',
        },
      ],
    });

    expect(challengeSideFromRecord(timed)).not.toHaveProperty('events');
  });
});

describe('comparisonFromChallenge', () => {
  it('gives the same answer as comparing the records directly', () => {
    const decoded = decodeChallengePayload(encodeChallengePayload(challenge()))!;
    const fromToken = comparisonFromChallenge(decoded);
    const fromRecords = compareSessions(EARLIER, LATER);

    expect(fromToken.previous.report.retailRecoveryPercent).toBeCloseTo(
      fromRecords.previous.report.retailRecoveryPercent,
      6,
    );
    expect(fromToken.current.report.retailRecoveryPercent).toBeCloseTo(
      fromRecords.current.report.retailRecoveryPercent,
      6,
    );
    expect(fromToken.summary).toBe(fromRecords.summary);
    expect(fromToken.metrics.map((metric) => metric.id)).toEqual(
      fromRecords.metrics.map((metric) => metric.id),
    );
  });

  it('states the recovery difference in percentage points, not percent', () => {
    const decoded = decodeChallengePayload(encodeChallengePayload(challenge()))!;
    const recovery = comparisonFromChallenge(decoded).metrics.find(
      (metric) => metric.id === 'recovery',
    );

    expect(recovery?.unit).toBe('percentagePoints');
    // Percentage-valued metrics deliberately withhold a proportional change.
    expect(recovery?.relativeChange).toBeNull();
  });

  it('recomputes achievements rather than trusting the sender', () => {
    const decoded = decodeChallengePayload(encodeChallengePayload(challenge()))!;
    const comparison = comparisonFromChallenge(decoded);

    expect(comparison.achievements.current.length).toBeGreaterThanOrEqual(0);
    expect(comparison.achievements.gained.every((entry) => entry.title.length > 0)).toBe(true);
  });

  it('compares food diversity as its own dimension', () => {
    const diverse = record('diverse', {
      items: [item({ quantity: 2 }), item({ id: 'p', foodId: 'pork-belly', quantity: 2 })],
    });
    const comparison = compareSessions(EARLIER, diverse);
    const diversity = comparison.metrics.find((metric) => metric.id === 'diversity');

    expect(diversity?.previous).toBe(1);
    expect(diversity?.current).toBe(2);
    expect(diversity?.delta).toBe(1);
  });
});

describe('buildChallengeCardModel', () => {
  it('reads its figures from the token, never from the sender', () => {
    const card = buildChallengeCardModel(encodeChallengePayload(challenge()));

    expect(card.headline).toMatch(/^\d+% vs \d+%$/);
    expect(card.previousLabel).toBe('Seoul Garden');
    expect(card.currentLabel).toBe('Ember House');
    expect(card.shift).toMatch(/^[+-]\d+ percentage points?$/);
  });

  it('states the shift in percentage points', () => {
    const card = buildChallengeCardModel(encodeChallengePayload(challenge()));
    expect(card.description).toContain('percentage point');
    expect(card.description).not.toMatch(/increase|decrease/);
  });

  it('falls back rather than describing a challenge that does not exist', () => {
    expect(buildChallengeCardModel('nonsense')).toBe(FALLBACK_CHALLENGE_CARD);
    expect(buildChallengeCardModel(null)).toBe(FALLBACK_CHALLENGE_CARD);
  });

  it('truncates a long restaurant name rather than overflowing the card', () => {
    const long = record('long', { restaurantName: 'A'.repeat(60) });
    const card = buildChallengeCardModel(
      encodeChallengePayload({
        previous: challengeSideFromRecord(long),
        current: challengeSideFromRecord(LATER),
      }),
    );

    expect(card.previousLabel.length).toBeLessThanOrEqual(22);
    expect(card.previousLabel.endsWith('…')).toBe(true);
  });
});
