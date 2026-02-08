import { expect, test, type Page } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  horizontalOverflow,
  openCalculator,
  setRestaurantName,
} from './helpers';

const DB_NAME = 'ayce-damage';
const STORE = 'sessions';

/** Counts rows straight from IndexedDB, bypassing any UI reporting. */
async function storedSessionCount(page: Page): Promise<number> {
  return page.evaluate(
    ([dbName, storeName]) =>
      new Promise<number>((resolve) => {
        const request = indexedDB.open(dbName as string);
        request.onerror = () => resolve(-1);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName as string)) {
            resolve(0);
            return;
          }
          const count = db
            .transaction(storeName as string)
            .objectStore(storeName as string)
            .count();
          count.onsuccess = () => resolve(count.result);
          count.onerror = () => resolve(-1);
        };
      }),
    [DB_NAME, STORE],
  );
}

test.describe('Saving a session to history', () => {
  test('files a completed report and confirms it', async ({ page }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    await page.getByRole('button', { name: 'Save to history' }).click();

    await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();
    await expect(page.getByText('Session filed. The record stays on this device.')).toBeVisible();
    expect(await storedSessionCount(page)).toBe(1);
  });

  test('does not stack duplicates when the same meal is filed twice', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    await page.getByRole('button', { name: 'Save to history' }).click();
    await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();

    // Back to the builder and straight to the report again, meal unchanged.
    await page.getByRole('button', { name: 'Back to meal' }).click();
    await calculateDamage(page);
    await page.getByRole('button', { name: 'Save to history' }).click();

    await expect(page.getByText('Existing record for this meal updated.')).toBeVisible();
    expect(await storedSessionCount(page)).toBe(1);
  });

  test('offers to file again once the meal has changed', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    await page.getByRole('button', { name: 'Save to history' }).click();
    await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();

    await page.getByRole('button', { name: 'Back to meal' }).click();
    await addPlate(page, 'Brisket');
    await calculateDamage(page);

    // A different meal is a different session, so the control resets.
    await expect(page.getByRole('button', { name: 'Save to history' })).toBeEnabled();
    await page.getByRole('button', { name: 'Save to history' }).click();

    await expect(page.getByText('Session filed. The record stays on this device.')).toBeVisible();
    expect(await storedSessionCount(page)).toBe(2);
  });
});

/** Reaches History from wherever the current viewport puts the navigation. */
async function goToHistory(page: Page) {
  const menu = page.getByRole('button', { name: 'Open the menu' });
  if (await menu.isVisible()) {
    await menu.click();
  }
  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'The file', level: 1 })).toBeVisible();
}

test.describe('The history page', () => {
  test('is reachable from the calculator and states its empty case', async ({ page }) => {
    await openCalculator(page);
    await goToHistory(page);

    await expect(page.getByText('No prior incidents on record.')).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('lists a filed session and opens it read-only', async ({ page }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await addPlate(page, 'Ribeye', { quality: 'Premium', plateSize: 'Large' });
    await calculateDamage(page);
    await page.getByRole('button', { name: 'Save to history' }).click();
    await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();

    await goToHistory(page);

    const entry = page.getByRole('listitem').filter({ hasText: 'Seoul Garden' });
    await expect(entry).toBeVisible();
    await entry.getByRole('link', { name: 'Seoul Garden' }).click();

    await expect(page.getByRole('heading', { name: 'Filed Damage Report' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What was recorded' })).toBeVisible();
    // 220 g x $52/kg x 1.35 premium = $15.44, recomputed from the stored meal.
    // Scoped to the line itself: with one plate on the tab, the breakdown's
    // total carries the same figure.
    await expect(
      page
        .getByRole('region', { name: 'What was recorded' })
        .getByRole('listitem')
        .getByText('$15.44'),
    ).toBeVisible();
    // Read-only: none of the editing affordances belong here.
    await expect(page.getByRole('button', { name: 'Save to history' })).toBeHidden();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('adds a local tag from record detail and shows it in the file', async ({ page }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);
    await page.getByRole('button', { name: 'Save to history' }).click();

    await goToHistory(page);
    await page.getByRole('link', { name: 'Seoul Garden' }).click();
    await page.getByLabel('New tag').fill('  Friends  ');
    await page.getByRole('button', { name: 'Add tag' }).click();
    await expect(
      page.getByRole('list', { name: 'Current tags' }).getByText('friends'),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Back to the file' }).first().click();
    await expect(page.getByRole('listitem').getByText('friends')).toBeVisible();
  });

  test('deletes a record after confirmation', async ({ page }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);
    await page.getByRole('button', { name: 'Save to history' }).click();
    await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();

    await goToHistory(page);
    await page.getByRole('button', { name: /^Delete the record from Seoul Garden/ }).click();
    await page.getByRole('button', { name: 'Delete record' }).click();

    await expect(page.getByText('No prior incidents on record.')).toBeVisible();
    expect(await storedSessionCount(page)).toBe(0);
  });

  test('explains a record id that is not on this device', async ({ page }) => {
    await page.goto('/history/not-a-real-record');

    await expect(page.getByText('No such record.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to the file' }).first()).toBeVisible();
  });
});
