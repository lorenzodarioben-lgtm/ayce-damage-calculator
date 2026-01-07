import { expect, test } from '@playwright/test';
import { addPlate, calculateDamage, openCalculator, report, tab } from './helpers';

/**
 * Marks the live document so a full page load can be detected. If the browser
 * re-fetched the page, the property is gone.
 */
async function markDocument(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__ayceDocumentMark = 'kept';
  });
}

async function documentWasKept(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as Record<string, unknown>).__ayceDocumentMark === 'kept',
  );
}

test.describe('Browser history navigation', () => {
  test('Back returns to the builder and Forward returns to the report', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await markDocument(page);

    await calculateDamage(page);
    await expect(page).toHaveURL(/\?stage=report$/);

    await page.goBack();
    await expect(report(page)).toBeHidden();
    await expect(tab(page).getByText('Ribeye')).toBeVisible();

    await page.goForward();
    await expect(report(page)).toBeVisible();
    await expect(page).toHaveURL(/\?stage=report$/);

    // The whole journey must have stayed on the same document.
    expect(await documentWasKept(page)).toBe(true);
  });

  test('the in-app Back control also unwinds the history entry', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    await page.getByRole('button', { name: 'Back to meal' }).click();

    await expect(page).not.toHaveURL(/stage=report/);
    await expect(report(page)).toBeHidden();

    // Forward is still available because the control unwound rather than pushed.
    await page.goForward();
    await expect(report(page)).toBeVisible();
  });

  test('editing the meal does not fill the history stack', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');

    const before = await page.evaluate(() => window.history.length);

    await addPlate(page, 'Brisket');
    await page.getByRole('button', { name: 'Add a diner' }).click();
    await tab(page)
      .getByRole('button', { name: /^Add one plate of Ribeye/ })
      .click();

    expect(await page.evaluate(() => window.history.length)).toBe(before);
  });

  test('a reload on the report URL comes back to the report', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    await page.reload();

    await expect(report(page)).toBeVisible();
    await expect(page).toHaveURL(/\?stage=report$/);
  });

  test('a report URL with no stored meal falls back to the builder', async ({ page }) => {
    await page.goto('/?stage=report');

    await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
    await expect(report(page)).toBeHidden();
    await expect(page).not.toHaveURL(/stage=report/);
  });
});
