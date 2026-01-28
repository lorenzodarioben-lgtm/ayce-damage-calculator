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

/**
 * Files a record written under an older schema, directly into IndexedDB.
 *
 * A meal from before the ledger existed cannot be produced through the UI any
 * more, and it is exactly the case the replay has to handle honestly, so it is
 * seeded at the storage layer instead.
 */
async function seedLegacyRecord(page: Page) {
  await page.evaluate(
    ([dbName, storeName]) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName as string, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName as string)) {
            const store = db.createObjectStore(storeName as string, { keyPath: 'id' });
            store.createIndex('byCreatedAt', 'createdAt');
          }
        };
        request.onerror = () => reject(new Error('database unavailable'));
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(storeName as string, 'readwrite');
          tx.objectStore(storeName as string).put({
            id: 'legacy-record',
            version: 6,
            createdAt: '2026-01-05T12:00:00.000Z',
            restaurantName: 'Old Seoul',
            pricePerDiner: 59.9,
            dinerCount: 1,
            pricingProfile: {
              id: 'australian-kbbq',
              name: 'Australian KBBQ estimates',
              money: { currency: 'AUD', locale: 'en-AU' },
              overrides: {},
              builtIn: true,
            },
            customFoods: [],
            note: '',
            items: [
              {
                id: 'beef-ribeye__standard__regular',
                foodId: 'beef-ribeye',
                quality: 'standard',
                plateSize: 'regular',
                quantity: 6,
              },
            ],
            fingerprint: 'legacy',
            snapshot: {
              totalAdmission: 59.9,
              totalRetailValue: 48.36,
              totalRestaurantCost: 20,
              totalPlates: 6,
              totalWeightKg: 0.93,
              retailRecoveryPercent: 80.7,
              nutrition: { calories: 0, protein: 0, fat: 0, carbs: 0 },
              verdictId: 'respectable-restraint',
              achievementIds: [],
            },
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(new Error('write failed'));
        };
      }),
    [DB_NAME, STORE],
  );
}

/** Records a short meal with a few plates and files it. */
async function fileTimedMeal(page: Page) {
  await openCalculator(page);
  await setRestaurantName(page, 'Seoul Garden');
  await addPlate(page, 'Ribeye');
  await addPlate(page, 'Short Rib');
  await addPlate(page, 'Pork Belly', { category: 'Pork' });
  await calculateDamage(page);
  await page.getByRole('button', { name: 'Save to history' }).click();
  await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();

  await page.goto('/history');
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Seoul Garden' })
    .getByRole('link', { name: 'Seoul Garden' })
    .click();
  await expect(page.getByRole('heading', { name: 'Filed Damage Report' })).toBeVisible();
}

function replay(page: Page) {
  return page.getByRole('region', { name: 'The replay' });
}

test.describe('The meal replay', () => {
  test('replays a meal that was recorded with a timeline', async ({ page }) => {
    await fileTimedMeal(page);

    await expect(replay(page)).toBeVisible();
    await expect(replay(page).getByRole('img')).toBeVisible();
    await expect(replay(page).getByText('First plate')).toBeVisible();
    await expect(replay(page).getByLabel('Scrub the meal')).toBeVisible();
  });

  test('leaves the ordinary filed report exactly as it was', async ({ page }) => {
    await fileTimedMeal(page);

    await expect(page.getByRole('heading', { name: 'Filed Damage Report' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What was recorded' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Order this again' })).toBeVisible();
  });

  test('scrubs back through the meal from the keyboard', async ({ page }) => {
    await fileTimedMeal(page);

    const scrubber = replay(page).getByLabel('Scrub the meal');
    await expect(scrubber).toHaveAttribute('aria-valuetext', /3 plates/);

    await scrubber.focus();
    await page.keyboard.press('Home');

    await expect(scrubber).toHaveAttribute('aria-valuetext', /1 plate,/);
  });

  test('plays and restarts without losing the record', async ({ page }) => {
    await fileTimedMeal(page);

    await replay(page).getByRole('button', { name: 'Play replay' }).click();
    await expect(replay(page).getByRole('button', { name: 'Pause replay' })).toBeVisible();

    await replay(page).getByRole('button', { name: 'Pause replay' }).click();
    await replay(page).getByRole('button', { name: 'Restart' }).click();

    await expect(replay(page).getByLabel('Scrub the meal')).toHaveAttribute(
      'aria-valuetext',
      /1 plate,/,
    );
  });

  test('offers the timeline as figures for anything that cannot read the chart', async ({
    page,
  }) => {
    await fileTimedMeal(page);

    await replay(page).getByText('Show the timeline as figures').click();

    const table = replay(page).getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Recovery' })).toBeVisible();
  });

  test('says plainly that an older record was never timed', async ({ page }) => {
    await page.goto('/history');
    await seedLegacyRecord(page);
    await page.goto('/history/legacy-record');

    await expect(page.getByRole('heading', { name: 'Filed Damage Report' })).toBeVisible();
    await expect(page.getByText(/detailed timing was not recorded/i)).toBeVisible();
    await expect(page.getByLabel('Scrub the meal')).toHaveCount(0);
    // The record itself is untouched and completely readable.
    await expect(page.getByRole('heading', { name: 'What was recorded' })).toBeVisible();
  });

  test('introduces no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await fileTimedMeal(page);

    await expect(replay(page)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
