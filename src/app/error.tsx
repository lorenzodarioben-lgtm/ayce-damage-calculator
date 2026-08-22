'use client';

import Link from 'next/link';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';
import { Button } from '@/components/ui/Button';

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly retry: () => void;
}

/**
 * A route-level recovery surface. Storage reads already degrade gracefully;
 * this is the last line of defence for an unexpected render failure.
 */
export default function ErrorPage({ error: _error, retry }: ErrorPageProps) {
  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto flex min-h-[calc(100dvh-14rem)] max-w-[560px] flex-col justify-center px-4 py-16 sm:px-6"
      >
        <p className="micro-label">Service interrupted</p>
        <h1 className="display-type mt-4 text-4xl text-cream-50 sm:text-5xl">
          That page hit a flare-up.
        </h1>
        <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-cream-300">
          Your meal data has not been reset. Try loading this page again, or return to the
          calculator and continue from there.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={retry}>
            Try again
          </Button>
          <Link
            href="/"
            className="inline-flex min-h-14 items-center justify-center rounded-[10px] border border-line-ember bg-ash-850 px-6 text-base font-bold uppercase tracking-[0.1em] text-ember-400 transition-colors duration-200 hover:bg-ash-800"
          >
            Return to calculator
          </Link>
        </div>
      </main>

      <SiteFooter>
        A temporary display problem does not remove the session stored in this browser.
      </SiteFooter>
    </>
  );
}
