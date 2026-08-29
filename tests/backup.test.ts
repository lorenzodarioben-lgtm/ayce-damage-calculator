import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  MAX_BACKUP_BYTES,
  backupFilename,
  buildBackup,
  calculateRestoreImpact,
  mergeById,
  parseBackup,
  serialiseBackup,
} from '@/lib/backup';
import { buildDamageReport } from '@/lib/calculations';
import { createCustomFood } from '@/lib/customFoods';
import { createFavorite, type MealFavorite } from '@/lib/favorites';
import { createSavedSession } from '@/lib/history';
import { createRestaurantProfile } from '@/lib/restaurants';
import type { BackupConfiguration } from '@/lib/backup';
import { getVerdict } from '@/lib/verdicts';
import type { SavedMealSession } from '@/types/history';
import type { MealItem, MealSession } from '@/types/meal';
import type { PricingProfile } from '@/types/pricing';

const AT = '2026-08-16T12:00:00.000Z';

function item(foodId = 'beef-ribeye', quantity = 2): MealItem {
  return {
    id: `${foodId}__standard__regular`,
    foodId,
    quality: 'standard',
    plateSize: 'regular',
    quantity,
  };
}

function record(id: string, overrides: Partial<MealSession> = {}): SavedMealSession {
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 59.9,
    dinerCount: 1,
    items: [item()],
    ...overrides,
  };
  const report = buildDamageReport(session.items, session);
  return createSavedSession(
    session,
    report,
    getVerdict(report.totalRetailValue, report.totalAdmission),
    { id, createdAt: AT },
  );
}

const RIBEYE_FAVORITE = createFavorite(
  { foodId: 'beef-ribeye', quality: 'premium', plateSize: 'large' },
  AT,
);
const PORK_FAVORITE = createFavorite(
  { foodId: 'pork-belly', quality: 'standard', plateSize: 'regular' },
  AT,
);

const MARKET_PROFILE: PricingProfile = {
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

const CHEESE_CORN = createCustomFood(
  {
    name: 'Cheese Corn',
    shortName: 'Cheese Corn',
    category: 'chicken',
    retailPricePerKg: 18,
    restaurantCostPerKg: 7,
  },
  'custom-food-cheese-corn',
);

if (!CHEESE_CORN) {
  throw new Error('Could not create the custom menu fixture.');
}

const CONFIGURATION: BackupConfiguration = {
  pricingProfiles: [MARKET_PROFILE],
  customFoods: [CHEESE_CORN],
  restaurants: [
    createRestaurantProfile(
      {
        name: 'Friday KBBQ',
        pricePerDiner: 42,
        dinerCount: 2,
        pricingProfileId: MARKET_PROFILE.id,
      },
      AT,
    )!,
  ],
};

function exported(
  history: readonly SavedMealSession[] = [record('a')],
  favorites: readonly MealFavorite[] = [RIBEYE_FAVORITE],
  configuration: BackupConfiguration = {
    pricingProfiles: [],
    customFoods: [],
    restaurants: [],
  },
): string {
  return serialiseBackup(buildBackup(history, favorites, AT, configuration));
}

describe('backupFilename', () => {
  it('is dated and clearly ours', () => {
    expect(backupFilename(new Date('2026-08-16T12:00:00.000Z'))).toMatch(
      /^ayce-damage-backup-2026-08-\d{2}\.json$/,
    );
  });

  it('pads single-digit months and days', () => {
    expect(backupFilename(new Date(2026, 0, 5))).toBe('ayce-damage-backup-2026-01-05.json');
  });

  it('does not produce a broken name for an invalid date', () => {
    expect(backupFilename(new Date('nonsense'))).toBe('ayce-damage-backup-unknown-date.json');
  });
});

describe('Round trip', () => {
  it('restores exactly what was exported', () => {
    const history = [record('a'), record('b', { dinerCount: 3 })];
    const favorites = [RIBEYE_FAVORITE, PORK_FAVORITE];

    const parsed = parseBackup(exported(history, favorites));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.history).toEqual(history);
    expect(parsed.contents.favorites).toEqual(favorites);
    expect(parsed.contents.exportedAt).toBe(AT);
    expect(parsed.summary).toEqual({
      skippedHistory: 0,
      skippedFavorites: 0,
      skippedPricingProfiles: 0,
      skippedCustomFoods: 0,
      skippedRestaurants: 0,
    });
  });

  it('stamps the file with the format and version', () => {
    const backup = buildBackup([record('a')], [], AT);

    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
  });

  it('survives a backup with history but no favourites', () => {
    const parsed = parseBackup(exported([record('a')], []));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.favorites).toEqual([]);
  });

  it('survives a backup with favourites but no history', () => {
    const parsed = parseBackup(exported([], [RIBEYE_FAVORITE]));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.history).toEqual([]);
  });

  it('carries custom menu configuration and the favourites that use it', () => {
    const customFavorite = createFavorite(
      { foodId: CHEESE_CORN.id, quality: 'premium', plateSize: 'large' },
      AT,
    );
    const parsed = parseBackup(exported([], [customFavorite], CONFIGURATION));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.configuration).toEqual(CONFIGURATION);
    expect(parsed.contents.favorites).toEqual([customFavorite]);
  });

  it('retains validated local session tags through export and restore parsing', () => {
    const tagged = { ...record('tagged'), tags: ['friends', 'birthday'] };

    const parsed = parseBackup(exported([tagged], []));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.history[0]?.tags).toEqual(['friends', 'birthday']);
  });

  it('continues to restore version 1 files without a configuration section', () => {
    const parsed = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        exportedAt: AT,
        history: [record('legacy')],
        favorites: [RIBEYE_FAVORITE],
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.configuration).toEqual({
      pricingProfiles: [],
      customFoods: [],
      restaurants: [],
    });
  });
});

describe('Rejecting bad files', () => {
  it.each([
    ['not JSON at all', 'this is not json', 'invalid-json'],
    ['a bare array', '[]', 'not-a-backup'],
    ['JSON that is not a backup', JSON.stringify({ hello: 'world' }), 'not-a-backup'],
    [
      'someone else’s export',
      JSON.stringify({ format: 'some-other-app', version: 1 }),
      'not-a-backup',
    ],
    [
      'a newer schema',
      JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, history: [] }),
      'unsupported-version',
    ],
    [
      'a version that is not a number',
      JSON.stringify({ format: BACKUP_FORMAT, version: 'one', history: [] }),
      'unsupported-version',
    ],
    [
      'a backup with nothing readable in it',
      JSON.stringify({ format: BACKUP_FORMAT, version: 1, history: [], favorites: [] }),
      'nothing-usable',
    ],
  ])('rejects %s', (_label, raw, error) => {
    const parsed = parseBackup(raw);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe(error);
  });

  it('refuses a file too large to be a real backup', () => {
    const huge = 'x'.repeat(MAX_BACKUP_BYTES + 1);
    const parsed = parseBackup(huge);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toBe('too-large');
  });

  it('never executes anything from the file', () => {
    // A backup is data; a function-shaped value simply does not survive JSON.
    const hostile = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      history: [{ ...record('a'), restaurantName: '<script>alert(1)</script>' }],
      favorites: [],
    });
    const parsed = parseBackup(hostile);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // Preserved as inert text, exactly as the app itself would store it.
    expect(parsed.contents.history[0]?.restaurantName).toBe('<script>alert(1)</script>');
  });

  it('never throws, whatever it is handed', () => {
    for (const raw of ['', '{', 'null', '"a string"', '{"format":null}', '0']) {
      expect(() => parseBackup(raw)).not.toThrow();
    }
  });
});

describe('Discarding unusable records', () => {
  it('keeps the good records and reports what it dropped', () => {
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: AT,
      history: [record('a'), { id: 'broken', version: 2, createdAt: 'whenever' }, 'nonsense'],
      favorites: [
        RIBEYE_FAVORITE,
        { foodId: 'beef-unicorn', quality: 'standard', plateSize: 'regular' },
      ],
    });

    const parsed = parseBackup(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.history).toHaveLength(1);
    expect(parsed.contents.favorites).toHaveLength(1);
    expect(parsed.summary).toEqual({
      skippedHistory: 2,
      skippedFavorites: 1,
      skippedPricingProfiles: 0,
      skippedCustomFoods: 0,
      skippedRestaurants: 0,
    });
  });

  it('drops malformed configuration entries while retaining valid menu data', () => {
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      history: [],
      favorites: [],
      configuration: {
        pricingProfiles: [MARKET_PROFILE, { ...MARKET_PROFILE, id: 'bad id' }],
        customFoods: [CHEESE_CORN, { ...CHEESE_CORN, retailPricePerKg: -1 }],
        restaurants: [CONFIGURATION.restaurants[0], { ...CONFIGURATION.restaurants[0], name: '' }],
      },
    });
    const parsed = parseBackup(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.configuration).toEqual(CONFIGURATION);
    expect(parsed.summary).toMatchObject({
      skippedPricingProfiles: 1,
      skippedCustomFoods: 1,
      skippedRestaurants: 1,
    });
  });

  it('collapses a record repeated inside the file', () => {
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      history: [record('a'), record('a')],
      favorites: [],
    });

    const parsed = parseBackup(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.history).toHaveLength(1);
  });

  it('repairs a missing export timestamp rather than rejecting the file', () => {
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      history: [record('a')],
      favorites: [],
    });

    const parsed = parseBackup(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Number.isNaN(Date.parse(parsed.contents.exportedAt))).toBe(false);
  });

  it('brings version 1 history records forward on restore', () => {
    const legacy = record('legacy');
    const { achievementIds: _dropped, ...snapshot } = legacy.snapshot;
    const raw = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      history: [{ ...legacy, version: 1, snapshot }],
      favorites: [],
    });

    const parsed = parseBackup(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.history[0]?.version).toBe(legacy.version);
  });
});

describe('mergeById', () => {
  it('adds what is new and keeps what is already here', () => {
    const existing = [record('a')];
    const incoming = [record('a', { dinerCount: 9 }), record('b')];

    const outcome = mergeById(existing, incoming);

    expect(outcome.result).toHaveLength(2);
    expect(outcome.added).toBe(1);
    expect(outcome.kept).toBe(1);
    // The existing copy of "a" wins; the incoming one does not overwrite it.
    expect(outcome.result.find((entry) => entry.id === 'a')?.dinerCount).toBe(1);
  });

  it('destroys nothing when the incoming list is empty', () => {
    const existing = [record('a'), record('b')];

    expect(mergeById(existing, []).result).toEqual(existing);
  });

  it('accepts everything onto an empty device', () => {
    const outcome = mergeById([], [record('a'), record('b')]);

    expect(outcome.result).toHaveLength(2);
    expect(outcome.added).toBe(2);
  });

  it('leaves the source arrays untouched', () => {
    const existing = [record('a')];
    mergeById(existing, [record('b')]);

    expect(existing).toHaveLength(1);
  });

  it('works for favourites as well as sessions', () => {
    const outcome = mergeById([RIBEYE_FAVORITE], [RIBEYE_FAVORITE, PORK_FAVORITE]);

    expect(outcome.result).toHaveLength(2);
    expect(outcome.added).toBe(1);
  });
});

describe('calculateRestoreImpact', () => {
  it('forecasts merge additions and replace discards without changing either collection', () => {
    const incoming = {
      history: [record('a'), record('b')],
      favorites: [RIBEYE_FAVORITE, PORK_FAVORITE],
      configuration: CONFIGURATION,
    };
    const current = {
      history: [record('a')],
      favorites: [RIBEYE_FAVORITE],
      configuration: CONFIGURATION,
    };
    const incomingBefore = structuredClone(incoming);
    const currentBefore = structuredClone(current);

    const impact = calculateRestoreImpact(incoming, current);

    expect(impact.merge.sessions).toEqual({ incoming: 2, new: 1, alreadyOnDevice: 1 });
    expect(impact.merge.savedOrders).toEqual({ incoming: 2, new: 1, alreadyOnDevice: 1 });
    expect(impact.merge.pricingProfiles).toEqual({ incoming: 1, new: 0, alreadyOnDevice: 1 });
    expect(impact.merge.customFoods).toEqual({ incoming: 1, new: 0, alreadyOnDevice: 1 });
    expect(impact.merge.restaurants).toEqual({ incoming: 1, new: 0, alreadyOnDevice: 1 });
    expect(impact.replace.sessions).toEqual({ incoming: 2, discarded: 1 });
    expect(impact.replace.savedOrders).toEqual({ incoming: 2, discarded: 1 });
    expect(impact.replace.pricingProfiles).toEqual({ incoming: 1, discarded: 1 });
    expect(impact.replace.customFoods).toEqual({ incoming: 1, discarded: 1 });
    expect(impact.replace.restaurants).toEqual({ incoming: 1, discarded: 1 });
    expect(incoming).toEqual(incomingBefore);
    expect(current).toEqual(currentBefore);
  });
});

describe('restaurant profiles in a backup', () => {
  it('carries saved restaurants out and back', () => {
    const parsed = parseBackup(exported([record('a')], [RIBEYE_FAVORITE], CONFIGURATION));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.configuration.restaurants).toEqual(CONFIGURATION.restaurants);
  });

  it('migrates the presets in a backup written before restaurants existed', () => {
    const parsed = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 2,
        exportedAt: AT,
        history: [],
        favorites: [],
        configuration: {
          pricingProfiles: [],
          customFoods: [],
          presets: [
            {
              id: 'friday-kbbq',
              name: 'Friday KBBQ',
              pricePerDiner: 42,
              dinerCount: 2,
              pricingProfileId: 'australian-kbbq',
              createdAt: AT,
            },
          ],
        },
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.configuration.restaurants).toEqual([
      {
        id: 'friday-kbbq',
        name: 'Friday KBBQ',
        pricePerDiner: 42,
        dinerCount: 2,
        pricingProfileId: 'australian-kbbq',
        note: '',
        createdAt: AT,
        updatedAt: AT,
      },
    ]);
  });

  it('prefers the newer shape when a file somehow carries both', () => {
    const parsed = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: AT,
        history: [],
        favorites: [],
        configuration: {
          restaurants: [{ ...CONFIGURATION.restaurants[0], note: 'Ask for the corner booth.' }],
          presets: [
            {
              id: 'friday-kbbq',
              name: 'Friday KBBQ',
              pricePerDiner: 99,
              dinerCount: 1,
              pricingProfileId: 'australian-kbbq',
              createdAt: AT,
            },
          ],
        },
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.configuration.restaurants).toHaveLength(1);
    expect(parsed.contents.configuration.restaurants[0]).toMatchObject({
      pricePerDiner: 42,
      note: 'Ask for the corner booth.',
    });
  });

  it('keeps the restaurant a filed visit belongs to', () => {
    const linked = { ...record('linked'), restaurantId: 'friday-kbbq' };
    const parsed = parseBackup(exported([linked], [], CONFIGURATION));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.contents.history[0]?.restaurantId).toBe('friday-kbbq');
  });
});
