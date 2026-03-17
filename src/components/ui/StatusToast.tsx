'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { StatusMessage } from '@/hooks/useStatusMessage';

interface StatusToastProps {
  message: StatusMessage | null;
  /**
   * Raised above the mobile reading so the two never overlap. Defaults to
   * false, which is right for every screen that has no such bar.
   */
  offset?: boolean;
}

/**
 * The live region always exists so assistive technology announces updates;
 * only the visual bubble mounts and unmounts.
 *
 * The container ignores pointer events so a resting toast can never intercept a
 * tap meant for the page beneath it. Only the buttons take them back.
 *
 * It leaves as deliberately as it arrives. The bubble used to enter on a
 * keyframe and then simply stop existing when its timer ran out, which reads as
 * a blink rather than a departure — and the seven-second version that carries
 * an undo offer sat over the content with no way at all to clear it.
 */
export function StatusToast({ message, offset = false }: StatusToastProps) {
  /*
   * The text has to outlive the message so there is something to animate out,
   * and the counter restarts the entry animation when one replaces another.
   * Adjusted during render rather than in an effect: this is state derived from
   * a prop, and React would rather re-render once than paint the old message
   * and then correct it.
   */
  const [shown, setShown] = useState<{ message: StatusMessage; seq: number } | null>(null);
  const [dismissed, setDismissed] = useState<StatusMessage | null>(null);

  if (message && message !== shown?.message) {
    setShown({ message, seq: (shown?.seq ?? 0) + 1 });
  }

  const open = message !== null && dismissed !== message;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Session updates"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{
        bottom: offset
          ? 'calc(9.5rem + env(safe-area-inset-bottom))'
          : 'calc(1.25rem + env(safe-area-inset-bottom))',
      }}
    >
      {shown && (
        <p
          key={shown.seq}
          data-open={open}
          className={cn(
            'flex max-w-[90vw] items-center gap-2 rounded-surface border border-line-ember',
            'elevate-float bg-ash-800/95 text-center text-ui font-medium text-cream-100 backdrop-blur-md',
            'transition-[opacity,transform] ease-out-soft',
            'data-[open=true]:translate-y-0 data-[open=true]:scale-100 data-[open=true]:opacity-100 data-[open=true]:duration-[180ms]',
            'data-[open=false]:translate-y-2 data-[open=false]:scale-[0.97] data-[open=false]:opacity-0 data-[open=false]:duration-[140ms]',
            'py-1.5 pl-4 pr-1.5',
          )}
        >
          <span>{shown.message.text}</span>
          {shown.message.action && (
            <button
              type="button"
              onClick={shown.message.action.onAction}
              className="motion-button pointer-events-auto min-h-11 shrink-0 cursor-pointer rounded-inner bg-linear-to-b from-ember-400 to-ember-600 px-3 text-caption font-bold uppercase tracking-caps text-ash-950 elevate-primary hover:from-ember-300 hover:to-ember-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-300 active:scale-[0.97]"
            >
              {shown.message.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setDismissed(message)}
            className="motion-button pointer-events-auto flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-inner text-cream-500 hover:bg-ash-700 hover:text-cream-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-400"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </p>
      )}
    </div>
  );
}
