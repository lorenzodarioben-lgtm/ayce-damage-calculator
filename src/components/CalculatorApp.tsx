'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Hero } from '@/components/Hero';
import { MealBuilder } from '@/components/meal/MealBuilder';
import { SiteFooter } from '@/components/nav/SiteFooter';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { MAIN_CONTENT_ID } from '@/components/nav/destinations';
import { DamageReport } from '@/components/results/DamageReport';
import { SessionSetup } from '@/components/session/SessionSetup';
import { SessionConflictNotice } from '@/components/session/SessionConflictNotice';
import { PricingProfileProvider } from '@/components/session/PricingContext';
import { LiveSummary } from '@/components/summary/LiveSummary';
import { StickySummaryBar } from '@/components/summary/StickySummaryBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusToast } from '@/components/ui/StatusToast';
import { useMealSession, type AddItemPayload } from '@/hooks/useMealSession';
import { useCustomFoods } from '@/hooks/useCustomFoods';
import { usePricingProfiles } from '@/hooks/usePricingProfiles';
import { useRegularDiners } from '@/hooks/useRegularDiners';
import { useStageHistory } from '@/hooks/useStageHistory';
import { useStatusMessage } from '@/hooks/useStatusMessage';
import { useUndoableRemove } from '@/hooks/useUndoableRemove';
import { DEFAULT_PRICING_PROFILE_ID } from '@/lib/pricing';

export function CalculatorApp() {
  const pricingProfiles = usePricingProfiles();
  const customFoods = useCustomFoods();
  const regularDiners = useRegularDiners();
  const {
    session,
    report,
    hydrated,
    setRestaurantName,
    setPricePerDiner,
    setPricingProfile,
    adjustDinerCount,
    applySetup,
    addDiner,
    renameDiner,
    setDinerAdmissionPrice,
    removeDiner,
    moveDiner,
    clearDiners,
    addItem,
    incrementItem,
    decrementItem,
    removeItem,
    restoreItem,
    resetSession,
    sessionConflict,
    loadExternalSession,
    keepCurrentSession,
    pricingProfile,
  } = useMealSession(pricingProfiles.profiles, customFoods.foods);

  const { stage, showReport, showBuilder } = useStageHistory({
    ready: hydrated,
    canShowReport: report.lines.length > 0,
  });

  const [resetOpen, setResetOpen] = useState(false);
  const [activeDinerId, setActiveDinerId] = useState<string | null>(null);
  const [status, announce] = useStatusMessage();

  const reportRef = useRef<HTMLDivElement>(null);
  const builderRef = useRef<HTMLDivElement>(null);

  const handleAdd = useCallback(
    (payload: AddItemPayload, confirmation: string) => {
      addItem(payload);
      announce(confirmation);
    },
    [addItem, announce],
  );

  const handleRemove = useUndoableRemove({
    items: session.items,
    removeItem,
    restoreItem,
    announce,
    location: 'your tab',
  });

  // Moves the viewport and focus to whichever stage was just revealed. Running
  // as an effect guarantees the target is mounted, and skips the first render
  // so an ordinary page load is not scrolled.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (stage === 'report') {
      reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      reportRef.current?.focus({ preventScroll: true });
    } else {
      builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [stage]);

  const handleCalculate = useCallback(() => {
    if (report.lines.length === 0) {
      return;
    }
    showReport();
  }, [report.lines.length, showReport]);

  const handleEditMeal = useCallback(() => {
    showBuilder();
  }, [showBuilder]);

  // From the report the brand acts as a way back; from the builder it behaves
  // like an ordinary home link and returns to the top. Neither touches session data.
  const handleBrandClick = useCallback(() => {
    if (stage === 'report') {
      showBuilder();
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [stage, showBuilder]);

  const handleConfirmReset = useCallback(() => {
    resetSession();
    setResetOpen(false);
    showBuilder();
    announce('Session reset. The buffet remembers nothing.');
  }, [resetSession, showBuilder, announce]);

  const handleRemovePricingProfile = useCallback(
    (id: string) => {
      pricingProfiles.remove(id);
      if (session.pricingProfileId === id) {
        setPricingProfile(DEFAULT_PRICING_PROFILE_ID);
        announce('The removed profile was active, so Australian estimates are back on this table.');
      }
    },
    [pricingProfiles, session.pricingProfileId, setPricingProfile, announce],
  );

  const selectedDinerId =
    activeDinerId && session.diners?.some((diner) => diner.id === activeDinerId)
      ? activeDinerId
      : null;

  return (
    <PricingProfileProvider profile={pricingProfile}>
      <>
        <SiteHeader
          onBrandClick={handleBrandClick}
          brandActionLabel={
            stage === 'report' ? 'Back to the meal builder' : 'Back to the top of the page'
          }
        />

        <main id={MAIN_CONTENT_ID} className="relative z-10">
          {stage === 'builder' && <Hero />}

          <div className="mx-auto max-w-[1280px] px-4 pb-32 pt-6 sm:px-6 lg:pb-16">
            {sessionConflict && (
              <div className="mb-4">
                <SessionConflictNotice
                  conflict={sessionConflict}
                  onLoadExternal={loadExternalSession}
                  onKeepCurrent={keepCurrentSession}
                />
              </div>
            )}
            {stage === 'report' ? (
              <div ref={reportRef} tabIndex={-1} className="outline-none">
                <DamageReport
                  report={report}
                  session={session}
                  onEditMeal={handleEditMeal}
                  onStatus={announce}
                />
              </div>
            ) : (
              <div
                ref={builderRef}
                className="grid items-start gap-4 lg:grid-cols-[1fr_380px] lg:gap-6"
              >
                <div className="space-y-4 lg:space-y-6">
                  <SessionSetup
                    session={session}
                    totalAdmission={report.totalAdmission}
                    onRestaurantNameChange={setRestaurantName}
                    onPricePerDinerChange={setPricePerDiner}
                    onPricingProfileChange={setPricingProfile}
                    pricingProfiles={pricingProfiles.profiles}
                    onSavePricingProfile={pricingProfiles.save}
                    onRemovePricingProfile={handleRemovePricingProfile}
                    customFoods={customFoods.foods}
                    onSaveCustomFood={customFoods.save}
                    onRemoveCustomFood={customFoods.remove}
                    onDinerCountChange={adjustDinerCount}
                    onApplySetup={applySetup}
                    regularDiners={regularDiners.diners}
                    onAddDiner={addDiner}
                    onRenameDiner={renameDiner}
                    onDinerAdmissionPriceChange={setDinerAdmissionPrice}
                    onRemoveDiner={removeDiner}
                    onMoveDiner={moveDiner}
                    onClearDiners={clearDiners}
                    onSaveRegularDiner={regularDiners.save}
                    onStatus={announce}
                  />
                  <MealBuilder
                    onAdd={handleAdd}
                    customFoods={customFoods.foods}
                    diners={session.diners ?? []}
                    activeDinerId={selectedDinerId}
                    onActiveDinerChange={setActiveDinerId}
                  />
                </div>

                <div className="lg:sticky lg:top-[4.5rem]">
                  <LiveSummary
                    report={report}
                    onIncrement={incrementItem}
                    onDecrement={decrementItem}
                    onRemove={handleRemove}
                    onCalculate={handleCalculate}
                    onReset={() => setResetOpen(true)}
                  />
                </div>
              </div>
            )}
          </div>
        </main>

        {/* The sticky summary bar overlays the foot of the page on small screens,
          so the footer reserves room for it there. */}
        <SiteFooter className="pb-24 lg:pb-8">
          Estimates only. Prices, portions and nutrition vary by supplier, restaurant and
          preparation. Estimated ingredient margin is not restaurant profit.
        </SiteFooter>

        {stage === 'builder' && <StickySummaryBar report={report} onCalculate={handleCalculate} />}

        <StatusToast message={status} offset={stage === 'builder' && report.lines.length > 0} />

        <ConfirmDialog
          open={resetOpen}
          title="Reset session?"
          body="This clears the restaurant name, entry price, diners and every plate on your tab. It cannot be undone."
          confirmLabel="Reset everything"
          onConfirm={handleConfirmReset}
          onCancel={() => setResetOpen(false)}
        />
      </>
    </PricingProfileProvider>
  );
}
