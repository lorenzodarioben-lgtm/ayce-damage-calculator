import { expect, test, type Page } from '@playwright/test';
import { addPlate, openCalculator, sessionSetup, setRestaurantName, tab } from './helpers';

interface StoredEnvelope {
  version: number;
  session: {
    items: Array<{ foodId: string; quantity: number }>;
    events?: Array<{ type: string; source: string; at: string; seq: number; quantity?: number }>;
    lifecycle?: { status: string; startedAt?: string; pausedMs: number };
  };
}

/**
 * The ledger has no screen of its own yet — it is the durable record every
 * later timing feature reads. What is worth asserting from the browser is that
 * it is actually written, that it survives a reload, and that it stays in step
 * with the tab it describes.
 */
async function storedSession(page: Page): Promise<StoredEnvelope | null> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('ayce-damage-calculator');
    return raw ? (JSON.parse(raw) as StoredEnvelope) : null;
  });
}

test.describe('the meal event ledger', () => {
  test('records plates from the builder against the moment they were added', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');

    const stored = await storedSession(page);
    expect(stored?.version).toBe(5);

    const events = stored?.session.events ?? [];
    expect(events.map((event) => event.type)).toEqual(['meal-started', 'plates-added']);
    expect(events.every((event) => event.source === 'builder')).toBe(true);
    expect(Date.parse(events[1]?.at ?? '')).toBeGreaterThan(0);
    expect(stored?.session.lifecycle?.status).toBe('active');
  });

  test('does not start the meal merely because the setup was edited', async ({ page }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');

    const setup = sessionSetup(page);
    await setup.getByLabel('Diner name').fill('Lorenzo');
    await setup.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(setup.getByRole('textbox', { name: 'Diner 1 name' })).toHaveValue('Lorenzo');

    const stored = await storedSession(page);
    expect(stored?.session.lifecycle).toBeUndefined();
    // The roster change is still recorded; it simply is not evidence of eating.
    expect((stored?.session.events ?? []).map((event) => event.type)).toEqual(['diner-joined']);
  });

  test('survives a reload with the tab it describes', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await addPlate(page, 'Pork Belly', { category: 'Pork' });

    const before = await storedSession(page);
    expect((before?.session.events ?? []).length).toBe(3);

    await page.reload();
    await expect(tab(page).getByText('Ribeye')).toBeVisible();

    const after = await storedSession(page);
    expect(after?.session.events).toEqual(before?.session.events);
    expect(after?.session.lifecycle).toEqual(before?.session.lifecycle);
  });

  test('records live-mode taps as their own source and keeps one rising sequence', async ({
    page,
  }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');

    await page.goto('/live');
    await page.getByRole('button', { name: /^Add one plate of Ribeye/ }).click();
    await expect(page.getByText('2 plates · 0.31 kg')).toBeVisible();

    const events = (await storedSession(page))?.session.events ?? [];
    expect(events.at(-1)).toMatchObject({ type: 'plates-added', source: 'live' });
    expect(events.map((event) => event.seq)).toEqual(
      events.map((_unused, index) => index).slice(0, events.length),
    );
  });

  test('a reset leaves nothing behind to replay', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');

    await page.getByRole('button', { name: 'Reset session' }).click();
    await page.getByRole('button', { name: 'Reset everything' }).click();

    expect(await storedSession(page)).toBeNull();
  });
});
