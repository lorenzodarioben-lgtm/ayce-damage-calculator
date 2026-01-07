import { expect, test } from '@playwright/test';
import { addPlate, calculateDamage, horizontalOverflow, openCalculator } from './helpers';

/**
 * The builder is dense and the report carries a fixed-width share card, so both
 * stages are checked. One pixel of slack absorbs sub-pixel rounding; anything
 * beyond that is a real sideways scroll on a phone.
 */
const OVERFLOW_TOLERANCE_PX = 1;

test.describe('Layout', () => {
  test('the builder does not scroll sideways', async ({ page }) => {
    await openCalculator(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);

    await addPlate(page, 'Wagyu Short Rib', { quality: 'Premium', plateSize: 'Large' });
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
  });

  test('the report does not scroll sideways', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
  });

  test('the primary controls meet the minimum touch target height', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');

    const calculate = page.getByRole('button', { name: 'Calculate the damage' });
    const box = await calculate.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
