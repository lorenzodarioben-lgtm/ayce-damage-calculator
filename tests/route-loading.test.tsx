import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouteLoading } from '@/components/ui/RouteLoading';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';

/*
 * Shown while a record or a shared report is being prepared. A loading screen
 * that is only a visual change leaves anyone not watching it with silence, so
 * what matters here is that it announces itself and still reads as a page.
 */

function loading() {
  render(
    <RouteLoading
      label="Opening the file"
      title="Retrieving this session."
      description="The record is being read from this browser only."
    />,
  );
}

describe('RouteLoading', () => {
  it('announces itself politely rather than changing in silence', () => {
    loading();
    const status = screen.getByRole('status');

    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it('says what is being waited for, not just that something is', () => {
    loading();

    expect(screen.getByText('Opening the file')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Retrieving this session.' })).toBeInTheDocument();
    expect(screen.getByText(/read from this browser only/i)).toBeInTheDocument();
  });

  it('is still a page, with one main heading and the skip link target', () => {
    loading();

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', MAIN_CONTENT_ID);
  });

  it('promises nothing about the device while it waits', () => {
    loading();

    expect(screen.getByText(/nothing has been changed while this page is loading/i)).toBeVisible();
  });
});
