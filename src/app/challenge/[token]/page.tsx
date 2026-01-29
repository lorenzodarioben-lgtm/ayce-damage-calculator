import type { Metadata } from 'next';
import Link from 'next/link';
import { ComparisonReport } from '@/components/history/ComparisonReport';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';
import { buildChallengeCardModel } from '@/lib/challengeCard';
import { comparisonFromChallenge, decodeChallengePayload } from '@/lib/challengeShare';

interface ChallengePageProps {
  params: Promise<{ token: string }>;
}

/**
 * A read-only head-to-head reconstructed entirely from the URL.
 *
 * Both sides are recalculated by the app's own comparison engine, so a
 * challenge and the `/history/compare` page can never disagree. The visitor's
 * own meal and history are untouched: nothing here writes to storage.
 */
export async function generateMetadata({ params }: ChallengePageProps): Promise<Metadata> {
  const { token } = await params;
  const card = buildChallengeCardModel(token);

  return {
    title: card.title,
    description: card.description,
    // A shared challenge is personal, so it is kept out of search results.
    // Social crawlers fetch the page directly and are unaffected.
    robots: { index: false, follow: false },
    openGraph: {
      type: 'article',
      title: card.title,
      description: card.description,
      siteName: 'AYCE Damage Calculator',
    },
    twitter: {
      card: 'summary_large_image',
      title: card.title,
      description: card.description,
    },
  };
}

const CTA_CLASS =
  'inline-flex min-h-14 items-center justify-center rounded-[10px] bg-ember-500 px-6 text-base ' +
  'font-bold uppercase tracking-[0.1em] text-ash-950 transition-colors duration-200 hover:bg-ember-400';

export default async function ChallengePage({ params }: ChallengePageProps) {
  const { token } = await params;
  const payload = decodeChallengePayload(token);

  if (!payload) {
    return (
      <>
        <SiteHeader />
        <main
          id={MAIN_CONTENT_ID}
          className="relative z-10 mx-auto max-w-[560px] px-4 pt-16 pb-16 sm:px-6"
        >
          <div className="panel border-dashed px-6 py-14 text-center">
            <h1 className="display-type text-3xl text-cream-300">This challenge cannot be read.</h1>
            <p className="mx-auto mt-4 max-w-[44ch] text-sm leading-relaxed text-cream-700">
              The link is incomplete, was altered in transit, or was produced by a version of the
              calculator this one does not understand. Nothing was lost — a challenge lives entirely
              in its own link.
            </p>
            <Link href="/" className={`${CTA_CLASS} mt-8`}>
              Run your own damage report
            </Link>
          </div>
        </main>
        <SiteFooter>
          Shared challenges carry both meals inside the link. There is no database behind them.
        </SiteFooter>
      </>
    );
  }

  const comparison = comparisonFromChallenge(payload);

  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto max-w-[900px] px-4 pt-8 pb-16 sm:px-6"
      >
        <p className="micro-label mb-2">A shared damage challenge</p>
        <h1 className="display-type mb-6 text-4xl text-cream-50 sm:text-5xl">Head to head</h1>

        <div className="space-y-6">
          <ComparisonReport
            comparison={comparison}
            previousLabel={comparison.previous.record.restaurantName || 'The challenger'}
            currentLabel={comparison.current.record.restaurantName || 'The contender'}
          />
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className={CTA_CLASS}>
            Run your own damage report
          </Link>
          <p className="mt-3 text-xs text-cream-700">
            This challenge is read-only and has not changed anything on your device.
          </p>
        </div>
      </main>

      <SiteFooter>
        Recovery differences are stated in percentage points. A move from 138% to 164% is 26
        percentage points, not a 26% increase. Both meals travel inside the link itself — no diner
        names, notes or history travel with them.
      </SiteFooter>
    </>
  );
}
