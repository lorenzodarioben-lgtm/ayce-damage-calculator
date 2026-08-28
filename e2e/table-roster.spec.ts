import { expect, test } from '@playwright/test';
import { addPlate, calculateDamage, openCalculator, sessionSetup } from './helpers';

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

  test('gives the seats nobody named their own share rather than the roster’s', async ({
    page,
  }) => {
    await openCalculator(page);

    const setup = sessionSetup(page);
    await setup.getByLabel('Diner name').fill('Lorenzo');
    await setup.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(setup.getByRole('textbox', { name: 'Diner 1 name' })).toHaveValue('Lorenzo');

    // Two more people ate and were charged for, but nobody typed their names.
    await setup.getByRole('button', { name: 'Add a diner' }).click();
    await setup.getByRole('button', { name: 'Add a diner' }).click();

    await addPlate(page, 'Ribeye');
    await addPlate(page, 'Ribeye');
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    const breakdown = page.getByRole('region', { name: 'Table breakdown' });
    // Three shared plates across three seats: the named diner takes one, not all.
    await expect(breakdown.getByRole('rowheader', { name: 'Lorenzo' })).toBeVisible();
    await expect(breakdown.getByRole('rowheader', { name: '2 unnamed seats' })).toBeVisible();
    await expect(breakdown.getByRole('row', { name: /^Lorenzo 1 plate/ })).toBeVisible();
    await expect(breakdown.getByRole('row', { name: /^2 unnamed seats 2 plates/ })).toBeVisible();
    await expect(page.getByText(/Seats nobody named keep their own share/)).toBeVisible();
  });
});
