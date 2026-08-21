import { expect, test } from '@playwright/test';
import { openCalculator, sessionSetup } from './helpers';

test.describe('Table roster', () => {
  test('keeps roster management optional and confirms a clear action', async ({ page }) => {
    await openCalculator(page);

    const setup = sessionSetup(page);
    await setup.getByLabel('Diner name').fill('Lorenzo');
    await setup.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(setup.getByRole('textbox', { name: 'Diner 1 name' })).toHaveValue('Lorenzo');

    await setup.getByRole('button', { name: 'Clear roster' }).click();
    await expect(page.getByRole('heading', { name: 'Clear this table roster?' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear roster' }).last().click();

    await expect(setup.getByText(/no one is being tracked individually/i)).toBeVisible();
  });
});
