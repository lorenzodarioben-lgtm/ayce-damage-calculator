import { expect, test } from '@playwright/test';
import { addPlate, calculateDamage, horizontalOverflow, openCalculator } from './helpers';

/**
 * The builder is dense and the report carries a fixed-width share card, so both
 * stages are checked. One pixel of slack absorbs sub-pixel rounding; anything
 * beyond that is a real sideways scroll on a phone.
 */
const OVERFLOW_TOLERANCE_PX = 1;

test.describe('Layout', () => {
  test('navigation fits phone, tablet and desktop widths', async ({ page }) => {
    await openCalculator(page);
    await page.evaluate(() => document.fonts.ready);

    for (const width of [320, 390, 640, 648, 768, 900, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await horizontalOverflow(page), `overflow at ${width}px`).toBeLessThanOrEqual(
        OVERFLOW_TOLERANCE_PX,
      );
      if (width === 648) {
        await page.screenshot({ path: test.info().outputPath('navigation-648.png') });
      }

      const toggle = page.getByRole('button', { name: 'Open the menu' });
      if (width < 1024) {
        await expect(toggle).toBeVisible();
      } else {
        await expect(toggle).toBeHidden();
        const brand = await page.getByRole('button', { name: /AYCE.*Back to/ }).boundingBox();
        const navigation = await page.getByRole('navigation', { name: 'Primary' }).boundingBox();
        expect(brand).not.toBeNull();
        expect(navigation).not.toBeNull();
        expect(brand!.x + brand!.width).toBeLessThanOrEqual(navigation!.x);
      }
    }
  });

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
