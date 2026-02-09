import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import GlobalError from '@/app/global-error';

/*
 * Rendering a component that owns `<html>` and `<body>` inside a container is
 * not how the framework mounts it, but it is enough to prove the two things
 * that can silently be wrong: which callback the button is wired to, and what
 * the copy promises about stored data.
 */
describe('GlobalError', () => {
  it('re-renders through the framework retry callback', async () => {
    const retry = vi.fn();
    const user = userEvent.setup();

    render(<GlobalError error={new Error('boom')} retry={retry} />);

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it('names the failure and offers a whole-document reload as well', () => {
    render(<GlobalError error={new Error('boom')} retry={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /grill went cold/i })).toBeInTheDocument();
    // Distinct from retry, which only re-renders: this one rebuilds the
    // document, which is the recovery that survives a broken shell.
    expect(screen.getByRole('button', { name: /reload the page/i })).toBeInTheDocument();
  });

  it('claims only what a render failure actually leaves untouched', () => {
    render(<GlobalError error={new Error('boom')} retry={vi.fn()} />);

    expect(screen.getByText(/still there/i)).toBeInTheDocument();
  });
});
