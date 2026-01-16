import Link from 'next/link';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';

export default function NotFound() {
  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto flex min-h-[calc(100dvh-14rem)] max-w-[560px] flex-col justify-center px-4 py-16 sm:px-6"
      >
        <p className="micro-label">404 — lost at the buffet</p>
        <h1 className="display-type mt-4 text-4xl text-cream-50 sm:text-5xl">
          This table does not exist.
        </h1>
        <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-cream-300">
          The address may be incomplete, or the page may have moved. Your in-progress meal is still
          safe on this device.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-12 w-fit items-center justify-center rounded-[10px] bg-ember-500 px-5 text-sm font-bold uppercase tracking-[0.1em] text-ash-950 transition-colors duration-200 hover:bg-ember-400"
        >
          Return to the calculator
        </Link>
      </main>

      <SiteFooter>
        The calculator keeps your in-progress meal in this browser until you reset it.
      </SiteFooter>
    </>
  );
}
