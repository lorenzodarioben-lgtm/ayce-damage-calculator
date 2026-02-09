import { expect, test } from '@playwright/test';

/**
 * The narrow-viewport menu, driven by keyboard in a real browser.
 *
 * The component suite proves the wiring, but not the part that only a real
 * engine can settle: a native modal dialog fires `cancel` on Escape, and this
 * menu must not take that key away from it.
 */
test.use({ viewport: { width: 390, height: 844 } });

test.describe('Mobile navigation', () => {
  test('Escape closes the menu and hands focus back to its toggle', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByRole('button', { name: 'Open the menu' });
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Close the menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await page.keyboard.press('Escape');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  test('a dialog opened from the menu keeps Escape for itself', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Open the menu' }).click();
    const menu = page.getByRole('navigation', { name: 'Primary' }).last();
    await menu.getByRole('button', { name: 'Methodology' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    // The menu is still the thing the visitor was in the middle of using.
    await expect(page.getByRole('button', { name: 'Close the menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  test('the page behind the open menu does not scroll, and is released again', async ({ page }) => {
    await page.goto('/');

    const bodyOverflow = () => page.evaluate(() => getComputedStyle(document.body).overflowY);

    await page.getByRole('button', { name: 'Open the menu' }).click();
    expect(await bodyOverflow()).toBe('hidden');

    await page.getByRole('button', { name: 'Close the menu' }).click();
    expect(await bodyOverflow()).not.toBe('hidden');
  });
});
