import { expect, test, type Page } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  horizontalOverflow,
  openCalculator,
  setPricePerDiner,
  setRestaurantName,
} from './helpers';

/** Records a session and files it, then clears the tab for the next one. */
async function fileSession(
  page: Page,
  options: { restaurant: string; price: number; food: string; category?: 'Beef' | 'Seafood' },
) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();

  await setRestaurantName(page, options.restaurant);
  await setPricePerDiner(page, options.price);
  await addPlate(page, options.food, options.category ? { category: options.category } : {});
  await calculateDamage(page);

  await page.getByRole('button', { name: 'Save to history' }).click();
  await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();

  await page.getByRole('button', { name: 'Back to meal' }).click();
  await page.getByRole('button', { name: 'Reset session' }).click();
  await page.getByRole('button', { name: 'Reset everything' }).click();
}

test.describe('Analytics', () => {
  test('states plainly when there is nothing to analyse', async ({ page }) => {
    await page.goto('/stats');

    await expect(page.getByRole('heading', { name: 'The analysis' })).toBeVisible();
    await expect(page.getByText('Nothing to analyse yet.')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('is reachable from the primary navigation', async ({ page }) => {
    await openCalculator(page);

    const menu = page.getByRole('button', { name: 'Open the menu' });
    if (await menu.isVisible()) {
      await menu.click();
    }
    await page.getByRole('link', { name: 'Stats' }).click();

    await expect(page.getByRole('heading', { name: 'The analysis' })).toBeVisible();
  });

  test('summarises filed sessions without inventing anything', async ({ page }) => {
    // One session well short of break-even, one comfortably past it.
    await fileSession(page, { restaurant: 'Little Seoul', price: 60, food: 'Ribeye' });
    await fileSession(page, { restaurant: 'Wagyu House', price: 10, food: 'Wagyu Short Rib' });

    await page.goto('/stats');

    const totals = page.getByRole('region', { name: 'On record' });
    // One of the two sessions cleared break-even, the other did not.
    await expect(totals.getByText('1 at or past break-even')).toBeVisible();
    // Two regular plates at 155 g, averaging half that per session.
    await expect(totals.getByText('0.31 kg', { exact: true })).toBeVisible();
    await expect(totals.getByText('0.16 kg average')).toBeVisible();

    const recovery = page.getByRole('region', { name: 'Retail recovery' });
    // 155 g x $82/kg = $12.71 of $10 = 127%, the better of the two.
    await expect(recovery.getByText('127%').first()).toBeVisible();
    await expect(recovery.getByText(/Wagyu House/)).toBeVisible();

    const mix = page.getByRole('region', { name: 'What gets ordered' });
    await expect(mix.getByText('Ribeye', { exact: true })).toBeVisible();
    await expect(mix.getByText('Wagyu Short Rib', { exact: true })).toBeVisible();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('describes its chart for anything that cannot see it', async ({ page }) => {
    await fileSession(page, { restaurant: 'Little Seoul', price: 60, food: 'Ribeye' });

    await page.goto('/stats');

    // The chart carries an accessible name, and the same figures in a table.
    await expect(page.getByRole('img', { name: /Retail recovery across the last/ })).toBeVisible();
    await page.getByText('Show these figures').click();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Recovery' })).toBeVisible();
  });

  test('links the largest session back to its record', async ({ page }) => {
    await fileSession(page, { restaurant: 'Wagyu House', price: 20, food: 'Wagyu Short Rib' });

    await page.goto('/stats');
    await page
      .getByRole('region', { name: 'Largest recorded session' })
      .getByRole('link', { name: 'Wagyu House' })
      .click();

    await expect(page.getByRole('heading', { name: 'Filed Damage Report' })).toBeVisible();
  });
});
