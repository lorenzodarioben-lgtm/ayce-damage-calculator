import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FoodSort } from '@/components/meal/FoodSort';
import type { FoodSortKey } from '@/data/foods';

/*
 * Two toggles rather than a radio group, because reordering the picker is not a
 * choice the meal records — it changes what the diner is looking at and nothing
 * else. The labels are one word each, so the accessible names are where the
 * difference between the two orderings is actually explained.
 */

function setup(value: FoodSortKey = 'menu') {
  const onChange = vi.fn<(key: FoodSortKey) => void>();
  render(<FoodSort value={value} onChange={onChange} />);
  return { onChange };
}

describe('FoodSort', () => {
  it('is a group labelled by the question it answers', () => {
    setup();

    expect(screen.getByRole('group', { name: 'Order by' })).toBeInTheDocument();
  });

  it('offers menu order and value order, and nothing else', () => {
    setup();

    const group = screen.getByRole('group', { name: 'Order by' });
    expect(within(group).getAllByRole('button')).toHaveLength(2);
    expect(within(group).getByText('Menu')).toBeInTheDocument();
    expect(within(group).getByText('Value')).toBeInTheDocument();
  });

  it('says what each ordering actually does, since one word cannot', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Show cuts in menu order' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show the dearest retail price per kilogram first' }),
    ).toBeInTheDocument();
  });

  it('shows menu order as the one in force when it is the value', () => {
    setup('menu');

    expect(screen.getByRole('button', { name: /menu order/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /retail price per kilogram/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows value order as the one in force when it is the value', () => {
    setup('value');

    expect(screen.getByRole('button', { name: /retail price per kilogram/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /menu order/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('asks for value ordering when value is picked', async () => {
    const { onChange } = setup('menu');

    await userEvent.click(screen.getByRole('button', { name: /retail price per kilogram/i }));

    expect(onChange).toHaveBeenCalledWith('value');
  });

  it('asks for menu ordering when menu is picked back', async () => {
    const { onChange } = setup('value');

    await userEvent.click(screen.getByRole('button', { name: /menu order/i }));

    expect(onChange).toHaveBeenCalledWith('menu');
  });

  it('still reports the ordering already in force, so a stray tap is harmless', async () => {
    const { onChange } = setup('menu');

    await userEvent.click(screen.getByRole('button', { name: /menu order/i }));

    expect(onChange).toHaveBeenCalledWith('menu');
  });
});
