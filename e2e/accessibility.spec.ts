import { expect, test, type Page } from '@playwright/test';
import { addPlate, calculateDamage, horizontalOverflow, openCalculator } from './helpers';

/** Every page reachable without first recording a meal. */
const ROUTES = [
  '/',
  '/live',
  '/history',
  '/history/compare',
  '/history/data',
  '/stats',
  '/share/1.gj4.1.bg-2-2-6.U2VvdWwgR2FyZGVu',
] as const;

/**
 * Heading levels in document order, counting only headings that are actually
 * rendered. Closed dialogs and the print-only receipt sit in the DOM but are
 * `display: none`, so they are absent from the accessibility tree and must not
 * count towards the outline a screen reader is given.
 */
async function headingOutline(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .filter((node) => node.checkVisibility())
      .map((node) => Number(node.tagName.slice(1))),
  );
}

test.describe('Page structure', () => {
  for (const route of ROUTES) {
    test(`${route} has one main heading and the expected landmarks`, async ({ page }) => {
      await page.goto(route);

      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByRole('banner')).toHaveCount(1);
      await expect(page.getByRole('contentinfo')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
    });

    test(`${route} starts its headings at level one and skips no level`, async ({ page }) => {
      await page.goto(route);
      const levels = await headingOutline(page);

      expect(levels[0]).toBe(1);
      for (let index = 1; index < levels.length; index += 1) {
        const step = (levels[index] ?? 0) - (levels[index - 1] ?? 0);
        expect(step, `heading ${index} jumps ${step} levels`).toBeLessThanOrEqual(1);
      }
    });

    test(`${route} does not scroll sideways`, async ({ page }) => {
      await page.goto(route);

      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('Skip link', () => {
  test('is the first thing a keyboard reaches, and it works', async ({ page }) => {
    await openCalculator(page);

    await page.keyboard.press('Tab');

    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    // Visually hidden until focused, so it never intrudes on the design.
    await expect(skip).toBeInViewport();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main-content$/);
  });

  test('points at a target that exists on every page', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page.locator('#main-content')).toHaveCount(1);
    }
  });
});

test.describe('Keyboard operation', () => {
  test('the report is reachable and returnable without a mouse', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    const back = page.getByRole('button', { name: 'Back to meal' });
    await back.focus();
    await expect(back).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
  });

  test('grade and portion radios show focus on their visible card', async ({ page }) => {
    await openCalculator(page);
    await page.getByRole('button', { name: /^Ribeye\b/ }).click();

    const premium = page.getByRole('radio', { name: /^Premium\b/ });
    // Tabbed to rather than focused programmatically: `:focus-visible` only
    // engages for keyboard interaction, which is exactly the case under test.
    await page.getByRole('radio', { name: /^House\b/ }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(premium).toBeFocused();

    // The input itself is visually hidden; the outline belongs to the label.
    const outlineWidth = await premium.evaluate((node) => {
      const label = node.closest('label');
      return label ? getComputedStyle(label).outlineWidth : '0px';
    });
    expect(outlineWidth).not.toBe('0px');
  });
});

test.describe('Resilience', () => {
  test('a very long restaurant name cannot break the report layout', async ({ page }) => {
    await openCalculator(page);
    await page.getByLabel('Restaurant').fill('A'.repeat(200));
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test('an extreme meal still produces finite figures', async ({ page }) => {
    await openCalculator(page);
    await page.getByLabel('Price per diner').fill('1');
    await page.getByLabel('Price per diner').blur();
    await addPlate(page, 'Wagyu Short Rib', { quality: 'Premium', plateSize: 'Large' });

    const tab = page.getByRole('region', { name: 'Your tab' });
    for (let index = 0; index < 5; index += 1) {
      await tab.getByRole('button', { name: /^Add one plate of Wagyu Short Rib/ }).click();
    }
    await calculateDamage(page);

    const text = await page.getByRole('main').innerText();
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('Infinity');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
