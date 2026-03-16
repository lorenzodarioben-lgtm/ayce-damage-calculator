'use client';

import { useId } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  /**
   * Names what backing out preserves, rather than "Cancel". There is no default:
   * this used to fall back to "Keep my tab", which is right on the calculator
   * and meaningless on "Delete this place?" and "Remove this person?", both of
   * which inherited it.
   */
  cancelLabel: string;
  /**
   * The confirmed action destroys something.
   *
   * All fourteen of these used to render the destroying action as the app's lit
   * ember primary while the safe path was a borderless ghost — so the warmest,
   * most attractive object on screen was always the one that threw data away.
   * When this is set the weights swap: the confirm is drawn as a danger, the
   * cancel as a solid secondary, and the cancel takes focus when the dialog
   * opens so the destructive button is never one stray Return away.
   */
  destructive?: boolean;
  /**
   * The confirmed action is still running. The dialog stays put and stops
   * accepting input, because an action that writes to storage has not happened
   * until the write says so — closing on the click would be a claim, not a
   * result.
   */
  busy?: boolean;
  /** What the confirm button says while `busy`. Written in the present tense. */
  busyLabel?: string;
  /** Announced politely while `busy`, so the wait is not silent. */
  busyMessage?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const NO_OP = () => {};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy = false,
  busyLabel,
  busyMessage,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

  return (
    <Dialog open={open} onClose={busy ? NO_OP : onCancel} title={title} labelledById={titleId}>
      <p className="text-ui leading-relaxed text-cream-300">{body}</p>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-caption text-cream-500">
        {busy && busyMessage ? busyMessage : ''}
      </p>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant={destructive ? 'secondary' : 'ghost'}
          onClick={onCancel}
          disabled={busy}
          autoFocus={destructive}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
