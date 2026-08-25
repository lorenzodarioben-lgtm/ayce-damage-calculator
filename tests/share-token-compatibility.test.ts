import { describe, expect, it } from 'vitest';
import { decodeChallengePayload, encodeChallengePayload } from '@/lib/challengeShare';
import { decodeMenuPayload, encodeMenuPayload } from '@/lib/menuShare';
import { decodeSharePayload, encodeSharePayload } from '@/lib/shareLink';

/**
 * Links that were already handed out.
 *
 * These strings are frozen on purpose. A share token has no server behind it,
 * so there is nothing that could ever reissue or migrate one: an address a
 * diner posted, bookmarked or sent to a friend has to keep decoding into the
 * same meal for as long as the app exists. Regenerating a fixture here would
 * defeat the only thing it is for — if one of these ever fails, a real link
 * somewhere has stopped working.
 */

const REPORT_V1 = '1.4me.2.bc-1-1-3_pa-2-2-2.U2VvdWwgR2FyZGVu';

const REPORT_V2 =
  '2.eyJyZXN0YXVyYW50TmFtZSI6IlNlb3VsIEdhcmRlbiIsInByaWNlUGVyRGluZXIiOjU5LjksImRpbmVyQ291bnQiOjIsInByaWNpbmdQcm9maWxlIjp7ImlkIjoiYXVzdHJhbGlhbi1rYmJxIiwibmFtZSI6IkF1c3RyYWxpYW4gS0JCUSBlc3RpbWF0ZXMiLCJtb25leSI6eyJjdXJyZW5jeSI6IkFVRCIsImxvY2FsZSI6ImVuLUFVIn0sIm92ZXJyaWRlcyI6e30sImJ1aWx0SW4iOnRydWV9LCJjdXN0b21Gb29kcyI6W10sIml0ZW1zIjpbeyJmb29kSWQiOiJiZWVmLXJpYmV5ZSIsInF1YWxpdHkiOiJzdGFuZGFyZCIsInBsYXRlU2l6ZSI6InJlZ3VsYXIiLCJxdWFudGl0eSI6M30seyJmb29kSWQiOiJwb3JrLWJlbGx5IiwicXVhbGl0eSI6InByZW1pdW0iLCJwbGF0ZVNpemUiOiJsYXJnZSIsInF1YW50aXR5IjoyfV19';

const MENU_V1 =
  '1.eyJwcmljaW5nUHJvZmlsZSI6eyJpZCI6ImN1c3RvbS1kb3dudG93bi1sdW5jaCIsIm5hbWUiOiJEb3dudG93biBsdW5jaCIsIm1vbmV5Ijp7ImN1cnJlbmN5IjoiVVNEIiwibG9jYWxlIjoiZW4tVVMifSwib3ZlcnJpZGVzIjp7ImJlZWYtcmliZXllIjp7InJldGFpbFByaWNlUGVyS2ciOjYxLCJyZXN0YXVyYW50Q29zdFBlcktnIjoyOX19fSwiY3VzdG9tRm9vZHMiOltdLCJyZXN0YXVyYW50Ijp7Im5hbWUiOiJGcmlkYXkgS0JCUSIsInByaWNlUGVyRGluZXIiOjQyLCJkaW5lckNvdW50IjoyfX0';

const CHALLENGE_V1 =
  '1.eyJhIjp7ImwiOiJTZW91bCBHYXJkZW4iLCJ0IjoiMjAyNi0wOC0xNlQxMjowMDowMC4wMDBaIiwicCI6NTkuOSwiZCI6MiwibSI6eyJpIjoiYXVzdHJhbGlhbi1rYmJxIiwibiI6IkF1c3RyYWxpYW4gS0JCUSBlc3RpbWF0ZXMiLCJjIjp7ImN1cnJlbmN5IjoiQVVEIiwibG9jYWxlIjoiZW4tQVUifSwibyI6e319LCJmIjpbXSwieCI6W3siZiI6ImJlZWYtcmliZXllIiwicSI6InN0YW5kYXJkIiwicyI6InJlZ3VsYXIiLCJuIjoyfV19LCJiIjp7ImwiOiJGcmlkYXkgS0JCUSIsInQiOiIyMDI2LTA4LTE2VDEyOjAwOjAwLjAwMFoiLCJwIjo1OS45LCJkIjoyLCJtIjp7ImkiOiJhdXN0cmFsaWFuLWtiYnEiLCJuIjoiQXVzdHJhbGlhbiBLQkJRIGVzdGltYXRlcyIsImMiOnsiY3VycmVuY3kiOiJBVUQiLCJsb2NhbGUiOiJlbi1BVSJ9LCJvIjp7fX0sImYiOltdLCJ4IjpbeyJmIjoiYmVlZi1yaWJleWUiLCJxIjoic3RhbmRhcmQiLCJzIjoicmVndWxhciIsIm4iOjV9XX19';

describe('Report links handed out before compression existed', () => {
  it('still decodes a version 1 token', () => {
    const payload = decodeSharePayload(REPORT_V1);

    expect(payload?.restaurantName).toBe('Seoul Garden');
    expect(payload?.pricePerDiner).toBeCloseTo(59.9, 5);
    expect(payload?.dinerCount).toBe(2);
    expect(
      payload?.items.map((item) => [item.foodId, item.quality, item.plateSize, item.quantity]),
    ).toEqual([
      ['beef-ribeye', 'standard', 'regular', 3],
      ['pork-belly', 'premium', 'large', 2],
    ]);
  });

  it('still decodes a version 2 token', () => {
    const payload = decodeSharePayload(REPORT_V2);

    expect(payload?.restaurantName).toBe('Seoul Garden');
    expect(payload?.pricePerDiner).toBeCloseTo(59.9, 5);
    expect(payload?.dinerCount).toBe(2);
    expect(payload?.pricingProfile.money.currency).toBe('AUD');
    expect(
      payload?.items.map((item) => [item.foodId, item.quality, item.plateSize, item.quantity]),
    ).toEqual([
      ['beef-ribeye', 'standard', 'regular', 3],
      ['pork-belly', 'premium', 'large', 2],
    ]);
  });

  it('decodes every version to the same meal', () => {
    const older = decodeSharePayload(REPORT_V1);
    const newer = decodeSharePayload(REPORT_V2);

    expect(older?.items.map((item) => item.foodId)).toEqual(
      newer?.items.map((item) => item.foodId),
    );
    expect(older?.pricePerDiner).toBeCloseTo(newer?.pricePerDiner ?? 0, 5);
  });

  it('re-encodes a decoded legacy meal as a current token that means the same thing', () => {
    const original = decodeSharePayload(REPORT_V2);
    const reissued = encodeSharePayload(
      {
        restaurantName: original!.restaurantName,
        pricePerDiner: original!.pricePerDiner,
        dinerCount: original!.dinerCount,
        items: original!.items,
      },
      { pricingProfile: original!.pricingProfile, customFoods: original!.customFoods },
    );

    expect(reissued?.startsWith('3.')).toBe(true);
    const round = decodeSharePayload(reissued);
    expect(round?.restaurantName).toBe(original?.restaurantName);
    expect(round?.items.map((item) => [item.foodId, item.quantity])).toEqual(
      original?.items.map((item) => [item.foodId, item.quantity]),
    );
  });
});

describe('Menu links handed out before compression existed', () => {
  it('still decodes a version 1 token', () => {
    const payload = decodeMenuPayload(MENU_V1);

    expect(payload?.pricingProfile.name).toBe('Downtown lunch');
    expect(payload?.pricingProfile.money.currency).toBe('USD');
    expect(payload?.pricingProfile.overrides['beef-ribeye']?.retailPricePerKg).toBe(61);
    expect(payload?.restaurant).toEqual({ name: 'Friday KBBQ', pricePerDiner: 42, dinerCount: 2 });
  });

  it('re-encodes it as a current token carrying the same menu', () => {
    const original = decodeMenuPayload(MENU_V1)!;
    const reissued = encodeMenuPayload(original);

    expect(reissued?.startsWith('2.')).toBe(true);
    expect(decodeMenuPayload(reissued)).toEqual(original);
  });
});

describe('Challenge links handed out before compression existed', () => {
  it('still decodes a version 1 token', () => {
    const payload = decodeChallengePayload(CHALLENGE_V1);

    expect(payload?.previous.label).toBe('Seoul Garden');
    expect(payload?.current.label).toBe('Friday KBBQ');
    expect(payload?.previous.items[0]?.quantity).toBe(2);
    expect(payload?.current.items[0]?.quantity).toBe(5);
  });

  it('re-encodes it as a current token carrying the same two meals', () => {
    const original = decodeChallengePayload(CHALLENGE_V1)!;
    const reissued = encodeChallengePayload(original);

    expect(reissued?.startsWith('2.')).toBe(true);
    expect(decodeChallengePayload(reissued)).toEqual(original);
  });
});

describe('Tokens from versions this build does not know', () => {
  it.each([
    ['a later version', '9.AAAA'],
    ['a version that is not a number', 'x.AAAA'],
    ['a token with no version at all', 'AAAA'],
    ['an empty version', '.AAAA'],
  ])('refuses %s', (_label, token) => {
    expect(decodeSharePayload(token)).toBeNull();
    expect(decodeMenuPayload(token)).toBeNull();
    expect(decodeChallengePayload(token)).toBeNull();
  });

  it('does not fall back to another reader when one declines', () => {
    // A version 3 body under a version 2 prefix is not a version 2 token, and
    // guessing would let a corrupt address produce a meal nobody shared.
    const current = encodeSharePayload({
      restaurantName: 'Seoul Garden',
      pricePerDiner: 59.9,
      dinerCount: 2,
      items: [
        { id: 'a', foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular', quantity: 2 },
      ],
    })!;
    expect(decodeSharePayload(`2.${current.slice(2)}`)).toBeNull();
  });
});
