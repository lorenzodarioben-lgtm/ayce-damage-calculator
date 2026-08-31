import { describe, expect, it } from 'vitest';
import {
  CATEGORY_META,
  FOOD_CATEGORIES,
  PLATE_SIZES,
  QUALITY_TIERS,
  getPlateSizeMeta,
  getQualityMeta,
  isFoodCategory,
  isPlateSize,
  isQualityTier,
} from '@/lib/constants';

/*
 * A category, a quality tier and a plate size all arrive from storage, a share
 * token and an imported CSV, where they are ordinary strings. These guards are
 * the boundary that turns one back into a value the calculator can price, and
 * the lookups beside them are deliberately loud rather than silently defaulting
 * — a plate size the app has never heard of is a bug, not a small plate.
 */

describe('isFoodCategory', () => {
  it.each(FOOD_CATEGORIES)('accepts %s', (category) => {
    expect(isFoodCategory(category)).toBe(true);
  });

  it('rejects a category the menu does not have', () => {
    expect(isFoodCategory('noodles')).toBe(false);
    expect(isFoodCategory('')).toBe(false);
  });

  it('rejects a category that differs only by case or spacing', () => {
    expect(isFoodCategory('Beef')).toBe(false);
    expect(isFoodCategory('hot food')).toBe(false);
    expect(isFoodCategory(' beef')).toBe(false);
  });

  it('rejects anything that is not a string', () => {
    expect(isFoodCategory(undefined)).toBe(false);
    expect(isFoodCategory(null)).toBe(false);
    expect(isFoodCategory(0)).toBe(false);
    expect(isFoodCategory(['beef'])).toBe(false);
  });
});

describe('isQualityTier', () => {
  it.each(QUALITY_TIERS.map((tier) => tier.id))('accepts %s', (tier) => {
    expect(isQualityTier(tier)).toBe(true);
  });

  it('rejects a tier nobody offers', () => {
    expect(isQualityTier('wagyu')).toBe(false);
    expect(isQualityTier('Standard')).toBe(false);
    expect(isQualityTier('')).toBe(false);
  });

  it('rejects anything that is not a string', () => {
    expect(isQualityTier(undefined)).toBe(false);
    expect(isQualityTier(null)).toBe(false);
    expect(isQualityTier(1)).toBe(false);
  });
});

describe('isPlateSize', () => {
  it.each(PLATE_SIZES.map((size) => size.id))('accepts %s', (size) => {
    expect(isPlateSize(size)).toBe(true);
  });

  it('rejects a size the picker never offered', () => {
    expect(isPlateSize('huge')).toBe(false);
    expect(isPlateSize('Regular')).toBe(false);
    expect(isPlateSize('')).toBe(false);
  });

  it('rejects anything that is not a string', () => {
    expect(isPlateSize(undefined)).toBe(false);
    expect(isPlateSize(null)).toBe(false);
    expect(isPlateSize(155)).toBe(false);
  });
});

describe('getQualityMeta', () => {
  it("returns the tier's own record for every configured tier", () => {
    for (const tier of QUALITY_TIERS) {
      expect(getQualityMeta(tier.id)).toBe(tier);
    }
  });

  it('names the tier it could not resolve rather than defaulting quietly', () => {
    expect(() => getQualityMeta('wagyu' as never)).toThrow(/wagyu/);
  });
});

describe('getPlateSizeMeta', () => {
  it("returns the size's own record for every configured size", () => {
    for (const size of PLATE_SIZES) {
      expect(getPlateSizeMeta(size.id)).toBe(size);
    }
  });

  it('names the size it could not resolve rather than defaulting quietly', () => {
    expect(() => getPlateSizeMeta('huge' as never)).toThrow(/huge/);
  });
});

describe('the tables the guards read from', () => {
  it('describes every category exactly once, so a picker cannot omit one', () => {
    expect(CATEGORY_META.map((meta) => meta.id)).toEqual([...FOOD_CATEGORIES]);
  });

  it('gives every quality tier and plate size a distinct id', () => {
    expect(new Set(QUALITY_TIERS.map((tier) => tier.id)).size).toBe(QUALITY_TIERS.length);
    expect(new Set(PLATE_SIZES.map((size) => size.id)).size).toBe(PLATE_SIZES.length);
  });
});
