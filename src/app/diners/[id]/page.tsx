import type { Metadata } from 'next';
import { DinerDetail } from '@/components/diners/DinerDetail';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';

export const metadata: Metadata = {
  title: 'A saved diner — AYCE Damage Calculator',
  description: 'One person, and their share of the meals filed with them on this device.',
  // A person and their meals only exist on the device that recorded them.
  robots: { index: false, follow: false },
};

export default async function DinerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto max-w-[900px] px-4 pt-6 pb-16 sm:px-6"
      >
        <DinerDetail id={id} />
      </main>

      <SiteFooter>
        Removing a person removes their saved profile only. Filed meals keep the roster they were
        recorded with, and no plate is ever reassigned.
      </SiteFooter>
    </>
  );
}
