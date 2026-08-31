import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QualitySelector } from '@/components/meal/QualitySelector';
import { QUALITY_TIERS } from '@/lib/constants';
import type { QualityTier } from '@/types/meal';

/*
 * The tier is a multiplier on every price in the meal, so the control has to
 * report the id the engine multiplies by rather than the word on the card. The
 * subtitles are the only thing that says what a tier means — "House" and
 * "Premium" are not self-explanatory prices — so they are held here too.
 */

function setup(value: QualityTier = 'standard') {
  const onChange = vi.fn<(tier: QualityTier) => void>();
  render(<QualitySelector value={value} onChange={onChange} />);
  return { onChange };
}

describe('QualitySelector', () => {
  it('names the choice it is asking for', () => {
    setup();

    expect(screen.getByRole('group', { name: 'Quality tier' })).toBeInTheDocument();
  });

  it('offers every configured tier', () => {
    setup();

    const group = screen.getByRole('group', { name: 'Quality tier' });
    expect(within(group).getAllByRole('radio')).toHaveLength(QUALITY_TIERS.length);

    for (const tier of QUALITY_TIERS) {
      expect(screen.getByRole('radio', { name: new RegExp(tier.label, 'i') })).toBeInTheDocument();
    }
  });

  it('says what each tier means underneath its name', () => {
    setup();

    for (const tier of QUALITY_TIERS) {
      expect(screen.getByText(tier.subtitle)).toBeInTheDocument();
    }
  });

  it.each(QUALITY_TIERS.map((tier) => tier.id))(
    'shows %s as checked when it is the value',
    (id) => {
      setup(id);

      const meta = QUALITY_TIERS.find((tier) => tier.id === id)!;
      expect(screen.getByRole('radio', { name: new RegExp(meta.label, 'i') })).toBeChecked();
    },
  );

  it('checks exactly one tier at a time', () => {
    setup('premium');

    const checked = screen
      .getAllByRole('radio')
      .filter((radio) => (radio as HTMLInputElement).checked);

    expect(checked).toHaveLength(1);
  });

  it('reports the id the engine multiplies by, not the label', async () => {
    const { onChange } = setup('standard');
    const other = QUALITY_TIERS.find((tier) => tier.id !== 'standard')!;

    await userEvent.click(screen.getByRole('radio', { name: new RegExp(other.label, 'i') }));

    expect(onChange).toHaveBeenCalledWith(other.id);
  });

  it('reports a choice for every tier other than the one already showing', async () => {
    const { onChange } = setup('standard');
    const others = QUALITY_TIERS.filter((tier) => tier.id !== 'standard');

    for (const tier of others) {
      await userEvent.click(screen.getByRole('radio', { name: new RegExp(tier.label, 'i') }));
    }

    expect(onChange.mock.calls.map(([id]) => id)).toEqual(others.map((tier) => tier.id));
  });

  it('says nothing when the tier already showing is picked again', async () => {
    const { onChange } = setup('standard');

    await userEvent.click(screen.getByRole('radio', { name: /standard/i }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
