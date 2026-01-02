import { expect, test } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  openCalculator,
  report,
  sessionSetup,
  setPricePerDiner,
  setRestaurantName,
  tab,
} from './helpers';

test.describe('Core meal journey', () => {
  test('configures a session, records plates and produces a report', async ({ page }) => {
    await openCalculator(page);

    await setRestaurantName(page, 'Seoul Garden');
    await setPricePerDiner(page, 60);
    // Exact, because the same figure also appears inside the "per person" line.
    await expect(sessionSetup(page).getByText('$60.00', { exact: true })).toBeVisible();

    await addPlate(page, 'Ribeye', { quality: 'Premium', plateSize: 'Large' });

    // 220 g x $52/kg x 1.35 premium = $15.44
    const line = tab(page).getByRole('listitem').filter({ hasText: 'Ribeye' });
    await expect(line).toBeVisible();
    await expect(line.getByText('$15.44')).toBeVisible();

    await addPlate(page, 'Pork Belly', { category: 'Pork' });
    await expect(tab(page).getByRole('listitem')).toHaveCount(2);

    await calculateDamage(page);
    // Scoped to the verdict panel; the name is also printed on the share card.
    await expect(
      page.getByRole('region', { name: 'AYCE Damage Report' }).getByText('Seoul Garden'),
    ).toBeVisible();
  });

  test('adjusts a tab line and reflects it in the running total', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');

    await expect(tab(page).getByText('1 plate · 155 g')).toBeVisible();

    await tab(page)
      .getByRole('button', { name: /^Add one plate of Ribeye/ })
      .click();
    await expect(tab(page).getByText('2 plates · 310 g')).toBeVisible();

    await tab(page)
      .getByRole('button', { name: /^Remove Ribeye,/ })
      .click();
    await expect(page.getByText('No damage yet')).toBeVisible();
  });

  test('keeps Calculate unavailable until the tab has a plate', async ({ page }) => {
    await openCalculator(page);

    await expect(page.getByRole('button', { name: 'Calculate the damage' })).toBeDisabled();
    await addPlate(page, 'Ribeye');
    await expect(page.getByRole('button', { name: 'Calculate the damage' })).toBeEnabled();
  });
});

test.describe('Report behaviour', () => {
  test('shows a verdict and the headline totals', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 20);

    await addPlate(page, 'Wagyu Short Rib', { quality: 'Premium', plateSize: 'Large' });
    await calculateDamage(page);

    // $82/kg x 0.22 kg x 1.35 = $24.35 against $20 admission, so the diner wins.
    await expect(page.getByText('Break-Even Bandit').first()).toBeVisible();
    await expect(page.getByText('Est. retail value')).toBeVisible();
    await expect(page.getByText('Admission', { exact: true })).toBeVisible();
    await expect(page.getByText('Retail value recovered')).toBeVisible();
    await expect(page.getByText('1 plate', { exact: true })).toBeVisible();
  });
});

test.describe('Return navigation', () => {
  test('returns to the builder from the in-report Back control', async ({ page }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    await page.getByRole('button', { name: 'Back to meal' }).click();

    await expect(report(page)).toBeHidden();
    await expect(tab(page).getByText('Ribeye')).toBeVisible();
    await expect(page.getByLabel('Restaurant')).toHaveValue('Seoul Garden');
  });

  test('returns to the builder when the brand is activated from the report', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    await page.getByRole('button', { name: /Back to the meal builder/ }).click();

    await expect(report(page)).toBeHidden();
    await expect(tab(page).getByText('Ribeye')).toBeVisible();
  });
});

test.describe('Persistence', () => {
  test('restores the meal and session settings after a reload', async ({ page }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await setPricePerDiner(page, 75);
    await addPlate(page, 'Pork Belly', { category: 'Pork', plateSize: 'Large' });

    await page.reload();

    await expect(page.getByLabel('Restaurant')).toHaveValue('Seoul Garden');
    await expect(page.getByLabel('Price per diner')).toHaveValue('75.00');
    await expect(tab(page).getByText('Pork Belly')).toBeVisible();
    await expect(tab(page).getByText('1 plate · 220 g')).toBeVisible();
  });
});
