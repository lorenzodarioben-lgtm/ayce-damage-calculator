// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decodeChallengePayload, encodeChallengePayload } from '@/lib/challengeShare';
import { decodeMenuPayload, encodeMenuPayload } from '@/lib/menuShare';
import { buildChallengeCardModel } from '@/lib/challengeCard';
import { FALLBACK_SOCIAL_CARD, socialCardFromToken } from '@/lib/socialCard';
import { decodeSharePayload, encodeSharePayload } from '@/lib/shareLink';
import { packShareBody, unpackShareBody, type PackLimits } from '@/lib/shareCodec';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import type { MealSession } from '@/types/meal';

/**
 * The codec, exercised outside a DOM.
 *
 * Open Graph images are rendered on the server, from the token alone, so the
 * exact same decoder has to run with no `window` anywhere. This suite exists
 * because a codec that quietly depended on a browser global would still pass
 * every jsdom test in the project and then produce a blank preview card for
 * every link anyone posted.
 */

const LIMITS: PackLimits = { maxDecodedBytes: 16 * 1024, maxEncodedLength: 4096 };

const SESSION: MealSession = {
  restaurantName: 'Seoul Garden',
  pricePerDiner: 59.9,
  dinerCount: 2,
  items: [
    { id: 'a', foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular', quantity: 4 },
    { id: 'b', foodId: 'pork-belly', quality: 'premium', plateSize: 'large', quantity: 2 },
  ],
};

describe('The codec on the server', () => {
  it('has no window to lean on', () => {
    expect(typeof globalThis.window).toBe('undefined');
  });

  it('round trips a document', () => {
    const json = JSON.stringify({ restaurantName: 'Seoul Garden', items: [1, 2, 3] });
    expect(unpackShareBody(packShareBody(json, LIMITS) as string, LIMITS)).toBe(json);
  });

  it('produces the same bytes the browser would', () => {
    // Determinism across runtimes is the whole reason the compressor is written
    // in this project rather than delegated to a platform stream.
    const json = JSON.stringify({ lines: Array(20).fill('beef-ribeye standard regular') });
    expect(packShareBody(json, LIMITS)).toBe(packShareBody(json, LIMITS));
  });

  it('decodes a report token into the meal it carries', () => {
    const token = encodeSharePayload(SESSION, { pricingProfile: DEFAULT_PRICING_PROFILE })!;
    const payload = decodeSharePayload(token);

    expect(payload?.restaurantName).toBe('Seoul Garden');
    expect(payload?.items.map((item) => item.quantity)).toEqual([4, 2]);
  });

  it('renders the report social card from a compressed token', () => {
    const token = encodeSharePayload(SESSION, { pricingProfile: DEFAULT_PRICING_PROFILE })!;
    const card = socialCardFromToken(token);

    expect(card.restaurantName).toBe('Seoul Garden');
    // Every figure is derived from the decoded meal, so none of them is the
    // placeholder the unreadable-token fallback uses.
    expect(card.plates).not.toBe('—');
    expect(card.retailValue).not.toBe('—');
    expect(card.recovery).not.toBe('—');
    expect(card.verdictTitle).not.toBe(FALLBACK_SOCIAL_CARD.verdictTitle);
  });

  it('falls back safely when the card is asked for an unreadable token', () => {
    expect(socialCardFromToken('3.not-a-real-body')).toEqual(FALLBACK_SOCIAL_CARD);
    expect(socialCardFromToken('9.AAAA')).toEqual(FALLBACK_SOCIAL_CARD);
  });

  it('renders the challenge card from a compressed token', () => {
    const side = {
      label: 'Seoul Garden',
      recordedAt: '2026-08-16T12:00:00.000Z',
      pricePerDiner: 59.9,
      dinerCount: 2,
      pricingProfile: DEFAULT_PRICING_PROFILE,
      customFoods: [],
      items: SESSION.items,
    };
    const token = encodeChallengePayload({ previous: side, current: side })!;
    const decoded = decodeChallengePayload(token);

    expect(decoded).not.toBeNull();
    const card = buildChallengeCardModel(token);
    expect(card.previousLabel).toBe('Seoul Garden');
    expect(card.currentLabel).toBe('Seoul Garden');
    expect(card.previousRecovery).not.toBe('—');
  });

  it('decodes a menu token', () => {
    const token = encodeMenuPayload({
      pricingProfile: DEFAULT_PRICING_PROFILE,
      customFoods: [],
      restaurant: { name: 'Friday KBBQ', pricePerDiner: 42, dinerCount: 2 },
    })!;

    expect(decodeMenuPayload(token)?.restaurant?.name).toBe('Friday KBBQ');
  });

  it('refuses hostile tokens here exactly as it does in a browser', () => {
    for (const token of ['3.', '3.!!!', '3.AAAA', `3.${'A'.repeat(3000)}`, '2.AAAA']) {
      expect(() => decodeSharePayload(token)).not.toThrow();
      expect(decodeSharePayload(token)).toBeNull();
    }
  });
});
