import { expect, test, type Page } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  horizontalOverflow,
  setPricePerDiner,
  setRestaurantName,
} from './helpers';

/** Records one complete session and files it into history. */
async function fileSession(
  page: Page,
  options: { restaurant: string; price: number; food: string; extra?: boolean },
) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();

  await setRestaurantName(page, options.restaurant);
  await setPricePerDiner(page, options.price);
  await addPlate(page, options.food);
  if (options.extra) {
    await addPlate(page, 'Prawns', { category: 'Seafood' });
  }

  await calculateDamage(page);
  await page.getByRole('button', { name: 'Save to history' }).click();
  await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();
}

test.describe('Session comparison', () => {
  test('states that a single session is not enough to compare', async ({ page }) => {
    await fileSession(page, { restaurant: 'Seoul Garden', price: 60, food: 'Ribeye' });

    await page.goto('/history/compare');

    await expect(page.getByText('Insufficient evidence.')).toBeVisible();
    await expect(page.getByText('Currently on file: 1.')).toBeVisible();
  });

  test('compares two filed sessions and states the difference correctly', async ({ page }) => {
    await fileSession(page, { restaurant: 'Little Seoul', price: 60, food: 'Ribeye' });
    // A second, larger session. Resetting first keeps the meals distinct.
    await page.goto('/');
    await page.getByRole('button', { name: 'Reset session' }).click();
    await page.getByRole('button', { name: 'Reset everything' }).click();
    await fileSession(page, {
      restaurant: 'Wagyu House',
      price: 60,
      food: 'Wagyu Short Rib',
      extra: true,
    });

    await page.goto('/history');
    await page.getByRole('link', { name: 'Compare' }).click();

    await expect(page.getByRole('heading', { name: 'Change in performance' })).toBeVisible();

    // Percentage points, never a bare percentage — the two mean different things.
    const lineByLine = page.getByRole('region', { name: 'Line by line' });
    await expect(lineByLine.getByText(/percentage points?$/)).toBeVisible();

    await expect(lineByLine.getByText('Retail recovery')).toBeVisible();
    await expect(lineByLine.getByText('Est. retail value')).toBeVisible();
    await expect(lineByLine.getByText('Admission')).toBeVisible();

    // The mix breakdown covers all four categories, including untouched ones.
    const mix = page.getByRole('region', { name: 'Category mix, in plates' });
    for (const category of ['Beef', 'Pork', 'Chicken', 'Seafood']) {
      await expect(mix.getByText(category, { exact: true })).toBeVisible();
    }

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('asks for two different sessions when the same one is picked twice', async ({ page }) => {
    await fileSession(page, { restaurant: 'Little Seoul', price: 60, food: 'Ribeye' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Reset session' }).click();
    await page.getByRole('button', { name: 'Reset everything' }).click();
    await fileSession(page, { restaurant: 'Wagyu House', price: 60, food: 'Wagyu Short Rib' });

    await page.goto('/history/compare');
    await expect(page.getByRole('heading', { name: 'Change in performance' })).toBeVisible();

    const earlier = page.getByLabel('Earlier session');
    const later = page.getByLabel('Later session');
    await earlier.selectOption(await later.inputValue());

    await expect(page.getByText('Choose two different sessions to compare.')).toBeVisible();
  });
});
