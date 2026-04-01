import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('keeps its plate artwork decorative while exposing the recovery action', () => {
    const { container } = render(
      <EmptyState
        mark="record"
        title="No meals on file."
        action={<a href="/">Start a meal</a>}
      >
        Saved meals appear here after you file them.
      </EmptyState>,
    );

    expect(screen.getByText('No meals on file.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a meal' })).toHaveAttribute('href', '/');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
