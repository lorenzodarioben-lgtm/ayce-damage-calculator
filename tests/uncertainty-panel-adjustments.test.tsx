import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UncertaintyPanel } from '@/components/methodology/UncertaintyPanel';
import { FOODS } from '@/data/foods';
import { buildDamageReport } from '@/lib/calculations';
import { formatPercent } from '@/lib/formatting';
import type { BillAdjustment, MealItem } from '@/types/meal';

/**
 * What the panel shows, against what the report shows.
 *
 * A reader has both numbers on one screen. If the panel is measured against the
 * entry price and the report against what was paid, the page argues with itself.
 */

const items: readonly MealItem[] = [
  {
    id: 'beef-ribeye__standard__regular',
    foodId: 'beef-ribeye',
    quality: 'standard',
    plateSize: 'regular',
    quantity: 8,
  },
];

const voucher: BillAdjustment = {
  id: 'adj-voucher',
  label: 'Voucher',
  amount: 30,
  kind: 'discount',
};

function renderPanel(adjustments?: readonly BillAdjustment[]) {
  render(
    <UncertaintyPanel
      items={items}
      pricePerDiner={59.9}
      dinerCount={1}
      {...(adjustments ? { adjustments } : {})}
      foods={FOODS}
      headingId="uncertainty-heading"
    />,
  );
}

function panel() {
  return screen.getByRole('region', { name: 'How firm is this number?' });
}

async function openDetail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(panel()).getByText('Show the range and what moves it'));
}

describe('The panel, on a meal with nothing on the bill', () => {
  it('renders exactly as it always did', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openDetail(user);

    const report = buildDamageReport(items, { pricePerDiner: 59.9, dinerCount: 1 });
    expect(
      within(panel()).getAllByText(formatPercent(report.retailRecoveryPercent)).length,
    ).toBeGreaterThan(0);
  });
});

describe('The panel, on a meal with a voucher', () => {
  it('reports the base scenario at the same recovery the report does', async () => {
    const user = userEvent.setup();
    renderPanel([voucher]);
    await openDetail(user);

    const report = buildDamageReport(items, {
      pricePerDiner: 59.9,
      dinerCount: 1,
      adjustments: [voucher],
    });
    expect(
      within(panel()).getAllByText(formatPercent(report.retailRecoveryPercent)).length,
    ).toBeGreaterThan(0);
  });

  it('does not report the figure it would have shown against the entry price', async () => {
    const user = userEvent.setup();
    renderPanel([voucher]);
    await openDetail(user);

    // The old defect, stated as an assertion: the undiscounted recovery must
    // not appear anywhere in the panel.
    const undiscounted = buildDamageReport(items, { pricePerDiner: 59.9, dinerCount: 1 });
    expect(
      within(panel()).queryByText(formatPercent(undiscounted.retailRecoveryPercent)),
    ).not.toBeInTheDocument();
  });
});
