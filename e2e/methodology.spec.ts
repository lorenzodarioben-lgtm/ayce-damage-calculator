import { expect, test, type Page } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  horizontalOverflow,
  openCalculator,
  setPricePerDiner,
  setRestaurantName,
} from './helpers';

function uncertainty(page: Page) {
  return page.getByRole('region', { name: 'How firm is this number?' });
}

async function openTheRange(page: Page) {
  await uncertainty(page).getByText('Show the range and what moves it').click();
}

test.describe('The uncertainty analysis', () => {
  test('appears on the report without displacing the headline figure', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    // The point estimate is still the report's answer.
    await expect(page.getByText('Est. retail value').first()).toBeVisible();
    await expect(uncertainty(page)).toBeVisible();
    await expect(uncertainty(page).getByRole('table')).toBeHidden();
  });

  test('opens to a conservative, base and upper scenario', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);
    await openTheRange(page);

    const table = uncertainty(page).getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('rowheader', { name: 'Conservative' })).toBeVisible();
    await expect(table.getByRole('rowheader', { name: 'Base estimate' })).toBeVisible();
    await expect(table.getByRole('rowheader', { name: 'Upper estimate' })).toBeVisible();
  });

  test('states plainly that these are scenarios, not confidence intervals', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);
    await openTheRange(page);

    await expect(
      uncertainty(page).getByText(/three named scenarios, not confidence intervals/i),
    ).toBeVisible();
  });

  test('says the verdict holds when a win is comfortable', async ({ page }) => {
    await openCalculator(page);
    // One large premium wagyu plate clears a ten-dollar admission even after
    // the conservative multipliers are applied to it.
    await setPricePerDiner(page, 10);
    await addPlate(page, 'Wagyu Short Rib', { quality: 'Premium', plateSize: 'Large' });
    await calculateDamage(page);

    await expect(
      uncertainty(page).getByText(/even under the conservative assumptions/i),
    ).toBeVisible();
  });

  test('says the verdict is assumption-dependent when it is', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 15);
    await addPlate(page, 'Brisket', { quality: 'House', plateSize: 'Small' });
    await calculateDamage(page);

    await expect(uncertainty(page)).toBeVisible();
    const headline = await uncertainty(page).getByRole('paragraph').first().textContent();
    expect(headline).toMatch(/conservative|generous|depends on the assumptions/i);
  });

  test('ranks what moves the result and explains each assumption', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);
    await openTheRange(page);

    await expect(uncertainty(page).getByText('What moves the result most')).toBeVisible();
    await expect(
      uncertainty(page).getByText(/a "regular" plate is a nominal 155 g/i),
    ).toBeVisible();
    await expect(uncertainty(page).getByText(/is still not restaurant profit/i)).toBeVisible();
  });

  test('is also on a filed record', async ({ page }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);
    await page.getByRole('button', { name: 'Save to history' }).click();
    await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();

    await page.goto('/history');
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Seoul Garden' })
      .getByRole('link', { name: 'Seoul Garden' })
      .click();

    await expect(uncertainty(page)).toBeVisible();
  });

  test('is described in the methodology dialog', async ({ page }) => {
    await openCalculator(page);
    await page.getByRole('button', { name: 'How we calculate it' }).first().click();

    // Both the header and footer render their own dialog; only the open one is
    // exposed, so scoping to it keeps the assertion about what is on screen.
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'How we calculate it' })).toBeVisible();
    await expect(dialog.getByText('How firm the number is')).toBeVisible();
  });

  test('introduces no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);
    await openTheRange(page);

    await expect(uncertainty(page).getByRole('table')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
