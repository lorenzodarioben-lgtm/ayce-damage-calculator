import { expect, test } from '@playwright/test';
import { addPlate } from './helpers';

test.describe('Session undo and redo', () => {
  test('replays plate edits from the builder controls and keyboard shortcuts', async ({ page }) => {
    await page.goto('/');
    await addPlate(page, 'Ribeye');

    const controls = page.getByRole('group', { name: 'Meal edit history' });
    await expect(controls.getByRole('button', { name: 'Undo meal edit' })).toBeEnabled();

    await controls.getByRole('button', { name: 'Undo meal edit' }).click();
    await expect(page.getByText('No damage yet')).toBeVisible();

    await page.keyboard.press('Control+Shift+Z');
    await expect(page.getByRole('region', { name: 'Your tab' }).getByText('Ribeye')).toBeVisible();
  });
});
