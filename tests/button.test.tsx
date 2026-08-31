import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/Button';

/*
 * Every action in the app is one of these, including the ones inside forms.
 * The default type is the part worth holding still: a button that quietly
 * submits its form navigates away from a half-built meal, and nothing else in
 * the component would look wrong when it happened.
 */

describe('Button', () => {
  it('is an ordinary button rather than a submit button by default', () => {
    render(<Button>Add plate</Button>);

    expect(screen.getByRole('button', { name: 'Add plate' })).toHaveAttribute('type', 'button');
  });

  it('forwards an explicit submit type', () => {
    render(<Button type="submit">Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });

  it('forwards the ordinary button attributes it is given', () => {
    render(
      <Button aria-label="Undo meal edit" data-testid="undo" form="meal-form" value="undo">
        Undo
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Undo meal edit' });
    expect(button).toHaveAttribute('data-testid', 'undo');
    expect(button).toHaveAttribute('form', 'meal-form');
    expect(button).toHaveAttribute('value', 'undo');
  });

  it('renders whatever children it was given', () => {
    render(
      <Button>
        <span data-testid="glyph" aria-hidden="true" />
        Share
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByTestId('glyph')).toBeInTheDocument();
  });

  it('calls its handler when it is clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add plate</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Add plate' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is actually disabled when it is asked to be', () => {
    render(
      <Button disabled onClick={vi.fn()}>
        Undo
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('does nothing at all when a disabled button is clicked', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Undo
      </Button>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps a caller's own class alongside its own", () => {
    render(<Button className="mt-6 self-end">Add plate</Button>);

    const button = screen.getByRole('button', { name: 'Add plate' });
    expect(button).toHaveClass('mt-6', 'self-end');
    // Its own styling is not dropped to make room for the caller's.
    expect(button).toHaveClass('inline-flex');
  });

  it('stretches to the full width only when asked', () => {
    const { rerender } = render(<Button fullWidth>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('w-full');

    rerender(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).not.toHaveClass('w-full');
  });
});
