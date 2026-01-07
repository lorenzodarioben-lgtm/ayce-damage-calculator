import { expect, test, type Page } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  horizontalOverflow,
  openCalculator,
  selectCategory,
  tab,
  type Category,
} from './helpers';

/** The oversized log button for a given cut. */
function plateButton(page: Page, descriptor: string) {
  return page.getByRole('button', { name: new RegExp(`^Add one plate of ${descriptor}`) });
}

async function addCutInLiveMode(page: Page, food: string, category?: Category) {
  await page.getByRole('button', { name: 'Add a cut' }).click();
  if (category) {
    await selectCategory(page, category);
  }
  await page.getByRole('button', { name: new RegExp(`^${food}\\b`) }).click();
  await page.getByRole('button', { name: 'Add to quick log' }).click();
}

test.describe('Live meal mode', () => {
  test('opens with an empty state and logs a first cut', async ({ page }) => {
    await page.goto('/live');

    await expect(page.getByRole('heading', { name: 'Live damage' })).toBeVisible();
    await expect(page.getByText('Nothing on the grill yet.')).toBeVisible();

    await addCutInLiveMode(page, 'Ribeye');

    await expect(plateButton(page, 'Ribeye')).toBeVisible();
    await expect(page.getByText('1 plate · 0.16 kg')).toBeVisible();
  });

  test('logs repeat plates with a single tap', async ({ page }) => {
    await page.goto('/live');
    await addCutInLiveMode(page, 'Ribeye');

    await plateButton(page, 'Ribeye').click();
    await plateButton(page, 'Ribeye').click();

    await expect(page.getByText('3 plates · 0.47 kg')).toBeVisible();
    // 3 x 155 g x $52/kg = $24.18
    await expect(page.getByText('$24.18').first()).toBeVisible();
  });

  test('can undo a plate and remove a cut entirely', async ({ page }) => {
    await page.goto('/live');
    await addCutInLiveMode(page, 'Ribeye');
    await plateButton(page, 'Ribeye').click();
    await expect(page.getByText('2 plates · 0.31 kg')).toBeVisible();

    await page.getByRole('button', { name: /^Remove one plate of Ribeye/ }).click();
    await expect(page.getByText('1 plate · 0.16 kg')).toBeVisible();

    // At one plate, decrementing further is not offered.
    await expect(page.getByRole('button', { name: /^Remove one plate of Ribeye/ })).toBeDisabled();

    await page.getByRole('button', { name: /^Remove Ribeye,.*from your tab/ }).click();
    await expect(page.getByText('Nothing on the grill yet.')).toBeVisible();
  });

  test('offers touch targets big enough to use one-handed', async ({ page }) => {
    await page.goto('/live');
    await addCutInLiveMode(page, 'Ribeye');

    const box = await plateButton(page, 'Ribeye').boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('shares one meal with the full builder in both directions', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');

    await page.goto('/live');
    // Logged in the builder, present here.
    await expect(plateButton(page, 'Ribeye')).toBeVisible();

    await plateButton(page, 'Ribeye').click();
    await addCutInLiveMode(page, 'Pork Belly', 'Pork');

    await page.goto('/');
    // Logged here, present in the builder.
    await expect(tab(page).getByText('2 plates · 310 g')).toBeVisible();
    await expect(tab(page).getByText('Pork Belly')).toBeVisible();
  });

  test('hands the meal to the full report', async ({ page }) => {
    await page.goto('/live');
    await addCutInLiveMode(page, 'Ribeye');

    await page.getByRole('link', { name: 'Calculate the damage' }).click();

    await expect(page.getByRole('heading', { name: 'AYCE Damage Report' })).toBeVisible();
    await expect(page).toHaveURL(/\?stage=report$/);
  });

  test('does not offer the report before anything is logged', async ({ page }) => {
    await page.goto('/live');

    const calculate = page.getByRole('link', { name: 'Calculate the damage' });
    await expect(calculate).toHaveAttribute('aria-disabled', 'true');
  });

  test('is reachable from the primary navigation', async ({ page }) => {
    await openCalculator(page);

    const menu = page.getByRole('button', { name: 'Open the menu' });
    if (await menu.isVisible()) {
      await menu.click();
    }
    await page.getByRole('link', { name: 'Live' }).click();

    await expect(page.getByRole('heading', { name: 'Live damage' })).toBeVisible();
  });
});

test.describe('Live mode calculations', () => {
  test('agrees exactly with the full builder', async ({ page }) => {
    await page.goto('/live');
    await addCutInLiveMode(page, 'Wagyu Short Rib');
    await plateButton(page, 'Wagyu Short Rib').click();
    await plateButton(page, 'Wagyu Short Rib').click();

    // 3 x 155 g x $82/kg = $38.13 against the default $59.90 = 64%.
    await expect(page.getByText('$38.13').first()).toBeVisible();
    await expect(page.getByText('64%')).toBeVisible();

    await page.goto('/');
    await calculateDamage(page);
    await expect(page.getByText('$38.13').first()).toBeVisible();
    await expect(page.getByText('64%').first()).toBeVisible();
  });
});
