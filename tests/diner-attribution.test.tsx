import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DinerAttribution } from '@/components/meal/DinerAttribution';
import type { Diner } from '@/types/meal';

/*
 * This is the control that decides whose meal a plate lands on, and it is a set
 * of toggles rather than a radio group because "the table" is not one of the
 * diners — it is the absence of a choice, and it has to be reachable again
 * after a diner has been picked.
 */

const DINERS: readonly Diner[] = [
  { id: 'diner-1', displayName: 'Mia' },
  { id: 'diner-2', displayName: 'Sam' },
  { id: 'diner-3', displayName: 'Ari' },
];

function setup(activeDinerId: string | null = null, diners: readonly Diner[] = DINERS) {
  const onChange = vi.fn();
  render(<DinerAttribution diners={diners} activeDinerId={activeDinerId} onChange={onChange} />);
  return { onChange };
}

describe('DinerAttribution', () => {
  it('renders nothing when nobody has been added to the table', () => {
    const { container } = render(
      <DinerAttribution diners={[]} activeDinerId={null} onChange={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('names itself, so the choices are not a loose row of buttons', () => {
    setup();

    expect(screen.getByRole('group', { name: 'Plate attribution' })).toBeInTheDocument();
  });

  it('offers the table alongside every diner at it', () => {
    setup();

    const group = screen.getByRole('group', { name: 'Plate attribution' });
    const names = within(group)
      .getAllByRole('button')
      .map((button) => button.textContent);

    expect(names).toEqual(['Table', 'Mia', 'Sam', 'Ari']);
  });

  it('shows the table as the target while no diner is chosen', () => {
    setup(null);

    expect(screen.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Mia' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the chosen diner as the target, and only that diner', () => {
    setup('diner-2');

    expect(screen.getByRole('button', { name: 'Sam' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Mia' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Ari' })).toHaveAttribute('aria-pressed', 'false');
  });

  it("reports the diner's own id when one is chosen", async () => {
    const { onChange } = setup(null);

    await userEvent.click(screen.getByRole('button', { name: 'Ari' }));

    expect(onChange).toHaveBeenCalledWith('diner-3');
  });

  it('reports no diner at all when the table is chosen back', async () => {
    const { onChange } = setup('diner-2');

    await userEvent.click(screen.getByRole('button', { name: 'Table' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
