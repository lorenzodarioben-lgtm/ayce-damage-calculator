import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UncertaintyPanel } from '@/components/methodology/UncertaintyPanel';
import { FOODS } from '@/data/foods';
import type { MealItem } from '@/types/meal';

function item(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 'beef-ribeye__standard__regular',
    foodId: 'beef-ribeye',
    quality: 'standard',
    plateSize: 'regular',
    quantity: 8,
    ...overrides,
  };
}

function renderPanel(items: readonly MealItem[] = [item()], pricePerDiner = 59.9) {
  render(
    <UncertaintyPanel
      items={items}
      pricePerDiner={pricePerDiner}
      dinerCount={1}
      foods={FOODS}
      headingId="uncertainty-heading"
    />,
  );
}

function panel() {
  return screen.getByRole('region', { name: 'How firm is this number?' });
}

describe('UncertaintyPanel', () => {
  it('leads with a plain reading and keeps the detail collapsed', () => {
    renderPanel([item({ quantity: 20, quality: 'premium', plateSize: 'large' })]);

    expect(
      within(panel()).getByText(/even under the conservative assumptions/i),
    ).toBeInTheDocument();
    // The table exists in the DOM but the disclosure is closed.
    expect(panel().querySelector('details')?.open).toBe(false);
  });

  it('opens to a table of the three scenarios', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(within(panel()).getByText('Show the range and what moves it'));

    const table = within(panel()).getByRole('table');
    expect(within(table).getByRole('rowheader', { name: 'Conservative' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Base estimate' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Upper estimate' })).toBeInTheDocument();
  });

  it('refuses to call the range a confidence interval', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(within(panel()).getByText('Show the range and what moves it'));

    expect(
      within(panel()).getByText(/three named scenarios, not confidence intervals/i),
    ).toBeInTheDocument();
    expect(within(panel()).getByText(/nothing here was sampled/i)).toBeInTheDocument();
  });

  it('ranks what moves the result, most first', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(within(panel()).getByText('Show the range and what moves it'));

    const movers = within(panel())
      .getByText('What moves the result most')
      .parentElement?.querySelectorAll('li');
    expect(movers?.[0]?.textContent).toContain('Serving weight');
  });

  it('says when a single assumption decides the outcome', async () => {
    const user = userEvent.setup();
    renderPanel([item({ quantity: 8 })], 60);

    await user.click(within(panel()).getByText('Show the range and what moves it'));

    // Both recovery assumptions are decisive on this knife-edge meal.
    expect(
      within(panel()).getAllByText(/this assumption decides whether admission was beaten/i),
    ).toHaveLength(2);
  });

  it('repeats that estimated ingredient margin is not profit', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(within(panel()).getByText('Show the range and what moves it'));

    expect(within(panel()).getByText(/is still not restaurant profit/i)).toBeInTheDocument();
  });

  it('renders nothing at all for an empty tab', () => {
    const { container } = render(
      <UncertaintyPanel
        items={[]}
        pricePerDiner={59.9}
        dinerCount={1}
        foods={FOODS}
        headingId="uncertainty-heading"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
