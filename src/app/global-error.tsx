'use client';

/*
 * `global-error` replaces the root layout when it is the root layout that
 * failed, so it renders its own document and inherits none of the app shell —
 * including the global stylesheet, which is why it is imported here rather than
 * relied upon.
 */
import './globals.css';

interface GlobalErrorProps {
  readonly error: Error & { digest?: string };
  /** Re-renders the boundary's children. Named by the framework. */
  readonly retry: () => void;
}

/**
 * The last surface left when the root layout cannot render.
 *
 * Deliberately self-contained: it imports no shared component, because the
 * failure it exists for may be in shared UI. A metadata export is not supported
 * here, so the document title is declared inline.
 */
export default function GlobalError({ error: _error, retry }: GlobalErrorProps) {
  return (
    <html lang="en-AU">
      <body>
        <title>Service interrupted — AYCE Damage Calculator</title>
        <main className="relative z-10 mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-4 py-16 sm:px-6">
          <p className="micro-label">Service interrupted</p>
          <h1 className="display-type mt-4 text-4xl text-cream-50 sm:text-5xl">
            The grill went cold.
          </h1>
          <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-cream-300">
            The page could not be built. Nothing was written or removed while it failed, so the
            session and history stored in this browser are still there.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={retry}
              className="inline-flex min-h-14 cursor-pointer items-center justify-center rounded-[10px] bg-ember-500 px-6 text-base font-bold uppercase tracking-[0.1em] text-ash-950 transition-colors duration-200 hover:bg-ember-400"
            >
              Try again
            </button>
            {/* A whole-document reload rather than a link: the shell that would
                handle a client navigation is the thing that just failed, and a
                re-render is already what the button beside this one does. */}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-14 cursor-pointer items-center justify-center rounded-[10px] border border-line-ember bg-ash-850 px-6 text-base font-bold uppercase tracking-[0.1em] text-ember-400 transition-colors duration-200 hover:bg-ash-800"
            >
              Reload the page
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
