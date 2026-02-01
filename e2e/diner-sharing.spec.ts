import { expect, test, type Page } from '@playwright/test';
import {
  addPlate,
  calculateDamage,
  horizontalOverflow,
  openCalculator,
  sessionSetup,
  tab,
} from './helpers';

/**
 * Splitting one plate between the people who actually shared it.
 *
 * The case the roster alone could never express: five at the table, one plate
 * of wagyu, two of them ate it. The assertion that matters is that the other
 * three are credited with none of it — and that the plate is still, in total,
 * one plate.
 */

const RIBEYE = 'Ribeye, Standard, Regular';

async function addDiner(page: Page, name: string, position: number) {
  const setup = sessionSetup(page);
  await setup.getByLabel('Diner name').fill(name);
  await setup.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(setup.getByRole('textbox', { name: `Diner ${position} name` })).toHaveValue(name);
}

async function seatThree(page: Page) {
  await addDiner(page, 'Ana', 1);
  await addDiner(page, 'Ben', 2);
  await addDiner(page, 'Cal', 3);
}

async function seatFour(page: Page) {
  await seatThree(page);
  await addDiner(page, 'Dee', 4);
}

function sharing(page: Page) {
  return tab(page).getByRole('group', { name: `Who shared ${RIBEYE}` });
}

test.describe('Sharing one plate between some of the table', () => {
  test('says nothing about sharing when nobody is on the roster', async ({ page }) => {
    await openCalculator(page);
    await addPlate(page, 'Ribeye');

    await expect(tab(page).getByText('Shared by')).toBeHidden();
  });

  test('offers the choice once there are enough people to choose between', async ({ page }) => {
    await openCalculator(page);
    await seatThree(page);
    await addPlate(page, 'Ribeye');

    await expect(tab(page).getByText('Shared by')).toBeVisible();
    // Nobody named yet means the whole table, which the copy says plainly.
    await expect(tab(page).getByText(/Everyone at the table splits/)).toBeVisible();
  });

  test('divides one plate between three without creating or losing any of it', async ({ page }) => {
    await openCalculator(page);
    await seatFour(page);
    await addPlate(page, 'Ribeye');

    await sharing(page).getByRole('button', { name: 'Ana' }).click();
    await sharing(page).getByRole('button', { name: 'Ben' }).click();
    await sharing(page).getByRole('button', { name: 'Cal' }).click();

    // A third each — a number that cannot be written down, so it is divided
    // rather than stored.
    await expect(tab(page).getByText(/Split between 3 of them/)).toBeVisible();
    await expect(tab(page).getByText(/0\.33 each/)).toBeVisible();
  });

  test('reads naming everybody as naming nobody, because they are the same', async ({ page }) => {
    await openCalculator(page);
    await seatThree(page);
    await addPlate(page, 'Ribeye');

    await sharing(page).getByRole('button', { name: 'Ana' }).click();
    await sharing(page).getByRole('button', { name: 'Ben' }).click();
    await sharing(page).getByRole('button', { name: 'Cal' }).click();

    await expect(tab(page).getByText(/Everyone at the table splits/)).toBeVisible();
  });

  test('credits nobody outside the named subset', async ({ page }) => {
    await openCalculator(page);
    await seatThree(page);
    await addPlate(page, 'Ribeye');

    await sharing(page).getByRole('button', { name: 'Ana' }).click();
    await sharing(page).getByRole('button', { name: 'Ben' }).click();
    await calculateDamage(page);

    const breakdown = page.getByRole('region', { name: 'Table breakdown' });
    // Half a plate each for the two who shared it, and none for the third.
    await expect(breakdown.getByRole('row', { name: /^Ana 1 plate/ })).toBeVisible();
    await expect(breakdown.getByRole('row', { name: /^Ben 1 plate/ })).toBeVisible();
    await expect(breakdown.getByRole('row', { name: /^Cal 0 plates/ })).toBeVisible();
  });

  test('puts the plate back to the table when the subset is cleared', async ({ page }) => {
    await openCalculator(page);
    await seatThree(page);
    await addPlate(page, 'Ribeye');

    await sharing(page).getByRole('button', { name: 'Ana' }).click();
    await expect(tab(page).getByText(/Split between 1 of them/)).toBeVisible();

    await sharing(page).getByRole('button', { name: 'Ana' }).click();
    await expect(tab(page).getByText(/Everyone at the table splits/)).toBeVisible();
  });

  test('survives a reload as the subset it was recorded as', async ({ page }) => {
    await openCalculator(page);
    await seatThree(page);
    await addPlate(page, 'Ribeye');
    await sharing(page).getByRole('button', { name: 'Ana' }).click();
    await sharing(page).getByRole('button', { name: 'Ben' }).click();

    await page.reload();

    await expect(tab(page).getByText(/Split between 2 of them/)).toBeVisible();
    await expect(sharing(page).getByRole('button', { name: 'Ana' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(sharing(page).getByRole('button', { name: 'Cal' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('introduces no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await openCalculator(page);
    await seatThree(page);
    await addPlate(page, 'Ribeye');
    await sharing(page).getByRole('button', { name: 'Ana' }).click();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
