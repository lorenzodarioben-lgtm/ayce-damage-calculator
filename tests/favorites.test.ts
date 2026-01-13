import { beforeEach, describe, expect, it } from 'vitest';
import { FOODS } from '@/data/foods';
import { PLATE_SIZES, QUALITY_TIERS } from '@/lib/constants';
import {
  FAVORITES_STORAGE_KEY,
  FAVORITES_VERSION,
  MAX_FAVORITES,
  MAX_STORED_FAVORITES_LENGTH,
  createFavorite,
  describeFavorite,
  favoriteId,
  isFavorited,
  loadFavorites,
  parseStoredFavorites,
  removeFavorite,
  saveFavorites,
  toggleFavorite,
  type FavoriteConfig,
  type MealFavorite,
} from '@/lib/favorites';

const RIBEYE: FavoriteConfig = {
  foodId: 'beef-ribeye',
  quality: 'premium',
  plateSize: 'large',
};

const PORK: FavoriteConfig = {
  foodId: 'pork-belly',
  quality: 'standard',
  plateSize: 'regular',
};

const AT = '2026-08-16T12:00:00.000Z';

function stored(favorites: readonly unknown[], version = FAVORITES_VERSION): string {
  return JSON.stringify({ version, favorites });
}

/** Distinct saveable orders, built from the real dataset and option tables. */
function distinctConfigs(count: number): FavoriteConfig[] {
  const configs: FavoriteConfig[] = [];
  for (const food of FOODS) {
    for (const quality of QUALITY_TIERS) {
      for (const size of PLATE_SIZES) {
        if (configs.length >= count) {
          return configs;
        }
        configs.push({ foodId: food.id, quality: quality.id, plateSize: size.id });
      }
    }
  }
  return configs;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('favoriteId', () => {
  it('is derived from the configuration, so identical orders collide by design', () => {
    expect(favoriteId(RIBEYE)).toBe('beef-ribeye__premium__large');
    expect(favoriteId({ ...RIBEYE })).toBe(favoriteId(RIBEYE));
  });

  it('distinguishes grade and portion, which are different orders', () => {
    expect(favoriteId({ ...RIBEYE, quality: 'house' })).not.toBe(favoriteId(RIBEYE));
    expect(favoriteId({ ...RIBEYE, plateSize: 'small' })).not.toBe(favoriteId(RIBEYE));
  });
});

describe('toggleFavorite', () => {
  it('adds a configuration that is not saved yet', () => {
    const next = toggleFavorite([], RIBEYE, AT);

    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe(favoriteId(RIBEYE));
    expect(isFavorited(next, RIBEYE)).toBe(true);
  });

  it('removes a configuration that is already saved', () => {
    const saved = toggleFavorite([], RIBEYE, AT);

    expect(toggleFavorite(saved, RIBEYE, AT)).toEqual([]);
  });

  it('never stores the same order twice', () => {
    const once = toggleFavorite([], RIBEYE, AT);
    const again = toggleFavorite(toggleFavorite(once, RIBEYE, AT), RIBEYE, AT);

    expect(again).toHaveLength(1);
  });

  it('puts the newest first', () => {
    const list = toggleFavorite(toggleFavorite([], RIBEYE, AT), PORK, AT);

    expect(list[0]?.foodId).toBe('pork-belly');
  });

  it('drops the oldest once the cap is reached', () => {
    // Save one more distinct order than the cap allows, oldest saved first.
    let list: readonly MealFavorite[] = [];
    for (const config of distinctConfigs(MAX_FAVORITES)) {
      list = toggleFavorite(list, config, AT);
    }
    const oldest = list[list.length - 1];
    expect(list).toHaveLength(MAX_FAVORITES);

    const overflowed = toggleFavorite(list, PORK, AT);

    expect(overflowed).toHaveLength(MAX_FAVORITES);
    expect(overflowed[0]?.foodId).toBe('pork-belly');
    expect(overflowed.some((entry) => entry.id === oldest?.id)).toBe(false);
  });

  it('leaves the source list untouched', () => {
    const original: readonly MealFavorite[] = [createFavorite(RIBEYE, AT)];
    toggleFavorite(original, PORK, AT);

    expect(original).toHaveLength(1);
  });
});

describe('removeFavorite', () => {
  it('removes only the named entry', () => {
    const list = [createFavorite(RIBEYE, AT), createFavorite(PORK, AT)];

    expect(removeFavorite(list, favoriteId(RIBEYE))).toHaveLength(1);
    expect(removeFavorite(list, 'never-existed')).toHaveLength(2);
  });
});

describe('describeFavorite', () => {
  it('reads the label from the dataset rather than the stored record', () => {
    expect(describeFavorite(RIBEYE)).toBe('Ribeye · Premium · Large');
  });

  it('returns nothing for a cut that no longer exists', () => {
    expect(describeFavorite({ ...RIBEYE, foodId: 'beef-unicorn' })).toBeNull();
  });
});

describe('parseStoredFavorites', () => {
  it('accepts what it wrote', () => {
    const favorites = [createFavorite(RIBEYE, AT), createFavorite(PORK, AT)];

    expect(parseStoredFavorites(stored(favorites))).toEqual(favorites);
  });

  it.each([
    ['nothing stored', null],
    ['an empty string', ''],
    ['malformed JSON', '{ not json'],
    ['a bare array', '[]'],
  ])('returns an empty list for %s', (_label, raw) => {
    expect(parseStoredFavorites(raw)).toEqual([]);
  });

  it('refuses an oversized storage entry before parsing it', () => {
    expect(parseStoredFavorites('x'.repeat(MAX_STORED_FAVORITES_LENGTH + 1))).toEqual([]);
  });

  it('rejects a payload from a different schema version', () => {
    expect(parseStoredFavorites(stored([createFavorite(RIBEYE, AT)], 99))).toEqual([]);
  });

  it('drops entries pointing at cuts that no longer exist', () => {
    const raw = stored([
      { ...createFavorite(RIBEYE, AT), foodId: 'beef-unicorn' },
      createFavorite(PORK, AT),
    ]);

    expect(parseStoredFavorites(raw)).toHaveLength(1);
    expect(parseStoredFavorites(raw)[0]?.foodId).toBe('pork-belly');
  });

  it.each([
    ['an unknown grade', { quality: 'legendary' }],
    ['an unknown portion', { plateSize: 'enormous' }],
  ])('drops entries with %s', (_label, overrides) => {
    const raw = stored([{ ...createFavorite(RIBEYE, AT), ...overrides }]);

    expect(parseStoredFavorites(raw)).toEqual([]);
  });

  it('collapses duplicates that a hand-edited file could contain', () => {
    const raw = stored([createFavorite(RIBEYE, AT), createFavorite(RIBEYE, AT)]);

    expect(parseStoredFavorites(raw)).toHaveLength(1);
  });

  it('repairs an unusable timestamp rather than discarding the entry', () => {
    const raw = stored([{ ...createFavorite(RIBEYE, AT), createdAt: 'whenever' }]);
    const parsed = parseStoredFavorites(raw);

    expect(parsed).toHaveLength(1);
    expect(Number.isNaN(Date.parse(parsed[0]?.createdAt ?? ''))).toBe(false);
  });

  it('rebuilds the id from the configuration, ignoring whatever was stored', () => {
    const raw = stored([{ ...createFavorite(RIBEYE, AT), id: 'tampered' }]);

    expect(parseStoredFavorites(raw)[0]?.id).toBe(favoriteId(RIBEYE));
  });

  it('never returns more than the cap', () => {
    const many = Array.from({ length: MAX_FAVORITES + 10 }, (_, index) => ({
      ...createFavorite(RIBEYE, AT),
      // Distinct configurations, so none are collapsed as duplicates.
      foodId: index % 2 === 0 ? 'beef-ribeye' : 'pork-belly',
      quality: index % 3 === 0 ? 'house' : 'premium',
      plateSize: index % 2 === 0 ? 'small' : 'large',
    }));

    expect(parseStoredFavorites(stored(many)).length).toBeLessThanOrEqual(MAX_FAVORITES);
  });
});

describe('storage round trip', () => {
  it('saves and reloads the list', () => {
    const favorites = [createFavorite(RIBEYE, AT)];
    saveFavorites(favorites);

    expect(window.localStorage.getItem(FAVORITES_STORAGE_KEY)).toContain('beef-ribeye');
    expect(loadFavorites()).toEqual(favorites);
  });

  it('reads an empty list when nothing has been saved', () => {
    expect(loadFavorites()).toEqual([]);
  });

  it('survives unusable stored data', () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, 'not json at all');

    expect(loadFavorites()).toEqual([]);
  });
});
