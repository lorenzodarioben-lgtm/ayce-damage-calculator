'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { MealBuilder } from '@/components/meal/MealBuilder';
import { Methodology } from '@/components/methodology/Methodology';
import { DamageReport } from '@/components/results/DamageReport';
import { SessionSetup } from '@/components/session/SessionSetup';
import { LiveSummary } from '@/components/summary/LiveSummary';
import { StickySummaryBar } from '@/components/summary/StickySummaryBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusToast } from '@/components/ui/StatusToast';
import { useMealSession, type AddItemPayload } from '@/hooks/useMealSession';
import { useStatusMessage } from '@/hooks/useStatusMessage';

type Stage = 'builder' | 'report';

export function CalculatorApp() {
  const {
    session,
    report,
    setRestaurantName,
    setPricePerDiner,
    adjustDinerCount,
    addItem,
    incrementItem,
    decrementItem,
    removeItem,
    resetSession,
  } = useMealSession();

  const [stage, setStage] = useState<Stage>('builder');
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
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
    setStage('report');
  }, [report.lines.length]);

  const handleEditMeal = useCallback(() => {
    setStage('builder');
  }, []);

  // From the report the brand acts as a way back; from the builder it behaves
  // like an ordinary home link and returns to the top. Neither touches session data.
  const handleBrandClick = useCallback(() => {
    if (stage === 'report') {
      setStage('builder');
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [stage]);

  const handleConfirmReset = useCallback(() => {
    resetSession();
    setResetOpen(false);
    setStage('builder');
    announce('Session reset. The buffet remembers nothing.');
  }, [resetSession, announce]);

  return (
    <>
      <Header
        onBrandClick={handleBrandClick}
        brandActionLabel={
          stage === 'report' ? 'Back to the meal builder' : 'Back to the top of the page'
        }
        onOpenMethodology={() => setMethodologyOpen(true)}
      />

      <main className="relative z-10">
        {stage === 'builder' && <Hero />}

        <div className="mx-auto max-w-[1280px] px-4 pb-32 pt-6 sm:px-6 lg:pb-16">
          {stage === 'report' ? (
            <div ref={reportRef} tabIndex={-1} className="outline-none">
              <DamageReport
                report={report}
                restaurantName={session.restaurantName}
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
                  onDinerCountChange={adjustDinerCount}
                />
                <MealBuilder onAdd={handleAdd} />
              </div>

              <div className="lg:sticky lg:top-[4.5rem]">
                <LiveSummary
                  report={report}
                  onIncrement={incrementItem}
                  onDecrement={decrementItem}
                  onRemove={removeItem}
                  onCalculate={handleCalculate}
                  onReset={() => setResetOpen(true)}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="relative z-10 border-t border-line px-4 pb-24 pt-6 sm:px-6 lg:pb-8">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3">
          <p className="max-w-[52ch] text-xs leading-relaxed text-cream-700">
            Estimates only. Prices, portions and nutrition vary by supplier, restaurant and
            preparation. Estimated ingredient margin is not restaurant profit.
          </p>
          <button
            type="button"
            onClick={() => setMethodologyOpen(true)}
            className="min-h-11 cursor-pointer px-1 text-xs font-semibold uppercase tracking-[0.1em] text-ember-500 underline-offset-4 hover:underline"
          >
            How we calculate it
          </button>
        </div>
      </footer>

      {stage === 'builder' && <StickySummaryBar report={report} onCalculate={handleCalculate} />}

      <StatusToast message={status} offset={stage === 'builder' && report.lines.length > 0} />

      <Methodology open={methodologyOpen} onClose={() => setMethodologyOpen(false)} />

      <ConfirmDialog
        open={resetOpen}
        title="Reset session?"
        body="This clears the restaurant name, entry price, diners and every plate on your tab. It cannot be undone."
        confirmLabel="Reset everything"
        onConfirm={handleConfirmReset}
        onCancel={() => setResetOpen(false)}
      />
    </>
  );
}
