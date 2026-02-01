'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, PencilLine, Printer } from 'lucide-react';
import { UncertaintyPanel } from '@/components/methodology/UncertaintyPanel';
import { AchievementList } from '@/components/results/AchievementList';
import { DamageReceipt } from '@/components/results/DamageReceipt';
import { MealBreakdown } from '@/components/results/MealBreakdown';
import { ReportSummary } from '@/components/results/ReportSummary';
import { ResultCard } from '@/components/results/ResultCard';
import { TableBreakdown } from '@/components/results/TableBreakdown';
import { SaveToHistory } from '@/components/results/SaveToHistory';
import { ShareActions } from '@/components/results/ShareActions';
import { Button } from '@/components/ui/Button';
import { evaluateAchievements } from '@/lib/achievements';
import { useCustomFoods } from '@/hooks/useCustomFoods';
import { foodCatalogue } from '@/lib/foodCatalogue';
import { buildResultCardModel } from '@/lib/resultCard';
import { getVerdict } from '@/lib/verdicts';
import type { DamageReport as DamageReportTotals, MealSession } from '@/types/meal';

interface DamageReportProps {
  report: DamageReportTotals;
  /** The canonical meal, needed to file the result into history. */
  session: MealSession;
  onEditMeal: () => void;
  onStatus: (message: string) => void;
}

export function DamageReport({ report, session, onEditMeal, onStatus }: DamageReportProps) {
  const restaurantName = session.restaurantName;
  const customFoods = useCustomFoods();
  const catalogue = useMemo(() => foodCatalogue(customFoods.foods), [customFoods.foods]);

  const verdict = useMemo(
    () => getVerdict(report.totalRetailValue, report.totalAdmission),
    [report.totalRetailValue, report.totalAdmission],
  );

  const cardModel = useMemo(
    () => buildResultCardModel(report, verdict, restaurantName),
    [report, verdict, restaurantName],
  );

  const achievements = useMemo(
    () => evaluateAchievements(report, session.dinerCount),
    [report, session.dinerCount],
  );

  // Fixed when the report opens, so the printed docket carries the time the
  // meal was assessed rather than the time the paper came out. Safe to read the
  // clock here: the report is only ever reached on the client.
  const [issuedAt] = useState(() => new Date().toISOString());

  return (
    <div className="animate-fade-up space-y-6">
      {/* Escape hatch. The same action exists at the foot of the report, but the
          report is long enough that a bottom-only control reads as a dead end. */}
      <button
        type="button"
        onClick={onEditMeal}
        className="-ml-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[10px] px-2 text-xs font-semibold uppercase tracking-[0.1em] text-cream-500 transition-colors duration-200 hover:bg-ash-850 hover:text-cream-100"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to meal
      </button>

      <ReportSummary
        report={report}
        verdict={verdict}
        restaurantName={restaurantName}
        heading="AYCE Damage Report"
        headingId="report-heading"
        // The hero, and its h1, is gone once the report is showing.
        headingLevel={1}
      />

      <MealBreakdown lines={report.lines} headingId="breakdown-heading" heading="What you ate" />

      <TableBreakdown session={session} report={report} />

      <AchievementList achievements={achievements} headingId="achievements-heading" />

      {/* The point estimate above stays the report's answer. This is for the
          reader who wants to know how much it depends on assumptions. */}
      <UncertaintyPanel
        items={session.items}
        pricePerDiner={session.pricePerDiner}
        dinerCount={session.dinerCount}
        diners={session.diners}
        adjustments={session.adjustments}
        foods={catalogue}
        headingId="uncertainty-heading"
      />

      {/* Shareable card + actions */}
      <section aria-labelledby="share-heading" className="panel p-4 sm:p-5">
        <h3 id="share-heading" className="micro-label mb-4">
          Share the damage
        </h3>
        <div className="flex justify-center overflow-x-auto pb-1">
          <ResultCard model={cardModel} />
        </div>
        <div className="mt-4 space-y-2">
          <ShareActions
            report={report}
            verdict={verdict}
            session={session}
            cardModel={cardModel}
            onStatus={onStatus}
          />
          <SaveToHistory session={session} report={report} verdict={verdict} />
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" size="lg" fullWidth onClick={onEditMeal}>
          <PencilLine size={18} aria-hidden="true" />
          Edit meal
        </Button>
        <Button variant="secondary" size="lg" fullWidth onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" />
          Print damage receipt
        </Button>
      </div>

      {/* Present in the DOM but only painted by the print stylesheet. */}
      <DamageReceipt
        report={report}
        session={session}
        verdict={verdict}
        achievements={achievements}
        issuedAt={issuedAt}
      />
    </div>
  );
}
