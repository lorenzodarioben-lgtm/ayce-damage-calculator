import { describe, expect, it } from 'vitest';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import { encodeSharePayload } from '@/lib/shareLink';
import {
  FALLBACK_SOCIAL_CARD,
  SOCIAL_NAME_LIMIT,
  buildSocialCardModel,
  socialCardFromToken,
  truncateForCard,
} from '@/lib/socialCard';
import type { MealItem, MealSession } from '@/types/meal';

function line(
  foodId: string,
  quantity: number,
  quality: MealItem['quality'] = 'standard',
  plateSize: MealItem['plateSize'] = 'regular',
): MealItem {
  return { id: `${foodId}__${quality}__${plateSize}`, foodId, quality, plateSize, quantity };
}

function session(overrides: Partial<MealSession> = {}): MealSession {
  return {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 59.9,
    dinerCount: 1,
    items: [line('beef-ribeye', 4)],
    ...overrides,
  };
}

function cardFor(input: MealSession) {
  return socialCardFromToken(encodeSharePayload(input));
}

describe('truncateForCard', () => {
  it('leaves a short name alone', () => {
    expect(truncateForCard('Seoul Garden')).toBe('Seoul Garden');
  });

  it('collapses whitespace', () => {
    expect(truncateForCard('  Seoul    Garden  ')).toBe('Seoul Garden');
  });

  it('truncates a long name to the limit', () => {
    const result = truncateForCard('A'.repeat(200));

    expect(result.length).toBeLessThanOrEqual(SOCIAL_NAME_LIMIT);
    expect(result.endsWith('…')).toBe(true);
  });

  it('breaks on a word boundary when one is close enough to the limit', () => {
    const result = truncateForCard('Seoul Garden Korean Barbecue Restaurant House');

    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('  ');
    // Broken mid-word would leave a fragment; this keeps whole words.
    expect(result.slice(0, -1).trim().split(' ').at(-1)).not.toBe('Restauran');
  });

  it('still truncates when there is no space to break on', () => {
    const result = truncateForCard('Supercalifragilisticexpialidociousrestaurantname');

    expect(result.length).toBeLessThanOrEqual(SOCIAL_NAME_LIMIT);
  });

  it('handles an empty name', () => {
    expect(truncateForCard('')).toBe('');
  });
});

describe('buildSocialCardModel', () => {
  const card = cardFor(session());

  it('states the verdict, the volume and the three headline figures', () => {
    // 4 x 155 g x $52/kg = $32.24 of $59.90 = 54%.
    expect(card.verdictTitle).toBe('Corporate Sponsor');
    expect(card.plates).toBe('4 plates');
    expect(card.retailValue).toBe('$32.24');
    expect(card.admission).toBe('$59.90');
    expect(card.recovery).toBe('54%');
  });

  it('names the restaurant in the title copy and the description', () => {
    expect(card.title).toBe('Corporate Sponsor — AYCE Damage Report');
    expect(card.description).toContain('at Seoul Garden');
    expect(card.description).toContain('$32.24');
    expect(card.description).toContain('54% recovered');
  });

  it('reads sensibly with no restaurant name', () => {
    const anonymous = cardFor(session({ restaurantName: '' }));

    expect(anonymous.restaurantName).toBe('');
    expect(anonymous.description).not.toContain(' at .');
    expect(anonymous.description).toContain('4 plates.');
  });

  it('describes a single plate in the singular', () => {
    expect(cardFor(session({ items: [line('beef-ribeye', 1)] })).plates).toBe('1 plate');
  });

  it('reflects a verdict at the other end of the scale', () => {
    const dominant = cardFor(
      session({
        pricePerDiner: 20,
        items: [line('beef-wagyu-short-rib', 6, 'premium', 'large')],
      }),
    );

    expect(dominant.verdictTitle).toBe('Do Not Return');
    expect(dominant.title).toContain('Do Not Return');
  });

  it('shortens a long restaurant name for the preview', () => {
    const card = cardFor(
      session({ restaurantName: 'The Extremely Long Korean Barbecue House Of Seoul' }),
    );

    expect(card.restaurantName.length).toBeLessThanOrEqual(SOCIAL_NAME_LIMIT);
    expect(card.restaurantName.endsWith('…')).toBe(true);
  });

  it('provides alt text describing what the image says', () => {
    expect(card.alt).toContain('Corporate Sponsor');
    expect(card.alt).toContain('4 plates');
    expect(card.alt).toContain('54%');
  });

  it('never emits a figure that is not a real number', () => {
    const card = cardFor(session({ pricePerDiner: 1, items: [line('beef-ribeye', 99)] }));

    for (const value of [card.retailValue, card.admission, card.recovery, card.plates]) {
      expect(value).not.toContain('NaN');
      expect(value).not.toContain('Infinity');
    }
  });
});

describe('socialCardFromToken', () => {
  it.each([
    ['nothing', null],
    ['undefined', undefined],
    ['an empty token', ''],
    ['plain words', 'not-a-token'],
    ['an unknown version', '9.abc.1.bc-0-1-2.'],
    ['an unknown cut', '1.abc.1.zz-0-1-2.'],
    ['a token with no items', '1.abc.1..'],
  ])('falls back rather than failing for %s', (_label, token) => {
    expect(socialCardFromToken(token)).toEqual(FALLBACK_SOCIAL_CARD);
  });

  it('gives the fallback a usable title and description of its own', () => {
    expect(FALLBACK_SOCIAL_CARD.title).toBe('AYCE Damage Calculator');
    expect(FALLBACK_SOCIAL_CARD.description.length).toBeGreaterThan(0);
    expect(FALLBACK_SOCIAL_CARD.alt.length).toBeGreaterThan(0);
  });

  it('never throws on hostile input', () => {
    for (const token of ['.....', '1.'.repeat(400), '1.abc.1.bc-0-1-2.<script>']) {
      expect(() => socialCardFromToken(token)).not.toThrow();
    }
  });

  it('agrees with the page for the same token', () => {
    const token = encodeSharePayload(session())!;

    expect(socialCardFromToken(token)).toEqual(
      buildSocialCardModel({
        ...session(),
        pricingProfile: DEFAULT_PRICING_PROFILE,
        customFoods: [],
      }),
    );
  });
});
