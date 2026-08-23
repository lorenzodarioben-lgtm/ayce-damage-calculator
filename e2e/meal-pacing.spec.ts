import { expect, test, type Page } from '@playwright/test';
import { horizontalOverflow } from './helpers';

/**
 * Seeds a session that started some minutes ago.
 *
 * The clock is derived from persisted instants rather than from a counter, so
 * a meal already in progress can be reproduced exactly by writing the moment it
 * began — which is also what proves a reload, a route change and a
 * backgrounded tab cannot lose the time.
 */
async function seedMealInProgress(page: Page, minutesAgo: number, durationMinutes: number) {
  await page.addInitScript(
    ([elapsed, duration]) => {
      const startedAt = new Date(Date.now() - (elapsed as number) * 60_000).toISOString();
      window.localStorage.setItem(
        'ayce-damage-calculator',
        JSON.stringify({
          version: 5,
          session: {
            restaurantName: 'Seoul Garden',
            pricePerDiner: 59.9,
            dinerCount: 1,
            pricingProfileId: 'australian-kbbq',
            plannedDurationMinutes: duration,
            items: [
              {
                id: 'beef-ribeye__standard__regular',
                foodId: 'beef-ribeye',
                quality: 'standard',
                plateSize: 'regular',
                quantity: 4,
              },
            ],
            lifecycle: { status: 'active', startedAt, pausedMs: 0 },
          },
        }),
      );
    },
    [minutesAgo, durationMinutes],
  );
}

/** The pacing panel, so its controls are never confused with the tab's own. */
function clock(page: Page) {
  return page.getByRole('region', { name: 'Meal clock' });
}

function progress(page: Page) {
  return page.getByRole('progressbar', { name: 'Meal window progress' });
}

test.describe('the meal clock', () => {
  test('offers a window without forcing one, and books a preset', async ({ page }) => {
    await page.goto('/live');

    const lengths = clock(page).getByRole('group', { name: 'Meal length' });
    await expect(lengths.getByRole('button', { name: 'No limit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText(/no time limit set/i)).toBeVisible();

    await lengths.getByRole('button', { name: '90 min' }).click();

    await expect(lengths.getByRole('button', { name: '90 min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(progress(page)).toHaveAttribute('aria-valuenow', '0');
    // Booking a window is a plan, not a meal: nothing has started.
    await expect(clock(page).getByText('Not started', { exact: true })).toBeVisible();
  });

  test('accepts a custom window inside the validated range', async ({ page }) => {
    await page.goto('/live');

    await clock(page).getByRole('button', { name: 'Custom' }).click();
    const field = page.getByLabel('Custom length in minutes');
    await field.fill('45');
    await page.getByRole('button', { name: 'Set length' }).click();

    await expect(page.getByText('45 minutes booked')).toBeVisible();
  });

  test('starts running from the first plate and survives a reload', async ({ page }) => {
    await page.goto('/live');
    await clock(page).getByRole('button', { name: '60 min' }).click();

    await page.getByRole('button', { name: 'Add a cut' }).click();
    await page.getByRole('button', { name: /^Ribeye\b/ }).click();
    await page.getByRole('button', { name: 'Add to quick log' }).click();

    await expect(clock(page).getByText('Running', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause meal' })).toBeVisible();

    await page.reload();

    await expect(clock(page).getByText('Running', { exact: true })).toBeVisible();
    await expect(clock(page).getByRole('button', { name: '60 min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('pauses and resumes without losing the meal', async ({ page }) => {
    await seedMealInProgress(page, 20, 90);
    await page.goto('/live');

    await page.getByRole('button', { name: 'Pause meal' }).click();
    await expect(clock(page).getByText('Paused', { exact: true })).toBeVisible();
    const paused = await progress(page).getAttribute('aria-valuetext');

    // A paused clock stays exactly where it was, however long the tab is open.
    await page.waitForTimeout(1500);
    expect(await progress(page).getAttribute('aria-valuetext')).toBe(paused);

    await page.getByRole('button', { name: 'Resume meal' }).click();
    await expect(clock(page).getByText('Running', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Add one plate of Ribeye/ })).toBeVisible();
  });

  test('reads the clock from the recorded start after a route change', async ({ page }) => {
    await seedMealInProgress(page, 45, 90);
    await page.goto('/live');

    await expect(progress(page)).toHaveAttribute('aria-valuetext', /45 minutes elapsed/);

    await page.getByRole('link', { name: 'Calculator' }).first().click();
    await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
    await page.goBack();

    await expect(progress(page)).toHaveAttribute('aria-valuetext', /45 minutes elapsed/);
  });

  test('projects from a settled meal and states that it is an estimate', async ({ page }) => {
    await seedMealInProgress(page, 45, 90);
    await page.goto('/live');

    await expect(clock(page).getByText('Projected recovery')).toBeVisible();
    await expect(page.getByText('Too early')).toHaveCount(0);
    await expect(page.getByText(/not promises/i)).toBeVisible();
  });

  test('finishes the meal and freezes the clock', async ({ page }) => {
    await seedMealInProgress(page, 45, 90);
    await page.goto('/live');

    await page.getByRole('button', { name: 'Finish meal' }).click();

    await expect(clock(page).getByText('Finished', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finish meal' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Resume meal' })).toHaveCount(0);
  });

  test('says the window is over rather than counting past it', async ({ page }) => {
    await seedMealInProgress(page, 120, 90);
    await page.goto('/live');

    await expect(progress(page)).toHaveAttribute('aria-valuenow', '100');
    await expect(page.getByText(/booked window is over/i).first()).toBeVisible();
  });

  test('introduces no horizontal overflow at 320px', async ({ page }) => {
    await seedMealInProgress(page, 45, 90);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/live');

    await expect(progress(page)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
