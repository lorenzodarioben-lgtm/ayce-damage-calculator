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

async function saveRestaurant(page: Page, name: string, price: number) {
  await setRestaurantName(page, name);
  await setPricePerDiner(page, price);
  await page.getByRole('button', { name: 'Save this setup' }).click();
}

async function fileVisitAt(page: Page, name: string, price: number) {
  await openCalculator(page);
  await saveRestaurant(page, name, price);
  // Applying the saved place is what links the meal to it.
  await page.getByRole('button', { name: new RegExp(`^Apply preset ${name}`) }).click();
  await addPlate(page, 'Ribeye');
  await calculateDamage(page);
  await page.getByRole('button', { name: 'Save to history' }).click();
  await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();
}

/** Files a meal whose typed name matches a saved place without being linked to it. */
async function fileUnlinkedVisit(page: Page, name: string, price: number) {
  await openCalculator(page);
  await saveRestaurant(page, name, price);
  // Typed by hand, never applied, so the meal is not linked to the place.
  await setRestaurantName(page, name);
  await addPlate(page, 'Ribeye');
  await calculateDamage(page);
  await page.getByRole('button', { name: 'Save to history' }).click();
  await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();
}

async function linkCandidateVisits(page: Page) {
  await page.getByRole('button', { name: 'Link these visits' }).click();
  await expect(page.getByRole('heading', { name: 'Link these visits?' })).toBeVisible();
  await page.getByRole('button', { name: 'Link them' }).click();
  await expect(page.getByText(/linked to/)).toBeVisible();
}

test.describe('The restaurant hub', () => {
  test('states its empty case and stays honest about what it is', async ({ page }) => {
    await page.goto('/restaurants');

    await expect(page.getByRole('heading', { name: 'Known establishments' })).toBeVisible();
    await expect(page.getByText('No places on file.')).toBeVisible();
    await expect(page.getByText(/no bundled restaurant directory/i)).toBeVisible();
  });

  test('lists a saved place and opens its detail', async ({ page }) => {
    await openCalculator(page);
    await saveRestaurant(page, 'Friday KBBQ', 42);

    await page.goto('/restaurants');
    await page.getByRole('link', { name: /Friday KBBQ/ }).click();

    await expect(page.getByRole('heading', { name: 'Friday KBBQ', level: 1 })).toBeVisible();
    await expect(page.getByText(/No visits filed here yet/)).toBeVisible();
  });

  test('counts a filed visit against the place it was started from', async ({ page }) => {
    await fileVisitAt(page, 'Friday KBBQ', 42);

    await page.goto('/restaurants/friday-kbbq');

    await expect(page.getByText('Visits', { exact: true })).toBeVisible();
    await expect(page.getByText('Average recovery')).toBeVisible();
    await expect(page.getByText('Most ordered here')).toBeVisible();
    await expect(page.getByText('Recent visits')).toBeVisible();
    // The visit is counted, and its figures come from the record itself.
    await expect(page.getByText('Average admission')).toBeVisible();
  });

  test('does not claim a visit merely because the names match', async ({ page }) => {
    await fileUnlinkedVisit(page, 'Friday KBBQ', 42);

    await page.goto('/restaurants/friday-kbbq');

    await expect(page.getByText(/No visits filed here yet/)).toBeVisible();
    await expect(page.getByText(/Older visits that might belong here/)).toBeVisible();
    await expect(page.getByText(/A matching name is not proof/)).toBeVisible();
  });

  test('links an older visit only when the diner says so', async ({ page }) => {
    await fileUnlinkedVisit(page, 'Friday KBBQ', 42);

    await page.goto('/restaurants/friday-kbbq');
    await expect(page.getByText(/No visits filed here yet/)).toBeVisible();
    await linkCandidateVisits(page);

    // The place recounts itself as soon as the link is written, with no reload
    // and no instruction to perform one.
    await expect(page.getByText('Recent visits')).toBeVisible();
    await expect(page.getByText('Average recovery')).toBeVisible();
    await expect(page.getByText(/No visits filed here yet/)).toBeHidden();
    await expect(page.getByText(/Older visits that might belong here/)).toBeHidden();
  });

  test('has written the link before it says it has', async ({ page }) => {
    await fileUnlinkedVisit(page, 'Friday KBBQ', 42);

    await page.goto('/restaurants/friday-kbbq');
    await linkCandidateVisits(page);
    await expect(page.getByText('Recent visits')).toBeVisible();

    // Reloading immediately is the whole point: the announcement is a report of
    // a committed transaction, so what comes back has to agree with it.
    await page.reload();
    await expect(page.getByText('Recent visits')).toBeVisible();
    await expect(page.getByText('Visits', { exact: true })).toBeVisible();
  });

  test('closes the linking workflow only once the write is done', async ({ page }) => {
    await fileUnlinkedVisit(page, 'Friday KBBQ', 42);

    await page.goto('/restaurants/friday-kbbq');
    await page.getByRole('button', { name: 'Link these visits' }).click();
    const heading = page.getByRole('heading', { name: 'Link these visits?' });
    await expect(heading).toBeVisible();

    await page.getByRole('button', { name: 'Link them' }).click();
    // Whichever side of the write this lands on, the dialog is never both open
    // and still offering the action again.
    await expect(heading).toBeHidden();
    await expect(page.getByText('Recent visits')).toBeVisible();
  });

  test('starts a meal from a saved place, linked and priced', async ({ page }) => {
    await openCalculator(page);
    await saveRestaurant(page, 'Friday KBBQ', 42);

    await page.goto('/restaurants/friday-kbbq');
    await page.getByRole('button', { name: 'Start a meal here' }).click();

    await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
    await expect(page.getByLabel('Restaurant')).toHaveValue('Friday KBBQ');
    await expect(page.getByLabel('Price per diner')).toHaveValue('42.00');
  });

  test('asks before replacing a meal in progress', async ({ page }) => {
    await openCalculator(page);
    await saveRestaurant(page, 'Friday KBBQ', 42);
    await addPlate(page, 'Ribeye');

    await page.goto('/restaurants/friday-kbbq');
    await page.getByRole('button', { name: 'Start a meal here' }).click();

    await expect(
      page.getByRole('heading', { name: 'Replace the meal in progress?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Keep my tab' }).click();

    await page.goto('/');
    await expect(tab(page).getByText('Ribeye')).toBeVisible();
  });

  test('deleting a place leaves its filed visits alone', async ({ page }) => {
    await fileVisitAt(page, 'Friday KBBQ', 42);

    await page.goto('/restaurants/friday-kbbq');
    await page.getByRole('button', { name: 'Delete this place' }).click();
    await expect(page.getByRole('heading', { name: 'Delete this place?' })).toBeVisible();
    await expect(page.getByText(/stays in your history exactly as it was recorded/)).toBeVisible();
    await page.getByRole('button', { name: 'Delete the place' }).click();

    await expect(page.getByText('No places on file.')).toBeVisible();

    // The record itself is untouched, with the name it was filed under.
    await page.goto('/history');
    await expect(page.getByRole('link', { name: 'Friday KBBQ' })).toBeVisible();
  });

  test('is reachable from the primary navigation', async ({ page }) => {
    await openCalculator(page);

    const menu = page.getByRole('button', { name: 'Open the menu' });
    if (await menu.isVisible()) {
      await menu.click();
    }
    await page.getByRole('link', { name: 'Places' }).click();

    await expect(page.getByRole('heading', { name: 'Known establishments' })).toBeVisible();
  });

  test('introduces no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await fileVisitAt(page, 'Friday KBBQ', 42);

    await page.goto('/restaurants/friday-kbbq');
    await expect(page.getByRole('heading', { name: 'Friday KBBQ', level: 1 })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
