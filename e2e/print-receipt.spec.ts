import { expect, test, type Page } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  openCalculator,
  setPricePerDiner,
  setRestaurantName,
} from './helpers';

/**
 * Emulates the print stylesheet.
 *
 * Playwright cannot open a print dialog, but it can render the page under
 * `print` media, which is what actually decides whether the receipt appears and
 * whether the rest of the app gets out of its way.
 */
async function usePrintMedia(page: Page) {
  await page.emulateMedia({ media: 'print' });
}

async function buildReport(page: Page) {
  await openCalculator(page);
  await setRestaurantName(page, 'Seoul Garden');
  await setPricePerDiner(page, 60);
  await addPlate(page, 'Ribeye', { quality: 'Premium', plateSize: 'Large' });
  // Stated explicitly: the builder keeps the previous configuration otherwise.
  await addPlate(page, 'Prawns', {
    category: 'Seafood',
    quality: 'Standard',
    plateSize: 'Regular',
  });
  await calculateDamage(page);
}

function receipt(page: Page) {
  return page.locator('.print-receipt');
}

test.describe('Printable damage receipt', () => {
  test('stays out of the way on screen', async ({ page }) => {
    await buildReport(page);

    await expect(receipt(page)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Print damage receipt' })).toBeVisible();
  });

  test('is what gets printed, and the app is not', async ({ page }) => {
    await buildReport(page);
    await usePrintMedia(page);

    await expect(receipt(page)).toBeVisible();

    // Screen furniture must not reach the paper. Hidden elements leave the
    // accessibility tree entirely, so a control that still resolves by role is
    // a control that would have been printed.
    expect(await page.getByRole('button').count()).toBe(0);
    expect(await page.getByRole('link').count()).toBe(0);
    // Direct children of body: the site chrome, as distinct from the receipt's
    // own header and footer.
    await expect(page.locator('body > header')).toHaveCSS('visibility', 'hidden');
    await expect(page.locator('body > footer')).toHaveCSS('visibility', 'hidden');
  });

  test('carries the whole meal and its findings', async ({ page }) => {
    await buildReport(page);
    await usePrintMedia(page);

    const text = (await receipt(page).innerText()).replace(/\s+/g, ' ');

    expect(text).toContain('DAMAGE RECEIPT');
    expect(text).toContain('Seoul Garden');
    expect(text).toContain('Ribeye');
    expect(text).toContain('Premium · Large');
    expect(text).toContain('Prawns');
    // $15.44 ribeye + $4.65 prawns = $20.09 against $60.00 = 33%.
    expect(text).toContain('$15.44');
    expect(text).toContain('$20.09');
    expect(text).toContain('$60.00');
    expect(text).toContain('33%');
    expect(text).toContain('TOTAL PLATES 2');
    expect(text).toContain('FINDING');
    expect(text).toContain('CORPORATE SPONSOR');
    expect(text).toContain('THANK YOU FOR YOUR CUSTOM');
  });

  test('lists commendations when the meal earned them', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 20);
    await addPlate(page, 'Ribeye', { plateSize: 'Large' });
    await addPlate(page, 'Pork Belly', { category: 'Pork', plateSize: 'Large' });
    await addPlate(page, 'Chicken Thigh', { category: 'Chicken', plateSize: 'Large' });
    await addPlate(page, 'Prawns', { category: 'Seafood', plateSize: 'Large' });
    await calculateDamage(page);
    await usePrintMedia(page);

    const text = await receipt(page).innerText();

    expect(text).toContain('COMMENDATIONS');
    expect(text).toContain('Four Corners');
  });

  test('names the restaurant honestly when none was given', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);
    await usePrintMedia(page);

    expect(await receipt(page).innerText()).toContain('Not recorded');
  });

  test('does not scroll sideways on paper', async ({ page }) => {
    await buildReport(page);
    await usePrintMedia(page);

    const overflow = await page.evaluate(() => {
      const node = document.querySelector('.print-receipt');
      return node ? node.scrollWidth - node.clientWidth : 0;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
