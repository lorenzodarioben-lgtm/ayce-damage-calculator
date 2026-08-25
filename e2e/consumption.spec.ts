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
 * Ordered against eaten, from the tab through to the filed record.
 *
 * The first test is the one that matters most: someone who cleared their plates
 * has nothing extra to fill in, and sees the calculator they always saw.
 */

const SLIDER = /Plates of Ribeye.*eaten/;

/** Drives the range by keyboard, which is how it must be operable anyway. */
async function reduceEaten(page: Page, steps: number) {
  const slider = tab(page).getByLabel(SLIDER);
  await slider.focus();
  await expect(slider).toBeFocused();
  for (let step = 0; step < steps; step += 1) {
    await page.keyboard.press('ArrowLeft');
  }
}

async function openConsumption(page: Page) {
  await tab(page)
    .getByRole('button', { name: /Record how much of Ribeye.*was eaten/ })
    .click();
}

test.describe('Eaten and left', () => {
  test('says nothing about it when the plates went clean', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');

    await expect(tab(page).getByLabel(SLIDER)).toBeHidden();
    await expect(tab(page).getByText(/left/)).toBeHidden();

    await calculateDamage(page);
    await expect(page.getByText('What reached the table')).toBeHidden();
    await expect(page.getByText('Plates ordered')).toBeVisible();
  });

  test('defaults to fully eaten when the control is opened', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await openConsumption(page);

    // Opening it is not a statement that anything was left.
    await expect(tab(page).getByLabel(SLIDER)).toHaveValue('1');
    await expect(tab(page).getByText(/left/)).toBeHidden();
  });

  test('is operable by keyboard, in quarter plates', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await openConsumption(page);

    await reduceEaten(page, 1);

    await expect(tab(page).getByLabel(SLIDER)).toHaveValue('0.75');
    await expect(tab(page).getByText(/0.75 eaten · 0.25 left/)).toBeVisible();
  });

  test('values only what was eaten, and still says what arrived', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 50);
    await addPlate(page, 'Ribeye');
    await openConsumption(page);
    await reduceEaten(page, 2);
    await calculateDamage(page);

    const arrived = page.getByRole('region', { name: 'What reached the table' });
    await expect(arrived).toBeVisible();
    await expect(arrived.getByText('Ordered', { exact: true })).toBeVisible();
    await expect(arrived.getByText('Eaten', { exact: true })).toBeVisible();
    await expect(arrived.getByText('Left', { exact: true })).toBeVisible();
    await expect(page.getByText(/Recovery is measured on what was eaten/)).toBeVisible();
  });

  test('survives a reload with the tab', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await openConsumption(page);
    await reduceEaten(page, 2);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
    // Still open, because there is still something to see.
    await expect(tab(page).getByLabel(SLIDER)).toHaveValue('0.5');
  });

  test('brings the eaten amount down when the order shrinks', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await page.getByRole('button', { name: /^Add one plate of Ribeye/ }).click();
    await openConsumption(page);
    await expect(tab(page).getByLabel(SLIDER)).toHaveValue('2');

    await page.getByRole('button', { name: /^Remove one plate of Ribeye/ }).click();

    // A tab must never claim more was eaten than ever arrived.
    await expect(tab(page).getByLabel(SLIDER)).toHaveValue('1');
    await expect(tab(page).getByText(/left/)).toBeHidden();
  });

  test('files what was left with the record', async ({ page }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await addPlate(page, 'Ribeye');
    await openConsumption(page);
    await reduceEaten(page, 2);
    await calculateDamage(page);

    await page.getByRole('button', { name: 'Save to history' }).click();
    await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();

    await page.goto('/history');
    await page.getByRole('link', { name: 'Seoul Garden' }).click();

    await expect(page.getByRole('region', { name: 'What reached the table' })).toBeVisible();
  });

  test('carries what was left inside a share link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await addPlate(page, 'Ribeye');
    await openConsumption(page);
    await reduceEaten(page, 2);
    await calculateDamage(page);

    await page.getByRole('button', { name: 'Copy share link' }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());

    const recipient = await context.browser()!.newContext();
    const recipientPage = await recipient.newPage();
    await recipientPage.goto(link);

    await expect(
      recipientPage.getByRole('region', { name: 'What reached the table' }),
    ).toBeVisible();
    await recipient.close();
  });

  test('is available in Live Meal Mode too', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');

    await page.goto('/live');
    await page.getByRole('button', { name: /Record how much of Ribeye.*was eaten/ }).click();

    const slider = page.getByLabel(SLIDER);
    await slider.focus();
    await page.keyboard.press('ArrowLeft');

    await expect(slider).toHaveValue('0.75');
    await expect(page.getByText(/0.25 left/)).toBeVisible();
  });

  test('introduces no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await openConsumption(page);
    await reduceEaten(page, 2);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    await calculateDamage(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
