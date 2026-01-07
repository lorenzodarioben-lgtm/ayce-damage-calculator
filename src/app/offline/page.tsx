import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';

export const metadata: Metadata = {
  title: 'Offline — AYCE Damage Calculator',
  description: 'The calculator is temporarily unreachable.',
};

/**
 * Served by the service worker when a navigation fails and no cached document
 * covers it. Deliberately static and asset-free so it can always be precached.
 */
export default function OfflinePage() {
  return (
    <main className="relative z-10 mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-6 py-16">
      <BrandMark />

      <h1 className="display-type mt-8 text-4xl text-cream-50 sm:text-5xl">Service interrupted</h1>

      <p className="mt-4 text-sm leading-relaxed text-cream-300">
        This page is not available offline. The calculator itself keeps working once it has been
        opened at least once — the connection is only needed for pages you have not visited yet.
      </p>

      <p className="mt-3 text-sm leading-relaxed text-cream-500">
        Your meal, history and favourites are stored on this device and are unaffected.
      </p>

      <Link
        href="/"
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-[10px] border border-line-ember bg-ash-850 px-5 text-sm font-semibold uppercase tracking-[0.1em] text-ember-400 transition-colors duration-200 hover:bg-ash-800"
      >
        Return to the calculator
      </Link>
    </main>
  );
}
