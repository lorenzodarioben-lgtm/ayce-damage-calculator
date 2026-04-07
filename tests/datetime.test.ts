import { describe, expect, it } from 'vitest';
import { isIsoTimestamp } from '@/lib/datetime';

describe('isIsoTimestamp', () => {
  it('accepts the canonical timestamp Date writes', () => {
    expect(isIsoTimestamp('2026-08-16T12:00:00.000Z')).toBe(true);
  });

  it('rejects parseable but non-canonical dates', () => {
    expect(isIsoTimestamp('2026-08-16')).toBe(false);
    expect(isIsoTimestamp('2026-08-16T12:00:00Z')).toBe(false);
    expect(isIsoTimestamp('2026-08-16T22:00:00.000+10:00')).toBe(false);
  });

  it('rejects impossible values without throwing', () => {
    expect(isIsoTimestamp('2026-02-30T12:00:00.000Z')).toBe(false);
    expect(isIsoTimestamp('whenever')).toBe(false);
    expect(isIsoTimestamp(42)).toBe(false);
  });
});

it('accepts leap day in a leap year', () => {
  expect(isIsoTimestamp('2024-02-29T23:59:59.999Z')).toBe(true);
});

it('rejects leap day in a non-leap year', () => {
  expect(isIsoTimestamp('2025-02-29T12:00:00.000Z')).toBe(false);
});

it('rejects impossible month and hour fields', () => {
  expect(isIsoTimestamp('2026-13-01T12:00:00.000Z')).toBe(false);
  expect(isIsoTimestamp('2026-09-27T25:00:00.000Z')).toBe(false);
});

it('rejects surrounding whitespace on a timestamp', () => {
  expect(isIsoTimestamp(' 2026-09-27T12:00:00.000Z')).toBe(false);
  expect(isIsoTimestamp('2026-09-27T12:00:00.000Z ')).toBe(false);
});
