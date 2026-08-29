import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RestoreImpactSummary } from '@/components/history/RestoreImpactSummary';
import type { RestoreImpact } from '@/lib/backup';

const IMPACT: RestoreImpact = {
  merge: {
    sessions: { incoming: 3, new: 2, alreadyOnDevice: 1 },
    savedOrders: { incoming: 2, new: 1, alreadyOnDevice: 1 },
    pricingProfiles: { incoming: 1, new: 0, alreadyOnDevice: 1 },
    customFoods: { incoming: 4, new: 4, alreadyOnDevice: 0 },
    restaurants: { incoming: 2, new: 1, alreadyOnDevice: 1 },
  },
  replace: {
    sessions: { incoming: 3, discarded: 7 },
    savedOrders: { incoming: 2, discarded: 3 },
    pricingProfiles: { incoming: 1, discarded: 2 },
    customFoods: { incoming: 4, discarded: 5 },
    restaurants: { incoming: 2, discarded: 1 },
  },
};

describe('RestoreImpactSummary', () => {
  it('makes merge additions, existing records and replacement losses explicit', () => {
    render(<RestoreImpactSummary impact={IMPACT} />);

    const summary = screen.getByRole('region', { name: 'Restore impact' });

    expect(within(summary).getByText('Filed sessions')).toBeInTheDocument();
    expect(within(summary).getByText('2 new · 1 already on this device')).toBeInTheDocument();
    expect(
      within(summary).getByText('Replace discards 7 currently on this device'),
    ).toBeInTheDocument();
    expect(within(summary).getByText('Custom foods')).toBeInTheDocument();
    expect(within(summary).getByText('4 new · 0 already on this device')).toBeInTheDocument();
    expect(
      within(summary).getByText('Replace discards 5 currently on this device'),
    ).toBeInTheDocument();
  });
});
