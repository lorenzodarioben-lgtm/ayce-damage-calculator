import { expect, test, type Page } from '@playwright/test';
import {
  addPlate,
  openCalculator,
  sessionSetup,
  setPricePerDiner,
  setRestaurantName,
} from './helpers';

function presetChip(page: Page, label: string) {
  return page.getByRole('button', { name: new RegExp(`^Apply preset ${label}`) });
}

async function savePreset(page: Page, name: string, price: number) {
  await setRestaurantName(page, name);
  await setPricePerDiner(page, price);
  await page.getByRole('button', { name: 'Save this setup' }).click();
}

test.describe('Restaurant presets', () => {
  test('start with an explanatory empty state', async ({ page }) => {
    await openCalculator(page);

    await expect(sessionSetup(page).getByText(/No saved restaurants yet/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save this setup' })).toBeDisabled();
  });

  test('save the current setup and apply it again later', async ({ page }) => {
    await openCalculator(page);
    await savePreset(page, 'Friday KBBQ', 59.9);

    await expect(presetChip(page, 'Friday KBBQ')).toBeVisible();

    // Change the setup, then put it back with one tap.
    await setRestaurantName(page, 'Somewhere Else');
    await setPricePerDiner(page, 25);
    await expect(sessionSetup(page).getByText('$25.00', { exact: true })).toBeVisible();

    await presetChip(page, 'Friday KBBQ').click();

    await expect(page.getByLabel('Restaurant')).toHaveValue('Friday KBBQ');
    await expect(page.getByLabel('Price per diner')).toHaveValue('59.90');
  });

  test('update rather than duplicate when the same name is saved again', async ({ page }) => {
    await openCalculator(page);
    await savePreset(page, 'Friday KBBQ', 59.9);
    await savePreset(page, 'Friday KBBQ', 80);

    await expect(page.getByRole('button', { name: /^Apply preset Friday KBBQ/ })).toHaveCount(1);
    await expect(presetChip(page, 'Friday KBBQ, \\$80.00')).toBeVisible();
  });

  test('survive a reload', async ({ page }) => {
    await openCalculator(page);
    await savePreset(page, 'Friday KBBQ', 59.9);

    await page.reload();

    await expect(presetChip(page, 'Friday KBBQ')).toBeVisible();
  });

  test('can be deleted', async ({ page }) => {
    await openCalculator(page);
    await savePreset(page, 'Friday KBBQ', 59.9);

    await page.getByRole('button', { name: 'Delete the preset Friday KBBQ' }).click();

    await expect(sessionSetup(page).getByText(/No saved restaurants yet/)).toBeVisible();
  });

  test('ask before changing the setup under a meal in progress', async ({ page }) => {
    await openCalculator(page);
    await savePreset(page, 'Friday KBBQ', 59.9);

    await setRestaurantName(page, 'Somewhere Else');
    await setPricePerDiner(page, 25);
    await addPlate(page, 'Ribeye');

    await presetChip(page, 'Friday KBBQ').click();
    await expect(page.getByText(/Your plates stay exactly as they are/)).toBeVisible();

    await page.getByRole('button', { name: 'Leave it as it is' }).click();
    await expect(page.getByLabel('Restaurant')).toHaveValue('Somewhere Else');
  });

  test('never cost the user their plates when applied', async ({ page }) => {
    await openCalculator(page);
    await savePreset(page, 'Friday KBBQ', 59.9);
    await setPricePerDiner(page, 25);
    await addPlate(page, 'Ribeye');

    await presetChip(page, 'Friday KBBQ').click();
    // Exact, or this also matches the chip's own "Apply preset <name>" label.
    await page.getByRole('button', { name: 'Apply preset', exact: true }).click();

    await expect(page.getByLabel('Price per diner')).toHaveValue('59.90');
    // The tab is untouched; only the admission it is measured against moved.
    await expect(page.getByRole('region', { name: 'Your tab' }).getByText('Ribeye')).toBeVisible();
    await expect(sessionSetup(page).getByText('$59.90', { exact: true })).toBeVisible();
  });

  test('apply without asking when there is no meal to disturb', async ({ page }) => {
    await openCalculator(page);
    await savePreset(page, 'Friday KBBQ', 59.9);
    await setPricePerDiner(page, 25);

    await presetChip(page, 'Friday KBBQ').click();

    await expect(page.getByText(/Your plates stay exactly as they are/)).toBeHidden();
    await expect(page.getByLabel('Price per diner')).toHaveValue('59.90');
  });
});
