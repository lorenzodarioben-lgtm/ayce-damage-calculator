'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { AchievementList } from '@/components/results/AchievementList';
import { MealBreakdown } from '@/components/results/MealBreakdown';
import { ReportSummary } from '@/components/results/ReportSummary';
import { PricingProfileProvider } from '@/components/session/PricingContext';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatPlates, formatRecordedAt } from '@/lib/formatting';
import { resolveSavedSession, sessionFromSaved, type ResolvedSavedSession } from '@/lib/history';
import { getSession } from '@/lib/historyRepository';
import { loadSession, saveSession as saveActiveSession } from '@/lib/storage';
import type { SavedMealSession } from '@/types/history';

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'found'; resolved: ResolvedSavedSession };

const BACK_LINK =
  '-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-xs font-semibold ' +
  'uppercase tracking-[0.1em] text-cream-500 transition-colors duration-200 hover:bg-ash-850 hover:text-cream-100';

/**
 * A filed session, rendered read-only.
 *
 * The record is looked up on the client because history never leaves the
 * device; there is nothing for a server to render.
 */
export function HistoryDetail({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [pendingRerun, setPendingRerun] = useState<SavedMealSession | null>(null);

  /**
   * Loads the filed meal into the calculator and hands the diner over to it.
   *
   * The record itself is untouched: it is copied into the in-progress session,
   * which is the same versioned envelope the calculator writes itself, so the
   * calculator hydrates from it on arrival with nothing special to know.
   */
  const rerun = useCallback(
    (record: SavedMealSession) => {
      saveActiveSession(sessionFromSaved(record));
      router.push('/');
    },
    [router],
  );

  const handleRerun = useCallback(
    (record: SavedMealSession) => {
      const current = loadSession();
      // Overwriting plates someone is in the middle of eating is not a thing to
      // do quietly.
      if (current && current.items.length > 0) {
        setPendingRerun(record);
        return;
      }
      rerun(record);
    },
    [rerun],
  );

  useEffect(() => {
    let cancelled = false;

    void getSession(id).then((record) => {
      if (cancelled) {
        return;
      }
      setState(
        record ? { status: 'found', resolved: resolveSavedSession(record) } : { status: 'missing' },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-sm text-cream-700">
        Retrieving the record…
      </p>
    );
  }

  if (state.status === 'missing') {
    return (
      <div className="panel border-dashed px-6 py-14 text-center">
        <p className="display-type text-2xl text-cream-300">No such record.</p>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-cream-700">
          This session is not in the file on this device. It may have been deleted, or filed in a
          different browser.
        </p>
        <Link
          href="/history"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-[10px] border border-line-ember bg-ash-850 px-5 text-sm font-semibold uppercase tracking-[0.1em] text-ember-400 transition-colors duration-200 hover:bg-ash-800"
        >
          Back to the file
        </Link>
      </div>
    );
  }

  const { record, report, verdict, achievements } = state.resolved;

  return (
    <PricingProfileProvider profile={record.pricingProfile}>
      <div className="animate-fade-up space-y-6">
        <Link href="/history" className={BACK_LINK}>
          <ArrowLeft size={15} aria-hidden="true" />
          Back to the file
        </Link>

        <ReportSummary
          report={report}
          verdict={verdict}
          restaurantName={record.restaurantName}
          heading="Filed Damage Report"
          headingId="saved-report-heading"
          headingLevel={1}
          subheading={`Recorded ${formatRecordedAt(record.createdAt)}`}
        />

        {record.note && (
          <section aria-labelledby="saved-note-heading" className="panel p-4 sm:p-5">
            <h3 id="saved-note-heading" className="micro-label mb-2">
              Note on file
            </h3>
            <p className="break-words text-sm leading-relaxed text-cream-300">{record.note}</p>
          </section>
        )}

        {/* Read from the record, so a session shows what it earned at the time. */}
        <AchievementList achievements={achievements} headingId="saved-achievements-heading" />

        <MealBreakdown lines={report.lines} headingId="recorded-plates-heading" />

        {/* The point of keeping a record of a good order is being able to place
          it again. */}
        <Button variant="secondary" size="lg" fullWidth onClick={() => handleRerun(record)}>
          <RotateCcw size={18} aria-hidden="true" />
          Order this again
        </Button>

        <ConfirmDialog
          open={pendingRerun !== null}
          title="Replace the meal in progress?"
          body={`There is already a tab open in the calculator. Loading this record replaces it with ${formatPlates(report.totalPlates)} from ${record.restaurantName || 'an unnamed restaurant'}. The filed record itself is not changed.`}
          confirmLabel="Load this meal"
          cancelLabel="Keep my tab"
          onConfirm={() => {
            const target = pendingRerun;
            setPendingRerun(null);
            if (target) {
              rerun(target);
            }
          }}
          onCancel={() => setPendingRerun(null)}
        />
      </div>
    </PricingProfileProvider>
  );
}
