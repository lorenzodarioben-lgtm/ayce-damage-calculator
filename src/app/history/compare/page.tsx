import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ComparisonView } from '@/components/history/ComparisonView';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';

export const metadata: Metadata = {
  title: 'Compare sessions — AYCE Damage Calculator',
  description: 'Measure one recorded all-you-can-eat session against another.',
};

export default function ComparePage() {
  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto max-w-[900px] px-4 pt-8 pb-16 sm:px-6"
      >
        <h1 className="display-type text-4xl text-cream-50 sm:text-5xl">Case comparison</h1>
        <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-cream-300">
          Two filed sessions, measured against each other. Both sides are recalculated from their
          recorded meals, so the comparison is like for like.
        </p>

        <div className="mt-8">
          <Suspense
            fallback={
              <p role="status" className="text-sm text-cream-700">
                Retrieving comparison…
              </p>
            }
          >
            <ComparisonView />
          </Suspense>
        </div>
      </main>

      <SiteFooter>
        Recovery differences are stated in percentage points. A move from 134% to 172% is 38
        percentage points, not a 38% increase.
      </SiteFooter>
    </>
  );
}
