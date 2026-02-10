import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { LICENSE_URL, REPOSITORY_URL } from '@/lib/constants';

describe('SiteFooter', () => {
  it('lets the claim about local data be checked against the source', () => {
    render(<SiteFooter>Meal data stays in this browser.</SiteFooter>);

    expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute('href', REPOSITORY_URL);
    expect(screen.getByRole('link', { name: 'MIT License' })).toHaveAttribute('href', LICENSE_URL);
  });

  it('opens outbound links without handing the destination this page', () => {
    render(<SiteFooter>Meal data stays in this browser.</SiteFooter>);

    for (const name of ['Source', 'MIT License']) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('keeps the methodology control and the note it was given', () => {
    render(<SiteFooter>Meal data stays in this browser.</SiteFooter>);

    expect(screen.getByRole('button', { name: /how we calculate it/i })).toBeInTheDocument();
    expect(screen.getByText('Meal data stays in this browser.')).toBeInTheDocument();
  });
});
