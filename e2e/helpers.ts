import { expect, type Page } from '@playwright/test';

/**
 * Shared journey steps. Everything here addresses the page through roles and
 * accessible names, so a styling change cannot break the suite and a broken
 * accessible name will.
 */

export async function openCalculator(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
}

export function tab(page: Page) {
  return page.getByRole('region', { name: 'Your tab' });
}

export function sessionSetup(page: Page) {
  return page.getByRole('region', { name: 'Session setup' });
}

export async function setRestaurantName(page: Page, name: string) {
  await page.getByLabel('Restaurant').fill(name);
}

export async function setPricePerDiner(page: Page, price: number) {
  const field = page.getByLabel('Price per diner');
  await field.fill(String(price));
  await field.blur();
}

/**
 * Quality and plate size are native radios kept visually hidden, so the element
 * that actually receives the pointer is the wrapping label. Selecting the radio
 * by role and clicking its label keeps the query accessible while clicking what
 * a real user clicks.
 */
async function chooseOption(page: Page, optionLabel: string) {
  const radio = page.getByRole('radio', { name: new RegExp(`^${optionLabel}\\b`) });
  await radio.locator('..').click();
  await expect(radio).toBeChecked();
}

export type Category = 'Beef' | 'Pork' | 'Chicken' | 'Seafood';

export async function selectCategory(page: Page, category: Category) {
  const target = page.getByRole('tab', { name: new RegExp(`^${category}\\b`) });
  await target.click();
  await expect(target).toHaveAttribute('aria-selected', 'true');
}

export interface PlateOptions {
  /** Defaults to Beef, which is the category the builder opens on. */
  category?: Category;
  quality?: 'House' | 'Standard' | 'Premium';
  plateSize?: 'Small' | 'Regular' | 'Large';
}

/** Selects a cut, configures it, and commits it to the tab. */
export async function addPlate(page: Page, food: string, options: PlateOptions = {}) {
  if (options.category) {
    await selectCategory(page, options.category);
  }

  await page.getByRole('button', { name: new RegExp(`^${food}\\b`) }).click();

  // The configuration panel only exists once a cut is selected.
  const add = page.getByRole('button', { name: 'Add to my damage' });
  await expect(add).toBeVisible();

  if (options.quality) {
    await chooseOption(page, options.quality);
  }
  if (options.plateSize) {
    await chooseOption(page, options.plateSize);
  }

  await add.click();
}

export async function calculateDamage(page: Page) {
  await page.getByRole('button', { name: 'Calculate the damage' }).click();
  await expect(page.getByRole('heading', { name: 'AYCE Damage Report' })).toBeVisible();
}

export function report(page: Page) {
  return page.getByRole('heading', { name: 'AYCE Damage Report' });
}

/**
 * Reads the horizontal overflow of the document. Returns the number of pixels
 * the content exceeds the viewport by, so assertions can allow sub-pixel noise.
 */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
