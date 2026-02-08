import { expect, test } from '@playwright/test';

test('shows local data durability controls beside backup and restore', async ({ page }) => {
  await page.goto('/history/data');

  await expect(page.getByRole('heading', { name: 'Local data protection' })).toBeVisible();
  await expect(page.getByText(/browser storage controls can reduce eviction risk/i)).toBeVisible();
});
