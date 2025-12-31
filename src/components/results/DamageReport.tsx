'use client';

import { useMemo } from 'react';
import { PencilLine } from 'lucide-react';
import { ResultCard } from '@/components/results/ResultCard';
import { ResultMetric } from '@/components/results/ResultMetric';
import { ShareActions } from '@/components/results/ShareActions';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { buildResultCardModel } from '@/lib/resultCard';
import {
  formatCalories,
  formatGrams,
  formatKg,
  formatLb,
  formatMoney,
  formatPercent,
  formatPlates,
  formatSignedMoney,
} from '@/lib/formatting';
import { getHouseStatus, getVerdict } from '@/lib/verdicts';
import type { DamageReport as DamageReportTotals } from '@/types/meal';

interface DamageReportProps {
  report: DamageReportTotals;
  restaurantName: string;
  onEditMeal: () => void;
  onStatus: (message: string) => void;
}

const SEVERITY_TONE = {
  calm: 'text-cream-500',
  normal: 'text-cream-300',
  watch: 'text-ember-400',
  alert: 'text-ember-300',
  breach: 'text-char-500',
} as const;

export function DamageReport({ report, restaurantName, onEditMeal, onStatus }: DamageReportProps) {
  const verdict = useMemo(
    () => getVerdict(report.totalRetailValue, report.totalAdmission),
    [report.totalRetailValue, report.totalAdmission],
  );

  const houseStatus = useMemo(
    () => getHouseStatus(report.totalRestaurantCost, report.totalAdmission),
    [report.totalRestaurantCost, report.totalAdmission],
  );

  const cardModel = useMemo(
    () => buildResultCardModel(report, verdict, restaurantName),
    [report, verdict, restaurantName],
  );

  const extracted = report.retailValueDifference >= 0;

  return (
    <div className="animate-fade-up space-y-6">
      {/* 1 — Verdict */}
      <section aria-labelledby="report-heading" className="panel overflow-hidden">
        <div className="grill-texture border-b border-line px-5 py-4 text-center">
          <h2 id="report-heading" className="micro-label !text-ember-400">
            AYCE Damage Report
          </h2>
          {restaurantName && (
            <p className="mt-1 break-words text-sm text-cream-300">{restaurantName}</p>
          )}
        </div>

        <div className="px-5 py-8 text-center sm:py-10">
          <p
            className={cn(
              'display-type text-[2.5rem] leading-[0.92] sm:text-6xl',
              verdict.tone === 'diner'
                ? 'text-sesame-400'
                : verdict.tone === 'even'
                  ? 'text-ember-400'
                  : 'text-cream-50',
            )}
          >
            {verdict.title}
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-cream-300 sm:text-base">
            {verdict.copy}
          </p>
        </div>
      </section>

      {/* 2 — Retail value against admission */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ResultMetric
          label="Est. retail value"
          value={formatMoney(report.totalRetailValue)}
          detail="What a similar quantity might cost at retail."
          emphasis="major"
          tone="accent"
        />
        <ResultMetric
          label="Admission"
          value={formatMoney(report.totalAdmission)}
          detail="What the table paid to walk in."
          emphasis="major"
        />
        <ResultMetric
          label={extracted ? 'Value extracted' : 'Value gap'}
          value={formatSignedMoney(report.retailValueDifference)}
          detail="Estimated retail value minus admission."
          tone={extracted ? 'positive' : 'negative'}
        />
        <ResultMetric
          label="Retail value recovered"
          value={formatPercent(report.retailRecoveryPercent)}
          detail="Retail comparison only — not restaurant profitability."
          tone="accent"
        />
      </div>

      {/* 3 — Volume */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ResultMetric label="Total plates" value={formatPlates(report.totalPlates)} />
        <ResultMetric
          label="Food consumed"
          value={formatKg(report.totalWeightKg)}
          detail={formatLb(report.totalWeightLb)}
        />
      </div>

      {/* 4 — Nutrition */}
      <section aria-labelledby="nutrition-heading">
        <h3 id="nutrition-heading" className="micro-label mb-2">
          Approximate nutrition
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ResultMetric label="Calories" value={formatCalories(report.nutrition.calories)} />
          <ResultMetric label="Protein" value={formatGrams(report.nutrition.protein)} />
          <ResultMetric label="Fat" value={formatGrams(report.nutrition.fat)} />
          <ResultMetric label="Carbohydrates" value={formatGrams(report.nutrition.carbs)} />
        </div>
      </section>

      {/* 5 — The house side of the ledger */}
      <section aria-labelledby="house-heading" className="panel p-4 sm:p-5">
        <h3 id="house-heading" className="micro-label mb-3">
          The house side of the ledger
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <ResultMetric
            label="Est. ingredient cost"
            value={formatMoney(report.totalRestaurantCost)}
            detail="What the restaurant may have spent on the raw ingredient."
          />
          <ResultMetric
            label="Est. ingredient margin"
            value={formatMoney(report.estimatedIngredientMargin)}
            detail="Before rent, wages, utilities, tax, waste, sides and overhead."
          />
        </div>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-[10px] border border-line-soft bg-ash-900 px-4 py-3">
          <div>
            <p className="micro-label">Est. food cost</p>
            <p className={cn('mt-0.5 text-sm font-semibold', SEVERITY_TONE[houseStatus.severity])}>
              {houseStatus.label}
            </p>
          </div>
          <p className="tabular display-type text-3xl text-cream-100">
            {formatPercent(report.estimatedFoodCostPercent)}{' '}
            <span className="text-sm text-cream-700">of admission</span>
          </p>
        </div>
      </section>

      {/* Shareable card + actions */}
      <section aria-labelledby="share-heading" className="panel p-4 sm:p-5">
        <h3 id="share-heading" className="micro-label mb-4">
          Share the damage
        </h3>
        <div className="flex justify-center overflow-x-auto pb-1">
          <ResultCard model={cardModel} />
        </div>
        <div className="mt-4">
          <ShareActions
            report={report}
            verdict={verdict}
            restaurantName={restaurantName}
            cardModel={cardModel}
            onStatus={onStatus}
          />
        </div>
      </section>

      <Button variant="secondary" size="lg" fullWidth onClick={onEditMeal}>
        <PencilLine size={18} aria-hidden="true" />
        Edit meal
      </Button>
    </div>
  );
}
