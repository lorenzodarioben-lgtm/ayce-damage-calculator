import { expect, test } from '@playwright/test';
import { addPlate, tab } from './helpers';

test('does not silently replace a meal edited in another browser tab', async ({ browser }) => {
  // Tabs in one browser context share localStorage, which lets this exercise
  // the native storage event rather than a mocked synchronization channel.
  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();

  await first.goto('http://127.0.0.1:3100/');
  await second.goto('http://127.0.0.1:3100/');
  await expect(first.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
  await expect(second.getByRole('heading', { name: 'Build the meal' })).toBeVisible();

  await addPlate(first, 'Ribeye');
  await expect(tab(second).getByText('Ribeye')).toBeVisible();

  await addPlate(second, 'Pork Belly', { category: 'Pork' });
  await expect(first.getByRole('alert', { name: 'Another tab changed this meal.' })).toBeVisible();
  await expect(tab(first).getByText('Ribeye')).toBeVisible();
  await expect(tab(first).getByText('Pork Belly')).not.toBeVisible();

  await first.getByRole('button', { name: 'Load newer meal' }).click();
  await expect(tab(first).getByText('Pork Belly')).toBeVisible();

  await context.close();
});
