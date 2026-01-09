import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MealBreakdown } from '@/components/results/MealBreakdown';
import { buildDamageReport } from '@/lib/calculations';
import type { MealItem } from '@/types/meal';

const RIBEYE: MealItem = {
  id: 'ribeye',
  foodId: 'beef-ribeye',
  quality: 'standard',
  plateSize: 'regular',
  quantity: 2,
};

const PRAWNS: MealItem = {
  id: 'prawns',
  foodId: 'seafood-prawns',
  quality: 'premium',
  plateSize: 'small',
  quantity: 1,
};

function linesFor(items: readonly MealItem[]) {
  return buildDamageReport(items, { pricePerDiner: 60, dinerCount: 1 }).lines;
}

describe('MealBreakdown', () => {
  it('renders nothing when there is no meal', () => {
    const { container } = render(<MealBreakdown lines={[]} headingId="empty" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists every line with its configuration, volume and value', () => {
    render(<MealBreakdown lines={linesFor([RIBEYE, PRAWNS])} headingId="breakdown" />);

    const section = screen.getByRole('region', { name: /what was recorded/i });
    const entries = within(section).getAllByRole('listitem');
    expect(entries).toHaveLength(2);

    const [ribeye, prawns] = entries;
    expect(within(ribeye!).getByText('Ribeye')).toBeInTheDocument();
    expect(within(ribeye!).getByText('Standard · Regular')).toBeInTheDocument();
    // 2 x 155 g = 310 g at $52/kg = $16.12
    expect(within(ribeye!).getByText('2 plates · 310 g')).toBeInTheDocument();
    expect(within(ribeye!).getByText('$16.12')).toBeInTheDocument();

    expect(within(prawns!).getByText('Premium · Small')).toBeInTheDocument();
    expect(within(prawns!).getByText('1 plate · 100 g')).toBeInTheDocument();
  });

  it('totals the lines it shows', () => {
    const lines = linesFor([RIBEYE, PRAWNS]);
    const expected = lines.reduce((sum, line) => sum + line.retailValue, 0);

    render(<MealBreakdown lines={lines} headingId="breakdown" />);

    const section = screen.getByRole('region', { name: /what was recorded/i });
    expect(within(section).getByText(`$${expected.toFixed(2)}`)).toBeInTheDocument();
  });

  it('takes the heading its context needs', () => {
    render(<MealBreakdown lines={linesFor([RIBEYE])} headingId="ate" heading="What you ate" />);
    expect(screen.getByRole('heading', { name: 'What you ate' })).toBeInTheDocument();
  });
});
