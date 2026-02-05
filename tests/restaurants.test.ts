import { beforeEach, describe, expect, it } from 'vitest';
import { buildDamageReport } from '@/lib/calculations';
import { createSavedSession } from '@/lib/history';
import { PRESETS_STORAGE_KEY, PRESETS_VERSION, createPreset } from '@/lib/presets';
import { DEFAULT_PRICING_PROFILE_ID } from '@/lib/pricing';
import {
  MAX_RESTAURANTS,
  MAX_STORED_RESTAURANTS_LENGTH,
  RESTAURANTS_VERSION,
  createRestaurantProfile,
  findRestaurant,
  loadRestaurants,
  parseStoredRestaurants,
  removeRestaurant,
  restaurantId,
  restaurantMatchesSetup,
  restaurantsFromPresets,
  saveRestaurants,
  upsertRestaurant,
  type RestaurantProfile,
} from '@/lib/restaurants';
import {
  buildRestaurantSummary,
  compareRestaurants,
  orphanedVisits,
  restaurantVisits,
  summariseRestaurants,
  unlinkedVisitCandidates,
} from '@/lib/restaurantHub';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { MealSession } from '@/types/meal';

const AT = '2026-08-16T12:00:00.000Z';

function profile(name: string, pricePerDiner = 59.9, dinerCount = 1): RestaurantProfile {
  const created = createRestaurantProfile({ name, pricePerDiner, dinerCount }, AT);
  if (!created) {
    throw new Error(`Could not create a restaurant named "${name}"`);
  }
  return created;
}

function visit(id: string, overrides: Partial<MealSession> = {}, createdAt = AT): SavedMealSession {
  const session: MealSession = {
    restaurantName: 'Friday KBBQ',
    pricePerDiner: 59.9,
    dinerCount: 1,
    items: [
      {
        id: 'beef-ribeye__standard__regular',
        foodId: 'beef-ribeye',
        quality: 'standard',
        plateSize: 'regular',
        quantity: 8,
      },
    ],
    ...overrides,
  };
  const report = buildDamageReport(session.items, session);
  return createSavedSession(session, report, getVerdict(1, 1), { id, createdAt });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('restaurantId', () => {
  it('is the name, case- and space-insensitively', () => {
    expect(restaurantId('Friday KBBQ')).toBe('friday-kbbq');
    expect(restaurantId('  friday   kbbq  ')).toBe('friday-kbbq');
    expect(restaurantId('FRIDAY KBBQ')).toBe('friday-kbbq');
  });
});

describe('createRestaurantProfile', () => {
  it('refuses a place with no name', () => {
    expect(
      createRestaurantProfile({ name: '   ', pricePerDiner: 20, dinerCount: 1 }, AT),
    ).toBeNull();
  });

  it('clamps the setup it was handed', () => {
    const created = profile('Friday KBBQ', 10_000, 99);
    expect(created.pricePerDiner).toBe(500);
    expect(created.dinerCount).toBe(12);
  });

  it('starts with the built-in pricing context and an empty note', () => {
    const created = profile('Friday KBBQ');
    expect(created.pricingProfileId).toBe(DEFAULT_PRICING_PROFILE_ID);
    expect(created.note).toBe('');
    expect(created.createdAt).toBe(AT);
    expect(created.updatedAt).toBe(AT);
  });

  it('collapses and bounds a note', () => {
    const created = createRestaurantProfile(
      { name: 'Friday KBBQ', pricePerDiner: 20, dinerCount: 1, note: `  a  b  ${'x'.repeat(400)}` },
      AT,
    );
    expect(created?.note.startsWith('a b ')).toBe(true);
    expect(created?.note.length).toBe(200);
  });
});

describe('the restaurant list', () => {
  it('updates rather than duplicates when the same name is saved again', () => {
    const list = upsertRestaurant([profile('Friday KBBQ', 42)], profile('friday kbbq', 80));

    expect(list).toHaveLength(1);
    expect(list[0]?.pricePerDiner).toBe(80);
  });

  it('keeps the date the place was first saved', () => {
    const original = profile('Friday KBBQ');
    const later = createRestaurantProfile(
      { name: 'Friday KBBQ', pricePerDiner: 80, dinerCount: 1 },
      '2026-09-01T12:00:00.000Z',
    );
    const list = upsertRestaurant([original], later!);

    expect(list[0]?.createdAt).toBe(AT);
    expect(list[0]?.updatedAt).toBe('2026-09-01T12:00:00.000Z');
  });

  it('never grows past the supported length', () => {
    let list: readonly RestaurantProfile[] = [];
    for (let index = 0; index < MAX_RESTAURANTS + 5; index += 1) {
      list = upsertRestaurant(list, profile(`Place ${index}`));
    }
    expect(list).toHaveLength(MAX_RESTAURANTS);
  });

  it('removes and finds by id', () => {
    const list = [profile('Friday KBBQ'), profile('Sunday Hotpot')];

    expect(findRestaurant(list, 'friday-kbbq')?.name).toBe('Friday KBBQ');
    expect(removeRestaurant(list, 'friday-kbbq')).toHaveLength(1);
    expect(findRestaurant(removeRestaurant(list, 'friday-kbbq'), 'friday-kbbq')).toBeUndefined();
  });

  it('knows when applying a place would change nothing', () => {
    const place = profile('Friday KBBQ', 42, 2);

    expect(
      restaurantMatchesSetup(place, { name: 'Friday KBBQ', pricePerDiner: 42, dinerCount: 2 }),
    ).toBe(true);
    expect(
      restaurantMatchesSetup(place, { name: 'Friday KBBQ', pricePerDiner: 43, dinerCount: 2 }),
    ).toBe(false);
  });
});

describe('stored restaurants', () => {
  it('round trips through storage', () => {
    const list = [profile('Friday KBBQ'), profile('Sunday Hotpot')];
    saveRestaurants(list);
    expect(loadRestaurants()).toEqual(list);
  });

  it('refuses an oversized entry before parsing it', () => {
    expect(parseStoredRestaurants('x'.repeat(MAX_STORED_RESTAURANTS_LENGTH + 1))).toEqual([]);
  });

  it('rejects an envelope it does not recognise', () => {
    expect(parseStoredRestaurants('{ not json')).toEqual([]);
    expect(parseStoredRestaurants(JSON.stringify({ version: 99, restaurants: [] }))).toEqual([]);
  });

  it('drops entries it cannot read and de-duplicates the rest', () => {
    const restored = parseStoredRestaurants(
      JSON.stringify({
        version: RESTAURANTS_VERSION,
        restaurants: [
          profile('Friday KBBQ'),
          { ...profile('Friday KBBQ'), pricePerDiner: 80 },
          { name: '' },
          'nonsense',
          { name: 'No price' },
        ],
      }),
    );

    expect(restored).toHaveLength(1);
    expect(restored[0]?.pricePerDiner).toBe(59.9);
  });

  it('migrates the old presets the first time it is read', () => {
    window.localStorage.setItem(
      PRESETS_STORAGE_KEY,
      JSON.stringify({
        version: PRESETS_VERSION,
        presets: [createPreset({ name: 'Friday KBBQ', pricePerDiner: 42, dinerCount: 2 }, AT)],
      }),
    );

    const migrated = loadRestaurants();

    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toMatchObject({
      id: 'friday-kbbq',
      name: 'Friday KBBQ',
      pricePerDiner: 42,
      dinerCount: 2,
      note: '',
    });
    // The presets themselves are left where they are for older builds.
    expect(window.localStorage.getItem(PRESETS_STORAGE_KEY)).not.toBeNull();
  });

  it('stops migrating once a restaurant list exists, even an empty one', () => {
    window.localStorage.setItem(
      PRESETS_STORAGE_KEY,
      JSON.stringify({
        version: PRESETS_VERSION,
        presets: [createPreset({ name: 'Friday KBBQ', pricePerDiner: 42, dinerCount: 2 }, AT)],
      }),
    );
    saveRestaurants([]);

    expect(loadRestaurants()).toEqual([]);
  });

  it('preserves a preset id exactly, so nothing that referred to it is orphaned', () => {
    const preset = createPreset({ name: 'Friday KBBQ', pricePerDiner: 42, dinerCount: 2 }, AT)!;
    expect(restaurantsFromPresets([preset])[0]?.id).toBe(preset.id);
  });
});

describe('restaurant visits', () => {
  const place = profile('Friday KBBQ');

  it('belongs to a place by an explicit link, never by a matching name', () => {
    const records = [
      visit('a', { restaurantId: 'friday-kbbq' }),
      // Same name typed by hand, but never linked.
      visit('b'),
    ];

    expect(restaurantVisits(records, 'friday-kbbq').map((record) => record.id)).toEqual(['a']);
    expect(unlinkedVisitCandidates(records, place).map((record) => record.id)).toEqual(['b']);
  });

  it('offers no candidates when the names do not match either', () => {
    expect(
      unlinkedVisitCandidates([visit('a', { restaurantName: 'Somewhere Else' })], place),
    ).toEqual([]);
  });

  it('summarises the visits it does have', () => {
    const summary = buildRestaurantSummary(place, [
      visit('a', { restaurantId: 'friday-kbbq' }, '2026-08-10T12:00:00.000Z'),
      visit('b', { restaurantId: 'friday-kbbq', pricePerDiner: 30 }, '2026-08-20T12:00:00.000Z'),
    ]);

    expect(summary.visits).toBe(2);
    expect(summary.firstVisitAt).toBe('2026-08-10T12:00:00.000Z');
    expect(summary.latestVisitAt).toBe('2026-08-20T12:00:00.000Z');
    expect(summary.averageAdmission).toBeCloseTo((59.9 + 30) / 2, 6);
    expect(summary.bestRecoveryPercent).toBeGreaterThan(summary.averageRecoveryPercent);
    expect(summary.averagePlates).toBe(8);
    expect(summary.analytics.topFoods[0]?.name).toBe('Ribeye');
    expect(summary.records.map((record) => record.id)).toEqual(['b', 'a']);
  });

  it('reports a place with no visits without dividing by zero', () => {
    const summary = buildRestaurantSummary(place, []);

    expect(summary.visits).toBe(0);
    expect(summary.averageAdmission).toBe(0);
    expect(summary.averageRecoveryPercent).toBe(0);
    expect(summary.bestRecoveryPercent).toBe(0);
    expect(summary.firstVisitAt).toBeNull();
    expect(summary.latestVisitAt).toBeNull();
  });

  it('counts nothing that belongs to another place', () => {
    const summary = buildRestaurantSummary(place, [
      visit('a', { restaurantId: 'friday-kbbq' }),
      visit('b', { restaurantId: 'sunday-hotpot' }),
    ]);

    expect(summary.visits).toBe(1);
  });

  it('orders the list by the most recent visit, then by name', () => {
    const summaries = summariseRestaurants(
      [profile('Sunday Hotpot'), profile('Friday KBBQ'), profile('Never Been')],
      [
        visit('a', { restaurantId: 'friday-kbbq' }, '2026-08-20T12:00:00.000Z'),
        visit('b', { restaurantId: 'sunday-hotpot' }, '2026-08-10T12:00:00.000Z'),
      ],
    );

    expect(summaries.map((summary) => summary.profile.id)).toEqual([
      'friday-kbbq',
      'sunday-hotpot',
      'never-been',
    ]);
  });
});

describe('deleting a place', () => {
  it('leaves its filed visits intact', () => {
    const records = [visit('a', { restaurantId: 'friday-kbbq' })];
    const remaining = removeRestaurant([profile('Friday KBBQ')], 'friday-kbbq');

    expect(remaining).toEqual([]);
    // The record keeps its own snapshot of the name, price and menu context.
    expect(records[0]?.restaurantName).toBe('Friday KBBQ');
    expect(records[0]?.pricePerDiner).toBe(59.9);
    expect(orphanedVisits(records, remaining).map((record) => record.id)).toEqual(['a']);
  });

  it('reports nothing as orphaned while the place still exists', () => {
    const records = [visit('a', { restaurantId: 'friday-kbbq' })];
    expect(orphanedVisits(records, [profile('Friday KBBQ')])).toEqual([]);
  });

  it('never treats an unlinked record as orphaned', () => {
    expect(orphanedVisits([visit('a')], [])).toEqual([]);
  });
});

describe('restaurant comparisons', () => {
  it('uses only records linked to each explicit restaurant ID', () => {
    const comparison = compareRestaurants(profile('Friday KBBQ'), profile('Sunday Hotpot'), [
      visit('friday', { restaurantId: 'friday-kbbq' }),
      visit('sunday', { restaurantId: 'sunday-hotpot' }),
      visit('unlinked', { restaurantName: 'Friday KBBQ' }),
    ]);

    expect(comparison.left.visits).toBe(1);
    expect(comparison.right.visits).toBe(1);
  });
});
