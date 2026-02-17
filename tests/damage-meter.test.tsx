import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DamageMeter } from '@/components/summary/DamageMeter';

function meter(recoveryPercent: number) {
  render(
    <DamageMeter
      retailValue={80}
      totalAdmission={60}
      recoveryPercent={recoveryPercent}
      remainingGap={0}
    />,
  );
  return screen.getByRole('progressbar');
}

describe('DamageMeter', () => {
  it('reports progress against admission on a nought-to-hundred scale', () => {
    const bar = meter(64);

    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '64');
  });

  it('caps the bar at full while the spoken figure keeps climbing', () => {
    const bar = meter(250);

    expect(bar).toHaveAttribute('aria-valuenow', '100');
    // The number itself is not capped; only the drawing is.
    expect(bar).toHaveAttribute('aria-valuetext', '250% of admission recovered');
  });

  it('never goes below empty', () => {
    expect(meter(-40)).toHaveAttribute('aria-valuenow', '0');
  });

  it('reads a figure it cannot use as no progress at all', () => {
    // The engine guards its own divisions, but a progressbar is the wrong place
    // to find that out: NaN would reach the browser as both a width and an
    // ARIA value.
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const bar = meter(value);
      expect(bar).toHaveAttribute('aria-valuenow', '0');
      screen.getAllByRole('progressbar').forEach((node) => node.remove());
    }
  });
});
