'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
import { FavoriteQuickAdd } from '@/components/favorites/FavoriteQuickAdd';
import { AddCutDialog } from '@/components/live/AddCutDialog';
import { QuickLogRow } from '@/components/live/QuickLogRow';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';
import { DamageMeter } from '@/components/summary/DamageMeter';
import { PricingProfileProvider } from '@/components/session/PricingContext';
import { Button } from '@/components/ui/Button';
import { StatusToast } from '@/components/ui/StatusToast';
import { useFavorites } from '@/hooks/useFavorites';
import { useMealSession, type AddItemPayload } from '@/hooks/useMealSession';
import { usePricingProfiles } from '@/hooks/usePricingProfiles';
import { useStatusMessage } from '@/hooks/useStatusMessage';
import { useUndoableRemove } from '@/hooks/useUndoableRemove';
import { REPORT_STAGE, STAGE_PARAM } from '@/hooks/useStageHistory';
import { findFood } from '@/data/foods';
import { formatKg, formatMoney, formatPlates } from '@/lib/formatting';

/** Hands the meal back to the calculator, already on the report. */
const REPORT_HREF = `/?${STAGE_PARAM}=${REPORT_STAGE}`;

/**
 * A one-handed logging surface for use at the table.
 *
 * It drives the same session reducer and the same calculation engine as the
 * full builder — there is no second meal model and no second set of sums. What
 * differs is only the interaction: oversized targets, no configuration on the
 * critical path, and the running total pinned in view.
 */
export function LiveMealMode() {
  const pricingProfiles = usePricingProfiles();
  const {
    session,
    report,
    pricingProfile,
    addItem,
    incrementItem,
    decrementItem,
    removeItem,
    restoreItem,
  } = useMealSession(pricingProfiles.profiles);
  const { favorites, remove: removeFavorite } = useFavorites();

  const [addOpen, setAddOpen] = useState(false);
  const [status, announce] = useStatusMessage();

  const handleAdd = useCallback(
    (payload: AddItemPayload) => {
      addItem(payload);
      announce(`${findFood(payload.foodId)?.name ?? 'Item'} added to the quick log.`);
    },
    [addItem, announce],
  );

  const handleFavoriteAdd = useCallback(
    (payload: AddItemPayload, confirmation: string) => {
      addItem(payload);
      announce(confirmation);
    },
    [addItem, announce],
  );

  const handleIncrement = useCallback(
    (id: string) => {
      incrementItem(id);
    },
    [incrementItem],
  );

  const handleRemove = useUndoableRemove({
    items: session.items,
    removeItem,
    restoreItem,
    announce,
    location: 'the quick log',
  });

  const hasItems = report.lines.length > 0;

  return (
    <PricingProfileProvider profile={pricingProfile}>
      <>
        <SiteHeader />

        <main
          id={MAIN_CONTENT_ID}
          className="relative z-10 mx-auto max-w-[640px] px-4 pt-4 pb-28 sm:px-6"
        >
          {/* Pinned under the header: the number the whole mode exists to move. */}
          <section
            aria-labelledby="live-damage-heading"
            className="panel sticky top-[3.5rem] z-20 mb-4 bg-ash-850/95 p-4 backdrop-blur-md"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h1 id="live-damage-heading" className="display-type text-2xl text-cream-50">
                Live damage
              </h1>
              <p className="tabular text-xs text-cream-700">
                {formatPlates(report.totalPlates)} · {formatKg(report.totalWeightKg)}
              </p>
            </div>

            <div className="mt-3">
              <DamageMeter
                compact
                retailValue={report.totalRetailValue}
                totalAdmission={report.totalAdmission}
                recoveryPercent={report.retailRecoveryPercent}
                remainingGap={report.remainingRetailGap}
              />
            </div>
          </section>

          {hasItems ? (
            <ul className="space-y-3">
              {report.lines.map((line) => (
                <QuickLogRow
                  key={line.item.id}
                  line={line}
                  onIncrement={handleIncrement}
                  onDecrement={decrementItem}
                  onRemove={handleRemove}
                />
              ))}
            </ul>
          ) : (
            <div className="panel border-dashed px-6 py-12 text-center">
              <p className="display-type text-2xl text-cream-300">Nothing on the grill yet.</p>
              <p className="mx-auto mt-3 max-w-[40ch] text-sm leading-relaxed text-cream-700">
                Add the cuts you are ordering. Each one gets its own button, so logging a plate is a
                single tap for the rest of the meal.
              </p>
            </div>
          )}

          {favorites.length > 0 && (
            <section aria-labelledby="live-saved-orders-heading" className="mt-4">
              <h2 id="live-saved-orders-heading" className="micro-label mb-2">
                Saved orders
              </h2>
              <FavoriteQuickAdd
                favorites={favorites}
                onAdd={handleFavoriteAdd}
                onRemove={removeFavorite}
                size="large"
              />
            </section>
          )}

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            className="mt-3"
            onClick={() => setAddOpen(true)}
          >
            <Plus size={18} aria-hidden="true" />
            Add a cut
          </Button>

          <div className="mt-6 space-y-2">
            <Link
              href={REPORT_HREF}
              aria-disabled={!hasItems}
              tabIndex={hasItems ? undefined : -1}
              className={
                hasItems
                  ? 'flex min-h-14 w-full items-center justify-center gap-2 rounded-[10px] bg-ember-500 px-6 text-base font-bold uppercase tracking-[0.1em] text-ash-950 transition-colors duration-200 hover:bg-ember-400'
                  : 'pointer-events-none flex min-h-14 w-full items-center justify-center gap-2 rounded-[10px] bg-ash-700 px-6 text-base font-bold uppercase tracking-[0.1em] text-cream-700'
              }
            >
              <Receipt size={18} aria-hidden="true" />
              Calculate the damage
            </Link>

            <p className="text-center text-xs text-cream-700">
              {formatMoney(session.pricePerDiner, pricingProfile.money)} per diner ×{' '}
              {session.dinerCount}.{' '}
              <Link href="/" className="text-ember-500 underline-offset-4 hover:underline">
                Change in the full builder
              </Link>
              .
            </p>
          </div>
        </main>

        <SiteFooter>
          Live mode edits the same session as the calculator. Anything logged here appears on the
          full builder, and the other way round.
        </SiteFooter>

        <StatusToast message={status} />

        <AddCutDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      </>
    </PricingProfileProvider>
  );
}
