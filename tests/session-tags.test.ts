import { describe, expect, it } from 'vitest';
import {
  MAX_SESSION_TAGS,
  MAX_SESSION_TAG_LENGTH,
  normaliseSessionTag,
  parseSessionTags,
} from '@/lib/sessionTags';

/*
 * Tags are typed on one screen and searched on another, so the two only agree
 * if both go through the same normalisation. Case and spacing are the whole
 * risk: "Late Night" and "late  night" are one label to a diner, and would be
 * two to a filter that took them at face value.
 */

describe('normaliseSessionTag', () => {
  it('rejects anything that is not a string', () => {
    expect(normaliseSessionTag(undefined)).toBeNull();
    expect(normaliseSessionTag(null)).toBeNull();
    expect(normaliseSessionTag(7)).toBeNull();
    expect(normaliseSessionTag(['lunch'])).toBeNull();
  });

  it('trims the space around a tag', () => {
    expect(normaliseSessionTag('  lunch  ')).toBe('lunch');
    expect(normaliseSessionTag('\tlunch\n')).toBe('lunch');
  });

  it('collapses repeated whitespace to a single space', () => {
    expect(normaliseSessionTag('late    night')).toBe('late night');
    expect(normaliseSessionTag('birthday\t\tdinner')).toBe('birthday dinner');
  });

  it('lowercases, so one label cannot become two', () => {
    expect(normaliseSessionTag('Late Night')).toBe('late night');
    expect(normaliseSessionTag('BIRTHDAY')).toBe('birthday');
  });

  it('treats an empty or whitespace-only tag as no tag at all', () => {
    expect(normaliseSessionTag('')).toBeNull();
    expect(normaliseSessionTag('   ')).toBeNull();
    expect(normaliseSessionTag('\t\n')).toBeNull();
  });

  it('accepts a tag of exactly the maximum length', () => {
    const longest = 'a'.repeat(MAX_SESSION_TAG_LENGTH);

    expect(normaliseSessionTag(longest)).toBe(longest);
  });

  it('rejects a tag longer than the maximum rather than truncating it', () => {
    expect(normaliseSessionTag('a'.repeat(MAX_SESSION_TAG_LENGTH + 1))).toBeNull();
  });

  it('measures the length after normalising, not before', () => {
    // The padding is not part of the label, so it must not count against it.
    const padded = `  ${'a'.repeat(MAX_SESSION_TAG_LENGTH)}  `;

    expect(normaliseSessionTag(padded)).toBe('a'.repeat(MAX_SESSION_TAG_LENGTH));
  });
});

describe('parseSessionTags', () => {
  it('reports nothing for a value that is not an array', () => {
    expect(parseSessionTags(undefined)).toEqual([]);
    expect(parseSessionTags(null)).toEqual([]);
    expect(parseSessionTags('lunch')).toEqual([]);
    expect(parseSessionTags({ 0: 'lunch' })).toEqual([]);
  });

  it('normalises every entry it keeps', () => {
    expect(parseSessionTags(['  Late  Night ', 'BIRTHDAY'])).toEqual(['late night', 'birthday']);
  });

  it('drops duplicates that only differ before normalising', () => {
    expect(parseSessionTags(['Lunch', 'lunch', '  LUNCH  '])).toEqual(['lunch']);
  });

  it('drops malformed entries without losing the good ones around them', () => {
    expect(parseSessionTags(['lunch', 42, null, '   ', { name: 'x' }, 'friends'])).toEqual([
      'lunch',
      'friends',
    ]);
  });

  it('drops an over-long entry but keeps the rest', () => {
    expect(parseSessionTags(['lunch', 'a'.repeat(MAX_SESSION_TAG_LENGTH + 1), 'friends'])).toEqual([
      'lunch',
      'friends',
    ]);
  });

  it('preserves the order the tags were given in', () => {
    expect(parseSessionTags(['zebra', 'apple', 'mango'])).toEqual(['zebra', 'apple', 'mango']);
  });

  it('caps the collection at the number a card can carry', () => {
    const many = Array.from({ length: MAX_SESSION_TAGS + 4 }, (_, index) => `tag-${index}`);

    expect(parseSessionTags(many)).toHaveLength(MAX_SESSION_TAGS);
    expect(parseSessionTags(many)).toEqual(many.slice(0, MAX_SESSION_TAGS));
  });

  it('counts only what it kept towards the cap', () => {
    // The malformed entries in front must not use up the allowance.
    const value = [null, 42, ...Array.from({ length: MAX_SESSION_TAGS }, (_, i) => `tag-${i}`)];

    expect(parseSessionTags(value)).toHaveLength(MAX_SESSION_TAGS);
  });

  it('does not mutate the array it was given', () => {
    const value = ['Lunch', 'lunch', 'friends'];

    parseSessionTags(value);

    expect(value).toEqual(['Lunch', 'lunch', 'friends']);
  });
});
