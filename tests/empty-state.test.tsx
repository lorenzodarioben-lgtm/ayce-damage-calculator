import { render, screen } from '@testing-library/react';
import Link from 'next/link';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('keeps its plate artwork decorative while exposing the recovery action', () => {
    const { container } = render(
      <EmptyState
        mark="record"
        title="No meals on file."
        action={<Link href="/">Start a meal</Link>}
      >
        Saved meals appear here after you file them.
      </EmptyState>,
    );

    expect(screen.getByText('No meals on file.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a meal' })).toHaveAttribute('href', '/');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
