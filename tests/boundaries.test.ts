import { describe, expect, it } from 'vitest';
import { buildDamageReport } from '@/lib/calculations';
import { parseStoredSession } from '@/lib/storage';
import { parseStoredPricingProfiles } from '@/lib/pricingProfiles';
import { parseStoredRestaurants } from '@/lib/restaurants';
import { calculatePlanProgress } from '@/lib/planner';
import { decodeSharePayload } from '@/lib/shareLink';

describe('deterministic persistence boundaries', () => {
  it.each([null, '', '{', '[]', '{"version":999}'])(
    'never accepts malformed session storage: %p',
    (raw) => {
      expect(() => parseStoredSession(raw)).not.toThrow();
    },
  );

  it('rejects unsupported local schema envelopes deterministically', () => {
    expect(parseStoredPricingProfiles('{"version":999,"profiles":[]}')).toEqual([]);
    expect(parseStoredRestaurants('{"version":999,"restaurants":[]}')).toEqual([]);
  });

  it('keeps planner progress read-only and bounded by the plan', () => {
    const eaten = [
      {
        id: 'beef-ribeye__standard__regular',
        foodId: 'beef-ribeye',
        quality: 'standard' as const,
        plateSize: 'regular' as const,
        quantity: 99,
      },
    ];
    expect(
      calculatePlanProgress(
        [{ foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular', quantity: 2 }],
        eaten,
      ),
    ).toEqual({ plannedPlates: 2, matchedPlates: 2, remainingPlates: 0 });
  });

  it('does not trust crafted share values to create non-finite totals', () => {
    const decoded = decodeSharePayload('1.zzzzzz.zzz.bc-0-1-zzzz.')!;
    const report = buildDamageReport(decoded.items, decoded);
    expect(
      [report.totalRetailValue, report.totalAdmission, report.retailRecoveryPercent].every(
        Number.isFinite,
      ),
    ).toBe(true);
  });
});
