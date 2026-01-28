import { expect, test, type Browser, type Page } from '@playwright/test';
import { horizontalOverflow, openCalculator, sessionSetup, setRestaurantName } from './helpers';

/** Adds one diner-authored food, which is what makes a menu worth sharing. */
async function addCustomFood(page: Page, name: string, retailPerKg: number) {
  await sessionSetup(page).getByRole('button', { name: 'Add food' }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Retail price per kg').fill(String(retailPerKg));
  await page.getByLabel('Restaurant cost per kg').fill(String(Math.round(retailPerKg / 2)));
  await page.getByRole('button', { name: 'Save to my menu' }).click();
  await expect(sessionSetup(page).getByText(name).first()).toBeVisible();
}

async function copyMenuLink(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Copy the menu link' }).click();
  await expect(page.getByText('Menu link copied.')).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

/**
 * Opens a link the way a recipient really would.
 *
 * A second page in the same context would share the sender's local storage,
 * which is exactly what these tests need to rule out.
 */
async function openAsRecipient(browser: Browser, link: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  return page;
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('Sharing a personal menu', () => {
  test('offers nothing to share until there is a menu', async ({ page }) => {
    await openCalculator(page);

    await expect(sessionSetup(page).getByText(/There is nothing to share yet/)).toBeVisible();
  });

  test('produces a link that reproduces the menu for someone else', async ({ page, browser }) => {
    await openCalculator(page);
    await addCustomFood(page, 'Cheese corn', 14);

    const link = await copyMenuLink(page);
    expect(link).toContain('/menu/1.');

    const recipient = await openAsRecipient(browser, link);

    await expect(recipient.getByText('A shared personal menu')).toBeVisible();
    await expect(recipient.getByText('Cheese corn').first()).toBeVisible();
    await expect(recipient.getByText(/Nothing has been saved to your device/)).toBeVisible();

    await recipient.close();
  });

  test('imports nothing until the recipient says so', async ({ page, browser }) => {
    await openCalculator(page);
    await addCustomFood(page, 'Cheese corn', 14);
    const link = await copyMenuLink(page);

    const recipient = await openAsRecipient(browser, link);
    const stored = () =>
      recipient.evaluate(() => window.localStorage.getItem('ayce-damage-custom-foods'));

    expect(await stored()).toBeNull();

    await recipient.getByRole('button', { name: 'Import this menu' }).click();
    await expect(recipient.getByText(/Saved\./)).toBeVisible();

    expect(await stored()).toContain('Cheese corn');
    await recipient.close();
  });

  test('an imported menu is usable in the recipient’s own calculator', async ({
    page,
    browser,
  }) => {
    await openCalculator(page);
    await addCustomFood(page, 'Cheese corn', 14);
    const link = await copyMenuLink(page);

    const recipient = await openAsRecipient(browser, link);
    await recipient.getByRole('button', { name: 'Import this menu' }).click();
    await recipient.getByRole('link', { name: 'Back to the calculator', exact: true }).click();

    await expect(recipient.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
    await expect(recipient.getByRole('button', { name: /^Cheese corn/ })).toBeVisible();
    await recipient.close();
  });

  test('never overwrites what the recipient already has', async ({ page, browser }) => {
    await openCalculator(page);
    await addCustomFood(page, 'Cheese corn', 14);
    const link = await copyMenuLink(page);

    const context = await browser.newContext();
    const recipient = await context.newPage();
    // The recipient already has a food of their own with the same name.
    await recipient.goto('/');
    await expect(recipient.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
    await addCustomFood(recipient, 'Cheese corn', 99);

    await recipient.goto(link);
    await expect(recipient.getByText(/Some names are already taken here/)).toBeVisible();
    await expect(recipient.getByText(/will be saved as separate entries/)).toBeVisible();

    await recipient.getByRole('button', { name: 'Import this menu' }).click();
    await recipient.goto('/');
    await expect(recipient.getByRole('button', { name: /^Cheese corn/ })).toHaveCount(2);

    await recipient.close();
  });

  test('carries a restaurant setup only when the sender ticks the box', async ({
    page,
    browser,
  }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await addCustomFood(page, 'Cheese corn', 14);

    const without = await openAsRecipient(browser, await copyMenuLink(page));
    await expect(without.getByText('The restaurant setup')).toHaveCount(0);
    await without.close();

    await page.getByLabel(/Include the restaurant setup/).check();
    const with_ = await openAsRecipient(browser, await copyMenuLink(page));
    await expect(with_.getByText('The restaurant setup')).toBeVisible();
    await expect(with_.getByText('Seoul Garden').first()).toBeVisible();
    await with_.close();
  });

  test('carries nothing but the menu', async ({ page, browser }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await sessionSetup(page).getByLabel('Diner name').fill('Lorenzo');
    await sessionSetup(page).getByRole('button', { name: 'Add', exact: true }).click();
    await addCustomFood(page, 'Cheese corn', 14);

    const link = await copyMenuLink(page);
    // The roster name is nowhere in the address, in any encoding.
    const body = Buffer.from(
      link.split('/menu/1.')[1]!.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf-8');
    expect(body).not.toContain('Lorenzo');

    const recipient = await openAsRecipient(browser, link);
    await expect(recipient.getByText('Lorenzo')).toHaveCount(0);
    await recipient.close();
  });

  test('offers a scannable code alongside the link', async ({ page }) => {
    await openCalculator(page);
    await addCustomFood(page, 'Cheese corn', 14);

    await page.getByRole('button', { name: 'Show a QR code' }).click();

    await expect(page.getByRole('img', { name: 'A scannable link to this menu' })).toBeVisible();
    // The copyable link is always there, code or no code.
    await expect(page.getByRole('button', { name: 'Copy the menu link' })).toBeVisible();
  });

  test('explains an unreadable link rather than failing', async ({ page }) => {
    await page.goto('/menu/1.not-a-real-token');

    await expect(page.getByRole('heading', { name: 'This menu cannot be read.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open the calculator' })).toBeVisible();
  });

  test('keeps a shared menu out of search results', async ({ page }) => {
    await page.goto('/menu/1.not-a-real-token');

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex, nofollow/,
    );
  });

  test('introduces no horizontal overflow at 320px', async ({ page, browser }) => {
    await openCalculator(page);
    await addCustomFood(page, 'Cheese corn', 14);
    const link = await copyMenuLink(page);

    const context = await browser.newContext({ viewport: { width: 320, height: 720 } });
    const recipient = await context.newPage();
    await recipient.goto(link);

    await expect(recipient.getByText('A shared personal menu')).toBeVisible();
    expect(await horizontalOverflow(recipient)).toBeLessThanOrEqual(1);
    await recipient.close();
  });
});
