import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  decodeTokenDocument,
  horizontalOverflow,
  openCalculator,
  sessionSetup,
  setPricePerDiner,
  setRestaurantName,
  tab,
} from './helpers';
import { SHARE_TOKEN_VERSION } from '../src/lib/shareLink';

/** Copies the share link from the report and reads it back out of the clipboard. */
async function copyShareLink(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Copy share link' }).click();
  await expect(page.getByText(/Share link copied/)).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

/**
 * Opens a link the way a recipient really would.
 *
 * A second page in the same context would share the sender's local storage,
 * which is exactly the thing these tests need to rule out — so the recipient
 * gets a context of their own.
 */
async function openAsRecipient(browser: Browser, link: string): Promise<Page> {
  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();
  await recipientPage.goto(link);
  return recipientPage;
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('What a shared report says about the people at the table', () => {
  test('carries no name, and no id derived from one', async ({ page }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await setPricePerDiner(page, 50);

    // The path that matters: "Add & save" gives the person an id slugged from
    // their name, which used to travel inside the token in full.
    const setup = sessionSetup(page);
    await setup.getByLabel('Diner name').fill('Lorenzo');
    await setup.getByRole('button', { name: 'Add & save' }).click();
    await expect(setup.getByRole('textbox', { name: 'Diner 1 name' })).toHaveValue('Lorenzo');

    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    const body = decodeTokenDocument(await copyShareLink(page), 'share');
    expect(body).not.toContain('Lorenzo');
    // The check the old test could not make: `diner-lorenzo` is the name.
    expect(body.toLowerCase()).not.toContain('lorenzo');
    expect(body).toContain('d1');
  });

  test('still shows the recipient a table, under positions', async ({ page, browser }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await setPricePerDiner(page, 50);

    const setup = sessionSetup(page);
    await setup.getByLabel('Diner name').fill('Lorenzo');
    await setup.getByRole('button', { name: 'Add & save' }).click();
    await expect(setup.getByRole('textbox', { name: 'Diner 1 name' })).toHaveValue('Lorenzo');

    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    const recipient = await openAsRecipient(browser, await copyShareLink(page));
    await expect(recipient.getByText('Lorenzo')).toHaveCount(0);
    await recipient.close();
  });
});

test.describe('Sharing a report', () => {
  test('produces a link that reproduces the report for someone else', async ({ page, browser }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await setPricePerDiner(page, 20);
    await addPlate(page, 'Ribeye', { quality: 'Premium', plateSize: 'Large' });
    await calculateDamage(page);

    const link = await copyShareLink(page);
    expect(link).toContain(`/share/${SHARE_TOKEN_VERSION}.`);

    const recipientPage = await openAsRecipient(browser, link);

    await expect(recipientPage.getByText('A shared damage report')).toBeVisible();
    await expect(
      recipientPage.getByRole('region', { name: 'AYCE Damage Report' }).getByText('Seoul Garden'),
    ).toBeVisible();
    // $52/kg x 0.22 kg x 1.35 = $15.44 against $20 admission = 77%.
    await expect(recipientPage.getByText('$15.44').first()).toBeVisible();
    await expect(recipientPage.getByText('77%').first()).toBeVisible();

    expect(await horizontalOverflow(recipientPage)).toBeLessThanOrEqual(1);
    await recipientPage.close();
  });

  test('does not give the recipient the sender’s meal', async ({ page, browser }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);
    const link = await copyShareLink(page);

    const recipientPage = await openAsRecipient(browser, link);
    await expect(recipientPage.getByText('A shared damage report')).toBeVisible();

    // The shared page is read-only, and the visitor's own tab stays empty.
    await expect(recipientPage.getByRole('button', { name: 'Save to history' })).toBeHidden();
    await expect(recipientPage.getByRole('button', { name: 'Back to meal' })).toBeHidden();

    await recipientPage.getByRole('link', { name: 'Run your own damage report' }).click();
    await expect(recipientPage.getByText('No damage yet')).toBeVisible();
    await recipientPage.close();
  });

  test('carries the achievements the meal earned', async ({ page, browser }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 20);
    await addPlate(page, 'Ribeye', { plateSize: 'Large' });
    await addPlate(page, 'Pork Belly', { category: 'Pork', plateSize: 'Large' });
    await addPlate(page, 'Chicken Thigh', { category: 'Chicken', plateSize: 'Large' });
    await addPlate(page, 'Prawns', { category: 'Seafood', plateSize: 'Large' });
    await calculateDamage(page);

    const link = await copyShareLink(page);
    const recipientPage = await openAsRecipient(browser, link);

    await expect(
      recipientPage.getByRole('region', { name: 'Commendations' }).getByText('Four Corners'),
    ).toBeVisible();
    await recipientPage.close();
  });

  test('keeps the sender’s own session untouched', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);
    await copyShareLink(page);

    await page.getByRole('button', { name: 'Back to meal' }).click();
    await expect(tab(page).getByText('Ribeye')).toBeVisible();
  });
});

/** Reads a meta tag's content by property or name. */
async function metaContent(page: Page, selector: string): Promise<string | null> {
  return page.locator(`head > meta[${selector}]`).first().getAttribute('content');
}

test.describe('Social preview', () => {
  // 6 large premium Wagyu Short Rib at $214.24 admission for 4 diners.
  const TOKEN = '1.gj4.1.bg-2-2-6.U2VvdWwgR2FyZGVu';

  test('describes the shared report in its metadata', async ({ page }) => {
    await page.goto(`/share/${TOKEN}`);

    await expect(page).toHaveTitle(/House Favourite — AYCE Damage Report/);
    expect(await metaContent(page, 'property="og:title"')).toContain('House Favourite');

    const description = await metaContent(page, 'property="og:description"');
    expect(description).toContain('6 plates');
    expect(description).toContain('Seoul Garden');
    expect(description).toContain('68% recovered');

    expect(await metaContent(page, 'name="twitter:card"')).toBe('summary_large_image');
  });

  test('points at a generated image of the right shape', async ({ page, request }) => {
    await page.goto(`/share/${TOKEN}`);

    const imageUrl = await metaContent(page, 'property="og:image"');
    expect(imageUrl).toContain(`/share/${TOKEN}/opengraph-image`);
    expect(await metaContent(page, 'property="og:image:width"')).toBe('1200');
    expect(await metaContent(page, 'property="og:image:height"')).toBe('630');

    // Requested by path: the advertised URL is absolute against metadataBase,
    // which points at the deployment rather than at this test server.
    const image = await request.get(new URL(imageUrl!).pathname);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
    // A blank or errored render would be far smaller than this.
    expect((await image.body()).byteLength).toBeGreaterThan(10_000);
  });

  test('keeps a shared report out of search results', async ({ page }) => {
    await page.goto(`/share/${TOKEN}`);

    expect(await metaContent(page, 'name="robots"')).toContain('noindex');
  });

  test('falls back to the app description for an unreadable token', async ({ page, request }) => {
    await page.goto('/share/completely-invalid');

    await expect(page).toHaveTitle('AYCE Damage Calculator');
    expect(await metaContent(page, 'property="og:description"')).toContain('beat the buffet');

    // The image still renders rather than 500ing on a bad token.
    const image = await request.get('/share/completely-invalid/opengraph-image');
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
  });
});

test.describe('Unreadable share links', () => {
  test('explains a token that cannot be decoded', async ({ page }) => {
    await page.goto('/share/completely-invalid');

    await expect(page.getByText('This report cannot be read.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Run your own damage report' })).toBeVisible();
  });

  test('explains a token from an unknown version', async ({ page }) => {
    await page.goto('/share/9.abc.1.bc-0-1-2.');

    await expect(page.getByText('This report cannot be read.')).toBeVisible();
  });

  test('explains a token naming a cut that does not exist', async ({ page }) => {
    await page.goto('/share/1.abc.1.zz-0-1-2.');

    await expect(page.getByText('This report cannot be read.')).toBeVisible();
  });

  test('renders a hostile restaurant name as inert text', async ({ page }) => {
    // "<img src=x onerror=alert(1)>" as URL-safe base64.
    const name = Buffer.from('<img src=x onerror=alert(1)>')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const errors: string[] = [];
    page.on('dialog', (dialog) => {
      errors.push(dialog.message());
      void dialog.dismiss();
    });

    await page.goto(`/share/1.abc.1.bc-0-1-2.${name}`);

    await expect(page.getByText('<img src=x onerror=alert(1)>').first()).toBeVisible();
    expect(errors).toEqual([]);
    expect(await page.locator('img[src="x"]').count()).toBe(0);
  });
});
