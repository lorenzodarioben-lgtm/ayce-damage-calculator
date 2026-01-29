import { expect, test, type Page } from '@playwright/test';
import { addPlate, calculateDamage, horizontalOverflow, setRestaurantName } from './helpers';

const PASSWORD = 'a-perfectly-ordinary-passphrase';

/** Records and files one session, so there is something worth encrypting. */
async function fileSession(page: Page, restaurant: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
  await setRestaurantName(page, restaurant);
  await addPlate(page, 'Ribeye');
  await calculateDamage(page);
  await page.getByRole('button', { name: 'Save to history' }).click();
  await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();
}

/** Runs the encrypted export and returns the downloaded file. */
async function downloadVault(
  page: Page,
  password = PASSWORD,
): Promise<{ filename: string; body: string }> {
  await page.goto('/history/data');
  await page.getByRole('button', { name: 'Download encrypted backup' }).click();

  await expect(page.getByRole('heading', { name: 'Choose a password' })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Encrypt and download' }).click(),
  ]);

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return { filename: download.suggestedFilename(), body: Buffer.concat(chunks).toString('utf8') };
}

async function chooseFile(page: Page, body: string, name = 'ayce-damage-backup.vault.json') {
  await page.getByLabel('Backup file').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(body, 'utf8'),
  });
}

test.describe('Encrypted backup', () => {
  test('exports a sealed file that reveals nothing about the meal', async ({ page }) => {
    await fileSession(page, 'Seoul Garden');

    const { filename, body } = await downloadVault(page);

    expect(filename).toMatch(/^ayce-damage-backup-\d{4}-\d{2}-\d{2}\.vault\.json$/);
    const envelope = JSON.parse(body);
    expect(envelope.format).toBe('ayce-damage-vault');
    expect(envelope.kdf).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256' });
    expect(envelope.cipher).toMatchObject({ name: 'AES-GCM' });

    // Nothing of the payload, and nothing of the password, is in the file.
    expect(body).not.toContain('Seoul Garden');
    expect(body).not.toContain(PASSWORD);

    await expect(page.getByText(/Encrypted 1 sessions/)).toBeVisible();
    await expect(page.getByText(/cannot be recovered/).first()).toBeVisible();
  });

  test('leaves the ordinary unencrypted export available', async ({ page }) => {
    await fileSession(page, 'Seoul Garden');
    await page.goto('/history/data');

    await expect(page.getByRole('button', { name: 'Download backup' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download spreadsheet' })).toBeVisible();
  });

  test('asks for the password only when the file needs one', async ({ page }) => {
    await fileSession(page, 'Seoul Garden');
    const { body } = await downloadVault(page);

    // A plain backup goes straight to the preview.
    await page.goto('/history/data');
    const plain = JSON.stringify({
      format: 'ayce-damage-backup',
      version: 1,
      exportedAt: '2026-08-16T12:00:00.000Z',
      history: [],
      favorites: [{ id: 'f', foodId: 'beef-ribeye', quality: 'standard', plateSize: 'regular' }],
      configuration: {},
    });
    await chooseFile(page, plain, 'plain.json');
    await expect(page.getByText('In this file')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'This backup is encrypted' })).toHaveCount(0);

    // An encrypted one asks first.
    await page.reload();
    await chooseFile(page, body);
    await expect(page.getByRole('heading', { name: 'This backup is encrypted' })).toBeVisible();
    await expect(page.getByText('In this file')).toHaveCount(0);
  });

  test('opens with the right password and previews before writing anything', async ({ page }) => {
    await fileSession(page, 'Seoul Garden');
    const { body } = await downloadVault(page);

    await page.goto('/history/data');
    await chooseFile(page, body);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Open the backup' }).click();

    await expect(page.getByText('In this file')).toBeVisible();
    await expect(page.getByText('1 filed sessions')).toBeVisible();
    // Still nothing applied: merging and replacing are both still offered.
    await expect(page.getByRole('button', { name: 'Merge into this device' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Replace everything' })).toBeVisible();
  });

  test('restores the sessions once merged', async ({ page, browser }) => {
    await fileSession(page, 'Seoul Garden');
    const { body } = await downloadVault(page);

    // A clean device, so the restore is the only source of the record.
    const context = await browser.newContext();
    const fresh = await context.newPage();
    await fresh.goto('/history');
    await expect(fresh.getByText('No prior incidents on record.')).toBeVisible();

    await fresh.goto('/history/data');
    await chooseFile(fresh, body);
    await fresh.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await fresh.getByRole('button', { name: 'Open the backup' }).click();
    await fresh.getByRole('button', { name: 'Merge into this device' }).click();
    await expect(fresh.getByText(/Added 1 sessions/)).toBeVisible();

    await fresh.goto('/history');
    await expect(fresh.getByRole('link', { name: 'Seoul Garden' })).toBeVisible();
    await fresh.close();
  });

  test('refuses a wrong password without importing anything', async ({ page }) => {
    await fileSession(page, 'Seoul Garden');
    const { body } = await downloadVault(page);

    await page.goto('/history/data');
    await chooseFile(page, body);
    await page.getByLabel('Password', { exact: true }).fill('not-the-right-password');
    await page.getByRole('button', { name: 'Open the backup' }).click();

    await expect(page.getByText(/did not open this backup/)).toBeVisible();
    await expect(page.getByText('In this file')).toHaveCount(0);
    // The dialog stays open so the password can be corrected.
    await expect(page.getByRole('heading', { name: 'This backup is encrypted' })).toBeVisible();
  });

  test('refuses a tampered file the same way it refuses a wrong password', async ({ page }) => {
    await fileSession(page, 'Seoul Garden');
    const { body } = await downloadVault(page);

    const envelope = JSON.parse(body);
    const bytes = Buffer.from(envelope.ciphertext, 'base64');
    bytes[0] = bytes[0]! ^ 0xff;
    envelope.ciphertext = bytes.toString('base64');

    await page.goto('/history/data');
    await chooseFile(page, JSON.stringify(envelope));
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Open the backup' }).click();

    await expect(page.getByText(/did not open this backup/)).toBeVisible();
  });

  test('refuses a damaged envelope with its own message', async ({ page }) => {
    await fileSession(page, 'Seoul Garden');
    const { body } = await downloadVault(page);

    const envelope = JSON.parse(body);
    envelope.kdf.iterations = 1;

    await page.goto('/history/data');
    await chooseFile(page, JSON.stringify(envelope));
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Open the backup' }).click();

    await expect(page.getByText(/incomplete or damaged/)).toBeVisible();
  });

  test('refuses a truncated file', async ({ page }) => {
    await fileSession(page, 'Seoul Garden');
    const { body } = await downloadVault(page);

    await page.goto('/history/data');
    await chooseFile(page, body.slice(0, Math.floor(body.length / 2)));
    // A truncated file is not readable JSON at all, so it never asks for a password.
    await expect(page.getByRole('heading', { name: 'This backup is encrypted' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Restore' }).getByRole('alert')).toBeVisible();
  });

  test('will not seal a backup behind a password that is too short', async ({ page }) => {
    await fileSession(page, 'Seoul Garden');
    await page.goto('/history/data');
    await page.getByRole('button', { name: 'Download encrypted backup' }).click();

    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Confirm password').fill('short');

    await expect(page.getByRole('button', { name: 'Encrypt and download' })).toBeDisabled();
  });

  test('will not seal a backup when the two passwords disagree', async ({ page }) => {
    await fileSession(page, 'Seoul Garden');
    await page.goto('/history/data');
    await page.getByRole('button', { name: 'Download encrypted backup' }).click();

    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password').fill(`${PASSWORD}-nearly`);
    await page.getByRole('button', { name: 'Encrypt and download' }).click();

    await expect(page.getByText('Those two passwords are not the same.')).toBeVisible();
  });

  test('introduces no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/history/data');
    await page.getByRole('button', { name: 'Download encrypted backup' }).click();

    await expect(page.getByRole('heading', { name: 'Choose a password' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
