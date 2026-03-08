import type { Metadata } from 'next';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';
import { RestaurantList } from '@/components/restaurants/RestaurantList';

export const metadata: Metadata = {
  title: 'Restaurants — AYCE Damage Calculator',
  description:
    'The places you have saved on this device, and what your own records say about them.',
  // This is a personal list rather than a public restaurant directory. It is
  // empty for a cold visitor and should never be presented as a search result.
  robots: { index: false, follow: false },
};

export default function RestaurantsPage() {
  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto max-w-[900px] px-4 pt-8 pb-16 sm:px-6"
      >
        <h1 className="display-hero text-[clamp(2.5rem,7vw,4rem)] text-cream-50">
          Known establishments
        </h1>
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-cream-300">
          Places you have saved, with the visits you have filed against each one. Every figure comes
          from your own records, recalculated from the meals themselves. There is still no bundled
          restaurant directory here — a place exists because you named it.
        </p>

        <div className="mt-8">
          <RestaurantList />
        </div>
      </main>

      <SiteFooter>
        Restaurants are saved in this browser. No address, rating or menu is fetched from anywhere,
        and nothing about them leaves the device.
      </SiteFooter>
    </>
  );
}
