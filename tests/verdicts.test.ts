import { describe, expect, it } from 'vitest';
import { getHouseStatus, getVerdict } from '@/lib/verdicts';

const ADMISSION = 100;

function verdictAtRatio(ratio: number) {
  return getVerdict(ratio * ADMISSION, ADMISSION).id;
}

function statusAtRatio(ratio: number) {
  return getHouseStatus(ratio * ADMISSION, ADMISSION).severity;
}

describe('verdict thresholds', () => {
  it('is deterministic for identical totals', () => {
    expect(getVerdict(137, 100)).toBe(getVerdict(137, 100));
    expect(getVerdict(137, 100).id).toBe('value-extraction-specialist');
  });

  it.each([
    [0, 'corporate-sponsor'],
    [0.2, 'corporate-sponsor'],
    [0.5499, 'corporate-sponsor'],
    [0.55, 'house-favourite'],
    [0.7, 'house-favourite'],
    [0.8499, 'house-favourite'],
    [0.85, 'respectable-restraint'],
    [0.9999, 'respectable-restraint'],
    [1.0, 'break-even-bandit'],
    [1.2499, 'break-even-bandit'],
    [1.25, 'value-extraction-specialist'],
    [1.5999, 'value-extraction-specialist'],
    [1.6, 'margin-compression-event'],
    [1.9999, 'margin-compression-event'],
    [2.0, 'do-not-return'],
    [5, 'do-not-return'],
  ])('ratio %s resolves to %s', (ratio, expected) => {
    expect(verdictAtRatio(ratio)).toBe(expected);
  });

  it('falls back safely on invalid input', () => {
    expect(getVerdict(50, 0).id).toBe('corporate-sponsor');
    expect(getVerdict(Number.NaN, 100).id).toBe('corporate-sponsor');
    expect(getVerdict(50, Number.NaN).id).toBe('corporate-sponsor');
    expect(getVerdict(50, -10).id).toBe('corporate-sponsor');
  });

  it('never labels an outcome as restaurant profit', () => {
    for (const verdict of [getVerdict(10, 100), getVerdict(100, 100), getVerdict(300, 100)]) {
      expect(verdict.copy.toLowerCase()).not.toContain('restaurant profit');
    }
  });
});

describe('house status thresholds', () => {
  it.each([
    [0, 'calm'],
    [0.3499, 'calm'],
    [0.35, 'normal'],
    [0.5499, 'normal'],
    [0.55, 'watch'],
    [0.7499, 'watch'],
    [0.75, 'alert'],
    [0.9999, 'alert'],
    [1.0, 'breach'],
    [3, 'breach'],
  ])('cost ratio %s resolves to %s', (ratio, expected) => {
    expect(statusAtRatio(ratio)).toBe(expected);
  });

  it('falls back safely on invalid input', () => {
    expect(getHouseStatus(20, 0).severity).toBe('calm');
    expect(getHouseStatus(Number.NaN, 100).severity).toBe('calm');
  });
});
