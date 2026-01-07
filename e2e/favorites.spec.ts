import { expect, test, type Page } from '@playwright/test';
import { openCalculator, selectCategory, tab } from './helpers';

/** Configures a cut in the builder without committing it to the tab. */
async function configure(
  page: Page,
  food: string,
  options: { quality?: string; plateSize?: string } = {},
) {
  await page.getByRole('button', { name: new RegExp(`^${food}\\b`) }).click();
  for (const label of [options.quality, options.plateSize].filter(Boolean)) {
    const radio = page.getByRole('radio', { name: new RegExp(`^${label}\\b`) });
    await radio.locator('..').click();
    await expect(radio).toBeChecked();
  }
}

test.describe('Saved orders', () => {
  test('start with an explanatory empty state', async ({ page }) => {
    await openCalculator(page);

    await expect(
      page.getByText(/No saved orders yet. Use the star beside a configured cut/),
    ).toBeVisible();
  });

  test('save a configured cut and add it back in one tap', async ({ page }) => {
    await openCalculator(page);
    await configure(page, 'Ribeye', { quality: 'Premium', plateSize: 'Large' });

    await page
      .getByRole('button', { name: 'Save Ribeye · Premium · Large as a quick order' })
      .click();

    const quickAdd = page.getByRole('button', {
      name: 'Add one plate of Ribeye · Premium · Large',
    });
    await expect(quickAdd).toBeVisible();

    await quickAdd.click();

    // 220 g x $52/kg x 1.35 = $15.44, so the saved grade and portion were used.
    const line = tab(page).getByRole('listitem').filter({ hasText: 'Ribeye' });
    await expect(line.getByText('$15.44')).toBeVisible();
    await expect(line.getByText('Premium · Large')).toBeVisible();
  });

  test('never save the same order twice', async ({ page }) => {
    await openCalculator(page);
    await configure(page, 'Ribeye', { quality: 'Premium', plateSize: 'Large' });

    const star = page.getByRole('button', {
      name: 'Save Ribeye · Premium · Large as a quick order',
    });
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');

    // Pressing again unsaves rather than adding a second copy.
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await star.click();

    await expect(
      page.getByRole('button', { name: 'Add one plate of Ribeye · Premium · Large' }),
    ).toHaveCount(1);
  });

  test('survive a reload', async ({ page }) => {
    await openCalculator(page);
    await configure(page, 'Ribeye', { quality: 'Premium', plateSize: 'Large' });
    await page
      .getByRole('button', { name: 'Save Ribeye · Premium · Large as a quick order' })
      .click();

    await page.reload();

    await expect(
      page.getByRole('button', { name: 'Add one plate of Ribeye · Premium · Large' }),
    ).toBeVisible();
  });

  test('can be removed from the strip', async ({ page }) => {
    await openCalculator(page);
    await configure(page, 'Ribeye', { quality: 'Premium', plateSize: 'Large' });
    await page
      .getByRole('button', { name: 'Save Ribeye · Premium · Large as a quick order' })
      .click();

    await page
      .getByRole('listitem')
      .filter({ hasText: 'Ribeye' })
      .getByRole('button', { name: 'Remove Ribeye · Premium · Large from saved orders' })
      .click();

    await expect(page.getByText(/No saved orders yet/)).toBeVisible();
  });

  test('are available in live mode', async ({ page }) => {
    await openCalculator(page);
    await selectCategory(page, 'Pork');
    await configure(page, 'Pork Belly', { plateSize: 'Large' });
    await page
      .getByRole('button', { name: 'Save Pork Belly · Standard · Large as a quick order' })
      .click();

    await page.goto('/live');

    const quickAdd = page.getByRole('button', {
      name: 'Add one plate of Pork Belly · Standard · Large',
    });
    await expect(quickAdd).toBeVisible();

    await quickAdd.click();

    await expect(page.getByText('1 plate · 0.22 kg')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Add one plate of Pork Belly, Standard, Large/ }),
    ).toBeVisible();
  });
});
