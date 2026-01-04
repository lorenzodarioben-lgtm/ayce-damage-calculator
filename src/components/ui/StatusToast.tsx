'use client';

interface StatusToastProps {
  message: string | null;
  /**
   * Raised above the mobile sticky bar so the two never overlap. Defaults to
   * false, which is right for every screen that has no such bar.
   */
  offset?: boolean;
}

/**
 * The live region always exists so assistive technology announces updates;
 * only the visual bubble mounts and unmounts.
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
        <p className="animate-toast-in max-w-[90vw] rounded-full border border-line-ember bg-ash-800 px-4 py-2 text-center text-sm font-medium text-cream-100 shadow-[0_12px_32px_-12px_#000]">
          {message}
        </p>
      )}
    </div>
  );
}
