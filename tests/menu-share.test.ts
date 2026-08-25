import { describe, expect, it } from 'vitest';
import { createCustomFood } from '@/lib/customFoods';
import {
  MAX_MENU_TOKEN_LENGTH,
  MENU_TOKEN_VERSION,
  decodeMenuPayload,
  encodeMenuPayload,
  encodeMenuResult,
  MAX_MENU_DECODED_BYTES,
  menuLinkPath,
  planMenuImport,
  type MenuSharePayload,
} from '@/lib/menuShare';
import { DEFAULT_PRICING_PROFILE } from '@/lib/pricing';
import { createPricingProfile } from '@/lib/pricingProfiles';
import { createRestaurantProfile } from '@/lib/restaurants';
import { unpackShareBody } from '@/lib/shareCodec';
import { encodeUrlText } from '@/lib/urlText';
import type { CustomFood } from '@/types/customFoods';

const AT = '2026-08-16T12:00:00.000Z';

/**
 * Text a compressor cannot help with, generated the same way every run.
 *
 * The size limit is about what fits in an address, and compression moved where
 * that boundary sits without removing it. Testing the boundary therefore needs
 * input the codec genuinely cannot shrink, rather than input that merely used
 * to be long.
 */
function incompressible(length: number, seed: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let state = seed;
  let text = '';
  for (let index = 0; index < length; index += 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    text += alphabet[state % alphabet.length];
  }
  return text;
}

const PROFILE = createPricingProfile(
  {
    name: 'Downtown lunch',
    currency: 'USD',
    overrides: {
      'beef-ribeye': {
        valuation: 'by-weight' as const,
        retailPricePerKg: 61,
        restaurantCostPerKg: 29,
      },
      'pork-belly': {
        valuation: 'by-weight' as const,
        retailPricePerKg: 24,
        restaurantCostPerKg: 11,
      },
    },
  },
  'custom-downtown-lunch',
)!;

const CHEESE_CORN = createCustomFood(
  {
    name: 'Cheese corn',
    category: 'chicken',
    retailPricePerKg: 14,
    restaurantCostPerKg: 6,
    caloriesPer100g: 180,
  },
  'custom-food-cheese-corn',
)!;

function payload(overrides: Partial<MenuSharePayload> = {}): MenuSharePayload {
  return {
    pricingProfile: PROFILE,
    customFoods: [CHEESE_CORN],
    ...overrides,
  };
}

function emptyLocal() {
  return { pricingProfiles: [], customFoods: [], restaurants: [] };
}

describe('encodeMenuPayload', () => {
  it('produces a versioned, URL-safe token', () => {
    const token = encodeMenuPayload(payload())!;

    expect(token.startsWith(`${MENU_TOKEN_VERSION}.`)).toBe(true);
    expect(token).toMatch(/^[0-9]+\.[A-Za-z0-9\-_]+$/);
    expect(token.length).toBeLessThanOrEqual(MAX_MENU_TOKEN_LENGTH);
  });

  it('refuses a menu with nothing in it', () => {
    expect(
      encodeMenuPayload({ pricingProfile: DEFAULT_PRICING_PROFILE, customFoods: [] }),
    ).toBeNull();
  });

  it('shares a restaurant setup only when one is supplied', () => {
    const without = decodeMenuPayload(encodeMenuPayload(payload()));
    const with_ = decodeMenuPayload(
      encodeMenuPayload(
        payload({ restaurant: { name: 'Friday KBBQ', pricePerDiner: 42, dinerCount: 2 } }),
      ),
    );

    expect(without).not.toHaveProperty('restaurant');
    expect(with_?.restaurant).toEqual({ name: 'Friday KBBQ', pricePerDiner: 42, dinerCount: 2 });
  });

  it('refuses a menu too long to be an address', () => {
    const foods: CustomFood[] = Array.from(
      { length: 32 },
      (_unused, index) =>
        createCustomFood(
          {
            name: `Extremely long custom food name number ${index}`,
            category: 'beef',
            description: incompressible(140, index + 1),
            retailPricePerKg: 40,
            restaurantCostPerKg: 20,
          },
          `custom-food-long-${index}`,
        )!,
    );

    const result = encodeMenuResult(payload({ customFoods: foods }));
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.reason).toBe('too-large');
    expect(encodeMenuPayload(payload({ customFoods: foods }))).toBeNull();
  });

  it('fits a repetitive menu that would not have fitted uncompressed', () => {
    const foods: CustomFood[] = Array.from(
      { length: 32 },
      (_unused, index) =>
        createCustomFood(
          {
            name: `Extremely long custom food name number ${index}`,
            category: 'beef',
            description: 'x'.repeat(140),
            retailPricePerKg: 40,
            restaurantCostPerKg: 20,
          },
          `custom-food-long-${index}`,
        )!,
    );

    const token = encodeMenuPayload(payload({ customFoods: foods }));
    expect(token).not.toBeNull();
    expect(token!.length).toBeLessThanOrEqual(MAX_MENU_TOKEN_LENGTH);
    expect(decodeMenuPayload(token)?.customFoods).toHaveLength(32);
  });

  it('says a menu is empty rather than merely unshareable', () => {
    const result = encodeMenuResult({
      pricingProfile: DEFAULT_PRICING_PROFILE,
      customFoods: [],
    });
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.reason).toBe('empty');
  });

  it('builds the path a recipient opens', () => {
    expect(menuLinkPath(payload())?.startsWith(`/menu/${MENU_TOKEN_VERSION}.`)).toBe(true);
    expect(menuLinkPath({ pricingProfile: DEFAULT_PRICING_PROFILE, customFoods: [] })).toBeNull();
  });
});

describe('decodeMenuPayload', () => {
  it('round trips the whole menu', () => {
    const decoded = decodeMenuPayload(encodeMenuPayload(payload()));

    expect(decoded?.pricingProfile).toEqual(PROFILE);
    expect(decoded?.customFoods).toEqual([CHEESE_CORN]);
  });

  it('refuses anything that is not a token', () => {
    expect(decodeMenuPayload(null)).toBeNull();
    expect(decodeMenuPayload(undefined)).toBeNull();
    expect(decodeMenuPayload('')).toBeNull();
    expect(decodeMenuPayload('not-a-token')).toBeNull();
    expect(decodeMenuPayload('1.')).toBeNull();
  });

  it('refuses a token from a version it does not know', () => {
    const body = encodeUrlText(JSON.stringify({ pricingProfile: PROFILE, customFoods: [] }));
    expect(decodeMenuPayload(`2.${body}`)).toBeNull();
    expect(decodeMenuPayload(`0.${body}`)).toBeNull();
  });

  it('refuses an oversized token before parsing it', () => {
    expect(decodeMenuPayload(`1.${'a'.repeat(MAX_MENU_TOKEN_LENGTH)}`)).toBeNull();
  });

  it('refuses a token whose body is not readable', () => {
    expect(decodeMenuPayload('1.!!!!')).toBeNull();
    expect(decodeMenuPayload(`1.${encodeUrlText('{ not json')}`)).toBeNull();
    expect(decodeMenuPayload(`1.${encodeUrlText('"a string"')}`)).toBeNull();
    expect(decodeMenuPayload(`1.${encodeUrlText('[1,2,3]')}`)).toBeNull();
  });

  it('refuses a token with no usable pricing profile', () => {
    expect(
      decodeMenuPayload(`1.${encodeUrlText(JSON.stringify({ customFoods: [CHEESE_CORN] }))}`),
    ).toBeNull();
    expect(
      decodeMenuPayload(
        `1.${encodeUrlText(JSON.stringify({ pricingProfile: { id: 'bad id' }, customFoods: [] }))}`,
      ),
    ).toBeNull();
  });

  it('drops foods it cannot read without losing the readable ones', () => {
    const decoded = decodeMenuPayload(
      `1.${encodeUrlText(
        JSON.stringify({
          pricingProfile: PROFILE,
          customFoods: [CHEESE_CORN, { id: 'custom-food-broken' }, 'nonsense', CHEESE_CORN],
        }),
      )}`,
    );

    expect(decoded?.customFoods).toEqual([CHEESE_CORN]);
  });

  it('drops a restaurant setup it cannot read', () => {
    const decoded = decodeMenuPayload(
      `1.${encodeUrlText(
        JSON.stringify({
          pricingProfile: PROFILE,
          customFoods: [],
          restaurant: { name: '', pricePerDiner: 42, dinerCount: 2 },
        }),
      )}`,
    );

    expect(decoded).not.toBeNull();
    expect(decoded).not.toHaveProperty('restaurant');
  });

  it('clamps a hostile restaurant setup rather than honouring it', () => {
    const decoded = decodeMenuPayload(
      `1.${encodeUrlText(
        JSON.stringify({
          pricingProfile: PROFILE,
          customFoods: [],
          restaurant: { name: 'Friday KBBQ', pricePerDiner: 1e9, dinerCount: 9999 },
        }),
      )}`,
    );

    expect(decoded?.restaurant).toEqual({
      name: 'Friday KBBQ',
      pricePerDiner: 500,
      dinerCount: 12,
    });
  });

  it('never throws, whatever it is handed', () => {
    const hostile = [
      '1',
      '1.',
      '.',
      '1.'.repeat(200),
      `1.${encodeUrlText(JSON.stringify({ pricingProfile: null }))}`,
      `1.${encodeUrlText('null')}`,
      `1.${encodeUrlText(JSON.stringify({ pricingProfile: PROFILE, customFoods: {} }))}`,
      `1.${'-'.repeat(500)}`,
      `1.${'_'.repeat(500)}`,
    ];

    for (const token of hostile) {
      expect(() => decodeMenuPayload(token)).not.toThrow();
    }
  });

  it('brings the built-in context back as the built-in context', () => {
    const decoded = decodeMenuPayload(
      `1.${encodeUrlText(
        JSON.stringify({
          pricingProfile: { ...DEFAULT_PRICING_PROFILE, overrides: {} },
          customFoods: [CHEESE_CORN],
        }),
      )}`,
    );

    expect(decoded?.pricingProfile).toBe(DEFAULT_PRICING_PROFILE);
  });
});

describe('what a menu link does not carry', () => {
  it('contains no history, saved orders, diner names or notes', () => {
    const token = encodeMenuPayload(
      payload({ restaurant: { name: 'Friday KBBQ', pricePerDiner: 42, dinerCount: 2 } }),
    )!;
    const unpacked = unpackShareBody(token.slice(String(MENU_TOKEN_VERSION).length + 1), {
      maxDecodedBytes: MAX_MENU_DECODED_BYTES,
      maxEncodedLength: MAX_MENU_TOKEN_LENGTH,
    });
    const body = JSON.parse(unpacked!);

    expect(Object.keys(body).sort()).toEqual(['customFoods', 'pricingProfile', 'restaurant']);
    expect(Object.keys(body.restaurant).sort()).toEqual(['dinerCount', 'name', 'pricePerDiner']);
  });
});

describe('planMenuImport', () => {
  it('imports a clean menu untouched', () => {
    const plan = planMenuImport(payload(), emptyLocal(), AT);

    expect(plan.writes).toBe(true);
    expect(plan.pricingProfile?.id).toBe('custom-downtown-lunch');
    expect(plan.pricingProfileRenamed).toBe(false);
    expect(plan.customFoods).toEqual([CHEESE_CORN]);
    expect(plan.renamedFoods).toEqual([]);
    expect(plan.restaurant).toBeNull();
  });

  it('never overwrites a pricing profile that is already here', () => {
    const plan = planMenuImport(payload(), { ...emptyLocal(), pricingProfiles: [PROFILE] }, AT);

    expect(plan.pricingProfileRenamed).toBe(true);
    expect(plan.pricingProfile?.id).not.toBe(PROFILE.id);
    expect(plan.pricingProfile?.name).toBe('Downtown lunch (shared)');
  });

  it('never overwrites a custom food that is already here', () => {
    const local = { ...emptyLocal(), customFoods: [CHEESE_CORN] };
    const plan = planMenuImport(payload(), local, AT);

    expect(plan.renamedFoods).toEqual(['Cheese corn']);
    expect(plan.customFoods[0]?.id).not.toBe(CHEESE_CORN.id);
    expect(plan.customFoods[0]?.name).toBe('Cheese corn');
  });

  it('carries a renamed food price across with it', () => {
    const shared = createPricingProfile(
      {
        name: 'House menu',
        overrides: {
          'custom-food-cheese-corn': {
            valuation: 'by-weight' as const,
            retailPricePerKg: 99,
            restaurantCostPerKg: 9,
          },
        },
      },
      'custom-house-menu',
    )!;
    const plan = planMenuImport(
      { pricingProfile: shared, customFoods: [CHEESE_CORN] },
      { ...emptyLocal(), customFoods: [CHEESE_CORN] },
      AT,
    );

    const newId = plan.customFoods[0]!.id;
    expect(newId).not.toBe(CHEESE_CORN.id);
    expect(plan.pricingProfile?.overrides[newId]).toEqual({
      valuation: 'by-weight' as const,
      retailPricePerKg: 99,
      restaurantCostPerKg: 9,
    });
    expect(plan.pricingProfile?.overrides[CHEESE_CORN.id]).toBeUndefined();
  });

  it('imports nothing for the built-in pricing context, which everyone has', () => {
    const plan = planMenuImport(
      { pricingProfile: DEFAULT_PRICING_PROFILE, customFoods: [CHEESE_CORN] },
      emptyLocal(),
      AT,
    );

    expect(plan.pricingProfile).toBeNull();
    expect(plan.customFoods).toEqual([CHEESE_CORN]);
    expect(plan.writes).toBe(true);
  });

  it('imports a restaurant setup, pointing it at the imported prices', () => {
    const plan = planMenuImport(
      payload({ restaurant: { name: 'Friday KBBQ', pricePerDiner: 42, dinerCount: 2 } }),
      emptyLocal(),
      AT,
    );

    expect(plan.restaurant?.name).toBe('Friday KBBQ');
    expect(plan.restaurant?.pricingProfileId).toBe(plan.pricingProfile?.id);
    expect(plan.restaurantRenamed).toBe(false);
  });

  it('never overwrites a restaurant that is already here', () => {
    const existing = createRestaurantProfile(
      { name: 'Friday KBBQ', pricePerDiner: 80, dinerCount: 4 },
      AT,
    )!;
    const plan = planMenuImport(
      payload({ restaurant: { name: 'Friday KBBQ', pricePerDiner: 42, dinerCount: 2 } }),
      { ...emptyLocal(), restaurants: [existing] },
      AT,
    );

    expect(plan.restaurantRenamed).toBe(true);
    expect(plan.restaurant?.name).toBe('Friday KBBQ (shared)');
    expect(plan.restaurant?.id).not.toBe(existing.id);
  });

  it('keeps finding a free name however many collide', () => {
    const taken = ['Friday KBBQ', 'Friday KBBQ (shared)', 'Friday KBBQ (shared 2)'].map(
      (name) => createRestaurantProfile({ name, pricePerDiner: 40, dinerCount: 1 }, AT)!,
    );
    const plan = planMenuImport(
      payload({ restaurant: { name: 'Friday KBBQ', pricePerDiner: 42, dinerCount: 2 } }),
      { ...emptyLocal(), restaurants: taken },
      AT,
    );

    expect(plan.restaurant?.name).toBe('Friday KBBQ (shared 3)');
  });

  it('is a plan and nothing more: it writes nothing itself', () => {
    const local = { ...emptyLocal(), customFoods: [CHEESE_CORN] };
    planMenuImport(payload(), local, AT);

    expect(local.customFoods).toEqual([CHEESE_CORN]);
    expect(local.pricingProfiles).toEqual([]);
  });
});
