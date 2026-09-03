'use client';

import { cn } from '@/lib/cn';
import type { StatusMessage } from '@/hooks/useStatusMessage';

interface StatusToastProps {
  message: StatusMessage | null;
  /**
   * Raised above the mobile sticky bar so the two never overlap. Defaults to
   * false, which is right for every screen that has no such bar.
   */
  offset?: boolean;
}

/**
 * The live region always exists so assistive technology announces updates;
 * only the visual bubble mounts and unmounts.
 *
 * The container ignores pointer events so a resting toast can never intercept a
 * tap meant for the page beneath it. Only the action button, when there is one,
 * takes them back.
 */
export function StatusToast({ message, offset = false }: StatusToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Session updates"
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{
        bottom: offset
          ? 'calc(4.75rem + env(safe-area-inset-bottom))'
          : 'calc(1.25rem + env(safe-area-inset-bottom))',
      }}
    >
      {message && (
        <p
          className={cn(
            'animate-toast-in flex max-w-[90vw] items-center gap-3 rounded-full border border-line-ember',
            'bg-ash-800 text-center text-sm font-medium text-cream-100 shadow-[0_12px_32px_-12px_#000]',
            message.action ? 'py-2 pl-4 pr-2' : 'px-4 py-2',
          )}
        >
          <span>{message.text}</span>
          {message.action && (
            <button
              type="button"
              onClick={message.action.onAction}
              className="pointer-events-auto min-h-9 shrink-0 cursor-pointer rounded-full bg-ember-500 px-3 text-xs font-bold uppercase tracking-[0.08em] text-ash-950 transition-colors duration-200 hover:bg-ember-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-300"
            >
              {message.action.label}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
