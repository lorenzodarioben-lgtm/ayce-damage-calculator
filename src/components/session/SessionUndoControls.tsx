'use client';

import { Redo2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SessionUndoControlsProps {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
}

/** Compact recovery controls shared by the builder and one-handed live logger. */
export function SessionUndoControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: SessionUndoControlsProps) {
  return (
    <div role="group" aria-label="Meal edit history" className="flex flex-wrap gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo meal edit"
      >
        <Undo2 size={15} aria-hidden="true" />
        Undo
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo meal edit"
      >
        <Redo2 size={15} aria-hidden="true" />
        Redo
      </Button>
      <span className="self-center text-xs text-cream-700">Ctrl/Cmd+Z · Ctrl/Cmd+Shift+Z</span>
    </div>
  );
}
