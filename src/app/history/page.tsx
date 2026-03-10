import type { Metadata } from 'next';
import { HistoryList } from '@/components/history/HistoryList';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { RouteHeader } from '@/components/nav/RouteHeader';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';

export const metadata: Metadata = {
  title: 'Meal history — AYCE Damage Calculator',
  description: 'Previously recorded all-you-can-eat sessions, stored on this device.',
  // The page is meaningful only once this browser has records, which are
  // personal meal history rather than content intended for discovery.
  robots: { index: false, follow: false },
};

export default function HistoryPage() {
  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto max-w-[900px] px-4 pt-8 pb-16 sm:px-6"
      >
        <RouteHeader image="/images/embers.webp" title="The file">
          Every session you have filed, held on this device only. Totals are recalculated from the
          meal each time, so the file always agrees with the current model.
        </RouteHeader>

        <div className="mt-8">
          <HistoryList />
        </div>
      </main>

      <SiteFooter>
        History is stored in this browser. Clearing site data, or opening the calculator in another
        browser, will show an empty file.
      </SiteFooter>
    </>
  );
}
