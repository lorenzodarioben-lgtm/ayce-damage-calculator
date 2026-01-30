import { describe, expect, it } from 'vitest';
import { FOODS } from '@/data/foods';
import { buildDamageReport } from '@/lib/calculations';
import { MAX_RESTAURANT_NAME_LENGTH } from '@/lib/constants';
import { createCustomFood } from '@/lib/customFoods';
import { foodCatalogue } from '@/lib/foodCatalogue';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import {
  FOOD_SHARE_CODES,
  MAX_SHARE_ITEMS,
  MAX_SHARE_TOKEN_LENGTH,
  SHARE_TOKEN_VERSION,
  decodeSharePayload,
  encodeShareResult,
  encodeSharePayload,
  foodsMissingShareCodes,
  shareLinkPath,
} from '@/lib/shareLink';
import type { MealItem, MealSession } from '@/types/meal';
import type { CustomFoodDraft } from '@/types/customFoods';
import type { PricingProfile } from '@/types/pricing';

const CUSTOM_FOOD_DRAFT: CustomFoodDraft = {
  name: 'Cheese Corn',
  shortName: 'Cheese Corn',
  category: 'chicken',
  retailPricePerKg: 18,
  restaurantCostPerKg: 7,
};

const US_PROFILE: PricingProfile = {
  id: 'custom-weekend-market',
  name: 'Weekend Market',
  money: { currency: 'USD', locale: 'en-US' },
  overrides: {
    'beef-ribeye': {
      valuation: 'by-weight' as const,
      retailPricePerKg: 75,
      restaurantCostPerKg: 42,
    },
  },
  builtIn: false,
};

function line(
  foodId: string,
  quantity = 2,
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
    items: [line('beef-ribeye')],
    ...overrides,
  };
}

function roundTrip(input: MealSession) {
  const token = encodeSharePayload(input);
  expect(token).not.toBeNull();
  return decodeSharePayload(token);
}

describe('Share code table', () => {
  it('covers every cut in the dataset', () => {
    expect(foodsMissingShareCodes()).toEqual([]);
  });

  it('has no collisions, so a code identifies exactly one cut', () => {
    const codes = Object.values(FOOD_SHARE_CODES);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it('does not carry codes for cuts that no longer exist', () => {
    const known = new Set(FOODS.map((food) => food.id));

    expect(Object.keys(FOOD_SHARE_CODES).filter((id) => !known.has(id))).toEqual([]);
  });
});

describe('Round trip', () => {
  it('restores a simple meal exactly', () => {
    const decoded = roundTrip(session());

    expect(decoded).toMatchObject({
      restaurantName: 'Seoul Garden',
      pricePerDiner: 59.9,
      dinerCount: 1,
    });
    expect(decoded?.items).toHaveLength(1);
    expect(decoded?.items[0]).toMatchObject({
      foodId: 'beef-ribeye',
      quality: 'standard',
      plateSize: 'regular',
      quantity: 2,
    });
  });

  it('restores every grade and portion combination', () => {
    const decoded = roundTrip(
      session({
        items: [
          line('beef-ribeye', 1, 'house', 'small'),
          line('pork-belly', 3, 'standard', 'regular'),
          line('seafood-scallops', 5, 'premium', 'large'),
        ],
      }),
    );

    expect(decoded?.items).toEqual([
      expect.objectContaining({ foodId: 'beef-ribeye', quality: 'house', plateSize: 'small' }),
      expect.objectContaining({ foodId: 'pork-belly', quality: 'standard', plateSize: 'regular' }),
      expect.objectContaining({
        foodId: 'seafood-scallops',
        quality: 'premium',
        plateSize: 'large',
      }),
    ]);
  });

  it('produces the same report on both sides of the link', () => {
    const original = session({
      pricePerDiner: 75.5,
      dinerCount: 3,
      items: [line('beef-wagyu-short-rib', 6, 'premium', 'large'), line('seafood-prawns', 4)],
    });
    const decoded = roundTrip(original);

    const before = buildDamageReport(original.items, original);
    const after = buildDamageReport(decoded!.items, decoded!);

    expect(after.totalRetailValue).toBeCloseTo(before.totalRetailValue, 6);
    expect(after.totalAdmission).toBeCloseTo(before.totalAdmission, 6);
    expect(after.retailRecoveryPercent).toBeCloseTo(before.retailRecoveryPercent, 6);
    expect(after.totalPlates).toBe(before.totalPlates);
  });

  it('keeps a fractional price to the cent', () => {
    expect(roundTrip(session({ pricePerDiner: 59.95 }))?.pricePerDiner).toBeCloseTo(59.95, 6);
  });

  it('handles a session with no restaurant name', () => {
    expect(roundTrip(session({ restaurantName: '' }))?.restaurantName).toBe('');
  });

  it('carries non-ASCII names intact', () => {
    expect(roundTrip(session({ restaurantName: '고기 하우스 · Grill' }))?.restaurantName).toBe(
      '고기 하우스 · Grill',
    );
  });

  it('stays compact for a realistic meal', () => {
    const token = encodeSharePayload(
      session({
        items: [line('beef-ribeye', 4), line('pork-belly', 3), line('seafood-prawns', 2)],
      }),
    );

    expect(token!.length).toBeLessThan(MAX_SHARE_TOKEN_LENGTH);
  });

  it('does not put readable JSON in the URL', () => {
    const token = encodeSharePayload(session())!;

    expect(token).not.toContain('{');
    expect(token).not.toContain('foodId');
    expect(token).not.toContain('Seoul');
  });

  it('distinguishes an empty tab from one too large to carry', () => {
    const empty = encodeShareResult({ ...session(), items: [] });
    expect(empty.ok).toBe(false);
    expect(empty.ok ? null : empty.reason).toBe('empty');

    const overflowing = encodeShareResult({
      ...session(),
      items: Array.from({ length: MAX_SHARE_ITEMS + 1 }, (_unused, index) => ({
        id: `line-${index}`,
        foodId: FOODS[index % FOODS.length]!.id,
        quality: 'standard' as const,
        plateSize: 'regular' as const,
        quantity: 1,
      })),
    });
    expect(overflowing.ok).toBe(false);
    expect(overflowing.ok ? null : overflowing.reason).toBe('too-large');
  });

  it('keeps a full tab inside the address limit', () => {
    const full = encodeShareResult({
      ...session(),
      items: Array.from({ length: MAX_SHARE_ITEMS }, (_unused, index) => ({
        id: `line-${index}`,
        foodId: FOODS[index % FOODS.length]!.id,
        quality: 'standard' as const,
        plateSize: 'regular' as const,
        quantity: 3,
      })),
    });

    expect(full.ok).toBe(true);
    expect(full.ok ? full.token.length : Infinity).toBeLessThanOrEqual(MAX_SHARE_TOKEN_LENGTH);
    // Merged by food, so the decoded meal is shorter than the encoded list.
    expect(decodeSharePayload(full.ok ? full.token : null)).not.toBeNull();
  });

  it('builds a path a recipient can open', () => {
    expect(shareLinkPath(session())).toMatch(new RegExp(`^/share/${SHARE_TOKEN_VERSION}\.`));
  });

  it('carries the pricing and custom menu context needed to reproduce a meal', () => {
    const customFood = createCustomFood(CUSTOM_FOOD_DRAFT, 'custom-food-cheese-corn');
    expect(customFood).not.toBeNull();
    const original = session({
      pricePerDiner: 42,
      items: [line('beef-ribeye', 2), line(customFood!.id, 3, 'premium', 'large')],
    });
    const token = encodeSharePayload(original, {
      pricingProfile: US_PROFILE,
      customFoods: [customFood!],
    });
    const decoded = decodeSharePayload(token);

    expect(decoded?.pricingProfile).toEqual(US_PROFILE);
    expect(decoded?.customFoods).toEqual([customFood]);
    const before = buildDamageReport(
      original.items,
      original,
      US_PROFILE,
      foodCatalogue([customFood!]),
    );
    const after = buildDamageReport(
      decoded!.items,
      decoded!,
      decoded!.pricingProfile,
      foodCatalogue(decoded!.customFoods),
    );
    expect(after.totalRetailValue).toBeCloseTo(before.totalRetailValue, 6);
    expect(after.totalAdmission).toBeCloseTo(before.totalAdmission, 6);
  });

  it('keeps existing version 1 links readable with the original menu context', () => {
    const decoded = decodeSharePayload('1.abc.1.bc-0-1-2.');

    expect(decoded?.pricingProfile).toEqual(DEFAULT_PRICING_PROFILE);
    expect(decoded?.customFoods).toEqual([]);
    expect(decoded?.items[0]?.foodId).toBe('beef-ribeye');
  });
});

describe('Refusing to encode', () => {
  it('will not encode a meal with nothing in it', () => {
    expect(encodeSharePayload(session({ items: [] }))).toBeNull();
    expect(shareLinkPath(session({ items: [] }))).toBeNull();
  });

  it('will not encode a meal made only of unknown cuts', () => {
    expect(encodeSharePayload(session({ items: [line('beef-unicorn')] }))).toBeNull();
  });
});

describe('Rejecting bad tokens', () => {
  it.each([
    ['nothing', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['plain words', 'hello'],
    ['too few segments', '1.abc.1'],
    ['too many segments', '1.abc.1.bc-0-1-2..extra'],
    ['an unknown version', '9.abc.1.bc-0-1-2.'],
    ['a non-numeric version', 'x.abc.1.bc-0-1-2.'],
    ['a non-base36 price', '1.$$$.1.bc-0-1-2.'],
    ['a non-base36 diner count', '1.abc.@@.bc-0-1-2.'],
    ['an unknown food code', '1.abc.1.zz-0-1-2.'],
    ['a malformed item tuple', '1.abc.1.bc-0-1.'],
    ['a non-numeric grade', '1.abc.1.bc-x-1-2.'],
    ['an out-of-range grade', '1.abc.1.bc-7-1-2.'],
    ['an out-of-range portion', '1.abc.1.bc-0-7-2.'],
    ['a zero quantity', '1.abc.1.bc-0-1-0.'],
    ['no items at all', '1.abc.1..'],
    ['a name that is not base64url', '1.abc.1.bc-0-1-2.!!!!'],
  ])('rejects %s', (_label, token) => {
    expect(decodeSharePayload(token)).toBeNull();
  });

  it('rejects a token longer than the hard limit before parsing it', () => {
    const huge = `1.abc.1.${Array.from({ length: 5000 }, () => 'bc-0-1-2').join('_')}.`;

    expect(huge.length).toBeGreaterThan(MAX_SHARE_TOKEN_LENGTH);
    expect(decodeSharePayload(huge)).toBeNull();
  });

  it('rejects more line items than it is willing to hold', () => {
    const tooMany = `1.abc.1.${Array.from({ length: MAX_SHARE_ITEMS + 1 }, () => 'bc-0-1-2').join('_')}.`;

    expect(tooMany.length).toBeLessThanOrEqual(MAX_SHARE_TOKEN_LENGTH);
    expect(decodeSharePayload(tooMany)).toBeNull();
  });

  it('rejects a token where any single line is bad, rather than half-decoding it', () => {
    // The first line is valid; the second is not.
    expect(decodeSharePayload('1.abc.1.bc-0-1-2_zz-0-1-2.')).toBeNull();
  });

  it('never throws, whatever it is handed', () => {
    const nasty = [
      '.....',
      '1....',
      '1.'.repeat(200),
      '1.zzzzzzzzzzzz.zzzzzzzzzzzz.bc-0-1-zzzzzzzz.',
      '1.abc.1.bc-0-1-2.<script>alert(1)</script>',
      '1.abc.1.bc-0-1-2.' + 'A'.repeat(500),
    ];

    for (const token of nasty) {
      expect(() => decodeSharePayload(token)).not.toThrow();
    }
  });
});

describe('Bounding absurd values', () => {
  it('clamps a price beyond what the calculator accepts', () => {
    const decoded = roundTrip(session({ pricePerDiner: 9_999_999 }));

    expect(decoded?.pricePerDiner).toBe(500);
  });

  it('clamps a diner count beyond what the calculator accepts', () => {
    expect(roundTrip(session({ dinerCount: 9999 }))?.dinerCount).toBe(12);
  });

  it('clamps a hand-crafted enormous quantity', () => {
    // "zzzz" in base 36 is 1,679,615.
    const decoded = decodeSharePayload('1.abc.1.bc-0-1-zzzz.');

    expect(decoded?.items[0]?.quantity).toBe(99);
  });

  it('clamps a hand-crafted enormous price', () => {
    const decoded = decodeSharePayload('1.zzzzzz.1.bc-0-1-2.');

    expect(decoded?.pricePerDiner).toBe(500);
  });

  it('cannot produce totals that are not finite', () => {
    const decoded = decodeSharePayload('1.zzzzzz.zzz.bc-0-1-zzzz.')!;
    const report = buildDamageReport(decoded.items, decoded);

    for (const value of [
      report.totalRetailValue,
      report.totalAdmission,
      report.retailRecoveryPercent,
      report.totalWeightKg,
      report.nutrition.calories,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe('Restaurant names', () => {
  it('truncates a name past the maximum length', () => {
    const decoded = roundTrip(session({ restaurantName: 'A'.repeat(400) }));

    expect(decoded?.restaurantName.length).toBeLessThanOrEqual(MAX_RESTAURANT_NAME_LENGTH);
  });

  it('collapses whitespace rather than letting it distort the layout', () => {
    expect(roundTrip(session({ restaurantName: 'Seoul     Garden' }))?.restaurantName).toBe(
      'Seoul Garden',
    );
  });

  it('carries markup through as inert text', () => {
    const decoded = roundTrip(session({ restaurantName: '<script>alert(1)</script>' }));

    // Preserved verbatim as a string; it is rendered as text, never as markup.
    expect(decoded?.restaurantName).toBe('<script>alert(1)</script>');
  });

  it('bounds a name crafted directly into a token', () => {
    const long = 'B'.repeat(300);
    const encoded = btoa(long).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const decoded = decodeSharePayload(`1.abc.1.bc-0-1-2.${encoded}`);

    expect(decoded?.restaurantName.length).toBeLessThanOrEqual(MAX_RESTAURANT_NAME_LENGTH);
  });
});
