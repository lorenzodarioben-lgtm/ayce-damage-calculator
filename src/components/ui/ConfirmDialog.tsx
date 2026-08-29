'use client';

import { useId } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  /** Names what backing out preserves; worth stating rather than "Cancel". */
  cancelLabel?: string;
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
  cancelLabel = 'Keep my tab',
  busy = false,
  busyLabel,
  busyMessage,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();

  return (
    <Dialog open={open} onClose={busy ? NO_OP : onCancel} title={title} labelledById={titleId}>
      <p className="text-sm leading-relaxed text-cream-300">{body}</p>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs text-cream-500">
        {busy && busyMessage ? busyMessage : ''}
      </p>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={busy} aria-busy={busy}>
          {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
