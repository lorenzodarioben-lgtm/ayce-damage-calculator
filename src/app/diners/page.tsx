import type { Metadata } from 'next';
import { DinerList } from '@/components/diners/DinerList';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { RouteHeader } from '@/components/nav/RouteHeader';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';

export const metadata: Metadata = {
  title: 'Diners — AYCE Damage Calculator',
  description:
    'The people saved on this device, and what your own records say about eating with them.',
  // Names and meal patterns exist only in this browser. A cold visitor has no
  // directory to see, so search results would be both misleading and risky.
  robots: { index: false, follow: false },
};

export default function DinersPage() {
  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto max-w-[900px] px-4 pt-8 pb-16 sm:px-6"
      >
        <RouteHeader image="/images/table.webp" title="Known diners">
          People you have saved from a table roster, with their share of the meals you filed
          together. Every figure is recalculated from the meals themselves. A meal recorded without
          a roster is not assigned to anybody — nobody said who was there.
        </RouteHeader>

        <div className="mt-8">
          <DinerList />
        </div>
      </main>

      <SiteFooter>
        A person here is a name and a local identifier, saved in this browser. There is no contact
        list, no account and no sync, and nothing about them leaves the device.
      </SiteFooter>
    </>
  );
}
