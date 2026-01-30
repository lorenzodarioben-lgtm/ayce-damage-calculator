import { expect, test, type Page } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  horizontalOverflow,
  openCalculator,
  sessionSetup,
  setPricePerDiner,
  setRestaurantName,
} from './helpers';

/**
 * Charges and discounts, from the setup panel through to the filed record.
 *
 * The first test is the important one: someone who just paid the advertised
 * price has to see the calculator they always saw, with nothing extra to
 * dismiss and nothing extra to fill in.
 */

/**
 * The direction is a pair of visually hidden radios, so the element a real
 * user clicks is the wrapping label — the same arrangement the quality and
 * plate-size pickers use, and the same way the shared helper drives them.
 */
/** The adjustments editor, which is a named region inside the setup panel. */
function bill(page: Page) {
  return page.getByRole('region', { name: 'Charges and discounts' });
}

/** The report's own breakdown, which is a separate named region. */
function settled(page: Page) {
  return page.getByRole('region', { name: 'How the bill settled' });
}

async function chooseDirection(page: Page, kind: 'Charge' | 'Discount') {
  const radio = bill(page).getByRole('radio', { name: kind });
  await radio.locator('..').click();
  await expect(radio).toBeChecked();
}

async function addAdjustment(
  page: Page,
  kind: 'Charge' | 'Discount',
  label: string,
  amount: number,
) {
  await chooseDirection(page, kind);
  await bill(page).getByLabel('What was it').fill(label);
  await bill(page).getByLabel('Amount').fill(String(amount));
  await bill(page).getByRole('button', { name: 'Add to the bill' }).click();
  await expect(bill(page).getByText(label, { exact: true })).toBeVisible();
}

test.describe('Charges and discounts', () => {
  test('leaves the default meal exactly as it was', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 50);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    // No breakdown, no adjustment language, and the entry price is still the
    // number the report measures against.
    await expect(page.getByText('How the bill settled')).toBeHidden();
    await expect(page.getByText('Admission', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Total paid', { exact: true })).toHaveCount(0);
  });

  test('offers the editor without demanding anything of it', async ({ page }) => {
    await openCalculator(page);

    await expect(bill(page).getByRole('heading', { name: 'Charges and discounts' })).toBeVisible();
    await expect(bill(page).getByText(/Leave it empty and nothing changes/)).toBeVisible();
    await expect(bill(page).getByText('Paid in total')).toBeHidden();
  });

  test('settles a bill with a surcharge and a voucher', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 50);
    await addAdjustment(page, 'Charge', 'Weekend surcharge', 6);
    await addAdjustment(page, 'Discount', 'Voucher', 25);

    // 50 entry, plus 6, minus 25 — stated inside the editor's own breakdown and
    // again as the headline the setup panel has always shown.
    await expect(bill(page).getByText('$31.00')).toBeVisible();
    await expect(sessionSetup(page).getByText('Total paid', { exact: true })).toBeVisible();
  });

  test('measures the report against what was paid', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 50);
    await addAdjustment(page, 'Discount', 'Voucher', 25);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    await expect(settled(page).getByText('Entry price', { exact: true })).toBeVisible();
    await expect(settled(page).getByText('Discounts', { exact: true })).toBeVisible();
    await expect(settled(page).getByText('Paid in total')).toBeVisible();
    await expect(settled(page).getByText('−$25.00')).toBeVisible();
    await expect(page.getByText(/measured against the total paid/)).toBeVisible();
  });

  test('takes one back off the bill', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 50);
    await addAdjustment(page, 'Discount', 'Voucher', 25);

    await bill(page).getByRole('button', { name: 'Remove Voucher' }).click();

    await expect(bill(page).getByText('Voucher', { exact: true })).toBeHidden();
    await expect(bill(page).getByText('Paid in total')).toBeHidden();
  });

  test('confirms before clearing the whole bill', async ({ page }) => {
    await openCalculator(page);
    await addAdjustment(page, 'Charge', 'Card surcharge', 2);

    await bill(page).getByRole('button', { name: 'Clear them all' }).click();
    await expect(
      page.getByRole('heading', { name: 'Clear every charge and discount?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Keep them' }).click();
    await expect(bill(page).getByText('Card surcharge', { exact: true })).toBeVisible();

    await bill(page).getByRole('button', { name: 'Clear them all' }).click();
    await page.getByRole('button', { name: 'Clear them', exact: true }).click();
    await expect(bill(page).getByText('Card surcharge', { exact: true })).toBeHidden();
  });

  test('survives a reload with the tab', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 50);
    await addAdjustment(page, 'Discount', 'Voucher', 25);
    await addPlate(page, 'Ribeye');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Build the meal' })).toBeVisible();
    await expect(bill(page).getByText('Voucher', { exact: true })).toBeVisible();
    // Stated twice by design: once against the line, once in the total.
    await expect(bill(page).getByText('−$25.00').first()).toBeVisible();
  });

  test('files the bill with the record and shows it on the receipt', async ({ page }) => {
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await setPricePerDiner(page, 50);
    await addAdjustment(page, 'Discount', 'Voucher', 25);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    await page.getByRole('button', { name: 'Save to history' }).click();
    await expect(page.getByRole('button', { name: 'Filed to history' })).toBeVisible();

    await page.goto('/history');
    await page.getByRole('link', { name: 'Seoul Garden' }).click();

    await expect(settled(page).getByText('Paid in total')).toBeVisible();
  });

  test('carries the bill inside a share link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openCalculator(page);
    await setRestaurantName(page, 'Seoul Garden');
    await setPricePerDiner(page, 50);
    await addAdjustment(page, 'Discount', 'Voucher', 25);
    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    await page.getByRole('button', { name: 'Copy share link' }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());

    // A separate context, so nothing on this device can be feeding the page.
    const recipient = await context.browser()!.newContext();
    const recipientPage = await recipient.newPage();
    await recipientPage.goto(link);

    await expect(
      recipientPage
        .getByRole('region', { name: 'How the bill settled' })
        .getByText('Paid in total'),
    ).toBeVisible();
    await recipient.close();
  });

  test('splits a table charge and names a personal one', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 50);
    await sessionSetup(page).getByLabel('Diner name').fill('Ana');
    await sessionSetup(page).getByRole('button', { name: 'Add', exact: true }).click();
    await sessionSetup(page).getByLabel('Diner name').fill('Ben');
    await sessionSetup(page).getByRole('button', { name: 'Add', exact: true }).click();

    await bill(page).getByLabel('Who it belongs to').selectOption({ label: 'Ana' });
    await bill(page).getByLabel('What was it').fill('Drinks');
    await bill(page).getByLabel('Amount').fill('12');
    await bill(page).getByRole('button', { name: 'Add to the bill' }).click();

    await expect(bill(page).getByText(/Added to · Ana/)).toBeVisible();

    await addPlate(page, 'Ribeye');
    await calculateDamage(page);

    await expect(page.getByRole('columnheader', { name: 'Paid' })).toBeVisible();
    await expect(page.getByText(/one named to a diner is theirs/)).toBeVisible();
  });

  test('says plainly when the discounts covered the whole bill', async ({ page }) => {
    await openCalculator(page);
    await setPricePerDiner(page, 20);
    await addAdjustment(page, 'Discount', 'Voucher', 500);

    await expect(bill(page).getByText(/no recovery percentage to report/)).toBeVisible();
  });

  test('introduces no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await openCalculator(page);
    await addAdjustment(page, 'Charge', 'Public holiday evening surcharge', 6);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    await addPlate(page, 'Ribeye');
    await calculateDamage(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
