import type { Metadata } from 'next';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';
import { RestaurantDetail } from '@/components/restaurants/RestaurantDetail';

export const metadata: Metadata = {
  title: 'A saved restaurant — AYCE Damage Calculator',
  description: 'One saved place, and the visits filed against it on this device.',
  // The place and its visits only exist on the device that saved them.
  robots: { index: false, follow: false },
};

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto max-w-[900px] px-4 pt-6 pb-16 sm:px-6"
      >
        <RestaurantDetail id={id} />
      </main>

      <SiteFooter>
        Deleting a place removes its saved setup only. Filed visits keep the name, prices and menu
        context they were recorded with.
      </SiteFooter>
    </>
  );
}
