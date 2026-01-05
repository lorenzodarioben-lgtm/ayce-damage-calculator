import { expect, test, type Page } from '@playwright/test';
import { addPlate, calculateDamage, setRestaurantName } from './helpers';

/** Records and files one session, so there is something to back up. */
async function fileSession(page: Page, restaurant: string, food: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
  await setRestaurantName(page, restaurant);
  await addPlate(page, food);
  await calculateDamage(page);
  await page.getByRole('button', { name: 'Save to history' }).click();
  await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();
}

/** Exports a backup and returns the file's contents as text. */
async function downloadBackup(page: Page): Promise<{ filename: string; body: string }> {
  await page.goto('/history/data');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download backup' }).click(),
  ]);

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return { filename: download.suggestedFilename(), body: Buffer.concat(chunks).toString('utf8') };
}

/**
 * The restore section's own error message. Scoped, because Next.js keeps a
 * route announcer with the same role at the root of every page.
 */
function restoreAlert(page: Page) {
  return page.getByRole('region', { name: 'Restore' }).getByRole('alert');
}

/** Feeds a backup file into the restore control on a given page. */
async function chooseBackupFile(page: Page, body: string) {
  await page.getByLabel('Backup file').setInputFiles({
    name: 'ayce-damage-backup-2026-08-16.json',
    mimeType: 'application/json',
    buffer: Buffer.from(body, 'utf8'),
  });
}

test.describe('Backup', () => {
  test('exports a dated file containing the filed sessions', async ({ page }) => {
    await fileSession(page, 'Seoul Garden', 'Ribeye');

    const { filename, body } = await downloadBackup(page);

    expect(filename).toMatch(/^ayce-damage-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = JSON.parse(body);
    expect(parsed.format).toBe('ayce-damage-backup');
    expect(parsed.history).toHaveLength(1);
    expect(parsed.history[0].restaurantName).toBe('Seoul Garden');

    await expect(page.getByText(/Exported 1 sessions/)).toBeVisible();
  });

  test('is reachable from an empty file, which is when it is needed', async ({ page }) => {
    await page.goto('/history');

    await page.getByRole('link', { name: 'Restore a backup' }).click();
    await expect(page.getByRole('heading', { name: 'Custody of records' })).toBeVisible();
  });
});

test.describe('Restore', () => {
  test('previews a file before writing anything', async ({ page, browser }) => {
    await fileSession(page, 'Seoul Garden', 'Ribeye');
    const { body } = await downloadBackup(page);

    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await freshPage.goto('/history/data');
    await chooseBackupFile(freshPage, body);

    await expect(freshPage.getByText('1 filed sessions')).toBeVisible();
    await expect(freshPage.getByRole('button', { name: 'Merge into this device' })).toBeVisible();

    // Still untouched until a mode is chosen.
    await freshPage.goto('/history');
    await expect(freshPage.getByText('No prior incidents on record.')).toBeVisible();
    await fresh.close();
  });

  test('merges a backup onto a device that has none of it', async ({ page, browser }) => {
    await fileSession(page, 'Seoul Garden', 'Ribeye');
    const { body } = await downloadBackup(page);

    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await freshPage.goto('/history/data');
    await chooseBackupFile(freshPage, body);
    await freshPage.getByRole('button', { name: 'Merge into this device' }).click();

    await expect(freshPage.getByText(/Added 1 sessions/)).toBeVisible();

    await freshPage.goto('/history');
    await expect(freshPage.getByText('Seoul Garden')).toBeVisible();
    await fresh.close();
  });

  test('keeps what is already here when merging', async ({ page }) => {
    await fileSession(page, 'Seoul Garden', 'Ribeye');
    const { body } = await downloadBackup(page);

    // Re-importing the same file onto the same device must add nothing.
    await chooseBackupFile(page, body);
    await page.getByRole('button', { name: 'Merge into this device' }).click();

    await expect(page.getByText(/Added 0 sessions/)).toBeVisible();
    await page.goto('/history');
    await expect(page.getByRole('listitem')).toHaveCount(1);
  });

  test('asks before replacing everything, and can be backed out of', async ({ page }) => {
    await fileSession(page, 'Seoul Garden', 'Ribeye');
    const { body } = await downloadBackup(page);

    await chooseBackupFile(page, body);
    await page.getByRole('button', { name: 'Replace everything' }).click();

    await expect(page.getByText(/permanently discarded/)).toBeVisible();
    await page.getByRole('button', { name: 'Keep what I have' }).click();

    await page.goto('/history');
    await expect(page.getByRole('listitem')).toHaveCount(1);
  });

  test('refuses a file that is not a backup', async ({ page }) => {
    await page.goto('/history/data');
    await chooseBackupFile(page, JSON.stringify({ hello: 'world' }));

    await expect(restoreAlert(page)).toHaveText('That file is not an AYCE damage backup.');
    await expect(page.getByRole('button', { name: 'Merge into this device' })).toBeHidden();
  });

  test('refuses a file that is not readable JSON', async ({ page }) => {
    await page.goto('/history/data');
    await chooseBackupFile(page, 'this is definitely not json');

    await expect(restoreAlert(page)).toHaveText('That file is not readable JSON.');
  });

  test('refuses a backup from a newer version of the app', async ({ page }) => {
    await page.goto('/history/data');
    await chooseBackupFile(
      page,
      JSON.stringify({ format: 'ayce-damage-backup', version: 99, history: [], favorites: [] }),
    );

    await expect(restoreAlert(page)).toHaveText(
      'That backup was written by a newer version of the calculator.',
    );
  });
});
