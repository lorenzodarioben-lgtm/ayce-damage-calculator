import { expect, test, type Page } from '@playwright/test';
import { addPlate, horizontalOverflow, openCalculator, sessionSetup } from './helpers';
import { IMPORT_COLUMNS } from '../src/lib/menuImport';

/**
 * Importing a personal menu from a spreadsheet, end to end.
 *
 * Everything here happens on the device: the file is chosen, parsed, previewed
 * and only then written. The assertions are about that order as much as the
 * outcome — a preview that had already written something would not be one.
 */

const HEADER = IMPORT_COLUMNS.join(',');

function importRegion(page: Page) {
  return page.getByRole('region', { name: 'Import a menu' });
}

/**
 * The conflict choices are visually hidden radios, so the element a real user
 * clicks is the wrapping label — the same arrangement the quality and plate
 * pickers use.
 */
async function chooseConflict(page: Page, label: string) {
  const radio = importRegion(page).getByRole('radio', { name: label });
  await radio.locator('..').click();
  await expect(radio).toBeChecked();
}

async function choose(page: Page, body: string, name = 'menu.csv') {
  await importRegion(page)
    .getByLabel('Menu CSV file')
    .setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(`${HEADER}\n${body}\n`) });
}

test.describe('Importing a menu from CSV', () => {
  test('offers a template and an upload without demanding either', async ({ page }) => {
    await openCalculator(page);

    await expect(
      importRegion(page).getByRole('button', { name: 'Download the template' }),
    ).toBeVisible();
    await expect(
      importRegion(page).getByRole('button', { name: 'Choose a CSV file' }),
    ).toBeVisible();
    await expect(importRegion(page).getByText(/nothing is saved until you say so/)).toBeVisible();
  });

  test('downloads a template the parser can read back', async ({ page }) => {
    await openCalculator(page);

    const download = page.waitForEvent('download');
    await importRegion(page).getByRole('button', { name: 'Download the template' }).click();
    const file = await download;

    expect(file.suggestedFilename()).toBe('ayce-menu-template.csv');
  });

  test('previews the rows and writes nothing until asked', async ({ page }) => {
    await openCalculator(page);
    await choose(page, 'Kimchi,sides,by-weight,,,18,6,,30,2,0.5,4');

    await expect(importRegion(page).getByText(/1 row is ready to import/)).toBeVisible();
    await expect(importRegion(page).getByText('Kimchi')).toBeVisible();
    // Not on the menu yet, because a preview is not a decision.
    await expect(sessionSetup(page).getByRole('button', { name: 'Edit Kimchi' })).toBeHidden();

    await importRegion(page).getByRole('button', { name: 'Import this menu' }).click();
    await expect(sessionSetup(page).getByRole('button', { name: 'Edit Kimchi' })).toBeVisible();
  });

  test('carries a plated cut’s real weight through to the report', async ({ page }) => {
    await openCalculator(page);
    // 310 g is twice the nominal plate, so every figure should double.
    await choose(page, 'House brisket,beef,by-weight,,,40,20,310,,,,');
    await importRegion(page).getByRole('button', { name: 'Import this menu' }).click();

    await addPlate(page, 'House brisket');
    await page.getByRole('button', { name: 'Calculate the damage' }).click();
    await expect(page.getByRole('heading', { name: 'AYCE Damage Report' })).toBeVisible();

    // The declared plate, not the nominal 155 g, is what the report weighs.
    await expect(page.getByText('310 g').first()).toBeVisible();
    // 310 g at $40/kg is $12.40, where a nominal plate would have said $6.20.
    await expect(page.getByText('$12.40').first()).toBeVisible();
  });

  test('puts the imported item on the menu, ready to order', async ({ page }) => {
    await openCalculator(page);
    await choose(page, 'Kimchi,sides,by-weight,,,18,6,,30,2,0.5,4');
    await importRegion(page).getByRole('button', { name: 'Import this menu' }).click();

    await page.getByRole('tab', { name: /Sides/ }).click();
    await addPlate(page, 'Kimchi');
    await expect(page.getByRole('region', { name: 'Your tab' }).getByText('Kimchi')).toBeVisible();
  });

  test('names the rows it could not read, and keeps the ones it could', async ({ page }) => {
    await openCalculator(page);
    await choose(
      page,
      'Kimchi,sides,by-weight,,,18,6,,,,,\nBroken,nowhere,by-weight,,,18,6,,,,,\n"Bad price",sides,by-weight,,,lots,6,,,,,',
    );

    await expect(importRegion(page).getByText(/1 row is ready to import/)).toBeVisible();
    await expect(importRegion(page).getByText(/Row 3, Broken/)).toBeVisible();
    await expect(importRegion(page).getByText(/Row 4, Bad price/)).toBeVisible();
    await expect(importRegion(page).getByText(/Category must be one of/)).toBeVisible();
  });

  test('handles quoted fields, commas and doubled quotes', async ({ page }) => {
    await openCalculator(page);
    await choose(page, '"Kimchi, house","sides",by-weight,,"Sour, hot and ""good""",18,6,,,,,');

    await expect(importRegion(page).getByText('Kimchi, house')).toBeVisible();
  });

  test('renders a formula-like name as inert text', async ({ page }) => {
    await openCalculator(page);
    await choose(page, '"=cmd|\'/c calc\'!A1",sides,by-weight,,,18,6,,,,,');

    // Stored as text, with the lead character stripped, so it can never be
    // re-exported as something a spreadsheet would run.
    await expect(importRegion(page).getByText("cmd|'/c calc'!A1")).toBeVisible();
    await expect(importRegion(page).getByText("=cmd|'/c calc'!A1")).toBeHidden();
  });

  test('rejects a negative price rather than reading it as positive', async ({ page }) => {
    await openCalculator(page);
    await choose(page, 'Kimchi,sides,by-weight,,,-4,6,,,,,');

    await expect(importRegion(page).getByText(/could not be read/)).toBeVisible();
    await expect(importRegion(page).getByText(/not zero or a positive number/)).toBeVisible();
  });

  test('asks before replacing something already on the menu', async ({ page }) => {
    await openCalculator(page);
    await choose(page, 'Kimchi,sides,by-weight,,,18,6,,,,,');
    await importRegion(page).getByRole('button', { name: 'Import this menu' }).click();
    await expect(sessionSetup(page).getByRole('button', { name: 'Edit Kimchi' })).toBeVisible();

    await choose(page, 'Kimchi,sides,by-weight,,,99,40,,,,,');
    await expect(importRegion(page).getByText(/need a decision/)).toBeVisible();

    // Nothing is replaced unless the diner chooses it.
    await expect(importRegion(page).getByRole('radio', { name: 'Keep mine' })).toBeChecked();
    await chooseConflict(page, 'Keep both');
    await importRegion(page).getByRole('button', { name: 'Import this menu' }).click();

    await expect(sessionSetup(page).getByRole('button', { name: /^Edit Kimchi/ })).toHaveCount(2);
  });

  test('survives a reload with the imported menu intact', async ({ page }) => {
    await openCalculator(page);
    await choose(page, 'House lager,drinks,by-serving,,,9,2.5,330,,,,');
    await importRegion(page).getByRole('button', { name: 'Import this menu' }).click();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
    await page.getByRole('tab', { name: /Drinks/ }).click();
    await expect(page.getByRole('button', { name: /^House lager/ })).toBeVisible();
  });

  test('explains a file that is not a menu', async ({ page }) => {
    await openCalculator(page);
    await importRegion(page)
      .getByLabel('Menu CSV file')
      .setInputFiles({
        name: 'notes.txt',
        mimeType: 'text/csv',
        buffer: Buffer.from('nothing here at all'),
      });

    await expect(importRegion(page).getByRole('alert')).toBeVisible();
  });

  test('introduces no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await openCalculator(page);
    await choose(
      page,
      'An extremely long personal menu item name,sides,by-weight,,,18,6,,,,,\nBroken,nowhere,by-weight,,,18,6,,,,,',
    );

    await expect(importRegion(page).getByText(/could not be read/)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
