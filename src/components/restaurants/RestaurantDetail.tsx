'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Link2, Play, Trash2 } from 'lucide-react';
import { RecoveryTrend } from '@/components/stats/RecoveryTrend';
import { ShareBars } from '@/components/stats/ShareBars';
import { Button, EMPTY_STATE_LINK } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusToast } from '@/components/ui/StatusToast';
import { useMealHistory } from '@/hooks/useMealHistory';
import { useRestaurants } from '@/hooks/useRestaurants';
import { useStatusMessage } from '@/hooks/useStatusMessage';
import {
  formatKg,
  formatMoney,
  formatPercent,
  formatPlates,
  formatRecordedAt,
} from '@/lib/formatting';
import { putSessions } from '@/lib/historyRepository';
import { buildRestaurantSummary, unlinkedVisitCandidates } from '@/lib/restaurantHub';
import { loadSession, saveSession } from '@/lib/storage';

const BACK_LINK =
  '-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-xs font-semibold ' +
  'uppercase tracking-[0.1em] text-cream-500 transition-colors duration-200 hover:bg-ash-850 hover:text-cream-100';

/**
 * One place, and what the file says about visiting it.
 *
 * A record belongs here because the meal was started from this profile, or
 * because the diner explicitly linked it. Nothing is claimed on the strength of
 * a matching name, and deleting the profile leaves every filed visit exactly
 * where it is.
 */
export function RestaurantDetail({ id }: { id: string }) {
  const router = useRouter();
  const { restaurants, hydrated, remove } = useRestaurants();
  const { records, status, applyWritten } = useMealHistory();
  const [status_, announce] = useStatusMessage();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linking, setLinking] = useState(false);

  const profile = restaurants.find((entry) => entry.id === id);

  /**
   * Opens a fresh tab at this restaurant.
   *
   * Writes the same versioned envelope the calculator writes itself, so it
   * hydrates from it on arrival with nothing special to know — and carries the
   * link, so filing the report records the visit here.
   */
  const startMeal = useCallback(() => {
    if (!profile) {
      return;
    }
    saveSession({
      restaurantName: profile.name,
      restaurantId: profile.id,
      pricePerDiner: profile.pricePerDiner,
      dinerCount: profile.dinerCount,
      pricingProfileId: profile.pricingProfileId,
      items: [],
    });
    router.push('/');
  }, [profile, router]);

  const requestStart = useCallback(() => {
    const current = loadSession();
    if (current && current.items.length > 0) {
      setStartOpen(true);
      return;
    }
    startMeal();
  }, [startMeal]);

  const linkCandidates = useMemo(
    () => (profile ? unlinkedVisitCandidates(records, profile) : []),
    [profile, records],
  );

  /**
   * Records the candidates as visits here, and only then says so.
   *
   * The dialog stays open and inert until IndexedDB has committed, because
   * every part of this screen is a fold over the same records: announcing the
   * link, closing the workflow or re-reading the summary before the transaction
   * lands would report a change that a reload could still take away. On a
   * refused write nothing local moves at all, so the candidates stay exactly
   * where they were, still offered.
   */
  const linkVisits = useCallback(async () => {
    if (!profile || linking || linkCandidates.length === 0) {
      return;
    }
    const updated = linkCandidates.map((record) => ({ ...record, restaurantId: profile.id }));
    setLinking(true);
    const written = await putSessions(updated);
    setLinking(false);
    setLinkOpen(false);

    if (!written) {
      announce('Those visits could not be linked — this device refused the write.');
      return;
    }

    // Safe to fold in now: these are the rows the repository just accepted, so
    // the summary, the recent visits and the candidate list all recompute from
    // one set of records that genuinely exists on disk.
    applyWritten(updated);
    announce(
      `${updated.length} ${updated.length === 1 ? 'visit' : 'visits'} linked to ${profile.name}.`,
    );
  }, [announce, applyWritten, linkCandidates, linking, profile]);

  if (!hydrated || status === 'loading') {
    return (
      <p role="status" className="py-16 text-center text-sm text-cream-700">
        Reading the file…
      </p>
    );
  }

  if (!profile) {
    return (
      <div className="panel border-dashed px-6 py-14 text-center">
        <p className="display-type text-2xl text-cream-300">No such place.</p>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-cream-700">
          This restaurant is not saved on this device. Any meals you filed against it are still in
          the file, with the name and prices they were recorded under.
        </p>
        <Link href="/restaurants" className={EMPTY_STATE_LINK}>
          Back to the places
        </Link>
      </div>
    );
  }

  const summary = buildRestaurantSummary(profile, records);
  const categories = summary.analytics.categories.filter((entry) => entry.plates > 0);

  return (
    <div className="animate-fade-up space-y-6">
      <Link href="/restaurants" className={BACK_LINK}>
        <ArrowLeft size={15} aria-hidden="true" />
        Back to the places
      </Link>

      <section aria-labelledby="restaurant-heading" className="panel p-4 sm:p-5">
        <h1 id="restaurant-heading" className="display-type text-3xl text-cream-50 sm:text-4xl">
          {profile.name}
        </h1>
        <p className="tabular mt-2 text-sm text-cream-500">
          Saved setup: {formatMoney(profile.pricePerDiner, summary.money)} per diner ·{' '}
          {profile.dinerCount} {profile.dinerCount === 1 ? 'diner' : 'diners'}
        </p>
        {profile.note && (
          <p className="mt-2 max-w-[56ch] break-words text-sm leading-relaxed text-cream-300">
            {profile.note}
          </p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="primary" size="md" onClick={requestStart}>
            <Play size={16} aria-hidden="true" />
            Start a meal here
          </Button>
          <Button variant="danger" size="md" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={16} aria-hidden="true" />
            Delete this place
          </Button>
        </div>
      </section>

      <section aria-labelledby="restaurant-visits-heading" className="panel p-4 sm:p-5">
        <h2 id="restaurant-visits-heading" className="micro-label mb-3">
          The record
        </h2>

        {summary.visits === 0 ? (
          <p className="max-w-[56ch] text-sm leading-relaxed text-cream-700">
            No visits filed here yet. Start a meal from this place and file the report, and it will
            appear with everything that follows it.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Figure label="Visits" value={String(summary.visits)} />
              <Figure
                label="Average recovery"
                value={formatPercent(summary.averageRecoveryPercent)}
              />
              <Figure label="Best recovery" value={formatPercent(summary.bestRecoveryPercent)} />
              <Figure
                label="Average admission"
                value={formatMoney(summary.averageAdmission, summary.money)}
              />
              <Figure label="Average plates" value={formatPlates(summary.averagePlates)} />
              <Figure label="Average weight" value={formatKg(summary.averageWeightKg)} />
              <Figure label="First visit" value={formatRecordedAt(summary.firstVisitAt ?? '')} />
              <Figure label="Latest visit" value={formatRecordedAt(summary.latestVisitAt ?? '')} />
            </dl>

            {summary.analytics.trend.length > 1 && (
              <div className="mt-5">
                <h3 id="restaurant-trend-heading" className="micro-label mb-2">
                  Recovery over time
                </h3>
                <RecoveryTrend
                  points={summary.analytics.trend}
                  headingId="restaurant-trend-heading"
                />
              </div>
            )}

            {categories.length > 0 && (
              <div className="mt-5">
                <h3 className="micro-label mb-2">Category mix</h3>
                <ShareBars tallies={categories} unitLabel="plates" />
              </div>
            )}

            {summary.analytics.topFoods.length > 0 && (
              <div className="mt-5">
                <h3 className="micro-label mb-2">Most ordered here</h3>
                <ul className="space-y-1">
                  {summary.analytics.topFoods.map((food) => (
                    <li
                      key={food.foodId}
                      className="flex items-baseline justify-between gap-3 border-t border-line-soft py-2 text-sm"
                    >
                      <span className="text-cream-100">{food.name}</span>
                      <span className="tabular text-cream-500">{formatPlates(food.plates)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5">
              <h3 className="micro-label mb-2">Recent visits</h3>
              <ul className="space-y-1">
                {summary.records.slice(0, 5).map((record) => (
                  <li key={record.id} className="border-t border-line-soft py-2">
                    <Link
                      href={`/history/${record.id}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-cream-100 underline-offset-4 hover:underline"
                    >
                      <span>{formatRecordedAt(record.createdAt)}</span>
                      <span className="tabular text-xs text-cream-500">
                        {formatPercent(record.snapshot.retailRecoveryPercent)} ·{' '}
                        {formatPlates(record.snapshot.totalPlates)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      {linkCandidates.length > 0 && (
        <section
          aria-labelledby="restaurant-link-heading"
          className="panel border-dashed p-4 sm:p-5"
        >
          <h2 id="restaurant-link-heading" className="micro-label mb-2">
            Older visits that might belong here
          </h2>
          <p className="max-w-[60ch] text-sm leading-relaxed text-cream-300">
            {linkCandidates.length}{' '}
            {linkCandidates.length === 1 ? 'filed record names' : 'filed records name'} this
            restaurant but are not linked to it. A matching name is not proof they are the same
            place, so nothing is assumed — link them only if they are.
          </p>
          <Button variant="secondary" size="md" className="mt-3" onClick={() => setLinkOpen(true)}>
            <Link2 size={16} aria-hidden="true" />
            Link these visits
          </Button>
        </section>
      )}

      <ConfirmDialog
        open={startOpen}
        title="Replace the meal in progress?"
        body={`There is already a tab open in the calculator. Starting a meal at ${profile.name} clears it and sets the entry price to ${formatMoney(profile.pricePerDiner, summary.money)} per diner. Filed records are not affected.`}
        confirmLabel="Start here"
        cancelLabel="Keep my tab"
        onConfirm={() => {
          setStartOpen(false);
          startMeal();
        }}
        onCancel={() => setStartOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this place?"
        body={`This removes the saved setup for ${profile.name} from this device. Every meal you filed here stays in your history exactly as it was recorded, with its own name, prices and menu context.`}
        confirmLabel="Delete the place"
        cancelLabel="Keep it"
        onConfirm={() => {
          remove(profile.id);
          setDeleteOpen(false);
          router.push('/restaurants');
        }}
        onCancel={() => setDeleteOpen(false)}
      />

      <ConfirmDialog
        open={linkOpen}
        title="Link these visits?"
        body={`This records ${linkCandidates.length} filed ${linkCandidates.length === 1 ? 'meal' : 'meals'} as visits to ${profile.name}. The meals themselves are unchanged — only the place they are counted under.`}
        confirmLabel="Link them"
        cancelLabel="Leave them unlinked"
        busy={linking}
        busyLabel="Linking…"
        busyMessage="Writing the link to this device…"
        onConfirm={() => {
          void linkVisits();
        }}
        onCancel={() => {
          if (!linking) {
            setLinkOpen(false);
          }
        }}
      />

      <StatusToast message={status_} />
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
