import { expect, test, type Page } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  horizontalOverflow,
  openCalculator,
  setPricePerDiner,
  setRestaurantName,
  tab,
} from './helpers';

/**
 * Food the buffet price did not buy, from the tab through to the report.
 *
 * The assertion that matters is the one about the headline: marking a plate as
 * separately charged must move the recovery figure *down* to where it would
 * have been without that plate, never up. A drink you bought is not evidence
 * that the entry price paid for itself.
 */

const RIBEYE = 'Ribeye, Standard, Regular';

/** The report's own breakdown, which is a separate named region. */
function settled(page: Page) {
  return page.getByRole('region', { name: 'How the bill settled' });
}

async function markAsExtra(page: Page, descriptor: string, charge?: number) {
  await tab(page)
    .getByRole('button', { name: `Charge ${descriptor} separately from the buffet price` })
    .click();
  if (charge !== undefined) {
    await tab(page).getByLabel(`Amount paid for ${descriptor}`).fill(String(charge));
  }
}

/**
 * Reads the headline recovery percentage off the report.
 *
 * Located through the metric's own visible label rather than a test-only hook,
 * so the assertion breaks if the report stops saying what it means.
 */
async function recovery(page: Page): Promise<number> {
  const text = await page
    .getByText('Retail value recovered', { exact: true })
    .locator('xpath=../following-sibling::p[1]')
    .textContent();
  return Number.parseFloat((text ?? '').replace(/[^0-9.-]/g, ''));
}

test.describe('Items the buffet price did not cover', () => {
  test('leaves an ordinary tab exactly as it was', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 50);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    // No extras language anywhere, and the bill breakdown stays absent.
    await expect(page.getByText('Charged separately', { exact: true })).toBeHidden();
    await expect(page.getByText('Spent in total', { exact: true })).toBeHidden();
  });

  test('offers the control on every line without demanding it', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');

    const toggle = tab(page).getByRole('button', {
      name: `Charge ${RIBEYE} separately from the buffet price`,
    });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(tab(page).getByLabel(`Amount paid for ${RIBEYE}`)).toBeHidden();
  });

  test('asks what was paid, and never guesses it from retail value', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await markAsExtra(page, RIBEYE);

    // Marked but unpriced: the app says so rather than inventing a figure.
    await expect(tab(page).getByLabel(`Amount paid for ${RIBEYE}`)).toHaveValue('');
    await expect(tab(page).getByText('paid separately')).toBeVisible();
  });

  test('keeps an extra out of the buffet recovery figure', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 50);
    await addPlate(page, 'Ribeye');
    await addPlate(page, 'Pork Belly', { category: 'Pork' });
    await calculateDamage(page);
    const before = await recovery(page);

    await page.getByRole('button', { name: 'Edit meal' }).click();
    await markAsExtra(page, 'Pork Belly, Standard, Regular', 14);
    await calculateDamage(page);
    const after = await recovery(page);

    // The pork belly's value no longer counts towards beating the buffet.
    expect(after).toBeLessThan(before);
  });

  test('reports buffet spend and total spend as different numbers', async ({ page }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await setPricePerDiner(page, 50);
    await addPlate(page, 'Ribeye');
    await addPlate(page, 'Pork Belly', { category: 'Pork' });
    await markAsExtra(page, 'Pork Belly, Standard, Regular', 14);
    await calculateDamage(page);

    // Entry price and buffet total are both $50 here, which is the point: the
    // extra sits outside them and only the last line is the whole evening.
    await expect(settled(page).getByText('Buffet total', { exact: true })).toBeVisible();
    await expect(settled(page).getByText('$50.00').first()).toBeVisible();
    await expect(settled(page).getByText('Charged separately', { exact: true })).toBeVisible();
    await expect(settled(page).getByText('+$14.00')).toBeVisible();
    await expect(settled(page).getByText('Spent in total', { exact: true })).toBeVisible();
    await expect(settled(page).getByText('$64.00')).toBeVisible();
  });

  test('says when an extra has no price recorded', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 50);
    await addPlate(page, 'Ribeye');
    await markAsExtra(page, RIBEYE);
    await calculateDamage(page);

    await expect(page.getByText(/no price recorded/)).toBeVisible();
  });

  test('survives a reload as the extra it was recorded as', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await markAsExtra(page, RIBEYE, 12);

    await page.reload();

    await expect(
      tab(page).getByRole('button', {
        name: `Charge ${RIBEYE} separately from the buffet price`,
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(tab(page).getByLabel(`Amount paid for ${RIBEYE}`)).toHaveValue('12');
  });

  test('keeps an extra as its own line rather than merging it into the buffet', async ({
    page,
  }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await markAsExtra(page, RIBEYE, 12);
    // The same cut again, this time included in the buffet price.
    await addPlate(page, 'Ribeye');

    // Two lines for one cut, because one was paid for and the other was not.
    await expect(tab(page).getByText('Ribeye')).toHaveCount(2);
  });

  test('files the distinction with the record', async ({ page }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await setPricePerDiner(page, 50);
    await addPlate(page, 'Ribeye');
    await addPlate(page, 'Pork Belly', { category: 'Pork' });
    await markAsExtra(page, 'Pork Belly, Standard, Regular', 14);
    await calculateDamage(page);
    await page.getByRole('button', { name: 'Save to history' }).click();
    await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();

    await page.goto('/history');
    await page.getByRole('link', { name: /Seoul Garden/ }).click();

    await expect(page.getByText('Spent in total', { exact: true })).toBeVisible();
    await expect(page.getByText('$64.00')).toBeVisible();
  });

  test('introduces no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await markAsExtra(page, RIBEYE, 12);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    await calculateDamage(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
