import type { Metadata } from 'next';
import { HistoryDetail } from '@/components/history/HistoryDetail';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';

export const metadata: Metadata = {
  title: 'Filed session — AYCE Damage Calculator',
  description: 'A previously recorded all-you-can-eat session.',
  // The record only exists on the device that filed it.
  robots: { index: false, follow: false },
};

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-[900px] px-4 pt-6 pb-16 sm:px-6">
        <HistoryDetail id={id} />
      </main>

      <SiteFooter>
        Estimates only. Prices, portions and nutrition vary by supplier, restaurant and preparation.
        Estimated ingredient margin is not restaurant profit.
      </SiteFooter>
    </>
  );
}
