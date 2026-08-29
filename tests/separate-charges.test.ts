import { describe, expect, it } from 'vitest';
import { findFood } from '@/data/foods';
import { buildDamageReport, calculateSessionTotals } from '@/lib/calculations';
import { createSavedSession, fingerprintSession, parseSavedSession } from '@/lib/history';
import { decodeSharePayload, encodeSharePayload } from '@/lib/shareLink';
import {
  hasUnpricedCharge,
  isSeparatelyCharged,
  normaliseSeparateCharge,
  separateCharge,
  withSeparateCharge,
} from '@/lib/separateCharges';
import { getVerdict } from '@/lib/verdicts';
import type { MealItem, MealSession } from '@/types/meal';

/**
 * Food the buffet price did not buy.
 *
 * The property under test throughout: an extra never moves the buffet recovery
 * figure — not up through its retail value, and not down through what it cost —
 * while what was actually paid for it is kept and reported in its own terms.
 */

const ribeye = findFood('beef-ribeye')!;

function item(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 'line-1',
    foodId: ribeye.id,
    quality: 'standard',
    plateSize: 'regular',
    quantity: 1,
    ...overrides,
  };
}

const config = { pricePerDiner: 50, dinerCount: 1 };

describe('Reading a separate charge', () => {
  it('keeps a stated amount, to the cent', () => {
    expect(normaliseSeparateCharge(12.005)).toBe(12.01);
    expect(normaliseSeparateCharge(0)).toBe(0);
  });

  it('refuses anything that is not an amount somebody paid', () => {
    expect(normaliseSeparateCharge(-5)).toBeUndefined();
    expect(normaliseSeparateCharge(Number.NaN)).toBeUndefined();
    expect(normaliseSeparateCharge('12')).toBeUndefined();
    expect(normaliseSeparateCharge(undefined)).toBeUndefined();
  });

  it('tells an unpriced extra apart from a free one', () => {
    // Zero is a real answer — a comped drink — and different from "not said".
    expect(hasUnpricedCharge(item({ separatelyCharged: true }))).toBe(true);
    expect(hasUnpricedCharge(item({ separatelyCharged: true, separateCharge: 0 }))).toBe(false);
    expect(separateCharge(item({ separatelyCharged: true, separateCharge: 0 }))).toBe(0);
  });

  it('ignores a charge on a line nobody marked as an extra', () => {
    expect(separateCharge(item({ separateCharge: 12 }))).toBe(0);
    expect(isSeparatelyCharged(item({ separateCharge: 12 }))).toBe(false);
  });
});

describe('Marking a line', () => {
  it('stores nothing at all for a line included in admission', () => {
    const included = withSeparateCharge(
      item({ separatelyCharged: true, separateCharge: 9 }),
      false,
    );
    expect(included).not.toHaveProperty('separatelyCharged');
    expect(included).not.toHaveProperty('separateCharge');
  });

  it('keeps the extra without a price when none was given', () => {
    const extra = withSeparateCharge(item(), true);
    expect(extra).toMatchObject({ separatelyCharged: true });
    expect(extra).not.toHaveProperty('separateCharge');
  });

  it('replaces a price rather than accumulating one', () => {
    const first = withSeparateCharge(item(), true, 9);
    const second = withSeparateCharge(first, true, 12);
    expect(second).toMatchObject({ separatelyCharged: true, separateCharge: 12 });
  });

  it('drops a malformed price instead of storing it', () => {
    expect(withSeparateCharge(item(), true, -4)).not.toHaveProperty('separateCharge');
  });
});

describe('A meal with nothing charged separately', () => {
  it('is calculated exactly as it always was', () => {
    const report = buildDamageReport([item({ quantity: 4 })], config);

    expect(report.hasSeparatelyChargedItems).toBe(false);
    expect(report.separateSpend).toBe(0);
    expect(report.separateRetailValue).toBe(0);
    expect(report.separatePlates).toBe(0);
    expect(report.includedPlates).toBe(report.totalPlates);
    expect(report.totalSpend).toBe(report.totalAdmission);
  });
});

describe('An extra on the tab', () => {
  const items = [
    item({ id: 'buffet', quantity: 4 }),
    item({ id: 'beer', quantity: 1, separatelyCharged: true, separateCharge: 12 }),
  ];

  it('does not lift the buffet retail numerator', () => {
    const withExtra = buildDamageReport(items, config);
    const buffetOnly = buildDamageReport([item({ id: 'buffet', quantity: 4 })], config);

    expect(withExtra.totalRetailValue).toBeCloseTo(buffetOnly.totalRetailValue, 10);
    expect(withExtra.retailRecoveryPercent).toBeCloseTo(buffetOnly.retailRecoveryPercent, 10);
    expect(withExtra.hasBeatenBuffet).toBe(buffetOnly.hasBeatenBuffet);
  });

  it('does not worsen the buffet denominator either', () => {
    const withExtra = buildDamageReport(items, config);
    const buffetOnly = buildDamageReport([item({ id: 'buffet', quantity: 4 })], config);

    expect(withExtra.totalAdmission).toBe(buffetOnly.totalAdmission);
  });

  it('keeps its own value and its own cost, stated apart', () => {
    const report = buildDamageReport(items, config);

    expect(report.separatePlates).toBe(1);
    expect(report.separateRetailValue).toBeGreaterThan(0);
    expect(report.separateSpend).toBe(12);
  });

  it('reconciles into a total spend that is the whole evening', () => {
    const report = buildDamageReport(items, config);

    expect(report.totalSpend).toBe(report.totalAdmission + report.separateSpend);
    expect(report.totalSpend).toBe(62);
  });

  it('still counts towards what was eaten, because it was', () => {
    const report = buildDamageReport(items, config);

    // Weight, nutrition and plates describe the meal; only value is split by
    // who paid for it.
    expect(report.totalPlates).toBe(5);
    expect(report.includedPlates).toBe(4);
    expect(report.nutrition.calories).toBeGreaterThan(0);
  });

  it('never infers what it cost from what it is worth', () => {
    const unpriced = buildDamageReport(
      [item({ id: 'beer', quantity: 1, separatelyCharged: true })],
      config,
    );

    expect(unpriced.separateSpend).toBe(0);
    expect(unpriced.unpricedSeparateLines).toBe(1);
    // The retail value exists and is deliberately not used as the price paid.
    expect(unpriced.separateRetailValue).toBeGreaterThan(0);
    expect(unpriced.totalSpend).toBe(unpriced.totalAdmission);
  });

  it('averages buffet value over buffet plates only', () => {
    const report = buildDamageReport(items, config);
    const totals = calculateSessionTotals(items);

    expect(report.averageRetailValuePerPlate).toBeCloseTo(
      totals.totalRetailValue / totals.includedPlates,
      10,
    );
  });
});

describe('A tab of nothing but extras', () => {
  it('does not claim the buffet was beaten by food it never sold', () => {
    const report = buildDamageReport(
      [item({ quantity: 4, separatelyCharged: true, separateCharge: 40 })],
      config,
    );

    expect(report.totalRetailValue).toBe(0);
    expect(report.retailRecoveryPercent).toBe(0);
    expect(report.hasBeatenBuffet).toBe(false);
    expect(report.averageRetailValuePerPlate).toBe(0);
    expect(report.totalSpend).toBe(90);
  });
});

describe('Filing and sharing the distinction', () => {
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 50,
    dinerCount: 1,
    items: [
      item({ id: 'buffet', quantity: 2 }),
      item({ id: 'beer', quantity: 1, separatelyCharged: true, separateCharge: 12 }),
    ],
  };

  it('round-trips through a filed record', () => {
    const report = buildDamageReport(session.items, session);
    const saved = createSavedSession(session, report, getVerdict(report.totalRetailValue, 50), {
      id: 'rec-1',
      createdAt: new Date().toISOString(),
    });
    const parsed = parseSavedSession(JSON.parse(JSON.stringify(saved)));

    const extra = parsed?.items.find((entry) => entry.separatelyCharged);
    expect(extra).toMatchObject({ separatelyCharged: true, separateCharge: 12 });
    // And the included line carries no trace of the concept at all.
    const buffet = parsed?.items.find((entry) => !entry.separatelyCharged);
    expect(buffet).not.toHaveProperty('separateCharge');
  });

  it('round-trips through a share link', () => {
    const token = encodeSharePayload(session)!;
    const decoded = decodeSharePayload(token);

    const extra = decoded?.items.find((entry) => entry.separatelyCharged);
    expect(extra).toMatchObject({ separatelyCharged: true, separateCharge: 12 });
  });

  it('files a tab whose drinks were paid for as a different record', () => {
    const paid = fingerprintSession(session);
    const included = fingerprintSession({
      ...session,
      items: session.items.map((entry) => withSeparateCharge(entry, false)),
    });
    expect(paid).not.toBe(included);
  });
});

describe('Hostile input', () => {
  it('emits no NaN, Infinity or negative figure', () => {
    const report = buildDamageReport(
      [
        item({ quantity: 2, separatelyCharged: true, separateCharge: Number.NaN }),
        item({ id: 'two', quantity: 1, separatelyCharged: true, separateCharge: -99 }),
      ],
      config,
    );

    [report.separateSpend, report.totalSpend, report.separateRetailValue].forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    });
    expect(report.unpricedSeparateLines).toBe(2);
  });
});
