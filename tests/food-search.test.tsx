import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FoodSearch } from '@/components/meal/FoodSearch';

function search() {
  return screen.getByRole('searchbox', { name: /find a cut/i });
}

describe('FoodSearch slash shortcut', () => {
  it('focuses the search from anywhere on the page', async () => {
    const user = userEvent.setup();
    render(<FoodSearch value="" onChange={vi.fn()} resultCount={null} />);

    await user.keyboard('/');

    expect(search()).toHaveFocus();
  });

  it('leaves the key alone while something else is being typed into', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <FoodSearch value="" onChange={onChange} resultCount={null} />
        <textarea aria-label="Meal note" />
      </>,
    );

    const note = screen.getByRole('textbox', { name: /meal note/i });
    note.focus();
    await user.keyboard('/');

    expect(note).toHaveValue('/');
    expect(search()).not.toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves the key alone while a modal dialog is open', async () => {
    const user = userEvent.setup();
    render(
      <>
        <FoodSearch value="" onChange={vi.fn()} resultCount={null} />
        <dialog open aria-label="Something modal">
          <button type="button">Close</button>
        </dialog>
      </>,
    );

    const dialogButton = screen.getByRole('button', { name: 'Close' });
    dialogButton.focus();
    await user.keyboard('/');

    // The dialog's content is inert to the page behind it, so stealing the
    // keystroke would lose it rather than act on it.
    expect(search()).not.toHaveFocus();
    expect(dialogButton).toHaveFocus();
  });

  it('ignores the key as part of a browser or system chord', async () => {
    const user = userEvent.setup();
    render(<FoodSearch value="" onChange={vi.fn()} resultCount={null} />);

    await user.keyboard('{Control>}/{/Control}');

    expect(search()).not.toHaveFocus();
  });

  it('stops listening once it is gone', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<FoodSearch value="" onChange={vi.fn()} resultCount={null} />);
    unmount();

    // Nothing to assert beyond the absence of a crash from a handler reaching
    // for an input that no longer exists.
    await user.keyboard('/');

    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});

describe('FoodSearch escape', () => {
  it('clears the query and stays in the field', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FoodSearch value="brisket" onChange={onChange} resultCount={1} />);

    search().focus();
    await user.keyboard('{Escape}');

    expect(onChange).toHaveBeenCalledWith('');
    expect(search()).toHaveFocus();
  });

  it('does nothing to a query that is already empty', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FoodSearch value="" onChange={onChange} resultCount={null} />);

    search().focus();
    await user.keyboard('{Escape}');

    expect(onChange).not.toHaveBeenCalled();
    expect(search()).toHaveFocus();
  });
});

describe('FoodSearch shortcut hint', () => {
  it('shows the key it answers to, and gives way to the clear control', () => {
    const { rerender } = render(<FoodSearch value="" onChange={vi.fn()} resultCount={null} />);

    expect(search()).toHaveAttribute('aria-keyshortcuts', '/');
    expect(screen.queryByRole('button', { name: /clear the search/i })).toBeNull();

    rerender(<FoodSearch value="brisket" onChange={vi.fn()} resultCount={1} />);

    expect(screen.getByRole('button', { name: /clear the search/i })).toBeInTheDocument();
  });
});
