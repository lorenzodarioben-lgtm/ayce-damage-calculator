import { expect, test, type Page } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  horizontalOverflow,
  openCalculator,
  sessionSetup,
  tab,
} from './helpers';

/**
 * The four categories that only ever hold a diner's own items.
 *
 * The first test is the one that protects the default experience: someone using
 * the built-in Australian menu sees the four grill tabs and nothing else, with
 * no empty categories to wonder about.
 */

interface CustomItem {
  readonly name: string;
  readonly category: string;
  readonly retail: string;
  readonly cost: string;
  readonly perServing?: boolean;
  /** Left blank on purpose, to prove unknown is not zero. */
  readonly calories?: string;
}

async function addCustomFood(page: Page, item: CustomItem) {
  await sessionSetup(page).getByRole('button', { name: 'Add food' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add custom food' });

  await dialog.getByLabel('Name', { exact: true }).fill(item.name);
  await dialog.getByLabel('Category').selectOption(item.category);

  if (item.perServing) {
    await dialog.getByText('By serving', { exact: true }).click();
    await dialog.getByLabel('Retail price per serving').fill(item.retail);
    await dialog.getByLabel('Restaurant cost per serving').fill(item.cost);
  } else {
    await dialog.getByLabel('Retail price per kg').fill(item.retail);
    await dialog.getByLabel('Restaurant cost per kg').fill(item.cost);
  }

  if (item.calories !== undefined) {
    await dialog.getByLabel('Calories').fill(item.calories);
  }

  await dialog.getByRole('button', { name: 'Save to my menu' }).click();
  await expect(dialog).toBeHidden();
}

test.describe('Personal menu categories', () => {
  test('shows only the grill categories on the default menu', async ({ page }) => {
    await openCalculator(page);

    await expect(page.getByRole('tab')).toHaveCount(4);
    for (const label of ['Beef', 'Pork', 'Chicken', 'Seafood']) {
      await expect(page.getByRole('tab', { name: new RegExp(`^${label}`) })).toBeVisible();
    }
    await expect(page.getByRole('tab', { name: /Drinks/ })).toBeHidden();
  });

  test('adds a category tab once something is in it', async ({ page }) => {
    await openCalculator(page);
    await addCustomFood(page, {
      name: 'House lager',
      category: 'drinks',
      retail: '9',
      cost: '2.5',
      perServing: true,
    });

    await expect(page.getByRole('tab', { name: /Drinks/ })).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(5);
  });

  test('lets a personal side onto the tab and into the report', async ({ page }) => {
    await openCalculator(page);
    await addCustomFood(page, {
      name: 'Kimchi',
      category: 'sides',
      retail: '18',
      cost: '6',
      calories: '30',
    });

    await page.getByRole('tab', { name: /Sides/ }).click();
    await addPlate(page, 'Kimchi');
    await expect(tab(page).getByText('Kimchi')).toBeVisible();

    await calculateDamage(page);
    await expect(
      page.getByRole('region', { name: 'What you ate' }).getByText('Kimchi', { exact: true }),
    ).toBeVisible();
  });

  test('counts a drink in servings and hides plate size for it', async ({ page }) => {
    await openCalculator(page);
    await addCustomFood(page, {
      name: 'House lager',
      category: 'drinks',
      retail: '9',
      cost: '2.5',
      perServing: true,
    });

    await page.getByRole('tab', { name: /Drinks/ }).click();
    await page.getByRole('button', { name: /^House lager/ }).click();

    // A serving is whatever the restaurant serves, so the control is absent.
    await expect(page.getByRole('radio', { name: /^Regular/ })).toBeHidden();
    await expect(page.getByText('Servings', { exact: true })).toBeVisible();
    await expect(page.getByText('Not weighed')).toBeVisible();
  });

  test('says a macro is not recorded rather than counting it as zero', async ({ page }) => {
    await openCalculator(page);
    await addCustomFood(page, {
      name: 'Doenjang jjigae',
      category: 'hot-food',
      retail: '11',
      cost: '3.5',
      perServing: true,
    });

    await page.getByRole('tab', { name: /Hot food/ }).click();
    await addPlate(page, 'Doenjang jjigae');
    await calculateDamage(page);

    await expect(page.getByText(/no nutrition recorded/)).toBeVisible();
  });

  test('reports nothing missing for an ordinary grill meal', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    await expect(page.getByText(/no nutrition recorded/)).toBeHidden();
  });

  test('survives a reload with its category intact', async ({ page }) => {
    await openCalculator(page);
    await addCustomFood(page, {
      name: 'Green tea ice cream',
      category: 'desserts',
      retail: '6',
      cost: '1.8',
      perServing: true,
    });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
    await page.getByRole('tab', { name: /Desserts/ }).click();
    await expect(page.getByRole('button', { name: /^Green tea ice cream/ })).toBeVisible();
  });

  test('is reachable by keyboard across the visible tabs', async ({ page }) => {
    await openCalculator(page);
    await addCustomFood(page, {
      name: 'House lager',
      category: 'drinks',
      retail: '9',
      cost: '2.5',
      perServing: true,
    });

    const beef = page.getByRole('tab', { name: /^Beef/ });
    await beef.click();
    await beef.press('ArrowLeft');

    // Wraps to the last visible tab, which is the one that has food in it.
    await expect(page.getByRole('tab', { name: /Drinks/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('introduces no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await openCalculator(page);
    await addCustomFood(page, {
      name: 'House lager',
      category: 'drinks',
      retail: '9',
      cost: '2.5',
      perServing: true,
    });

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    await page.getByRole('tab', { name: /Drinks/ }).click();
    await addPlate(page, 'House lager');
    await calculateDamage(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
