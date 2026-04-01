import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatusToast } from '@/components/ui/StatusToast';

describe('StatusToast', () => {
  it('offers its attached action and lets a diner dismiss the visual message', async () => {
    const user = userEvent.setup();
    const undo = vi.fn();
    const { container } = render(
      <StatusToast message={{ text: 'Ribeye removed.', action: { label: 'Undo', onAction: undo } }} />,
    );

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(container.querySelector('[data-open="false"]')).toHaveTextContent('Ribeye removed.');
  });
});
