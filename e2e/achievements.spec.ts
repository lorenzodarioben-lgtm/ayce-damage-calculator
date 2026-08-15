import { expect, test } from '@playwright/test';
import { addPlate, calculateDamage, openCalculator, setPricePerDiner } from './helpers';

test.describe('Commendations', () => {
  test('are absent from a modest meal', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 500);
    await addPlate(page, 'Chicken Thigh', { category: 'Chicken', plateSize: 'Small' });
    await calculateDamage(page);

    // Nothing earned, so the section stays away rather than showing empty slots.
    await expect(page.getByRole('heading', { name: 'Commendations' })).toBeHidden();
  });

  test('appear on the report once a meal earns them', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 20);

    // Five large plates: 1.10 kg, all four categories, $33.00 against $20.
    await addPlate(page, 'Ribeye', { plateSize: 'Large' });
    await addPlate(page, 'Brisket', { plateSize: 'Large' });
    await addPlate(page, 'Pork Belly', { category: 'Pork', plateSize: 'Large' });
    await addPlate(page, 'Chicken Thigh', { category: 'Chicken', plateSize: 'Large' });
    await addPlate(page, 'Prawns', { category: 'Seafood', plateSize: 'Large' });

    await calculateDamage(page);

    const commendations = page.getByRole('region', { name: 'Commendations' });
    await expect(commendations).toBeVisible();
    await expect(commendations.getByText('Four Corners')).toBeVisible();
    await expect(commendations.getByText('Kilogram Club')).toBeVisible();
    await expect(commendations.getByText('Break Even')).toBeVisible();
  });

  test('are carried into the filed record', async ({ page }) => {
    await openCalculator(page);
    // $18.04 of retail value against $15 admission clears break-even.
    await setPricePerDiner(page, 15);
    await addPlate(page, 'Ribeye', { plateSize: 'Large' });
    await addPlate(page, 'Prawns', { category: 'Seafood', plateSize: 'Large' });
    await calculateDamage(page);

    await page.getByRole('button', { name: 'Save to history' }).click();
    await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();

    await page.goto('/history');
    await page.getByRole('listitem').first().getByRole('link').click();

    await expect(page.getByRole('heading', { name: 'Filed Damage Report' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Commendations' }).getByText('Break Even'),
    ).toBeVisible();
  });
});
