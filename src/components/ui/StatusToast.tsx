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
            'bg-ash-800/95 text-center text-sm font-medium text-cream-100 backdrop-blur-md',
            'shadow-[inset_0_1px_0_rgb(255_250_240/0.07),0_18px_44px_-16px_#000]',
            message.action ? 'py-2 pl-4 pr-2' : 'px-4 py-2',
          )}
        >
          <span>{message.text}</span>
          {message.action && (
            <button
              type="button"
              onClick={message.action.onAction}
              className="pointer-events-auto min-h-9 shrink-0 cursor-pointer rounded-full bg-linear-to-b from-ember-400 to-ember-600 px-3 text-xs font-bold uppercase tracking-[0.08em] text-ash-950 shadow-[inset_0_1px_0_rgb(255_250_240/0.35)] transition-[background-color,transform] duration-200 hover:from-ember-300 hover:to-ember-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-300 active:scale-95"
            >
              {message.action.label}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
