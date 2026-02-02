import { describe, expect, it } from 'vitest';
import { findFood } from '@/data/foods';
import { decodeSharePayload, encodeSharePayload } from '@/lib/shareLink';
import { unpackShareBody } from '@/lib/shareCodec';
import { regularDinerId } from '@/lib/regularDiners';
import type { BillAdjustment, Diner, MealItem, MealSession } from '@/types/meal';

/**
 * What a shared report says about the people who ate the meal.
 *
 * Display names were already replaced with positions. Their ids were not — and
 * a person saved from the diner hub has an id derived from their name, so
 * "Lorenzo" travelled inside the token as `diner-lorenzo`. The old privacy test
 * missed it twice over: it used the roster path that generates a random id, and
 * it compared case-sensitively.
 *
 * The fix is a remap rather than a redaction, so the structure the recipient
 * needs — who shared what, whose charge was whose — survives intact while the
 * identities do not.
 */

const ribeye = findFood('beef-ribeye')!;

/** The ids the diner hub actually produces: a slug of the person's name. */
const lorenzoId = regularDinerId('Lorenzo');
const omarId = regularDinerId('Omar');

const diners: readonly Diner[] = [
  { id: lorenzoId, displayName: 'Lorenzo' },
  { id: omarId, displayName: 'Omar' },
  { id: 'diner-ana', displayName: 'Ana' },
];

const adjustments: readonly BillAdjustment[] = [
  { id: 'adj-1', label: 'Voucher', amount: 10, kind: 'discount', dinerId: lorenzoId },
  { id: 'adj-2', label: 'Card surcharge', amount: 2, kind: 'charge' },
];

const items: readonly MealItem[] = [
  {
    id: 'line-1',
    foodId: ribeye.id,
    quality: 'standard',
    plateSize: 'regular',
    quantity: 4,
    allocations: [{ dinerId: lorenzoId, quantity: 2 }],
    sharedAmong: [omarId, 'diner-ana'],
  },
];

const session: MealSession = {
  restaurantName: 'Seoul Garden',
  pricePerDiner: 50,
  dinerCount: 3,
  diners,
  adjustments,
  items,
};

/** The document that actually travels, read with the app's own codec. */
function tokenBody(token: string): string {
  const separator = token.indexOf('.');
  const body = unpackShareBody(token.slice(separator + 1), {
    maxDecodedBytes: 64 * 1024,
    maxEncodedLength: 8192,
  });
  expect(body).not.toBeNull();
  return body as string;
}

describe('What the diner hub’s own ids look like', () => {
  it('derives them from the person’s name, which is the whole problem', () => {
    // Stated here so the rest of this file is obviously testing something real.
    expect(lorenzoId).toBe('diner-lorenzo');
  });
});

describe('A shared report carries no identity', () => {
  const body = tokenBody(encodeSharePayload(session)!);

  it('contains no display name', () => {
    expect(body).not.toContain('Lorenzo');
    expect(body).not.toContain('Omar');
  });

  it('contains no name-derived id, in any casing', () => {
    // The defect this locks down: `diner-lorenzo` passed a case-sensitive
    // check for "Lorenzo" while carrying the name in full.
    expect(body.toLowerCase()).not.toContain('lorenzo');
    expect(body.toLowerCase()).not.toContain('omar');
    expect(body).not.toContain(lorenzoId);
    expect(body).not.toContain(omarId);
  });

  it('carries positions instead', () => {
    expect(body).toContain('d1');
    expect(body).toContain('Diner 1');
  });
});

describe('A shared report keeps the attribution it needs', () => {
  const decoded = decodeSharePayload(encodeSharePayload(session)!)!;

  it('renames the roster to positions', () => {
    expect(decoded.diners?.map((diner) => diner.id)).toEqual(['d1', 'd2', 'd3']);
    expect(decoded.diners?.map((diner) => diner.displayName)).toEqual([
      'Diner 1',
      'Diner 2',
      'Diner 3',
    ]);
  });

  it('rewrites explicit attribution through the same map', () => {
    expect(decoded.items[0]?.allocations).toEqual([{ dinerId: 'd1', quantity: 2 }]);
  });

  it('rewrites a shared subset through the same map', () => {
    expect(decoded.items[0]?.sharedAmong).toEqual(['d2', 'd3']);
  });

  it('rewrites a personal charge through the same map', () => {
    const personal = decoded.adjustments?.find((entry) => entry.label === 'Voucher');
    expect(personal?.dinerId).toBe('d1');
  });

  it('leaves a table-wide charge belonging to the table', () => {
    const table = decoded.adjustments?.find((entry) => entry.label === 'Card surcharge');
    expect(table?.dinerId).toBeUndefined();
  });

  it('is consistent: every reference points at a diner in the shared roster', () => {
    const roster = new Set(decoded.diners?.map((diner) => diner.id));
    decoded.items.forEach((item) => {
      (item.allocations ?? []).forEach((allocation) => {
        expect(roster.has(allocation.dinerId)).toBe(true);
      });
      (item.sharedAmong ?? []).forEach((id) => {
        expect(roster.has(id)).toBe(true);
      });
    });
    (decoded.adjustments ?? []).forEach((adjustment) => {
      if (adjustment.dinerId !== undefined) {
        expect(roster.has(adjustment.dinerId)).toBe(true);
      }
    });
  });
});

describe('A shared report with no roster', () => {
  it('is exactly the document it always was', () => {
    const plain: MealSession = {
      restaurantName: 'Seoul Garden',
      pricePerDiner: 50,
      dinerCount: 2,
      items: [
        { id: 'line-1', foodId: ribeye.id, quality: 'standard', plateSize: 'regular', quantity: 2 },
      ],
    };
    const decoded = decodeSharePayload(encodeSharePayload(plain)!)!;

    expect(decoded.diners).toBeUndefined();
    expect(decoded.items[0]).not.toHaveProperty('allocations');
    expect(decoded.items[0]).not.toHaveProperty('sharedAmong');
  });
});

describe('Tokens written before the remap', () => {
  it('still decode, with whatever roster they were written with', () => {
    // An older token carries the original ids. It has to keep working; the
    // remap is about what leaves this device from now on.
    const legacy = JSON.stringify({
      restaurantName: 'Seoul Garden',
      pricePerDiner: 50,
      dinerCount: 2,
      customFoods: [],
      diners: [{ id: 'diner-lorenzo', displayName: 'Diner 1' }],
      items: [{ foodId: ribeye.id, quality: 'standard', plateSize: 'regular', quantity: 2 }],
    });
    const token = `2.${Buffer.from(legacy, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')}`;

    const decoded = decodeSharePayload(token);
    expect(decoded?.diners?.[0]?.id).toBe('diner-lorenzo');
    expect(decoded?.items).toHaveLength(1);
  });
});
