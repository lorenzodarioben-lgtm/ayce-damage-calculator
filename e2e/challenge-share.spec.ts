import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  horizontalOverflow,
  openCalculator,
  sessionSetup,
  setPricePerDiner,
  setRestaurantName,
  tab,
  decodeTokenDocument,
} from './helpers';
import { CHALLENGE_TOKEN_VERSION } from '../src/lib/challengeShare';

/** Files one meal, so a comparison has two sides to work with. */
async function fileMeal(page: Page, name: string, plates: number, price: number) {
  await openCalculator(page);
  await setRestaurantName(page, name);
  await setPricePerDiner(page, price);
  for (let index = 0; index < plates; index += 1) {
    await addPlate(page, 'Ribeye');
  }
  await calculateDamage(page);
  await page.getByRole('button', { name: 'Save to history' }).click();
  await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();
  // Clear the tab so the next meal starts clean.
  await page.getByRole('button', { name: 'Edit meal' }).click();
  await page.getByRole('button', { name: 'Reset session' }).click();
  await page.getByRole('button', { name: 'Reset everything' }).click();
  await expect(tab(page).getByText('No damage yet')).toBeVisible();
}

async function copyChallengeLink(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Copy challenge link' }).click();
  await expect(page.getByText('Challenge link copied.')).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

/** A recipient with a context of their own, so nothing local is shared. */
async function openAsRecipient(browser: Browser, link: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  return page;
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('Sharing a damage challenge', () => {
  test('produces a link that reproduces the comparison for someone else', async ({
    page,
    browser,
  }) => {
    await fileMeal(page, 'Seoul Garden', 2, 40);
    await fileMeal(page, 'Ember House', 5, 40);

    await page.goto('/history/compare');
    const link = await copyChallengeLink(page);
    expect(link).toContain(`/challenge/${CHALLENGE_TOKEN_VERSION}.`);

    const recipient = await openAsRecipient(browser, link);

    await expect(recipient.getByText('A shared damage challenge')).toBeVisible();
    await expect(recipient.getByRole('heading', { name: 'Head to head' })).toBeVisible();
    await expect(recipient.getByText('Seoul Garden')).toBeVisible();
    await expect(recipient.getByText('Ember House')).toBeVisible();
    await recipient.close();
  });

  test('states differences in percentage points on both sides of the link', async ({
    page,
    browser,
  }) => {
    await fileMeal(page, 'Seoul Garden', 2, 40);
    await fileMeal(page, 'Ember House', 5, 40);

    await page.goto('/history/compare');
    await expect(page.getByText(/percentage points?/).first()).toBeVisible();

    const recipient = await openAsRecipient(browser, await copyChallengeLink(page));
    await expect(recipient.getByText(/percentage points?/).first()).toBeVisible();
    await recipient.close();
  });

  test('does not give the recipient the sender’s history', async ({ page, browser }) => {
    await fileMeal(page, 'Seoul Garden', 2, 40);
    await fileMeal(page, 'Ember House', 5, 40);

    await page.goto('/history/compare');
    const recipient = await openAsRecipient(browser, await copyChallengeLink(page));

    await recipient.goto('/history');
    await expect(recipient.getByText('No prior incidents on record.')).toBeVisible();
    await recipient.close();
  });

  test('carries no diner names', async ({ page, browser }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await sessionSetup(page).getByLabel('Diner name').fill('Lorenzo');
    await sessionSetup(page).getByRole('button', { name: 'Add', exact: true }).click();
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);
    await page.getByRole('button', { name: 'Save to history' }).click();
    await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit meal' }).click();
    await page.getByRole('button', { name: 'Reset session' }).click();
    await page.getByRole('button', { name: 'Reset everything' }).click();

    await fileMeal(page, 'Ember House', 3, 40);

    await page.goto('/history/compare');
    const link = await copyChallengeLink(page);
    const body = decodeTokenDocument(link, 'challenge');
    expect(body).not.toContain('Lorenzo');

    const recipient = await openAsRecipient(browser, link);
    await expect(recipient.getByText('Lorenzo')).toHaveCount(0);
    await recipient.close();
  });

  test('is read-only: opening one changes nothing on the recipient’s device', async ({
    page,
    browser,
  }) => {
    await fileMeal(page, 'Seoul Garden', 2, 40);
    await fileMeal(page, 'Ember House', 5, 40);

    await page.goto('/history/compare');
    const link = await copyChallengeLink(page);

    const context = await browser.newContext();
    const recipient = await context.newPage();
    await recipient.goto('/');
    await addPlate(recipient, 'Pork Belly', { category: 'Pork' });
    await expect(tab(recipient).getByText('Pork Belly')).toBeVisible();

    await recipient.goto(link);
    await expect(recipient.getByRole('heading', { name: 'Head to head' })).toBeVisible();

    await recipient.goto('/');
    await expect(tab(recipient).getByText('Pork Belly')).toBeVisible();
    await expect(tab(recipient).getByRole('listitem')).toHaveCount(1);
    await recipient.close();
  });

  test('describes itself for a social preview', async ({ page }) => {
    await fileMeal(page, 'Seoul Garden', 2, 40);
    await fileMeal(page, 'Ember House', 5, 40);

    await page.goto('/history/compare');
    const link = await copyChallengeLink(page);
    await page.goto(link);

    await expect(page).toHaveTitle(/vs .*AYCE Damage Challenge/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /vs/);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      'content',
      /percentage point/,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex, nofollow/,
    );
  });

  test('generates an Open Graph image for a readable challenge', async ({ page, request }) => {
    await fileMeal(page, 'Seoul Garden', 2, 40);
    await fileMeal(page, 'Ember House', 5, 40);

    await page.goto('/history/compare');
    const link = await copyChallengeLink(page);
    const token = link.split('/challenge/')[1]!;

    const response = await request.get(`/challenge/${token}/opengraph-image`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  });

  test('explains an unreadable challenge rather than failing', async ({ page }) => {
    await page.goto('/challenge/1.not-a-real-token');

    await expect(
      page.getByRole('heading', { name: 'This challenge cannot be read.' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Run your own damage report' })).toBeVisible();
  });

  test('introduces no horizontal overflow at 320px', async ({ page, browser }) => {
    await fileMeal(page, 'Seoul Garden', 2, 40);
    await fileMeal(page, 'Ember House', 5, 40);

    await page.goto('/history/compare');
    const link = await copyChallengeLink(page);

    const context = await browser.newContext({ viewport: { width: 320, height: 720 } });
    const recipient = await context.newPage();
    await recipient.goto(link);

    await expect(recipient.getByRole('heading', { name: 'Head to head' })).toBeVisible();
    expect(await horizontalOverflow(recipient)).toBeLessThanOrEqual(1);
    await recipient.close();
  });
});
