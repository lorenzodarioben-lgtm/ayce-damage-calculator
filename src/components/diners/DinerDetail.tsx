'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, UserPlus } from 'lucide-react';
import { ShareBars } from '@/components/stats/ShareBars';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusToast } from '@/components/ui/StatusToast';
import { useMealHistory } from '@/hooks/useMealHistory';
import { useRegularDiners } from '@/hooks/useRegularDiners';
import { useStatusMessage } from '@/hooks/useStatusMessage';
import { formatPlateQuantity } from '@/lib/consumption';
import { buildDinerSummary } from '@/lib/dinerHub';
import {
  formatKg,
  formatMoney,
  formatPercent,
  formatPlates,
  formatRecordedAt,
} from '@/lib/formatting';
import { loadSession, saveSession } from '@/lib/storage';

const BACK_LINK =
  '-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-xs font-semibold ' +
  'uppercase tracking-[0.1em] text-cream-500 transition-colors duration-200 hover:bg-ash-850 hover:text-cream-100';

/**
 * One person, and what the file says about eating with them.
 *
 * Every figure is recomputed from the meals themselves, and the two kinds of
 * figure are kept visibly apart: plates somebody explicitly attributed, and an
 * even share of what the table shared. The second is an assumption and the page
 * says so, rather than presenting one confident number that is part record and
 * part arithmetic.
 */
export function DinerDetail({ id }: { id: string }) {
  const router = useRouter();
  const { diners, hydrated, remove } = useRegularDiners();
  const { records, status } = useMealHistory();
  const [message, announce] = useStatusMessage();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);

  const diner = diners.find((entry) => entry.id === id);

  /**
   * Puts this person on the roster of the meal in progress.
   *
   * Writes the same versioned envelope the calculator writes itself, so it
   * hydrates from it with nothing special to know.
   */
  const addToRoster = useCallback(() => {
    if (!diner) {
      return;
    }
    const current = loadSession();
    const roster = current?.diners ?? [];
    if (roster.some((entry) => entry.id === diner.id)) {
      announce(`${diner.displayName} is already at this table.`);
      return;
    }
    const diners_ = [...roster, { id: diner.id, displayName: diner.displayName }];
    saveSession({
      restaurantName: current?.restaurantName ?? '',
      pricePerDiner: current?.pricePerDiner ?? 59.9,
      dinerCount: Math.max(diners_.length, current?.dinerCount ?? 1),
      ...(current?.pricingProfileId ? { pricingProfileId: current.pricingProfileId } : {}),
      ...(current?.restaurantId ? { restaurantId: current.restaurantId } : {}),
      ...(current?.adjustments?.length ? { adjustments: current.adjustments } : {}),
      items: current?.items ?? [],
      diners: diners_,
    });
    router.push('/');
  }, [announce, diner, router]);

  if (!hydrated || status === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-sm text-cream-700">
        Reading the file…
      </p>
    );
  }

  if (!diner) {
    return (
      <div className="panel border-dashed px-6 py-14 text-center">
        <p className="display-type text-2xl text-cream-300">Nobody by that name here.</p>
        <p className="mx-auto mt-3 max-w-[46ch] text-sm leading-relaxed text-cream-700">
          This person is not saved on this device. Any meals filed with them still hold the roster
          they were recorded with, exactly as it was.
        </p>
        <Link
          href="/diners"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-[10px] border border-line-ember bg-ash-850 px-5 text-sm font-semibold uppercase tracking-[0.1em] text-ember-400 transition-colors duration-200 hover:bg-ash-800"
        >
          Back to the people
        </Link>
      </div>
    );
  }

  const summary = buildDinerSummary(diner, records);
  const categories = summary.categories.filter((entry) => entry.plates > 0);

  return (
    <div className="animate-fade-up space-y-6">
      <Link href="/diners" className={BACK_LINK}>
        <ArrowLeft size={15} aria-hidden="true" />
        Back to the people
      </Link>

      <section aria-labelledby="diner-heading" className="panel p-4 sm:p-5">
        <h1
          id="diner-heading"
          className="display-type break-words text-3xl text-cream-50 sm:text-4xl"
        >
          {diner.displayName}
        </h1>
        <p className="mt-2 text-sm text-cream-500">
          Saved on this device. Every figure below comes from meals you filed with them at the
          table.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="primary" size="md" onClick={() => setRosterOpen(true)}>
            <UserPlus size={16} aria-hidden="true" />
            Add to the current meal
          </Button>
          <Button variant="danger" size="md" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={16} aria-hidden="true" />
            Remove this person
          </Button>
        </div>
      </section>

      <section aria-labelledby="diner-record-heading" className="panel p-4 sm:p-5">
        <h2 id="diner-record-heading" className="micro-label mb-3">
          The record
        </h2>

        {summary.visits === 0 ? (
          <p className="max-w-[56ch] text-sm leading-relaxed text-cream-700">
            No meals filed with them yet. Add them to a table roster and file the report, and their
            share of it appears here. Meals recorded without a roster are not assigned to anybody —
            nobody said who was there, and the calculator will not guess.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Figure label="Meals" value={String(summary.visits)} />
              <Figure label="Their plates" value={formatPlates(summary.effectivePlates)} />
              <Figure
                label="Est. retail value"
                value={formatMoney(summary.retailValue, summary.money)}
              />
              <Figure label="Recovery" value={formatPercent(summary.recoveryPercent)} />
              <Figure label="Food weight" value={formatKg(summary.weightKg)} />
              <Figure label="Paid" value={formatMoney(summary.admission, summary.money)} />
              <Figure label="First meal" value={formatRecordedAt(summary.firstVisitAt ?? '')} />
              <Figure label="Latest meal" value={formatRecordedAt(summary.latestVisitAt ?? '')} />
            </dl>

            <div className="mt-4 rounded-[10px] border border-line-soft bg-ash-900 px-4 py-3">
              <h3 className="micro-label mb-2">How those plates were counted</h3>
              <dl className="grid grid-cols-2 gap-2">
                <Figure
                  label="Explicitly theirs"
                  value={formatPlateQuantity(summary.attributedPlates)}
                />
                <Figure label="Estimated share" value={formatPlateQuantity(summary.sharedPlates)} />
              </dl>
              <p className="mt-2 max-w-[62ch] text-xs leading-relaxed text-cream-700">
                The first figure is a record: somebody said those plates were theirs. The second is
                an even split of what the table shared, which is an assumption rather than a
                measurement — the calculator records one tab and cannot know who reached for what.
              </p>
            </div>

            {categories.length > 0 && (
              <div className="mt-5">
                <h3 className="micro-label mb-2">What they go for</h3>
                <ShareBars tallies={categories} unitLabel="plates" />
              </div>
            )}

            {summary.topFoods.length > 0 && (
              <div className="mt-5">
                <h3 className="micro-label mb-2">Most ordered</h3>
                <ul className="space-y-1">
                  {summary.topFoods.map((food) => (
                    <li
                      key={food.foodId}
                      className="flex items-baseline justify-between gap-3 border-t border-line-soft py-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-cream-100">{food.name}</span>
                      <span className="tabular shrink-0 text-cream-500">
                        {formatPlateQuantity(food.plates)} plates
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5">
              <h3 className="micro-label mb-2">Recent meals</h3>
              <ul className="space-y-1">
                {summary.recent.slice(0, 5).map((visit) => (
                  <li key={visit.recordId} className="border-t border-line-soft py-2">
                    <Link
                      href={`/history/${visit.recordId}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-cream-100 underline-offset-4 hover:underline"
                    >
                      <span className="min-w-0 truncate">
                        {visit.restaurantName || 'Unnamed restaurant'}
                      </span>
                      <span className="tabular shrink-0 text-xs text-cream-500">
                        {formatRecordedAt(visit.recordedAt)} ·{' '}
                        {formatPercent(visit.recoveryPercent)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={rosterOpen}
        title="Add them to the current meal?"
        body={`${diner.displayName} joins the table in the calculator. The plates already on the tab stay shared until you attribute them.`}
        confirmLabel="Add them"
        cancelLabel="Not now"
        onConfirm={() => {
          setRosterOpen(false);
          addToRoster();
        }}
        onCancel={() => setRosterOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Remove this person?"
        body={`This removes ${diner.displayName} from the people saved on this device. Every meal you filed with them keeps its own roster exactly as it was recorded — no history is rewritten and no plate is reassigned.`}
        confirmLabel="Remove them"
        cancelLabel="Keep them"
        onConfirm={() => {
          remove(diner.id);
          setDeleteOpen(false);
          router.push('/diners');
        }}
        onCancel={() => setDeleteOpen(false)}
      />

      <StatusToast message={message} />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-line-soft bg-ash-900 px-3 py-2">
      <dt className="micro-label">{label}</dt>
      <dd className="tabular mt-0.5 text-sm font-semibold text-cream-50">{value}</dd>
    </div>
  );
}
