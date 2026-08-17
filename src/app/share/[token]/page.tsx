import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';
import { AchievementList } from '@/components/results/AchievementList';
import { MealBreakdown } from '@/components/results/MealBreakdown';
import { ReportSummary } from '@/components/results/ReportSummary';
import { ResultCard } from '@/components/results/ResultCard';
import { evaluateAchievements } from '@/lib/achievements';
import { buildDamageReport } from '@/lib/calculations';
import { buildResultCardModel } from '@/lib/resultCard';
import { decodeSharePayload } from '@/lib/shareLink';
import { socialCardFromToken } from '@/lib/socialCard';
import { getVerdict } from '@/lib/verdicts';

interface SharePageProps {
  params: Promise<{ token: string }>;
}

/**
 * A read-only damage report reconstructed entirely from the URL.
 *
 * The visitor's own meal is never touched: nothing here writes to storage, and
 * the only way to act on the page is to start a session of your own.
 */

/**
 * Metadata is derived from the same token the page renders, so the preview a
 * platform shows and the report a visitor lands on can never disagree. An
 * unreadable token falls back to the app's own description rather than
 * advertising a report that does not exist.
 */
export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const card = socialCardFromToken(token);

  return {
    title: card.title,
    description: card.description,
    // A shared meal is personal, so it is kept out of search results. Social
    // crawlers fetch the page directly and are unaffected.
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

function UnreadableToken() {
  return (
    <main
      id={MAIN_CONTENT_ID}
      className="relative z-10 mx-auto max-w-[560px] px-4 pt-16 pb-16 sm:px-6"
    >
      <div className="panel border-dashed px-6 py-14 text-center">
        <h1 className="display-type text-3xl text-cream-300">This report cannot be read.</h1>
        <p className="mx-auto mt-4 max-w-[44ch] text-sm leading-relaxed text-cream-700">
          The link is incomplete, was altered in transit, or was produced by a version of the
          calculator this one does not understand. Nothing was lost — a shared report lives entirely
          in its own link.
        </p>
        <Link href="/" className={`${CTA_CLASS} mt-8`}>
          Run your own damage report
        </Link>
      </div>
    </main>
  );
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const payload = decodeSharePayload(token);

  if (!payload) {
    return (
      <>
        <SiteHeader />
        <UnreadableToken />
        <SiteFooter>
          Shared reports carry their whole meal inside the link. There is no database behind them.
        </SiteFooter>
      </>
    );
  }

  const report = buildDamageReport(payload.items, payload);
  const verdict = getVerdict(report.totalRetailValue, report.totalAdmission);
  const achievements = evaluateAchievements(report, payload.dinerCount);
  const cardModel = buildResultCardModel(report, verdict, payload.restaurantName);

  return (
    <>
      <SiteHeader />

      <main
        id={MAIN_CONTENT_ID}
        className="relative z-10 mx-auto max-w-[900px] px-4 pt-8 pb-16 sm:px-6"
      >
        <p className="micro-label mb-4">A shared damage report</p>

        <ReportSummary
          report={report}
          verdict={verdict}
          restaurantName={payload.restaurantName}
          heading="AYCE Damage Report"
          headingId="shared-report-heading"
          headingLevel={1}
        />

        <div className="mt-6">
          <MealBreakdown
            lines={report.lines}
            headingId="shared-breakdown-heading"
            heading="What was eaten"
          />
        </div>

        <div className="mt-6">
          <AchievementList achievements={achievements} headingId="shared-achievements-heading" />
        </div>

        <section aria-labelledby="shared-card-heading" className="panel mt-6 p-4 sm:p-5">
          <h3 id="shared-card-heading" className="micro-label mb-4">
            The card
          </h3>
          <div className="flex justify-center overflow-x-auto pb-1">
            <ResultCard model={cardModel} />
          </div>
        </section>

        <div className="mt-8 text-center">
          <Link href="/" className={CTA_CLASS}>
            Run your own damage report
          </Link>
          <p className="mt-3 text-xs text-cream-700">
            This report is read-only and has not changed anything on your device.
          </p>
        </div>
      </main>

      <SiteFooter>
        This link contains the shared meal itself — the plates, the entry price and the restaurant
        name, encoded into the address. Nothing was uploaded, and no other data travels with it.
      </SiteFooter>
    </>
  );
}
