import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OptionCard } from '@/components/meal/OptionCard';

/*
 * The card is a radio wearing a card's clothes. The native input is kept in the
 * DOM and only visually hidden, so arrow-key movement, grouping and the checked
 * state all come from the platform — which is exactly what these assertions
 * reach for, rather than the presentation wrapped around it.
 */

function setup(overrides: Partial<Parameters<typeof OptionCard>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <OptionCard
      name="plate-size"
      selected={false}
      onSelect={onSelect}
      label="Regular"
      detail="155 g · ~5.5 oz"
      {...overrides}
    />,
  );
  return { onSelect };
}

describe('OptionCard', () => {
  it('is a real radio rather than a button pretending to be one', () => {
    setup();

    expect(screen.getByRole('radio', { name: /regular/i })).toBeInTheDocument();
  });

  it('joins the group it was given, so only one card in it can be chosen', () => {
    setup({ name: 'quality-tier' });

    expect(screen.getByRole('radio', { name: /regular/i })).toHaveAttribute('name', 'quality-tier');
  });

  it('is checked when it is the selected option', () => {
    setup({ selected: true });

    expect(screen.getByRole('radio', { name: /regular/i })).toBeChecked();
  });

  it('is unchecked when it is not', () => {
    setup({ selected: false });

    expect(screen.getByRole('radio', { name: /regular/i })).not.toBeChecked();
  });

  it('shows its label and the detail underneath it', () => {
    setup();

    expect(screen.getByText('Regular')).toBeInTheDocument();
    expect(screen.getByText('155 g · ~5.5 oz')).toBeInTheDocument();
  });

  it('renders a glyph above the label when one is supplied', () => {
    setup({ glyph: <span data-testid="plate-disc" aria-hidden="true" /> });

    expect(screen.getByTestId('plate-disc')).toBeInTheDocument();
  });

  it('shows no glyph when none is supplied', () => {
    setup();

    expect(screen.queryByTestId('plate-disc')).not.toBeInTheDocument();
  });

  it('reports the choice when the diner picks it', async () => {
    const { onSelect } = setup();

    await userEvent.click(screen.getByRole('radio', { name: /regular/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('can be picked by its label, since the input itself is hidden', async () => {
    const { onSelect } = setup();

    await userEvent.click(screen.getByText('Regular'));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
