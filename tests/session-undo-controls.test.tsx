import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionUndoControls } from '@/components/session/SessionUndoControls';

/*
 * Recovery controls, so what matters is that they are honest about being
 * unavailable: a button offering to undo an empty history invites a tap that
 * does nothing, and the pair is shared by the builder and the one-handed live
 * logger, where a stray tap is likeliest.
 */

function setup(state: { canUndo?: boolean; canRedo?: boolean } = {}) {
  const onUndo = vi.fn();
  const onRedo = vi.fn();
  render(
    <SessionUndoControls
      canUndo={state.canUndo ?? false}
      canRedo={state.canRedo ?? false}
      onUndo={onUndo}
      onRedo={onRedo}
    />,
  );
  return { onUndo, onRedo };
}

const undo = () => screen.getByRole('button', { name: 'Undo meal edit' });
const redo = () => screen.getByRole('button', { name: 'Redo meal edit' });

describe('SessionUndoControls', () => {
  it('names itself as the meal edit history', () => {
    setup();

    expect(screen.getByRole('group', { name: 'Meal edit history' })).toBeInTheDocument();
  });

  it('offers exactly an undo and a redo', () => {
    setup();

    const group = screen.getByRole('group', { name: 'Meal edit history' });
    expect(within(group).getAllByRole('button')).toHaveLength(2);
    expect(undo()).toBeInTheDocument();
    expect(redo()).toBeInTheDocument();
  });

  it('disables both while there is nothing to recover', () => {
    setup({ canUndo: false, canRedo: false });

    expect(undo()).toBeDisabled();
    expect(redo()).toBeDisabled();
  });

  it('enables undo alone once an edit can be taken back', () => {
    setup({ canUndo: true, canRedo: false });

    expect(undo()).toBeEnabled();
    expect(redo()).toBeDisabled();
  });

  it('enables redo alone once an edit can be put back', () => {
    setup({ canUndo: false, canRedo: true });

    expect(redo()).toBeEnabled();
    expect(undo()).toBeDisabled();
  });

  it('takes the last edit back when undo is available and pressed', async () => {
    const { onUndo, onRedo } = setup({ canUndo: true });

    await userEvent.click(undo());

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).not.toHaveBeenCalled();
  });

  it('puts the edit back when redo is available and pressed', async () => {
    const { onUndo, onRedo } = setup({ canRedo: true });

    await userEvent.click(redo());

    expect(onRedo).toHaveBeenCalledTimes(1);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('does nothing when a disabled control is pressed', async () => {
    const { onUndo, onRedo } = setup({ canUndo: false, canRedo: false });

    await userEvent.click(undo());
    await userEvent.click(redo());

    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
  });

  it('shows the keyboard shortcuts that do the same thing', () => {
    setup();

    expect(screen.getByText('Ctrl/Cmd+Z · Ctrl/Cmd+Shift+Z')).toBeInTheDocument();
  });
});
