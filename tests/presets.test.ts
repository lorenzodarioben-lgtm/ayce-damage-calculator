import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_PRESETS,
  MAX_STORED_PRESETS_LENGTH,
  PRESETS_STORAGE_KEY,
  PRESETS_VERSION,
  createPreset,
  findPreset,
  loadPresets,
  parseStoredPresets,
  presetId,
  presetMatchesSetup,
  removePreset,
  savePresets,
  upsertPreset,
  type RestaurantPreset,
} from '@/lib/presets';
import { DEFAULT_PRICING_PROFILE_ID } from '@/lib/pricing';

const AT = '2026-08-16T12:00:00.000Z';

function preset(name: string, pricePerDiner = 59.9, dinerCount = 1): RestaurantPreset {
  const created = createPreset({ name, pricePerDiner, dinerCount }, AT);
  if (!created) {
    throw new Error(`Could not create a preset named "${name}"`);
  }
  return created;
}

function stored(presets: readonly unknown[], version = PRESETS_VERSION): string {
  return JSON.stringify({ version, presets });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('presetId', () => {
  it('ignores case and spacing, so one restaurant is one preset', () => {
    expect(presetId('Seoul Garden')).toBe(presetId('  seoul   GARDEN '));
  });

  it('distinguishes genuinely different names', () => {
    expect(presetId('Seoul Garden')).not.toBe(presetId('Seoul Grill'));
  });
});

describe('createPreset', () => {
  it('captures the setup', () => {
    const created = preset('Friday KBBQ', 59.9, 2);

    expect(created).toMatchObject({ name: 'Friday KBBQ', pricePerDiner: 59.9, dinerCount: 2 });
  });

  it('keeps the selected pricing profile with a restaurant setup', () => {
    const created = createPreset(
      {
        name: 'Seoul Garden',
        pricePerDiner: 59.9,
        dinerCount: 2,
        pricingProfileId: 'custom-city',
      },
      AT,
    );
    expect(created?.pricingProfileId).toBe('custom-city');
  });

  it('refuses a preset with no name to identify it by', () => {
    expect(createPreset({ name: '', pricePerDiner: 59.9, dinerCount: 1 }, AT)).toBeNull();
    expect(createPreset({ name: '   ', pricePerDiner: 59.9, dinerCount: 1 }, AT)).toBeNull();
  });

  it('clamps a setup the calculator would not accept', () => {
    const created = preset('Absurd', 999_999, 500);

    expect(created.pricePerDiner).toBe(500);
    expect(created.dinerCount).toBe(12);
  });

  it('collapses whitespace in the name', () => {
    expect(preset('  Seoul    Garden  ').name).toBe('Seoul Garden');
  });
});

describe('upsertPreset', () => {
  it('adds a new preset at the front', () => {
    const list = upsertPreset([preset('Little Seoul')], preset('Wagyu House'));

    expect(list).toHaveLength(2);
    expect(list[0]?.name).toBe('Wagyu House');
  });

  it('updates rather than duplicating when the name matches', () => {
    const list = upsertPreset([preset('Seoul Garden', 59.9, 1)], preset('seoul garden', 75, 4));

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'seoul garden', pricePerDiner: 75, dinerCount: 4 });
  });

  it('keeps the list bounded', () => {
    let list: readonly RestaurantPreset[] = [];
    for (let index = 0; index < MAX_PRESETS + 4; index += 1) {
      list = upsertPreset(list, preset(`Restaurant ${index}`));
    }

    expect(list).toHaveLength(MAX_PRESETS);
    // Newest kept, oldest dropped.
    expect(list[0]?.name).toBe(`Restaurant ${MAX_PRESETS + 3}`);
  });

  it('leaves the source list untouched', () => {
    const original = [preset('Little Seoul')];
    upsertPreset(original, preset('Wagyu House'));

    expect(original).toHaveLength(1);
  });
});

describe('removePreset and findPreset', () => {
  const list = [preset('Little Seoul'), preset('Wagyu House')];

  it('removes only the named preset', () => {
    expect(removePreset(list, presetId('Little Seoul'))).toHaveLength(1);
    expect(removePreset(list, 'never-existed')).toHaveLength(2);
  });

  it('finds a preset by id', () => {
    expect(findPreset(list, presetId('Wagyu House'))?.name).toBe('Wagyu House');
    expect(findPreset(list, 'never-existed')).toBeUndefined();
  });
});

describe('presetMatchesSetup', () => {
  const saved = preset('Seoul Garden', 59.9, 2);

  it('recognises a setup that already matches', () => {
    expect(
      presetMatchesSetup(saved, { name: 'seoul garden', pricePerDiner: 59.9, dinerCount: 2 }),
    ).toBe(true);
  });

  it.each([
    ['a different name', { name: 'Other', pricePerDiner: 59.9, dinerCount: 2 }],
    ['a different price', { name: 'Seoul Garden', pricePerDiner: 75, dinerCount: 2 }],
    ['a different table', { name: 'Seoul Garden', pricePerDiner: 59.9, dinerCount: 4 }],
  ])('reports a mismatch for %s', (_label, setup) => {
    expect(presetMatchesSetup(saved, setup)).toBe(false);
  });

  it('tolerates floating-point noise in the price', () => {
    expect(
      presetMatchesSetup(saved, {
        name: 'Seoul Garden',
        pricePerDiner: 59.9 + Number.EPSILON,
        dinerCount: 2,
      }),
    ).toBe(true);
  });
});

describe('parseStoredPresets', () => {
  it('accepts what it wrote', () => {
    const presets = [preset('Little Seoul'), preset('Wagyu House', 75, 3)];

    expect(parseStoredPresets(stored(presets))).toEqual(presets);
  });

  it('migrates a version-one preset to the Australian pricing context', () => {
    const legacy = JSON.stringify({
      version: 1,
      presets: [
        {
          id: 'seoul-garden',
          name: 'Seoul Garden',
          pricePerDiner: 59.9,
          dinerCount: 2,
          createdAt: AT,
        },
      ],
    });
    expect(parseStoredPresets(legacy)[0]?.pricingProfileId).toBe(DEFAULT_PRICING_PROFILE_ID);
  });

  it.each([
    ['nothing stored', null],
    ['an empty string', ''],
    ['malformed JSON', '{ not json'],
    ['a bare array', '[]'],
  ])('returns an empty list for %s', (_label, raw) => {
    expect(parseStoredPresets(raw)).toEqual([]);
  });

  it('refuses an oversized storage entry before parsing it', () => {
    expect(parseStoredPresets('x'.repeat(MAX_STORED_PRESETS_LENGTH + 1))).toEqual([]);
  });

  it('rejects a payload from a different schema version', () => {
    expect(parseStoredPresets(stored([preset('Little Seoul')], 99))).toEqual([]);
  });

  it.each([
    ['no name', { ...preset('Little Seoul'), name: '' }],
    ['a non-numeric price', { ...preset('Little Seoul'), pricePerDiner: 'free' }],
    ['a non-finite price', { ...preset('Little Seoul'), pricePerDiner: Number.POSITIVE_INFINITY }],
    ['a non-numeric table', { ...preset('Little Seoul'), dinerCount: 'lots' }],
  ])('drops an entry with %s', (_label, entry) => {
    expect(parseStoredPresets(stored([entry]))).toEqual([]);
  });

  it('collapses duplicates a hand-edited file could contain', () => {
    expect(
      parseStoredPresets(stored([preset('Seoul Garden'), preset('seoul garden')])),
    ).toHaveLength(1);
  });

  it('clamps absurd stored values rather than trusting them', () => {
    const entry = { ...preset('Little Seoul'), pricePerDiner: 100_000, dinerCount: 900 };
    const parsed = parseStoredPresets(stored([entry]));

    expect(parsed[0]?.pricePerDiner).toBe(500);
    expect(parsed[0]?.dinerCount).toBe(12);
  });

  it('repairs an unusable timestamp rather than discarding the entry', () => {
    const parsed = parseStoredPresets(
      stored([{ ...preset('Little Seoul'), createdAt: 'whenever' }]),
    );

    expect(parsed).toHaveLength(1);
    expect(Number.isNaN(Date.parse(parsed[0]?.createdAt ?? ''))).toBe(false);
  });

  it('never returns more than the cap', () => {
    const many = Array.from({ length: MAX_PRESETS + 6 }, (_, index) => preset(`Place ${index}`));

    expect(parseStoredPresets(stored(many))).toHaveLength(MAX_PRESETS);
  });
});

describe('storage round trip', () => {
  it('saves and reloads presets', () => {
    const presets = [preset('Friday KBBQ', 59.9, 1)];
    savePresets(presets);

    expect(window.localStorage.getItem(PRESETS_STORAGE_KEY)).toContain('Friday KBBQ');
    expect(loadPresets()).toEqual(presets);
  });

  it('reads an empty list when nothing has been saved', () => {
    expect(loadPresets()).toEqual([]);
  });

  it('survives unusable stored data', () => {
    window.localStorage.setItem(PRESETS_STORAGE_KEY, 'not json at all');

    expect(loadPresets()).toEqual([]);
  });
});
