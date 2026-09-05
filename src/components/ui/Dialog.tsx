'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  labelledById: string;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A modal built on the native dialog element, which supplies the backdrop,
 * inertness and Escape handling; focus is trapped explicitly for older engines.
 */
export function Dialog({ open, onClose, title, children, labelledById }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    if (open && !node.open) {
      node.showModal();
      node.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledById}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
      className="m-auto max-h-[85dvh] w-[min(38rem,calc(100vw-2rem))] overflow-y-auto rounded-panel border border-line-ember bg-ash-850 bg-[image:var(--fill-panel)] p-0 text-cream-100 shadow-[var(--shadow-float)] backdrop:bg-black/75 backdrop:backdrop-blur-sm"
    >
      {/* The header stays put while the body scrolls under it, so it needs to
          be opaque and to cast a little shade over what passes beneath. */}
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-ash-850/95 px-5 py-4 shadow-[0_10px_20px_-18px_#000] backdrop-blur-sm">
        <h2 id={labelledById} className="display-type text-2xl text-cream-50">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="-mr-1 -mt-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-cream-500 transition-colors hover:bg-ash-800 hover:text-cream-100"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="px-5 py-5">{children}</div>
    </dialog>
  );
}
