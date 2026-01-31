import { expect, test, type Page } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  horizontalOverflow,
  openCalculator,
  sessionSetup,
  setRestaurantName,
  tab,
} from './helpers';

/**
 * The diner hub, from the browser.
 *
 * The unit suites already prove the arithmetic. What is only true in a real
 * browser is the chain the arithmetic depends on: a name typed into a roster
 * becomes a saved profile with an opaque id, a filed report becomes that
 * person's record, and the page recomputes from that history rather than from
 * any second store of its own. The honesty claims are asserted the same way — a
 * meal filed without a roster stays unattributed, and removing somebody leaves
 * the rosters already on file untouched.
 */

/** Saves a person to the on-device directory and puts them on this table. */
async function saveDiner(page: Page, name: string) {
  const setup = sessionSetup(page);
  await setup.getByLabel('Diner name').fill(name);
  await setup.getByRole('button', { name: 'Add & save' }).click();
  await expect(setup.getByRole('textbox', { name: 'Diner 1 name' })).toHaveValue(name);
}

/** Empties the roster, so what follows is filed as one shared tab. */
async function clearRoster(page: Page) {
  await page.getByRole('button', { name: 'Clear roster' }).first().click();
  await expect(page.getByRole('heading', { name: 'Clear this table roster?' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear roster' }).last().click();
  await expect(page.getByRole('textbox', { name: 'Diner 1 name' })).toBeHidden();
}

/** Points the builder at one person, so the next plate is explicitly theirs. */
async function logPlatesTo(page: Page, name: string) {
  const target = page
    .getByRole('group', { name: 'Plate attribution' })
    .getByRole('button', { name });
  await target.click();
  await expect(target).toHaveAttribute('aria-pressed', 'true');
}

async function fileReport(page: Page) {
  await calculateDamage(page);
  await page.getByRole('button', { name: 'Save to history' }).click();
  await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();
}

/** One filed meal: a roster of one, a plate named to them and a plate shared. */
async function fileMealWith(page: Page, name: string) {
  await openCalculator(page);
  await setRestaurantName(page, 'Seoul Garden');
  await saveDiner(page, name);
  await logPlatesTo(page, name);
  await addPlate(page, 'Ribeye');
  await logPlatesTo(page, 'Table');
  await addPlate(page, 'Pork Belly', { category: 'Pork' });
  await fileReport(page);
}

test.describe('The diner hub', () => {
  test('states its empty case without inventing anybody', async ({ page }) => {
    await page.goto('/diners');

    await expect(page.getByRole('heading', { name: 'Known diners' })).toBeVisible();
    await expect(page.getByText('Nobody on file.')).toBeVisible();
    await expect(page.getByText(/Table Mode is optional/i)).toBeVisible();
  });

  test('lists a person saved from a table roster and opens their page', async ({ page }) => {
    await openCalculator(page);
    await saveDiner(page, 'Lorenzo');

    await page.goto('/diners');
    await page.getByRole('link', { name: /Lorenzo/ }).click();

    await expect(page.getByRole('heading', { name: 'Lorenzo', level: 1 })).toBeVisible();
    await expect(page.getByText(/No meals filed with them yet/)).toBeVisible();
  });

  test('counts a filed meal against the person on its roster', async ({ page }) => {
    await fileMealWith(page, 'Lorenzo');

    await page.goto('/diners/diner-lorenzo');

    await expect(page.getByText('Meals', { exact: true })).toBeVisible();
    await expect(page.getByText('Their plates')).toBeVisible();
    await expect(page.getByText('Most ordered')).toBeVisible();
    await expect(page.getByText('Recent meals')).toBeVisible();
    // The meal is reachable from here as the record it actually is.
    await expect(page.getByRole('link', { name: /Seoul Garden/ })).toBeVisible();
  });

  test('keeps an explicit plate apart from an estimated share', async ({ page }) => {
    await fileMealWith(page, 'Lorenzo');

    await page.goto('/diners/diner-lorenzo');

    await expect(page.getByText('How those plates were counted')).toBeVisible();
    await expect(page.getByText('Explicitly theirs')).toBeVisible();
    await expect(page.getByText('Estimated share')).toBeVisible();
    // The second figure is named as an assumption rather than presented as data.
    await expect(page.getByText(/an assumption rather than a measurement/)).toBeVisible();
  });

  test('assigns a meal filed without a roster to nobody', async ({ page }) => {
    await openCalculator(page);
    await saveDiner(page, 'Lorenzo');

    // The profile stays saved; the meal that follows simply has no roster.
    await clearRoster(page);
    await setRestaurantName(page, 'Seoul Garden');
    await addPlate(page, 'Ribeye');
    await fileReport(page);

    await page.goto('/diners/diner-lorenzo');
    await expect(page.getByText(/No meals filed with them yet/)).toBeVisible();
    await expect(page.getByText(/nobody said who was there/)).toBeVisible();
  });

  test('reports a name on a filed roster that is not saved here', async ({ page }) => {
    await openCalculator(page);
    const setup = sessionSetup(page);
    await setup.getByLabel('Diner name').fill('Guest');
    // Added to this table only, never to the directory.
    await setup.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(setup.getByRole('textbox', { name: 'Diner 1 name' })).toHaveValue('Guest');
    await addPlate(page, 'Ribeye');
    await fileReport(page);

    await page.goto('/diners');
    await expect(page.getByText(/on a filed roster without being saved here/)).toBeVisible();
    await expect(page.getByText(/nothing is added back to this list/i)).toBeVisible();
  });

  test('puts someone on the current meal only after a confirmation', async ({ page }) => {
    await openCalculator(page);
    await saveDiner(page, 'Lorenzo');
    await clearRoster(page);

    await page.goto('/diners/diner-lorenzo');
    await page.getByRole('button', { name: 'Add to the current meal' }).click();
    await expect(
      page.getByRole('heading', { name: 'Add them to the current meal?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Add them' }).click();

    await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
    await expect(sessionSetup(page).getByRole('textbox', { name: 'Diner 1 name' })).toHaveValue(
      'Lorenzo',
    );
  });

  test('leaves the meal in progress alone when the confirmation is declined', async ({ page }) => {
    await openCalculator(page);
    await saveDiner(page, 'Lorenzo');
    await clearRoster(page);
    await addPlate(page, 'Ribeye');

    await page.goto('/diners/diner-lorenzo');
    await page.getByRole('button', { name: 'Add to the current meal' }).click();
    await page.getByRole('button', { name: 'Not now' }).click();

    await page.goto('/');
    await expect(tab(page).getByText('Ribeye')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Diner 1 name' })).toBeHidden();
  });

  test('removing a profile leaves the rosters already filed exactly as they were', async ({
    page,
  }) => {
    await fileMealWith(page, 'Lorenzo');

    await page.goto('/diners/diner-lorenzo');
    await page.getByRole('button', { name: 'Remove this person' }).click();
    await expect(page.getByRole('heading', { name: 'Remove this person?' })).toBeVisible();
    await expect(
      page.getByText(/no history is rewritten and no plate is reassigned/),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Remove them' }).click();

    await expect(page.getByRole('heading', { name: 'Known diners' })).toBeVisible();
    await expect(page.getByText('Nobody on file.')).toBeVisible();
    // The filed meal is untouched, and still names them on its own roster.
    await expect(page.getByText(/on a filed roster without being saved here/)).toBeVisible();

    await page.goto('/history');
    await expect(page.getByRole('link', { name: /Seoul Garden/ })).toBeVisible();
  });

  test('explains a person this device does not have', async ({ page }) => {
    await page.goto('/diners/diner-nobody');

    await expect(page.getByText('Nobody by that name here.')).toBeVisible();
    await page.getByRole('link', { name: 'Back to the people' }).click();
    await expect(page.getByRole('heading', { name: 'Known diners' })).toBeVisible();
  });

  test('is reachable from the primary navigation', async ({ page }) => {
    await openCalculator(page);

    const menu = page.getByRole('button', { name: 'Open the menu' });
    if (await menu.isVisible()) {
      await menu.click();
    }
    await page.getByRole('link', { name: 'Diners' }).click();

    await expect(page.getByRole('heading', { name: 'Known diners' })).toBeVisible();
  });

  test('introduces no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await fileMealWith(page, 'Lorenzo');

    await page.goto('/diners');
    await expect(page.getByRole('link', { name: /Lorenzo/ })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    await page.goto('/diners/diner-lorenzo');
    await expect(page.getByRole('heading', { name: 'Lorenzo', level: 1 })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
