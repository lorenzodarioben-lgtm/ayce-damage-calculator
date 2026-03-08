import type { Metadata } from 'next';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';
import { StatsView } from '@/components/stats/StatsView';

export const metadata: Metadata = {
  title: 'Damage analytics — AYCE Damage Calculator',
  description: 'Patterns across your recorded all-you-can-eat sessions, derived on this device.',
  // Analytics derive from this browser's own history. There is no public data
  // set here, so a crawler has no useful page to index.
  robots: { index: false, follow: false },
};

export default function StatsPage() {
  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto max-w-[900px] px-4 pt-8 pb-16 sm:px-6"
      >
        <h1 className="display-hero text-[clamp(2.5rem,7vw,4rem)] text-cream-50">The analysis</h1>
        <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-cream-300">
          Everything below is derived from the sessions on this device, recalculated from their
          recorded meals. Nothing is estimated, and nothing leaves the browser.
        </p>

        <div className="mt-8">
          <StatsView />
        </div>
      </main>

      <SiteFooter>
        Analytics are computed locally from your own filed sessions. No usage is tracked and nothing
        is sent anywhere.
      </SiteFooter>
    </>
  );
}
