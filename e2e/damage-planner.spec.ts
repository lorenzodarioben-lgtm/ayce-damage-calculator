import { expect, test, type Page } from '@playwright/test';
import { addPlate, horizontalOverflow, openCalculator, tab } from './helpers';

function proposal(page: Page) {
  return page.getByRole('region', { name: 'The proposed configuration' });
}

async function runSimulation(page: Page) {
  await page.getByRole('button', { name: 'Run the simulation' }).click();
}

test.describe('The damage planner', () => {
  test('is reachable from the primary navigation and states what it is', async ({ page }) => {
    await openCalculator(page);

    const menu = page.getByRole('button', { name: 'Open the menu' });
    if (await menu.isVisible()) {
      await menu.click();
    }
    await page.getByRole('link', { name: 'Plan' }).click();

    await expect(page.getByRole('heading', { name: 'The pre-meal briefing' })).toBeVisible();
    await expect(
      page.getByText(/not a recommendation about what anyone should eat/i),
    ).toBeVisible();
  });

  test('proposes a configuration and says why', async ({ page }) => {
    await page.goto('/plan');
    await runSimulation(page);

    await expect(proposal(page)).toBeVisible();
    await expect(proposal(page).getByRole('table')).toBeVisible();
    await expect(proposal(page).getByText('Why this one')).toBeVisible();
    await expect(proposal(page).getByText(/menu simulation/i)).toBeVisible();
  });

  test('reaches the target it was set', async ({ page }) => {
    await page.goto('/plan');

    const target = page.getByLabel(/Target recovery/);
    await target.fill('150');
    await runSimulation(page);

    const recovery = proposal(page).getByText('Recovery').locator('xpath=following-sibling::dd[1]');
    const text = (await recovery.textContent()) ?? '0%';
    expect(Number.parseInt(text, 10)).toBeGreaterThanOrEqual(150);
  });

  test('respects the serving sizes and quality tiers left available', async ({ page }) => {
    await page.goto('/plan');

    const sizes = page.getByRole('group', { name: 'Serving sizes' });
    await sizes.getByRole('button', { name: 'Regular' }).click();
    await sizes.getByRole('button', { name: 'Large' }).click();
    await runSimulation(page);

    const configurations = await proposal(page).locator('tbody td').first().textContent();
    expect(configurations).toContain('small');
  });

  test('refuses honestly rather than inventing a plan', async ({ page }) => {
    await page.goto('/plan');

    const tiers = page.getByRole('group', { name: 'Quality tiers' });
    for (const tier of ['House', 'Standard', 'Premium']) {
      await tiers.getByRole('button', { name: tier }).click();
    }
    await runSimulation(page);

    await expect(page.getByRole('region', { name: 'No plan' })).toBeVisible();
    await expect(page.getByText(/include at least one cut/i)).toBeVisible();
  });

  test('never touches the meal in progress on its own', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await expect(tab(page).getByText('Ribeye')).toBeVisible();

    await page.goto('/plan');
    await runSimulation(page);
    await expect(proposal(page)).toBeVisible();

    await page.goto('/');
    await expect(tab(page).getByText('Ribeye')).toBeVisible();
    // Exactly the one plate that was logged, and nothing the planner proposed.
    await expect(tab(page).getByRole('listitem')).toHaveCount(1);
  });

  test('requires an explicit confirmation before a plan becomes a meal', async ({ page }) => {
    await page.goto('/plan');
    await runSimulation(page);

    await page.getByRole('button', { name: 'Load as a meal' }).click();
    await expect(page.getByRole('heading', { name: 'Load this plan as a meal?' })).toBeVisible();
    await expect(page.getByText(/a plan is a menu simulation, not a record/i)).toBeVisible();

    await page.getByRole('button', { name: 'Keep it a plan' }).click();
    await page.goto('/');
    await expect(page.getByText('No damage yet')).toBeVisible();
  });

  test('loads the plan as a meal once confirmed', async ({ page }) => {
    await page.goto('/plan');
    await runSimulation(page);

    await page.getByRole('button', { name: 'Load as a meal' }).click();
    await page.getByRole('button', { name: 'Log these plates' }).click();

    await page.goto('/');
    await expect(tab(page).getByRole('listitem').first()).toBeVisible();
  });

  test('introduces no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/plan');
    await runSimulation(page);

    await expect(proposal(page)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
