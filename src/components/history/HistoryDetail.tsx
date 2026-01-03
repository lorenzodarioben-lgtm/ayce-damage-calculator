'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ReportSummary } from '@/components/results/ReportSummary';
import { getPlateSizeMeta, getQualityMeta } from '@/lib/constants';
import { formatMoney, formatPlates, formatRecordedAt, formatWeight } from '@/lib/formatting';
import { resolveSavedSession, type ResolvedSavedSession } from '@/lib/history';
import { getSession } from '@/lib/historyRepository';

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
  const [state, setState] = useState<LoadState>({ status: 'loading' });

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

  const { record, report, verdict } = state.resolved;

  return (
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
        subheading={`Recorded ${formatRecordedAt(record.createdAt)}`}
      />

      <section aria-labelledby="recorded-plates-heading" className="panel p-4 sm:p-5">
        <h3 id="recorded-plates-heading" className="micro-label mb-3">
          What was recorded
        </h3>
        <ul>
          {report.lines.map((line) => (
            <li
              key={line.item.id}
              className="flex items-start justify-between gap-3 border-b border-line-soft py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-cream-50">{line.food.name}</p>
                <p className="text-xs text-cream-500">
                  {getQualityMeta(line.item.quality).label} ·{' '}
                  {getPlateSizeMeta(line.item.plateSize).label}
                </p>
                <p className="tabular mt-0.5 text-xs text-cream-700">
                  {formatPlates(line.plates)} · {formatWeight(line.weightG)}
                </p>
              </div>
              <p className="tabular shrink-0 text-sm font-bold text-ember-400">
                {formatMoney(line.retailValue)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
