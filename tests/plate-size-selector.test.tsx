import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlateSizeSelector } from '@/components/meal/PlateSizeSelector';
import { PLATE_SIZES } from '@/lib/constants';
import type { PlateSize } from '@/types/meal';

/*
 * Plate size multiplies straight into the weight and therefore into the whole
 * damage figure, so the control has to report the id the calculator prices
 * against rather than the label a diner reads. The sizes are taken from the
 * configuration for the same reason: adding a fourth should extend this suite
 * rather than quietly escape it.
 */

const detailOf = (size: (typeof PLATE_SIZES)[number]) => `${size.grams} g · ~${size.ounces}`;

/** The name a screen reader would read: the wrapping label, glyph excluded. */
const accessibleName = (radio: HTMLElement) => radio.closest('label')?.textContent ?? '';

const squashed = (text: string) => text.replace(/\s+/g, '');

function setup(value: PlateSize = 'regular') {
  const onChange = vi.fn<(size: PlateSize) => void>();
  render(<PlateSizeSelector value={value} onChange={onChange} />);
  return { onChange };
}

describe('PlateSizeSelector', () => {
  it('names the choice it is asking for', () => {
    setup();

    expect(screen.getByRole('group', { name: 'Plate size' })).toBeInTheDocument();
  });

  it('offers every configured plate size', () => {
    setup();

    const group = screen.getByRole('group', { name: 'Plate size' });
    expect(within(group).getAllByRole('radio')).toHaveLength(PLATE_SIZES.length);

    for (const size of PLATE_SIZES) {
      expect(screen.getByRole('radio', { name: new RegExp(size.label, 'i') })).toBeInTheDocument();
    }
  });

  it('states the weight of each plate beside its name', () => {
    setup();

    for (const size of PLATE_SIZES) {
      expect(screen.getByText(detailOf(size))).toBeInTheDocument();
    }
  });

  it.each(PLATE_SIZES.map((size) => size.id))('shows %s as checked when it is the value', (id) => {
    setup(id);

    const meta = PLATE_SIZES.find((size) => size.id === id)!;
    expect(screen.getByRole('radio', { name: new RegExp(meta.label, 'i') })).toBeChecked();
  });

  it('checks exactly one size at a time', () => {
    setup('large');

    const checked = screen
      .getAllByRole('radio')
      .filter((radio) => (radio as HTMLInputElement).checked);
    expect(checked).toHaveLength(1);
  });

  it('reports the id the calculator prices against, not the label', async () => {
    const { onChange } = setup('regular');
    const other = PLATE_SIZES.find((size) => size.id !== 'regular')!;

    await userEvent.click(screen.getByRole('radio', { name: new RegExp(other.label, 'i') }));

    expect(onChange).toHaveBeenCalledWith(other.id);
  });

  it('keeps the discs decorative, so they add no names of their own', () => {
    setup();

    // The name comes from the label and the weight beside it; the disc is drawn
    // from the same number and would only say it a second time.
    for (const size of PLATE_SIZES) {
      const radio = screen.getByRole('radio', { name: new RegExp(size.label, 'i') });
      /*
       * Compared with the spacing squeezed out of both sides: jsdom joins two
       * adjacent spans without the space a browser's name computation inserts,
       * and the spacing is not what this is checking.
       */
      expect(squashed(accessibleName(radio))).toBe(squashed(`${size.label}${detailOf(size)}`));
      expect(radio.closest('label')?.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    }
  });
});
