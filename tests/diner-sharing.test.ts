import { describe, expect, it } from 'vitest';
import { findFood } from '@/data/foods';
import { buildDamageReport, calculateTableSplit } from '@/lib/calculations';
import {
  ALLOCATION_STEP,
  allocationSum,
  normaliseAllocations,
  normaliseSharedAmong,
  reconcileItemAllocations,
  sharedAmongIds,
  formatSharePlates,
  sharedQuantity,
  sharedShareFor,
} from '@/lib/diners';
import { createSavedSession, parseSavedSession } from '@/lib/history';
import { decodeSharePayload, encodeSharePayload } from '@/lib/shareLink';
import { sessionReducer } from '@/lib/sessionReducer';
import { getVerdict } from '@/lib/verdicts';
import type { Diner, MealItem, MealSession } from '@/types/meal';

/**
 * Dividing a plate between the people who actually shared it.
 *
 * The invariant every case here checks: what the seats carry adds back up to
 * what was attributable, and nobody outside a named subset is credited with any
 * of it. One plate between three is a third each — a number that cannot be
 * written down — so the division is kept as a division and performed on use.
 */

const ribeye = findFood('beef-ribeye')!;

const three: readonly Diner[] = [
  { id: 'ana', displayName: 'Ana' },
  { id: 'ben', displayName: 'Ben' },
  { id: 'cal', displayName: 'Cal' },
];
const five: readonly Diner[] = [
  ...three,
  { id: 'dee', displayName: 'Dee' },
  { id: 'eli', displayName: 'Eli' },
];

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

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

describe('One plate shared equally by three', () => {
  const line = item({ quantity: 1, sharedAmong: ['ana', 'ben', 'cal'] });

  it('is representable at all', () => {
    expect(sharedAmongIds(line, three)).toEqual(['ana', 'ben', 'cal']);
  });

  it('gives each of them a third, without rounding it into a stored figure', () => {
    three.forEach((diner) => {
      expect(sharedShareFor(line, diner.id, three, 3)).toBeCloseTo(1 / 3, 12);
    });
  });

  it('creates and loses no plate: the thirds add back up to the plate', () => {
    const shares = three.map((diner) => sharedShareFor(line, diner.id, three, 3));
    expect(sum(shares)).toBeCloseTo(1, 12);
  });

  it('holds for every awkward division, not just thirds', () => {
    for (let people = 1; people <= 5; people += 1) {
      for (const quantity of [1, 2, 5, 7, 11]) {
        const roster = five.slice(0, people);
        const shared = item({ quantity, sharedAmong: roster.map((diner) => diner.id) });
        const shares = roster.map((diner) => sharedShareFor(shared, diner.id, five, 5));
        expect(sum(shares)).toBeCloseTo(quantity, 10);
      }
    }
  });
});

describe('A plate shared by only some of the table', () => {
  const line = item({ quantity: 1, sharedAmong: ['ana', 'ben'] });

  it('credits nobody outside the subset', () => {
    expect(sharedShareFor(line, 'ana', five, 5)).toBeCloseTo(0.5, 12);
    expect(sharedShareFor(line, 'ben', five, 5)).toBeCloseTo(0.5, 12);
    ['cal', 'dee', 'eli'].forEach((id) => {
      expect(sharedShareFor(line, id, five, 5)).toBe(0);
    });
  });

  it('still adds up to the whole plate', () => {
    const shares = five.map((diner) => sharedShareFor(line, diner.id, five, 5));
    expect(sum(shares)).toBeCloseTo(1, 12);
  });

  it('gives the seats nobody named none of it either', () => {
    // A subset is a statement about who shared it, and unnamed seats were not
    // named in it.
    const split = calculateTableSplit([line], {
      pricePerDiner: 50,
      dinerCount: 7,
      diners: five,
    });
    expect(split.unnamed?.sharedPlates ?? 0).toBe(0);
    expect(sum(split.diners.map((entry) => entry.sharedPlates))).toBeCloseTo(1, 12);
  });

  it('is what the whole table gets back when nobody names a subset', () => {
    const shared = item({ quantity: 1 });
    five.forEach((diner) => {
      expect(sharedShareFor(shared, diner.id, five, 5)).toBeCloseTo(0.2, 12);
    });
  });
});

describe('Explicit fractional attribution', () => {
  it('records half a plate as half a plate rather than none of it', () => {
    const line = item({ quantity: 2, allocations: [{ dinerId: 'ana', quantity: 0.5 }] });
    expect(allocationSum(line.allocations)).toBeCloseTo(0.5, 12);
    expect(sharedQuantity(line)).toBeCloseTo(1.5, 12);
  });

  it('keeps attribution to a hundredth of a plate', () => {
    const kept = normaliseAllocations([{ dinerId: 'ana', quantity: 0.333 }], 1, three);
    expect(kept[0]?.quantity).toBeCloseTo(0.33, 12);
    expect(ALLOCATION_STEP).toBe(0.01);
  });

  it('never lets the attributions exceed the line', () => {
    const kept = normaliseAllocations(
      [
        { dinerId: 'ana', quantity: 1.5 },
        { dinerId: 'ben', quantity: 1.5 },
      ],
      2,
      three,
    );
    expect(allocationSum(kept)).toBeCloseTo(2, 10);
    expect(sharedQuantity({ quantity: 2, allocations: kept })).toBeCloseTo(0, 10);
  });

  it('sums explicit and shared attribution back to the line quantity', () => {
    const line = item({
      quantity: 3,
      allocations: [{ dinerId: 'ana', quantity: 1.5 }],
      sharedAmong: ['ben', 'cal'],
    });
    const carried = three.map(
      (diner) =>
        (line.allocations?.find((entry) => entry.dinerId === diner.id)?.quantity ?? 0) +
        sharedShareFor(line, diner.id, three, 3),
    );
    expect(sum(carried)).toBeCloseTo(3, 10);
  });
});

describe('Malformed and legacy attribution', () => {
  it('reads a line with no subset as the whole table sharing it', () => {
    expect(sharedAmongIds(item(), three)).toBeNull();
  });

  it('ignores a subset naming people who are not at this table', () => {
    expect(sharedAmongIds(item({ sharedAmong: ['nobody'] }), three)).toBeNull();
    expect(normaliseSharedAmong(['nobody', 'ana'], three)).toEqual(['ana']);
  });

  it('treats naming everybody as naming nobody', () => {
    // The two are the same statement, and the shorter shape is the one every
    // reader already understands.
    expect(normaliseSharedAmong(['ana', 'ben', 'cal'], three)).toEqual([]);
  });

  it('keeps a subset in roster order however it was tapped in', () => {
    expect(normaliseSharedAmong(['cal', 'ana'], five)).toEqual(['ana', 'cal']);
  });

  it('drops duplicates rather than double-counting a sharer', () => {
    expect(sharedAmongIds(item({ sharedAmong: ['ana', 'ana'] }), three)).toEqual(['ana']);
    expect(sharedShareFor(item({ sharedAmong: ['ana', 'ana'] }), 'ana', three, 3)).toBeCloseTo(
      1,
      12,
    );
  });

  it('survives hostile numbers without emitting NaN or a negative share', () => {
    const line = item({
      quantity: Number.NaN,
      allocations: [{ dinerId: 'ana', quantity: Number.NEGATIVE_INFINITY }],
      sharedAmong: ['ana'],
    });
    const share = sharedShareFor(line, 'ana', three, 3);
    expect(Number.isFinite(share)).toBe(true);
    expect(share).toBeGreaterThanOrEqual(0);
    expect(sharedQuantity(line)).toBe(0);
  });

  it('drops a subset once the line is entirely spoken for', () => {
    const reconciled = reconcileItemAllocations(
      item({ quantity: 1, allocations: [{ dinerId: 'ana', quantity: 1 }], sharedAmong: ['ben'] }),
      three,
    );
    expect(reconciled).not.toHaveProperty('sharedAmong');
  });

  it('drops a subset whose people have all left the roster', () => {
    const reconciled = reconcileItemAllocations(item({ sharedAmong: ['dee'] }), three);
    expect(reconciled).not.toHaveProperty('sharedAmong');
  });
});

describe('Through the reducer, on the existing allocation path', () => {
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 50,
    dinerCount: 3,
    diners: three,
    items: [item({ quantity: 1 })],
  };

  it('records a subset without any new action of its own', () => {
    const next = sessionReducer(session, {
      type: 'set-item-allocations',
      id: 'line-1',
      allocations: [],
      sharedAmong: ['ana', 'ben'],
    });
    expect(next.items[0]?.sharedAmong).toEqual(['ana', 'ben']);
  });

  it('puts the line back to the table when the subset is emptied', () => {
    const shared = sessionReducer(session, {
      type: 'set-item-allocations',
      id: 'line-1',
      allocations: [],
      sharedAmong: ['ana'],
    });
    const back = sessionReducer(shared, {
      type: 'set-item-allocations',
      id: 'line-1',
      allocations: [],
      sharedAmong: [],
    });
    expect(back.items[0]).not.toHaveProperty('sharedAmong');
  });

  it('leaves a line alone when no subset is mentioned at all', () => {
    const shared = sessionReducer(session, {
      type: 'set-item-allocations',
      id: 'line-1',
      allocations: [],
      sharedAmong: ['ana'],
    });
    const untouched = sessionReducer(shared, {
      type: 'set-item-allocations',
      id: 'line-1',
      allocations: [],
    });
    expect(untouched.items[0]?.sharedAmong).toEqual(['ana']);
  });
});

describe('Filing and sharing a subset', () => {
  const session: MealSession = {
    restaurantName: 'Seoul Garden',
    pricePerDiner: 50,
    dinerCount: 3,
    diners: three,
    items: [item({ quantity: 1, sharedAmong: ['ana', 'ben'] })],
  };

  it('round-trips through a filed record', () => {
    const report = buildDamageReport(session.items, session);
    const saved = createSavedSession(session, report, getVerdict(report.totalRetailValue, 50), {
      id: 'rec-1',
      createdAt: new Date().toISOString(),
    });
    const parsed = parseSavedSession(JSON.parse(JSON.stringify(saved)));

    expect(parsed?.items[0]?.sharedAmong).toEqual(['ana', 'ben']);
  });

  it('round-trips through a share link', () => {
    const decoded = decodeSharePayload(encodeSharePayload(session)!);
    expect(decoded?.items[0]?.sharedAmong).toEqual(['ana', 'ben']);
  });

  it('renders a third as a third rather than on the quarter grid', () => {
    // The bug this guards: a share displayed with the consumption formatter
    // rounds one third of a plate to a quarter, which is a different number
    // from the one the report is using.
    expect(formatSharePlates(1 / 3)).toBe('0.33');
    expect(formatSharePlates(0.5)).toBe('0.5');
    expect(formatSharePlates(2)).toBe('2');
  });
});

describe('On a real report', () => {
  it('moves value to the people who actually ate it', () => {
    const config = { pricePerDiner: 50, dinerCount: 5, diners: five };
    const evenly = calculateTableSplit([item({ quantity: 1 })], config);
    const shared = calculateTableSplit(
      [item({ quantity: 1, sharedAmong: ['ana', 'ben'] })],
      config,
    );

    expect(shared.diners[0]!.retailValue).toBeGreaterThan(evenly.diners[0]!.retailValue);
    expect(shared.diners[2]!.retailValue).toBe(0);
    // The table's own total is untouched by who is said to have eaten it.
    const report = buildDamageReport([item({ quantity: 1 })], config);
    expect(sum(shared.diners.map((entry) => entry.retailValue))).toBeCloseTo(
      report.totalRetailValue,
      10,
    );
  });
});
