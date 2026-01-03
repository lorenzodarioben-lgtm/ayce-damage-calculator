import { expect, test, type Page } from '@playwright/test';
import { addPlate, calculateDamage, openCalculator, setRestaurantName } from './helpers';

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
