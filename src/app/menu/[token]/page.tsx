import type { Metadata } from 'next';
import Link from 'next/link';
import { MenuPreview } from '@/components/menu/MenuPreview';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';
import { decodeMenuPayload } from '@/lib/menuShare';

interface MenuPageProps {
  params: Promise<{ token: string }>;
}

/**
 * A personal menu reconstructed entirely from the URL.
 *
 * Read-only on arrival. The visitor's own pricing profiles, custom foods,
 * restaurants and history are untouched until they explicitly import, and even
 * then nothing of theirs is replaced.
 */
export const metadata: Metadata = {
  title: 'A shared menu — AYCE Damage Calculator',
  description: 'Someone else’s local price assumptions and custom foods, previewed read-only.',
  // A shared menu is personal, exactly like a shared report.
  robots: { index: false, follow: false },
};

const CTA_CLASS =
  'inline-flex min-h-14 items-center justify-center rounded-[10px] bg-ember-500 px-6 text-base ' +
  'font-bold uppercase tracking-[0.1em] text-ash-950 transition-colors duration-200 hover:bg-ember-400';

export default async function SharedMenuPage({ params }: MenuPageProps) {
  const { token } = await params;
  const payload = decodeMenuPayload(token);

  if (!payload) {
    return (
      <>
        <SiteHeader />
        <main
          id={MAIN_CONTENT_ID}
          className="relative z-10 mx-auto max-w-[560px] px-4 pt-16 pb-16 sm:px-6"
        >
          <div className="panel border-dashed px-6 py-14 text-center">
            <h1 className="display-type text-3xl text-cream-300">This menu cannot be read.</h1>
            <p className="mx-auto mt-4 max-w-[44ch] text-sm leading-relaxed text-cream-700">
              The link is incomplete, was altered in transit, or was produced by a version of the
              calculator this one does not understand. Nothing was lost — a shared menu lives
              entirely in its own link.
            </p>
            <Link href="/" className={`${CTA_CLASS} mt-8`}>
              Open the calculator
            </Link>
          </div>
        </main>
        <SiteFooter>
          Shared menus carry their whole contents inside the link. There is no database behind them.
        </SiteFooter>
      </>
    );
  }

  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto max-w-[900px] px-4 pt-8 pb-16 sm:px-6"
      >
        <MenuPreview payload={payload} />
      </main>

      <SiteFooter>
        This link contains the shared menu itself — the price assumptions, the custom foods and, if
        the sender chose to include it, a restaurant setup. Nothing was uploaded, and no history,
        saved order or diner name travels with it.
      </SiteFooter>
    </>
  );
}
